import { dateLocale, num, t as tr } from '@/i18n';
import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScreenHeader } from '@/components/ScreenHeader';
import { TrendChart } from '@/components/TrendChart';
import { RangeId, rangeDays } from '@/components/MetricDetailParts';
import { FRow, Pill, SecHead } from '@/components/fine/Fine';
import { BigFigure, FineGlyph, FineLink, FineRangeTabs, measureStyles } from '@/components/fine/FineMeasure';
import { DailyPoint, formatClock, formatSleep, shortDate, sinceDay, sleepNights, useDailyWearables, weeklyAverages, weeklyNights } from '@/wearables/dailySeries';
import { SleepNightsCard } from '@/components/SleepNightsCard';
import { WearableMetric } from '@/wearables/types';
import { thermometerRepository } from '@/data/temperatureRepository';
import { useReloadOnFocus } from '@/hooks/useReloadOnFocus';
import { SimpleMetricEntry } from '@/types/simpleMetric';
import { FINE, ff, fine } from '@/theme/fine';

// Información orientativa por métrica (texto de bienestar, no diagnóstico).
// Pendiente de revisión médica antes de usuarios reales.
// `figure`: la cifra grande sin la unidad (la unidad va al lado, apagada); `format`, la cifra con su unidad.
// `color`: el de la curva, en los tonos del prototipo (jade casi siempre; oro el sueño, turquesa las calorías).
interface MetricInfo {
  title: string;
  unit: string;
  color: string;
  higherIsBetter: boolean | null;
  figure: (v: number) => string;
  format: (v: number) => string;
  what: string;
  typical: string;
  affects: string;
  band?: { low: number; high: number };
}

const TURQUOISE = '#5CC7C9';

const INFO: Partial<Record<WearableMetric, MetricInfo>> = {
  resting_heart_rate: {
    title: 'Resting heart rate',
    unit: 'bpm',
    color: FINE.jade,
    higherIsBetter: false,
    figure: (v) => String(Math.round(v)),
    format: (v) => `${Math.round(v)} bpm`,
    what: 'How many times your heart beats per minute when you are fully at rest, usually measured during sleep.',
    typical: 'Most adults sit between 50 and 80 bpm. Fitter people tend to be lower. What matters most is your own trend.',
    affects: 'A few beats above your usual can mean poor sleep, alcohol, stress, dehydration or an incoming cold.',
    band: { low: 50, high: 80 },
  },
  hrv: {
    title: 'Heart rate variability',
    unit: 'ms',
    color: FINE.jade,
    higherIsBetter: true,
    figure: (v) => String(Math.round(v)),
    format: (v) => `${Math.round(v)} ms`,
    what: 'The small variation in time between heartbeats (RMSSD). It reflects how rested and recovered your nervous system is.',
    typical: 'Very individual: from 20 to over 100 ms. Compare yourself with your own average, not with others.',
    affects: 'Drops with stress, short sleep, alcohol, illness and hard training; rises with rest, regular sleep and fitness.',
  },
  sleep_duration: {
    title: 'Sleep',
    unit: '',
    color: FINE.gold,
    higherIsBetter: true,
    figure: (v) => formatSleep(v),
    format: (v) => formatSleep(v),
    what: 'Total time asleep each night, as estimated by your wearable.',
    typical: 'Adults need 7 to 9 hours. Regular bed and wake times matter as much as the total.',
    affects: 'Screens late at night, caffeine after lunch, alcohol and irregular schedules shorten and fragment sleep.',
    band: { low: 420, high: 540 },
  },
  steps: {
    title: 'Steps',
    unit: 'steps',
    color: FINE.jade,
    higherIsBetter: true,
    figure: (v) => Math.round(v).toLocaleString(dateLocale()),
    format: (v) => Math.round(v).toLocaleString(dateLocale()),
    what: 'Total steps per day counted by your phone or wearable.',
    typical: 'Health benefits grow up to around 8,000-10,000 steps a day. Any increase from your baseline helps.',
    affects: 'Short walks after meals, taking calls on foot and stairs add up quickly.',
    band: { low: 8000, high: 12000 },
  },
  active_energy: {
    title: 'Active calories',
    unit: 'kcal',
    color: TURQUOISE,
    higherIsBetter: true,
    figure: (v) => String(Math.round(v)),
    format: (v) => `${Math.round(v)} kcal`,
    what: 'Energy burned through movement and exercise, on top of what your body uses at rest.',
    typical: 'Depends on body size and activity: 300-600 kcal is a common range for active adults.',
    affects: 'Training intensity, daily steps and body weight. Wearable estimates can be off by 20% or more.',
  },
  // Distancia (desde Hoy, «Tus objetivos del día», 2026-11-17): llega en metros; se enseña en km con la coma del idioma
  distance: {
    title: 'Distance',
    unit: 'km',
    color: FINE.jade,
    higherIsBetter: true,
    figure: (v) => num((v / 1000).toFixed(1)),
    format: (v) => `${num((v / 1000).toFixed(1))} km`,
    what: 'Distance walked or run each day, as estimated by your phone or wearable.',
    typical: 'Around 6-8 km a day is roughly 8,000-10,000 steps; it depends on stride length.',
    affects: 'Walks and runs. Phone estimates depend on stride length and on where you carry it.',
  },
  body_temperature: {
    title: 'Body temperature',
    unit: '°C',
    color: FINE.jade,
    higherIsBetter: null,
    // Con la coma decimal del idioma, como el peso y el agua (fundador, 2026-11-17: «sé coherente entre comas y puntos»)
    figure: (v) => num(v.toFixed(1)),
    format: (v) => `${num(v.toFixed(1))} °C`,
    what: 'Skin or body temperature measured by your wearable, usually overnight.',
    typical: 'Around 36.1-37.2 °C. Wearables track changes from your baseline better than absolute values.',
    affects: 'Rises with illness, alcohol, a hot room and, in women, after ovulation (luteal phase).',
    band: { low: 36.1, high: 37.2 },
  },
};

// El color y la franja de la curva de cada medición del reloj, para que las gráficas pequeñas de Mediciones («Ver
// todas») sean la misma línea que esta ficha (fundador, 2026-11-17: «el detalle de pasos está bien; pero en la
// sección "Mediciones" no me gusta»)
export const metricLine = (kind: WearableMetric) => ({ color: INFO[kind]?.color ?? FINE.jade, band: INFO[kind]?.band });

// Las cifras del eje: pasos en miles, sueño en horas y distancia en km, con la coma decimal del idioma
export const metricAxis = (kind: WearableMetric): ((v: number) => string) | undefined =>
  kind === 'sleep_duration'
    ? (v) => `${num((v / 60).toFixed(1))} h`
    : kind === 'steps'
      ? (v) => `${num((v / 1000).toFixed(1))}k`
      : kind === 'body_temperature'
        ? (v) => num(v.toFixed(1))
        : kind === 'distance'
          ? (v) => num((v / 1000).toFixed(1))
          : undefined;

// Los periodos van por fecha (los últimos 7, 14, 30 o 182 días de calendario, hoy incluido), no por
// número de registros. En 6M, por semanas de calendario (weeklyAverages): 180 puntos diarios no se
// leen en una gráfica de móvil.
// Desde el 2026-11-16, como la ficha de una medición del prototipo y SimpleMetricDetailScreen (el fundador: los
// iconos de estas fichas «se ven un poco bastos»): sin el icono en círculo de color, la última cifra grande y
// ligera con la unidad y la fecha al lado, los periodos en pestañas con borde, la curva sin tarjeta, «En números»
// en filas con línea fina, la tendencia con una flecha a línea y lo demás en secciones pequeñas sin tarjetas.

export const MetricDetailScreen = () => {
  const router = useRouter();
  const { kind } = useLocalSearchParams<{ kind: WearableMetric }>();
  const info = INFO[kind as WearableMetric] ?? INFO.steps!;
  const { series, isSample } = useDailyWearables(182);
  const [range, setRange] = useState<RangeId>('14D');
  const days = rangeDays(range);
  const all = series[kind as WearableMetric] ?? [];
  const since = sinceDay(days);
  const daily = all.filter((p) => p.date >= since);
  // Por semanas solo si los datos abarcan más de un mes; si no (p. ej. un reloj conectado hace poco),
  // también en 6M día a día: una o dos medias semanales no dicen nada
  const spanDays = daily.length ? (Date.parse(daily[daily.length - 1].date) - Date.parse(daily[0].date)) / 86400000 : 0;
  const byWeek = days > 31 && spanDays > 31;
  const points = byWeek ? weeklyAverages(daily) : daily;
  const values = points.map((p) => p.value);
  const avg = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  // La cifra grande: el último día que hay (no la media de la última semana en 6M)
  const latest: DailyPoint | undefined = all[all.length - 1];
  const recent = all.filter((p) => p.date >= sinceDay(7)).map((p) => p.value);
  const previous = all.filter((p) => p.date >= sinceDay(14) && p.date < sinceDay(7)).map((p) => p.value);
  const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
  const change = previous.length ? (mean(recent) - mean(previous)) / mean(previous) : NaN;
  const trendGood = info.higherIsBetter === null ? null : info.higherIsBetter ? change > 0 : change < 0;

  // Sueño: fases y horas de cada noche del periodo
  const dailyNights = kind === 'sleep_duration' ? sleepNights(series).filter((n) => n.date >= since) : [];
  const nights = byWeek ? weeklyNights(dailyNights) : dailyNights;
  const nightOf = new Map(nights.map((n) => [n.date, n]));

  // Lecturas con termómetro (solo en la temperatura)
  // (con lo último leído, al momento; la red lo refresca detrás)
  const [thermo, setThermo] = useState<SimpleMetricEntry[]>(() =>
    kind === 'body_temperature' ? [...(thermometerRepository.peek() ?? [])].sort((a, b) => b.fecha.localeCompare(a.fecha)) : [],
  );
  useReloadOnFocus(
    useCallback(async () => {
      if (kind !== 'body_temperature') return;
      const all = await thermometerRepository.getAll().catch(() => []);
      setThermo([...all].sort((a, b) => b.fecha.localeCompare(a.fecha)));
    }, [kind])
  );

  const chartScale = metricAxis(kind as WearableMetric);
  const thermoShown = thermo.slice(0, 5);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader title={tr(info.title)} showBack />

        <View style={styles.body}>
          {/* La última cifra, grande y ligera; al lado, la unidad y de qué día es */}
          <BigFigure
            value={latest ? info.figure(latest.value) : '—'}
            lines={
              latest
                ? [
                    info.unit && tr(info.unit),
                    `${tr('Latest value')} · ${new Date(`${latest.date}T12:00:00`).toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short' })}`,
                    isSample && tr('sample data'),
                  ]
                : [tr('Latest value'), isSample && tr('sample data')]
            }
          />

          <FineRangeTabs value={range} onChange={setRange} />
          <View style={styles.chart}>
            <TrendChart
              height={150}
              labels={points.map((p) => shortDate(p.date))}
              series={[{ color: info.color, values }]}
              band={info.band}
              formatY={chartScale}
              formatValue={info.format}
            />
          </View>
          <Text style={styles.tapHint}>
            {byWeek ? tr('Weekly averages · tap the chart to see each week') : tr('Tap the chart to see each day')}
          </Text>

          <SecHead title={tr('In numbers')} />
          <FRow title={tr('Average')} value={values.length ? info.format(avg) : '—'} />
          <FRow title={tr('Lowest')} value={values.length ? info.format(Math.min(...values)) : '—'} />
          <FRow title={tr('Highest')} value={values.length ? info.format(Math.max(...values)) : '—'} last />
          {!Number.isNaN(change) && (
            <View style={styles.trend}>
              <FineGlyph
                name={change >= 0 ? 'up' : 'down'}
                size={16}
                color={trendGood === null ? FINE.mute : trendGood ? FINE.jade : FINE.gold}
              />
              <Text style={styles.trendText}>
                {tr(change >= 0 ? 'Last 7 days up {n}% vs the previous 7' : 'Last 7 days down {n}% vs the previous 7', { n: Math.abs(change * 100).toFixed(0) })}
              </Text>
            </View>
          )}

          {/* Temperatura: «Añadir una medición del termómetro» en píldora esmeralda y las últimas en filas */}
          {kind === 'body_temperature' && (
            <>
              <View style={styles.add}>
                <Pill label={tr('Add a thermometer reading')} onPress={() => router.push({ pathname: '/log-temperature', params: { mode: 'thermometer' } })} />
              </View>
              {thermoShown.length > 0 && (
                <>
                  <SecHead title={tr('Your thermometer readings')} />
                  {thermoShown.map((e, i) => (
                    <View key={e.id} style={[fine.row, i === thermoShown.length - 1 && styles.lastRow]}>
                      <Text style={styles.listDate}>
                        {new Date(e.fecha).toLocaleString(dateLocale(), { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </Text>
                      <Text style={[fine.rowValue, e.valor >= 38 && { color: FINE.gold }]}>{num(e.valor.toFixed(1))} °C</Text>
                    </View>
                  ))}
                </>
              )}
            </>
          )}

          {kind === 'sleep_duration' && <SleepNightsCard key={range} nights={nights} weekly={byWeek} />}

          <SecHead title={tr('What it is')} />
          <Text style={measureStyles.p}>{tr(info.what)}</Text>
          <SecHead title={tr('Typical range')} style={styles.infoHead} />
          <Text style={measureStyles.p}>{tr(info.typical)}</Text>
          <SecHead title={tr('What affects it')} style={styles.infoHead} />
          <Text style={measureStyles.p}>{tr(info.affects)}</Text>
          <Text style={fine.note}>{tr('General information, not a diagnosis.')}</Text>

          <SecHead title={byWeek ? tr('Weekly averages') : tr('Daily values')} />
          {[...points].reverse().map((p, i, list) => {
            const night = byWeek ? undefined : nightOf.get(p.date);
            return (
              <View key={p.date} style={[fine.row, i === list.length - 1 && styles.lastRow]}>
                <Text style={styles.listDate}>
                  {byWeek ? tr('Week of ') : ''}
                  {new Date(`${p.date}T12:00:00`).toLocaleDateString(
                    dateLocale(),
                    byWeek ? { day: 'numeric', month: 'short' } : { weekday: 'short', day: 'numeric', month: 'short' },
                  )}
                </Text>
                <Text style={fine.rowValue}>
                  {night?.start != null && night.end != null && (
                    <Text style={styles.listTimes}>{`${formatClock(night.start)}–${formatClock(night.end)}  `}</Text>
                  )}
                  {info.format(p.value)}
                </Text>
              </View>
            );
          })}

          <FineLink label={tr('Manage connected devices')} onPress={() => router.push('/wearables')} style={styles.manage} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: 'transparent' },
  content: { paddingBottom: 32 },
  body: { paddingHorizontal: 20 },
  chart: { marginTop: 14 },
  tapHint: { ...fine.note, textAlign: 'center', marginTop: 6 },
  trend: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  trendText: { ...ff('regular'), flex: 1, color: FINE.mute, fontSize: 12.5, lineHeight: 18 },
  add: { alignItems: 'center', marginTop: 22 },
  infoHead: { marginTop: 16 },
  lastRow: { borderBottomWidth: 0 },
  listDate: { ...ff('regular'), flex: 1, color: FINE.mute, fontSize: 13.5 },
  listTimes: { ...ff('regular'), color: FINE.mute, fontSize: 12.5 },
  manage: { marginTop: 18 },
});

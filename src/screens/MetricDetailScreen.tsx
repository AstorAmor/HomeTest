import { dateLocale, t as tr } from '@/i18n';
import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScreenHeader } from '@/components/ScreenHeader';
import { TrendChart } from '@/components/TrendChart';
import { MetricHero, RangeId, rangeDays, RangeTabs, StatsRow } from '@/components/MetricDetailParts';
import { Colors } from '@/constants/colors';
import { DailyPoint, formatClock, formatSleep, shortDate, sinceDay, sleepNights, useDailyWearables, weeklyAverages, weeklyNights } from '@/wearables/dailySeries';
import { SleepNightsCard } from '@/components/SleepNightsCard';
import { WearableMetric } from '@/wearables/types';
import { thermometerRepository } from '@/data/temperatureRepository';
import { useReloadOnFocus } from '@/hooks/useReloadOnFocus';
import { SimpleMetricEntry } from '@/types/simpleMetric';

// Información orientativa por métrica (texto de bienestar, no diagnóstico).
// Pendiente de revisión médica antes de usuarios reales.
interface MetricInfo {
  title: string;
  unit: string;
  icon: string;
  color: string;
  higherIsBetter: boolean | null;
  format: (v: number) => string;
  what: string;
  typical: string;
  affects: string;
  band?: { low: number; high: number };
}

const INFO: Partial<Record<WearableMetric, MetricInfo>> = {
  resting_heart_rate: {
    title: 'Resting heart rate',
    unit: 'bpm',
    icon: 'heart',
    color: Colors.coral,
    higherIsBetter: false,
    format: (v) => `${Math.round(v)} bpm`,
    what: 'How many times your heart beats per minute when you are fully at rest, usually measured during sleep.',
    typical: 'Most adults sit between 50 and 80 bpm. Fitter people tend to be lower. What matters most is your own trend.',
    affects: 'A few beats above your usual can mean poor sleep, alcohol, stress, dehydration or an incoming cold.',
    band: { low: 50, high: 80 },
  },
  hrv: {
    title: 'Heart rate variability',
    unit: 'ms',
    icon: 'pulse',
    color: Colors.accent,
    higherIsBetter: true,
    format: (v) => `${Math.round(v)} ms`,
    what: 'The small variation in time between heartbeats (RMSSD). It reflects how rested and recovered your nervous system is.',
    typical: 'Very individual: from 20 to over 100 ms. Compare yourself with your own average, not with others.',
    affects: 'Drops with stress, short sleep, alcohol, illness and hard training; rises with rest, regular sleep and fitness.',
  },
  sleep_duration: {
    title: 'Sleep',
    unit: 'h',
    icon: 'moon',
    color: Colors.violet,
    higherIsBetter: true,
    format: (v) => formatSleep(v),
    what: 'Total time asleep each night, as estimated by your wearable.',
    typical: 'Adults need 7 to 9 hours. Regular bed and wake times matter as much as the total.',
    affects: 'Screens late at night, caffeine after lunch, alcohol and irregular schedules shorten and fragment sleep.',
    band: { low: 420, high: 540 },
  },
  steps: {
    title: 'Steps',
    unit: 'steps',
    icon: 'footsteps',
    color: Colors.sky,
    higherIsBetter: true,
    format: (v) => Math.round(v).toLocaleString(dateLocale()),
    what: 'Total steps per day counted by your phone or wearable.',
    typical: 'Health benefits grow up to around 8,000-10,000 steps a day. Any increase from your baseline helps.',
    affects: 'Short walks after meals, taking calls on foot and stairs add up quickly.',
    band: { low: 8000, high: 12000 },
  },
  active_energy: {
    title: 'Active calories',
    unit: 'kcal',
    icon: 'flame',
    color: Colors.amber,
    higherIsBetter: true,
    format: (v) => `${Math.round(v)} kcal`,
    what: 'Energy burned through movement and exercise, on top of what your body uses at rest.',
    typical: 'Depends on body size and activity: 300-600 kcal is a common range for active adults.',
    affects: 'Training intensity, daily steps and body weight. Wearable estimates can be off by 20% or more.',
  },
  body_temperature: {
    title: 'Body temperature',
    unit: '°C',
    icon: 'thermometer',
    color: Colors.pinkSoft,
    higherIsBetter: null,
    format: (v) => `${v.toFixed(1)} °C`,
    what: 'Skin or body temperature measured by your wearable, usually overnight.',
    typical: 'Around 36.1-37.2 °C. Wearables track changes from your baseline better than absolute values.',
    affects: 'Rises with illness, alcohol, a hot room and, in women, after ovulation (luteal phase).',
    band: { low: 36.1, high: 37.2 },
  },
};

// Los periodos van por fecha (los últimos 7, 14, 30 o 182 días de calendario, hoy incluido), no por
// número de registros. En 6M, por semanas de calendario (weeklyAverages): 180 puntos diarios no se
// leen en una gráfica de móvil.

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
  const latestValue = values[values.length - 1];
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
  const [thermo, setThermo] = useState<SimpleMetricEntry[]>([]);
  useReloadOnFocus(
    useCallback(async () => {
      if (kind !== 'body_temperature') return;
      const all = await thermometerRepository.getAll().catch(() => []);
      setThermo([...all].sort((a, b) => b.fecha.localeCompare(a.fecha)));
    }, [kind])
  );

  const chartScale = kind === 'sleep_duration' ? (v: number) => `${(v / 60).toFixed(1)}h` : kind === 'steps' ? (v: number) => `${(v / 1000).toFixed(1)}k` : undefined;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader title={tr(info.title)} showBack />

        <MetricHero
          icon={info.icon}
          color={info.color}
          value={latestValue !== undefined ? info.format(latestValue) : '—'}
          sub={`${tr('Latest value')}${isSample ? ` · ${tr('sample data')}` : ''}`}
        />

        {kind === 'body_temperature' && (
          <>
            <TouchableOpacity
              style={styles.thermoButton}
              onPress={() => router.push({ pathname: '/log-temperature', params: { mode: 'thermometer' } })}
              activeOpacity={0.85}
            >
              <Ionicons name="thermometer-outline" size={20} color={Colors.background} />
              <Text style={styles.thermoText}>{tr('Add a thermometer reading')}</Text>
            </TouchableOpacity>
            {thermo.length > 0 && (
              <View style={styles.thermoList}>
                <Text style={styles.thermoTitle}>{tr('Your thermometer readings')}</Text>
                {thermo.slice(0, 5).map((t) => (
                  <View key={t.id} style={styles.thermoRow}>
                    <Text style={styles.thermoDate}>
                      {new Date(t.fecha).toLocaleString(dateLocale(), { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </Text>
                    <Text style={[styles.thermoValue, t.valor >= 38 && { color: Colors.attention }]}>{t.valor.toFixed(1)} °C</Text>
                  </View>
                ))}
              </View>
            )}
          </>
        )}

        <RangeTabs value={range} onChange={setRange} />

        <View style={styles.card}>
          <TrendChart
            height={150}
            labels={points.map((p) => shortDate(p.date))}
            series={[{ color: info.color, values }]}
            band={info.band}
            formatY={chartScale}
            formatValue={info.format}
          />
          <Text style={styles.tapHint}>
            {byWeek ? tr('Weekly averages · tap the chart to see each week') : tr('Tap the chart to see each day')}
          </Text>
        </View>

        <StatsRow
          items={[
            { label: 'Average', value: values.length ? info.format(avg) : '—' },
            { label: 'Lowest', value: values.length ? info.format(Math.min(...values)) : '—' },
            { label: 'Highest', value: values.length ? info.format(Math.max(...values)) : '—' },
          ]}
        />

        {!Number.isNaN(change) && (
          <View style={styles.trend}>
            <Ionicons
              name={change >= 0 ? 'trending-up' : 'trending-down'}
              size={18}
              color={trendGood === null ? Colors.textSecondary : trendGood ? Colors.accent : Colors.warning}
            />
            <Text style={styles.trendText}>
              {tr(change >= 0 ? 'Last 7 days up {n}% vs the previous 7' : 'Last 7 days down {n}% vs the previous 7', { n: Math.abs(change * 100).toFixed(0) })}
            </Text>
          </View>
        )}

        {kind === 'sleep_duration' && <SleepNightsCard key={range} nights={nights} weekly={byWeek} />}

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>{tr('What it is')}</Text>
          <Text style={styles.infoText}>{tr(info.what)}</Text>
          <Text style={styles.infoTitle}>{tr('Typical range')}</Text>
          <Text style={styles.infoText}>{tr(info.typical)}</Text>
          <Text style={styles.infoTitle}>{tr('What affects it')}</Text>
          <Text style={styles.infoText}>{tr(info.affects)}</Text>
          <Text style={styles.disclaimer}>{tr('General information, not a diagnosis.')}</Text>
        </View>

        <Text style={styles.sectionTitle}>{byWeek ? tr('Weekly averages') : tr('Daily values')}</Text>
        <View style={styles.list}>
          {[...points].reverse().map((p, i) => {
            const night = byWeek ? undefined : nightOf.get(p.date);
            return (
              <View key={p.date} style={[styles.listRow, i > 0 && styles.listDivider]}>
                <Text style={styles.listDate}>
                  {byWeek ? tr('Week of ') : ''}
                  {new Date(`${p.date}T12:00:00`).toLocaleDateString(
                    dateLocale(),
                    byWeek ? { day: 'numeric', month: 'short' } : { weekday: 'short', day: 'numeric', month: 'short' },
                  )}
                </Text>
                <Text style={styles.listValue}>
                  {night?.start != null && night.end != null && (
                    <Text style={styles.listTimes}>{`${formatClock(night.start)}–${formatClock(night.end)}  `}</Text>
                  )}
                  {info.format(p.value)}
                </Text>
              </View>
            );
          })}
        </View>

        <TouchableOpacity style={styles.manage} onPress={() => router.push('/wearables')}>
          <Ionicons name="watch-outline" size={18} color={Colors.accent} />
          <Text style={styles.manageText}>{tr('Manage connected devices')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  content: { paddingBottom: 32 },
  thermoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.accent,
    borderRadius: 24,
    paddingVertical: 12,
    marginHorizontal: 20,
    marginBottom: 12,
  },
  thermoText: { color: Colors.background, fontSize: 15, fontWeight: '700' },
  thermoList: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 16,
    padding: 14,
    marginHorizontal: 20,
    marginBottom: 14,
    gap: 6,
  },
  thermoTitle: { color: Colors.textPrimary, fontSize: 14, fontWeight: '700', marginBottom: 2 },
  thermoRow: { flexDirection: 'row', justifyContent: 'space-between' },
  thermoDate: { color: Colors.textSecondary, fontSize: 13 },
  thermoValue: { color: Colors.textPrimary, fontSize: 13, fontWeight: '700' },
  card: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 16,
    padding: 16,
    paddingTop: 24,
    marginHorizontal: 20,
  },
  tapHint: { color: Colors.textMuted, fontSize: 11, textAlign: 'center', marginTop: 8 },
  trend: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 20, marginTop: 12 },
  trendText: { color: Colors.textSecondary, fontSize: 13 },
  infoCard: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 20,
    marginTop: 16,
  },
  infoTitle: { color: Colors.textPrimary, fontSize: 14, fontWeight: '800', marginTop: 6, marginBottom: 4 },
  infoText: { color: Colors.textSecondary, fontSize: 13, lineHeight: 19 },
  disclaimer: { color: Colors.textMuted, fontSize: 11, marginTop: 10 },
  sectionTitle: { color: Colors.textPrimary, fontSize: 17, fontWeight: '700', paddingHorizontal: 20, marginTop: 20, marginBottom: 10 },
  list: { backgroundColor: Colors.card, borderRadius: 16, marginHorizontal: 20, paddingHorizontal: 14 },
  listRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 11 },
  listDivider: { borderTopWidth: 1, borderTopColor: Colors.divider },
  listDate: { color: Colors.textSecondary, fontSize: 13 },
  listValue: { color: Colors.textPrimary, fontSize: 13, fontWeight: '700' },
  listTimes: { color: Colors.textMuted, fontWeight: '400' },
  manage: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 18 },
  manageText: { color: Colors.accent, fontSize: 14, fontWeight: '700' },
});

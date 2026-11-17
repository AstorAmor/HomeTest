import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { BodyHologram } from '@/components/BodyHologram';
import { MeasureTabs } from '@/components/MeasureTabs';
import { ScreenHeader } from '@/components/ScreenHeader';
import { TrendChart } from '@/components/TrendChart';
import { Pill, SecHead } from '@/components/fine/Fine';
import { BigFigure } from '@/components/fine/FineMeasure';
import { useReloadOnFocus } from '@/hooks/useReloadOnFocus';
import { useLengthUnit } from '@/data/lengthUnit';
import { loadMeasureReadings, sampleMeasureReadings } from '@/data/measurementsRepository';
import { loadBodyBasics, type BodyBasics } from '@/data/bodyBasics';
import {
  fatSeries,
  jp3Sites,
  seriesChange,
  siteSeries,
  sitesOf,
  summarize,
  whtrSeries,
  withSteps,
  FOLD_SITES,
  type MeasureReadings,
  type MeasureTool,
  type SeriesPoint,
} from '@/logic/bodyMeasures';
import { tapeFatEstimate, tapeFatSeries } from '@/logic/bodyComposition';
import { figureSexOf } from '@/logic/bodyFigure';
import { seriesInUnit } from '@/logic/lengthUnits';
import { sampleBasicsNote, shortDay, signed, tapeFatNote } from '@/screens/measureFormat';
import { dateLocale, num, t } from '@/i18n';
import { FINE, ff, fine } from '@/theme/fine';

// La evolución de las medidas del cuerpo (Peso → Medidas → una medida o «Ver evolución»). El fundador,
// 2026-11-16: «me gustaría ver cómo quedaría la evolución/histórico». Arriba, cinta métrica o pinza de grasa;
// debajo, la figura y la lista de medidas con su última cifra: al tocar una (o su marca), la figura se acerca a su
// zona con esa cifra debajo. El cambio no va ni en la lista ni bajo la figura (fundador, 2026-11-17: «no pongas en
// la medida en sí la evolución… así se puede comprimir más y el muñequito no queda desproporcionado… para eso está
// muy bien la gráfica de debajo»): la lista, más apretada, cabe a la altura de la figura. Luego, la medida elegida:
// la última, la curva en jade y cada vez con su cambio respecto a la anterior. Con la pinza, también la grasa estimada; con la cinta, cintura /
// altura (las dos, SUPUESTO en src/logic/bodyMeasures.ts) y la grasa estimada con la cinta (SUPUESTO en
// src/logic/bodyComposition.ts). Sin colores ni avisos: subir o bajar no es bueno ni malo aquí. Sin medidas
// propias, las de ejemplo (nunca se guardan). Sexo, edad y altura, del perfil (en la demo, de ejemplo si faltan:
// src/data/bodyBasics.ts).
// ?kind=tape_waist (o fat / fat_tape / whtr) abre con esa medida elegida.
// La cinta, en la unidad elegida al apuntar (cm o pulgadas, src/data/lengthUnit.ts): cada cifra, la curva y los
// cambios. Pliegues, grasa y cintura / altura (con los cm guardados), igual.

interface Item {
  key: string; // kind del sitio, o 'fat' / 'fat_tape' / 'whtr'
  label: string;
  unit: string; // 'cm', 'in', 'mm', '%' o ''
  decimals: number;
  series: SeriesPoint[];
  site?: string; // kind del sitio en la figura
  note?: string;
}

const longDate = (iso: string) => new Date(iso).toLocaleDateString(dateLocale(), { day: 'numeric', month: 'long', year: 'numeric' });
const fmt = (v: number, decimals: number) => num(Number(v.toFixed(decimals)));

export const MeasurementsHistoryScreen = () => {
  const router = useRouter();
  const params = useLocalSearchParams<{ kind?: string }>();
  const initial = typeof params.kind === 'string' ? params.kind : undefined;
  const [tool, setTool] = useState<MeasureTool>(initial?.startsWith('skinfold_') || initial === 'fat' ? 'fold' : 'tape');
  const [selected, setSelected] = useState<string | null>(initial ?? null);
  const [data, setData] = useState<(BodyBasics & { readings: MeasureReadings; sample: boolean }) | null>(null);
  const [lengthUnit] = useLengthUnit();

  useReloadOnFocus(
    useCallback(async () => {
      const [readings, basics] = await Promise.all([loadMeasureReadings().catch(() => ({}) as MeasureReadings), loadBodyBasics()]);
      const own = summarize(readings).length > 0;
      const sample = own ? null : sampleMeasureReadings();
      setData({ ...basics, readings: sample ?? readings, sample: !!sample });
    }, []),
  );

  // Las medidas de la pestaña con algo apuntado, y lo que sale de ellas
  const items: Item[] = [];
  if (data) {
    for (const s of sitesOf(tool)) {
      const series = siteSeries(data.readings, s.kind);
      if (!series.length) continue;
      if (s.tool === 'tape') items.push({ key: s.kind, label: t(s.label), unit: lengthUnit, decimals: 1, series: seriesInUnit(series, lengthUnit), site: s.kind });
      else items.push({ key: s.kind, label: t(s.label), unit: s.unit, decimals: 1, series, site: s.kind });
    }
    // En la demo, con el perfil a medias: con qué datos de ejemplo sale cada cuenta (si las medidas también son de
    // ejemplo, basta con su aviso)
    const withBasics = (note: string, uses: { person?: boolean; height?: boolean }) => {
      const extra = data.sample ? null : sampleBasicsNote(data, uses);
      return extra ? `${note} ${extra}` : note;
    };
    if (tool === 'tape') {
      const series = whtrSeries(data.readings, data.heightCm);
      if (series.length)
        items.push({
          key: 'whtr',
          label: t('Waist / height'),
          unit: '',
          decimals: 2,
          series,
          site: 'tape_waist',
          note: withBasics(t('As a reference, a waist under half your height is usually advised.'), { height: true }),
        });
      // La grasa estimada con la cinta: como la de los pliegues, en los días con todas las medidas de la fórmula
      const fat = tapeFatSeries(data.readings, data.sex, data.heightCm);
      if (fat.length)
        items.push({
          key: 'fat_tape',
          label: t('Estimated body fat (tape)'),
          unit: '%',
          decimals: 1,
          series: fat,
          note: withBasics(`${tapeFatNote(data.sex)} ${t('US Navy circumference formula.')}`, { person: true, height: true }),
        });
    } else {
      const series = fatSeries(data.readings, data.sex, data.age);
      const sex = data.sex === 'male' || data.sex === 'female' ? data.sex : null;
      const sites = sex ? jp3Sites(sex).map((id) => t(FOLD_SITES.find((f) => f.id === id)!.label).toLowerCase()).join(', ') : '';
      if (series.length)
        items.push({
          key: 'fat',
          label: t('Estimated body fat'),
          unit: '%',
          decimals: 1,
          series,
          note: withBasics(`${t('Estimate from your skinfolds; compare it between measurements taken the same way.')} ${t('Jackson-Pollock formula with 3 skinfolds: {sites}.', { sites })}`, {
            person: true,
          }),
        });
    }
  }
  const current = items.find((i) => i.key === selected) ?? items[0];
  const change = current ? seriesChange(current.series, current.decimals) : null;
  const latest = current?.series[current.series.length - 1];
  // Las cifras del eje, sin decimales solo si la curva se mueve lo bastante para que no salgan repetidas (en
  // pulgadas los cambios son más pequeños: «15, 15»)
  const values = current?.series.map((p) => p.valor) ?? [];
  const spread = values.length ? Math.max(...values) - Math.min(...values) : 0;
  const filled = Object.fromEntries(items.filter((i) => i.site).map((i) => [i.site!, true]));
  const needsProfile = tool === 'fold' && data && !items.some((i) => i.key === 'fat') && items.length > 0;
  // Con la cinta: con el cuello o la cintura apuntados, sin sexo o sin altura en el perfil no sale la grasa estimada
  const tapeNeedsProfile =
    tool === 'tape' && !!data && items.some((i) => i.key === 'tape_neck' || i.key === 'tape_waist') && tapeFatEstimate(data.sex, data.heightCm, {}).kind === 'needs_profile';

  const switchTool = (next: MeasureTool) => {
    if (next === tool) return;
    setTool(next);
    setSelected(null);
  };
  const pick = (kind: string) => setSelected(kind);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader title={t('Measurement history')} showBack />
        <View style={styles.body}>
          <MeasureTabs value={tool} onChange={switchTool} />

          {data && !items.length ? (
            <Text style={[fine.note, styles.empty]}>{t('No measurements yet.')}</Text>
          ) : current ? (
            <>
              {/* La figura con la cifra de la medida elegida debajo y la lista de medidas con la última de cada una */}
              <View style={styles.top}>
                <BodyHologram
                  style={styles.figure}
                  sex={figureSexOf(data?.sex)}
                  tool={tool}
                  focus={current.site ?? null}
                  filled={filled}
                  focusLabel={latest ? `${fmt(latest.valor, current.decimals)}${current.unit ? ` ${current.unit}` : ''}` : undefined}
                  onPick={pick}
                />
                <View style={styles.list}>
                  {items.map((it, i) => {
                    const on = it === current;
                    const last = it.series[it.series.length - 1];
                    return (
                      <TouchableOpacity
                        key={it.key}
                        style={[styles.item, i === items.length - 1 && styles.lastItem]}
                        onPress={() => setSelected(it.key)}
                        activeOpacity={0.7}
                        accessibilityRole="button"
                        accessibilityState={{ selected: on }}
                      >
                        <View style={[styles.itemMark, on && styles.itemMarkOn]} />
                        <Text style={[styles.itemLabel, on && styles.itemLabelOn]} numberOfLines={2}>
                          {it.label}
                        </Text>
                        <Text style={styles.itemValue}>
                          {fmt(last.valor, it.decimals)}
                          {it.unit ? <Text style={styles.itemUnit}>{` ${it.unit}`}</Text> : null}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                  <Text style={styles.tapHint}>{t('Tap a measure or its mark on the figure.')}</Text>
                </View>
              </View>

              {/* La medida elegida: la última, su curva y cada vez */}
              <SecHead title={current.label} />
              {latest && (
                <BigFigure
                  value={fmt(latest.valor, current.decimals)}
                  lines={[current.unit, `${t('Latest value')} · ${shortDay(latest.fecha)}`, data?.sample && t('sample data')]}
                />
              )}
              {/* Sin «−1 cm desde el …»: la evolución la cuenta la curva de debajo (fundador, 2026-11-17); solo la pista si aún
                  no hay dos medidas */}
              {!change && <Text style={styles.change}>{t('Log measurements twice to see how they change.')}</Text>}
              {current.note ? <Text style={fine.note}>{current.note}</Text> : null}

              {current.series.length >= 2 && (
                <>
                  <View style={styles.chart}>
                    <TrendChart
                      height={140}
                      labels={current.series.map((p) => shortDay(p.fecha))}
                      series={[{ color: FINE.jade, values: current.series.map((p) => p.valor) }]}
                      formatY={(v) => fmt(v, spread >= 4 ? 0 : current.decimals)}
                      formatValue={(v) => `${fmt(v, current.decimals)}${current.unit ? ` ${current.unit}` : ''}`}
                    />
                  </View>
                  <Text style={styles.tapHint}>{t('Tap the chart to see each reading')}</Text>
                </>
              )}

              <SecHead title={t('History')} />
              {withSteps(current.series, current.decimals).map((p, i, all) => (
                <View key={p.fecha} style={[fine.row, i === all.length - 1 && styles.lastRow]}>
                  <Text style={styles.rowDate}>{longDate(p.fecha)}</Text>
                  <Text style={styles.rowValue}>
                    {fmt(p.valor, current.decimals)}
                    {current.unit ? <Text style={styles.itemUnit}>{` ${current.unit}`}</Text> : null}
                  </Text>
                  <Text style={styles.rowStep}>{p.step == null ? '' : signed(p.step, '', current.decimals)}</Text>
                </View>
              ))}
            </>
          ) : null}

          {needsProfile ? <Text style={fine.note}>{t('For a body fat estimate we need your sex and date of birth in your profile: the formulas depend on them.')}</Text> : null}
          {tapeNeedsProfile ? (
            <Text style={fine.note}>{t('For a body fat estimate with the tape we need your sex and height in your profile: the formula depends on them.')}</Text>
          ) : null}
          {data?.sample && <Text style={fine.note}>{t('Sample data: log your first reading to see your own.')}</Text>}

          <View style={styles.add}>
            <Pill label={t('Add measurements')} onPress={() => router.push({ pathname: '/log-measurements', params: tool === 'fold' ? { tool: 'fold' } : {} })} />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: 'transparent' },
  content: { paddingBottom: 40 },
  body: { paddingHorizontal: 20 },
  empty: { marginTop: 16 },
  // La figura a la izquierda y la lista a la derecha
  top: { flexDirection: 'row', gap: 12, marginTop: 14 },
  // Una fila por medida, sin el cambio debajo: la lista cabe a la altura de la figura y esta no queda pequeña a su lado
  figure: { width: '38%', maxWidth: 220, minWidth: 116, height: 330 },
  list: { flex: 1, minWidth: 0, justifyContent: 'center' },
  item: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, minHeight: 34, borderBottomWidth: 1, borderBottomColor: FINE.line },
  lastItem: { borderBottomWidth: 0 },
  // La elegida: una raya de jade a la izquierda y el nombre en marfil
  itemMark: { width: 2, alignSelf: 'stretch', borderRadius: 1, backgroundColor: 'transparent' },
  itemMarkOn: { backgroundColor: FINE.jade },
  itemLabel: { ...ff('regular'), flex: 1, minWidth: 0, fontSize: 13, lineHeight: 17, color: FINE.mute },
  itemLabelOn: { color: FINE.ivory },
  itemValue: { ...ff('regular'), fontSize: 14, color: FINE.ivory, fontVariant: ['tabular-nums'] },
  itemUnit: { ...ff('regular'), fontSize: 11.5, color: FINE.mute },
  tapHint: { ...fine.note, fontSize: 11.5, marginTop: 6 },
  change: { ...ff('regular'), fontSize: 14, lineHeight: 20, color: FINE.ivory, marginTop: 8 },
  chart: { marginTop: 14 },
  lastRow: { borderBottomWidth: 0 },
  rowDate: { ...ff('regular'), flex: 1, color: FINE.mute, fontSize: 13 },
  rowValue: { ...ff('regular'), color: FINE.ivory, fontSize: 15, fontVariant: ['tabular-nums'] },
  rowStep: { ...ff('regular'), width: 52, textAlign: 'right', color: FINE.mute, fontSize: 12.5, fontVariant: ['tabular-nums'] },
  add: { alignItems: 'center', marginTop: 22 },
});

import React, { useCallback, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ScreenHeader } from '@/components/ScreenHeader';
import { TrendChart } from '@/components/TrendChart';
import { RangeId, rangeDays } from '@/components/MetricDetailParts';
import { Chev, FRow, Pill, SecHead } from '@/components/fine/Fine';
import { BigFigure, FineRangeTabs } from '@/components/fine/FineMeasure';
import { useDeepState, useReloadOnFocus } from '@/hooks/useReloadOnFocus';
import { BloodPressureEntry } from '@/types/bloodPressure';
import { bloodPressureRepository, getBloodPressureEntries } from '@/data/bloodPressureRepository';
import { sampleBloodPressure } from '@/data/sampleReadings';
import { bpLabel, bpLevel, BpLevel } from '@/logic/bloodPressure';
import { dateLocale, t } from '@/i18n';
import { showSamples } from '@/data/dataMode';
import { FINE, ff, fine } from '@/theme/fine';

const shortDay = (iso: string) => {
  const d = new Date(iso);
  return `${d.getDate()}/${d.getMonth() + 1}`;
};

// La marca de cada toma, sin rojo ni naranja: jade en rango y oro fuera de él. Desde el 2026-11-16 un punto pequeño
// en lugar del icono en círculo (el fundador: los iconos «se ven un poco bastos»). La forma dice cuál: punto jade
// por debajo de 130/85, aro de oro la normal-alta o baja, punto de oro desde 140/90.
const LEVEL_COLOR: Record<BpLevel, string> = { ok: FINE.jade, watch: FINE.gold, high: FINE.gold };

function LevelMark({ level, size = 8 }: { level: BpLevel; size?: number }) {
  const ring = level === 'watch';
  return (
    <View style={styles.markBox} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View
        style={{
          width: ring ? size + 1 : size,
          height: ring ? size + 1 : size,
          borderRadius: size,
          backgroundColor: ring ? 'transparent' : LEVEL_COLOR[level],
          borderWidth: ring ? 1.4 : 0,
          borderColor: LEVEL_COLOR[level],
        }}
      />
    </View>
  );
}

// Las dos curvas en los tonos del prototipo: jade la sistólica y turquesa la diastólica
const SYS = FINE.jade;
const DIA = '#5CC7C9';

// Tensión arterial como la ficha de una medición del prototipo: la última toma grande y ligera con «mmHg», lo que
// es y la fecha al lado; los periodos en pestañas con borde, las dos curvas sin tarjeta, las medias en filas,
// «Añadir medición» en píldora esmeralda y el historial en filas con su marca.
export const BloodPressureDetailScreen = () => {
  const router = useRouter();
  // Con cuenta, la ficha nace con las tomas leídas la última vez (en Hoy, en Mediciones o al abrir la app) y las
  // refresca de la red detrás, en vez de empezar vacía (fundador, 2026-11-17: «las medidas tardan en cargar»)
  const [initial] = useState(() => bloodPressureRepository.peek());
  const [entries, setEntries] = useDeepState<BloodPressureEntry[]>(initial ?? []);
  const [range, setRange] = useState<RangeId>('1M');
  const firstLoad = useRef(true);

  const load = useCallback(() => {
    // Al volver de apuntar una toma, ya sale (lo último leído lleva lo nuevo); la red lo confirma detrás
    if (!firstLoad.current) {
      const snap = bloodPressureRepository.peek();
      if (snap) setEntries(snap);
    }
    firstLoad.current = false;
    return getBloodPressureEntries().then(setEntries);
  }, [setEntries]);
  useReloadOnFocus(load);

  // Sin registros propios: los de ejemplo (los mismos que enseña Mis datos), sin poder editarlos
  const isSample = entries.length === 0 && showSamples();
  const shown = isSample ? sampleBloodPressure() : entries;
  const cutoff = Date.now() - rangeDays(range) * 24 * 60 * 60 * 1000;
  const filtered = shown
    .filter((e) => new Date(e.fecha).getTime() >= cutoff)
    .sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());
  const historyDesc = [...shown].sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
  const latest = historyDesc[0];
  const mean = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null);
  const sysAvg = mean(filtered.map((e) => e.systolic));
  const diaAvg = mean(filtered.map((e) => e.diastolic));
  const pulseAvg = mean(filtered.flatMap((e) => (e.pulse != null ? [e.pulse] : [])));

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader title={t('Blood Pressure')} showBack />

        <View style={styles.body}>
          <BigFigure
            value={latest ? `${latest.systolic}/${latest.diastolic}` : '—'}
            lines={
              latest
                ? [
                    `mmHg · ${t(bpLabel(latest.systolic, latest.diastolic))}`,
                    new Date(latest.fecha).toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short' }),
                    isSample && t('sample data'),
                  ]
                : [t('No entries yet.')]
            }
          />

          <FineRangeTabs value={range} onChange={setRange} />
          <View style={styles.chart}>
            <TrendChart
              height={160}
              labels={filtered.map((e) => shortDay(e.fecha))}
              series={[
                { color: SYS, label: t('Systolic'), values: filtered.map((e) => e.systolic) },
                { color: DIA, label: t('Diastolic'), values: filtered.map((e) => e.diastolic) },
              ]}
              formatValue={(v) => `${Math.round(v)} mmHg`}
            />
          </View>
          <Text style={styles.tapHint}>{t('Tap the chart to see each reading')}</Text>

          <SecHead title={t('In numbers')} />
          <FRow title={t('Systolic')} value={sysAvg != null ? `${sysAvg} mmHg` : '—'} />
          <FRow title={t('Diastolic')} value={diaAvg != null ? `${diaAvg} mmHg` : '—'} />
          <FRow title={t('Pulse')} value={pulseAvg != null ? `${pulseAvg} ${t('BPM')}` : '—'} last />
          <Text style={fine.note}>{t('Averages for the selected period')}</Text>

          <View style={styles.add}>
            <Pill label={t('Add measurement')} onPress={() => router.push('/log-blood-pressure')} />
          </View>

          {isSample && <Text style={styles.sampleNote}>{t('Sample data: log your first reading to see your own.')}</Text>}

          <SecHead title={t('History')} />
          {historyDesc.length === 0 ? (
            <Text style={styles.emptyText}>{t('No entries yet.')}</Text>
          ) : (
            historyDesc.map((entry, i) => {
              const level = bpLevel(entry.systolic, entry.diastolic);
              return (
                <TouchableOpacity
                  key={entry.id}
                  style={[fine.row, i === historyDesc.length - 1 && styles.lastRow]}
                  disabled={isSample}
                  onPress={() => router.push({ pathname: '/log-blood-pressure', params: { id: entry.id } })}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: isSample }}
                  accessibilityLabel={`${shortDay(entry.fecha)}: ${entry.systolic}/${entry.diastolic} mmHg, ${t(bpLabel(entry.systolic, entry.diastolic))}`}
                >
                  <LevelMark level={level} />
                  <Text style={styles.historyDate}>{shortDay(entry.fecha)}</Text>
                  <Text style={styles.historyValue}>
                    {entry.systolic}/{entry.diastolic} <Text style={styles.historyUnit}>mmHg</Text>
                    {entry.pulse !== null ? <Text style={styles.historyUnit}>{`  ·  ${entry.pulse} ${t('BPM')}`}</Text> : null}
                  </Text>
                  {!isSample && <Chev />}
                </TouchableOpacity>
              );
            })
          )}
          <View style={styles.legend}>
            {(['ok', 'watch', 'high'] as const).map((l) => (
              <View key={l} style={styles.legendItem}>
                <LevelMark level={l} size={7} />
                <Text style={styles.legendText}>
                  {l === 'ok' ? t('Below 130/85') : l === 'watch' ? t('130-139 / 85-89 or low') : t('140/90 or more')}
                </Text>
              </View>
            ))}
          </View>
          <Text style={fine.note}>{t('Reference: European guidelines (ESC/ESH). General information, not a diagnosis.')}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: 'transparent' },
  content: { paddingBottom: 40 },
  body: { paddingHorizontal: 20 },
  chart: { marginTop: 14 },
  tapHint: { ...fine.note, textAlign: 'center', marginTop: 6 },
  add: { alignItems: 'center', marginTop: 22 },
  sampleNote: { ...fine.note, marginTop: 16 },
  emptyText: { ...fine.note, marginTop: 0 },
  lastRow: { borderBottomWidth: 0 },
  // Hueco fijo para la marca, así las fechas quedan alineadas sea punto o aro
  markBox: { width: 12, alignItems: 'center', justifyContent: 'center' },
  historyDate: { ...ff('regular'), color: FINE.mute, fontSize: 13, width: 40, fontVariant: ['tabular-nums'] },
  historyValue: { ...ff('regular'), flex: 1, color: FINE.ivory, fontSize: 15, fontVariant: ['tabular-nums'] },
  historyUnit: { ...ff('regular'), color: FINE.mute, fontSize: 12.5 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 14 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendText: { ...ff('regular'), color: FINE.mute, fontSize: 11.5 },
});

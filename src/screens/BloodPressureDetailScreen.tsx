import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ScreenHeader } from '@/components/ScreenHeader';
import { TrendChart } from '@/components/TrendChart';
import { AddMeasurementButton, MetricHero, RangeId, rangeDays, RangeTabs, StatsRow } from '@/components/MetricDetailParts';
import { Colors } from '@/constants/colors';
import { useDeepState, useReloadOnFocus } from '@/hooks/useReloadOnFocus';
import { BloodPressureEntry } from '@/types/bloodPressure';
import { getBloodPressureEntries } from '@/data/bloodPressureRepository';
import { sampleBloodPressure } from '@/data/sampleReadings';
import { bpLabel, bpLevel, BpLevel } from '@/logic/bloodPressure';
import { dateLocale, t } from '@/i18n';
import { showSamples } from '@/data/dataMode';

const shortDay = (iso: string) => {
  const d = new Date(iso);
  return `${d.getDate()}/${d.getMonth() + 1}`;
};

// El check de cada toma: verde (en rango), amarillo (normal-alta o baja), rojo (alta)
const LEVEL: Record<BpLevel, { icon: string; color: string }> = {
  ok: { icon: 'checkmark-circle', color: Colors.ok },
  watch: { icon: 'alert-circle', color: Colors.amber },
  high: { icon: 'alert-circle', color: Colors.danger },
};

const SYS = Colors.coral;
const DIA = Colors.sky;

// Tensión arterial con el mismo aspecto que las demás fichas: icono y última toma, 7D/14D/1M/6M,
// sistólica y diastólica con color debajo, medias, "+ Añadir medición" e historial con su check.
export const BloodPressureDetailScreen = () => {
  const router = useRouter();
  const [entries, setEntries] = useDeepState<BloodPressureEntry[]>([]);
  const [range, setRange] = useState<RangeId>('1M');

  const load = useCallback(() => getBloodPressureEntries().then(setEntries), [setEntries]);
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

        <MetricHero
          icon="speedometer-outline"
          color={SYS}
          value={latest ? `${latest.systolic}/${latest.diastolic}` : '—'}
          sub={
            latest
              ? `mmHg · ${t(bpLabel(latest.systolic, latest.diastolic))} · ${new Date(latest.fecha).toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short' })}${isSample ? ` · ${t('sample data')}` : ''}`
              : t('No entries yet.')
          }
        />

        <RangeTabs value={range} onChange={setRange} />

        <View style={styles.card}>
          <TrendChart
            height={160}
            labels={filtered.map((e) => shortDay(e.fecha))}
            series={[
              { color: SYS, label: t('Systolic'), values: filtered.map((e) => e.systolic) },
              { color: DIA, label: t('Diastolic'), values: filtered.map((e) => e.diastolic) },
            ]}
            formatValue={(v) => `${Math.round(v)} mmHg`}
          />
          <Text style={styles.tapHint}>{t('Tap the chart to see each reading')}</Text>
        </View>

        <StatsRow
          items={[
            { label: 'Systolic', value: sysAvg != null ? String(sysAvg) : '—' },
            { label: 'Diastolic', value: diaAvg != null ? String(diaAvg) : '—' },
            { label: 'Pulse', value: pulseAvg != null ? `${pulseAvg} ${t('BPM')}` : '—' },
          ]}
        />
        <Text style={styles.statsNote}>{t('Averages for the selected period')}</Text>

        <AddMeasurementButton onPress={() => router.push('/log-blood-pressure')} />

        {isSample && (
          <View style={styles.sampleNote}>
            <Ionicons name="flask-outline" size={16} color={Colors.textSecondary} />
            <Text style={styles.sampleNoteText}>{t('Sample data: log your first reading to see your own.')}</Text>
          </View>
        )}

        <Text style={styles.sectionTitle}>{t('History')}</Text>
        {historyDesc.length === 0 ? (
          <Text style={styles.emptyText}>{t('No entries yet.')}</Text>
        ) : (
          <View style={styles.historyList}>
            {historyDesc.map((entry, i) => {
              const level = LEVEL[bpLevel(entry.systolic, entry.diastolic)];
              return (
                <TouchableOpacity
                  key={entry.id}
                  style={[styles.historyRow, i > 0 && styles.historyDivider]}
                  disabled={isSample}
                  onPress={() => router.push({ pathname: '/log-blood-pressure', params: { id: entry.id } })}
                >
                  <Ionicons name={level.icon as any} size={20} color={level.color} />
                  <Text style={styles.historyDate}>{shortDay(entry.fecha)}</Text>
                  <Text style={styles.historyValue}>
                    {entry.systolic}/{entry.diastolic} <Text style={styles.historyUnit}>mmHg</Text>
                    {entry.pulse !== null ? <Text style={styles.historyUnit}>{`  ·  ${entry.pulse} ${t('BPM')}`}</Text> : null}
                  </Text>
                  {!isSample && <Ionicons name="pencil-outline" size={16} color={Colors.textMuted} />}
                </TouchableOpacity>
              );
            })}
          </View>
        )}
        <View style={styles.legend}>
          {(['ok', 'watch', 'high'] as const).map((l) => (
            <View key={l} style={styles.legendItem}>
              <Ionicons name={LEVEL[l].icon as any} size={14} color={LEVEL[l].color} />
              <Text style={styles.legendText}>
                {l === 'ok' ? t('Below 130/85') : l === 'watch' ? t('130-139 / 85-89 or low') : t('140/90 or more')}
              </Text>
            </View>
          ))}
        </View>
        <Text style={styles.legendNote}>{t('Reference: European guidelines (ESC/ESH). General information, not a diagnosis.')}</Text>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  content: { paddingBottom: 40 },
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
  statsNote: { color: Colors.textMuted, fontSize: 11, textAlign: 'center', marginTop: 6 },
  sampleNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 20,
    marginTop: 14,
    padding: 12,
    borderRadius: 12,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  sampleNoteText: { flex: 1, color: Colors.textSecondary, fontSize: 13, lineHeight: 18 },
  sectionTitle: { color: Colors.textPrimary, fontSize: 17, fontWeight: '700', paddingHorizontal: 20, marginTop: 20, marginBottom: 10 },
  emptyText: { color: Colors.textMuted, fontSize: 13, paddingHorizontal: 20 },
  historyList: { backgroundColor: Colors.card, borderRadius: 16, marginHorizontal: 20, paddingHorizontal: 14 },
  historyRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  historyDivider: { borderTopWidth: 1, borderTopColor: Colors.divider },
  historyDate: { color: Colors.textSecondary, fontSize: 13, width: 40 },
  historyValue: { flex: 1, color: Colors.textPrimary, fontSize: 15, fontWeight: '800' },
  historyUnit: { color: Colors.textSecondary, fontSize: 12, fontWeight: '500' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginHorizontal: 20, marginTop: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendText: { color: Colors.textSecondary, fontSize: 11 },
  legendNote: { color: Colors.textMuted, fontSize: 11, marginHorizontal: 20, marginTop: 6 },
});

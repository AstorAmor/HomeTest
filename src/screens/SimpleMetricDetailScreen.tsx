import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ScreenHeader } from '@/components/ScreenHeader';
import { TrendChart } from '@/components/TrendChart';
import { AddMeasurementButton, MetricHero, RangeId, rangeDays, RangeTabs, StatsRow } from '@/components/MetricDetailParts';
import { Colors } from '@/constants/colors';
import { useDeepState, useReloadOnFocus } from '@/hooks/useReloadOnFocus';
import { dateLocale, num, t } from '@/i18n';

export interface GenericMetricEntry {
  id: string;
  valor: number;
  unidad: string;
  fecha: string;
  extra?: string; // ej. "Desayuno" para glucosa
}

const shortDay = (iso: string) => {
  const d = new Date(iso);
  return `${d.getDate()}/${d.getMonth() + 1}`;
};

interface SimpleMetricDetailScreenProps {
  title: string;
  color: string;
  icon: string; // nombre de AppIcon (p. ej. 'glucose')
  band?: { low: number; high: number }; // franja de referencia en la gráfica
  loadEntries: () => Promise<GenericMetricEntry[]>;
  onAddPress: () => void;
  onEditPress: (id: string) => void;
  // Registros de ejemplo cuando aún no hay ninguno propio (no se pueden editar)
  sample?: GenericMetricEntry[];
}

// Ficha de una medición que se apunta a mano (glucosa, colesterol, cortisol), con el mismo
// aspecto que las de los wearables: icono y último valor, 7D/14D/1M/6M, curva con color debajo,
// media/mínimo/máximo, "+ Añadir medición" e historial.
export const SimpleMetricDetailScreen = ({
  title,
  color,
  icon,
  band,
  loadEntries,
  onAddPress,
  onEditPress,
  sample,
}: SimpleMetricDetailScreenProps) => {
  const [entries, setEntries] = useDeepState<GenericMetricEntry[]>([]);
  const loadEntriesRef = useRef(loadEntries);
  const [range, setRange] = useState<RangeId>('1M');

  useEffect(() => {
    loadEntriesRef.current = loadEntries;
  });
  const load = useCallback(() => loadEntriesRef.current().then(setEntries), [setEntries]);
  useReloadOnFocus(load);

  const isSample = entries.length === 0 && !!sample?.length;
  const shown = isSample ? sample! : entries;
  const cutoff = Date.now() - rangeDays(range) * 24 * 60 * 60 * 1000;
  const filtered = shown
    .filter((e) => new Date(e.fecha).getTime() >= cutoff)
    .sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());
  const values = filtered.map((e) => e.valor);

  const historyDesc = [...shown].sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
  const latest = historyDesc[0];
  const unit = latest?.unidad ?? '';
  const fmt = (v: number) => `${num(Math.round(v * 10) / 10)} ${unit}`.trim();
  const avg = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader title={title} showBack />

        <MetricHero
          icon={icon}
          color={color}
          value={latest ? fmt(latest.valor) : '—'}
          sub={
            latest
              ? `${t('Latest value')} · ${new Date(latest.fecha).toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short' })}${isSample ? ` · ${t('sample data')}` : ''}`
              : t('No entries yet.')
          }
        />

        <RangeTabs value={range} onChange={setRange} />

        <View style={styles.card}>
          <TrendChart
            height={150}
            labels={filtered.map((e) => shortDay(e.fecha))}
            series={[{ color, values }]}
            band={band}
            formatValue={fmt}
          />
          <Text style={styles.tapHint}>{t('Tap the chart to see each reading')}</Text>
        </View>

        <StatsRow
          unit={unit}
          items={[
            { label: 'Average', value: values.length ? num(Math.round(avg * 10) / 10) : '—' },
            { label: 'Lowest', value: values.length ? num(Math.min(...values)) : '—' },
            { label: 'Highest', value: values.length ? num(Math.max(...values)) : '—' },
          ]}
        />

        <AddMeasurementButton onPress={onAddPress} />

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
            {historyDesc.map((entry, i) => (
              <TouchableOpacity
                key={entry.id}
                style={[styles.historyRow, i > 0 && styles.historyDivider]}
                disabled={isSample}
                onPress={() => onEditPress(entry.id)}
              >
                <Text style={styles.historyDate}>{shortDay(entry.fecha)}</Text>
                <Text style={styles.historyValue}>
                  {num(entry.valor)} {entry.unidad}
                  {entry.extra ? <Text style={styles.historyExtra}>{`  ·  ${entry.extra}`}</Text> : null}
                </Text>
                {!isSample && <Ionicons name="pencil-outline" size={16} color={Colors.textMuted} />}
              </TouchableOpacity>
            ))}
          </View>
        )}
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
  historyRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  historyDivider: { borderTopWidth: 1, borderTopColor: Colors.divider },
  historyDate: { color: Colors.textSecondary, fontSize: 13, width: 44 },
  historyValue: { flex: 1, color: Colors.textPrimary, fontSize: 14, fontWeight: '700' },
  historyExtra: { color: Colors.textSecondary, fontWeight: '500' },
});

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ScreenHeader } from '@/components/ScreenHeader';
import { TrendChart } from '@/components/TrendChart';
import { RangeId, rangeDays } from '@/components/MetricDetailParts';
import { FRow, Pill, SecHead } from '@/components/fine/Fine';
import { BigFigure, FineRangeTabs } from '@/components/fine/FineMeasure';
import { useDeepState, useReloadOnFocus } from '@/hooks/useReloadOnFocus';
import { dateLocale, num, t } from '@/i18n';
import { FINE, ff, fine } from '@/theme/fine';

export interface GenericMetricEntry {
  id: string;
  valor: number;
  unidad: string;
  fecha: string;
  extra?: string; // ej. "Desayuno" para glucosa
  uploadId?: string; // valor de una analítica subida: no se edita aquí, se abre la analítica
}

const shortDay = (iso: string) => {
  const d = new Date(iso);
  return `${d.getDate()}/${d.getMonth() + 1}`;
};

interface SimpleMetricDetailScreenProps {
  title: string;
  color: string; // el de la curva
  icon: string; // nombre de AppIcon (p. ej. 'glucose'); desde el 2026-11-16 la ficha ya no lo pinta
  band?: { low: number; high: number }; // franja de referencia en la gráfica
  loadEntries: () => Promise<GenericMetricEntry[]>;
  onAddPress: () => void;
  onEditPress: (id: string) => void;
  // Registros de ejemplo cuando aún no hay ninguno propio (no se pueden editar)
  sample?: GenericMetricEntry[];
  // Texto que se añade bajo el último valor (p. ej. "Bueno para tu edad" en el VO2max). Puede llevar un enlace
  // (un <Text onPress> dentro): en Peso, «Añade tu altura» para ver el IMC (2026-11-16)
  describe?: (latest: number) => React.ReactNode;
  // Contenido propio de la ficha, debajo de "+ Añadir medición" (p. ej. tablas de referencia)
  extra?: React.ReactNode;
}

// Ficha de una medición que se apunta a mano (peso, glucosa, VO2max, colesterol, cortisol). Desde el
// 2026-11-16, como la ficha de una medición del prototipo (borradores/app-estructura/prototipo): la última
// cifra grande y ligera con la unidad y la fecha al lado, los periodos en pestañas con borde, la curva sin
// tarjeta, «En números» en filas con línea fina, «Añadir medición» en píldora esmeralda y el historial en filas.
export const SimpleMetricDetailScreen = ({
  title,
  color,
  band,
  loadEntries,
  onAddPress,
  onEditPress,
  sample,
  describe,
  extra,
}: SimpleMetricDetailScreenProps) => {
  const router = useRouter();
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
  const filtered = shown.filter((e) => new Date(e.fecha).getTime() >= cutoff).sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());
  const values = filtered.map((e) => e.valor);

  const historyDesc = [...shown].sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
  const latest = historyDesc[0];
  const unit = latest?.unidad ?? '';
  const fmt = (v: number) => `${num(Math.round(v * 10) / 10)} ${unit}`.trim();
  const avg = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  const withUnit = (v: string) => (v === '—' ? v : `${v} ${unit}`.trim());
  const described = latest ? describe?.(latest.valor) : null;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader title={title} showBack />

        <View style={styles.body}>
          {/* La última cifra, grande y ligera; al lado, la unidad y cuándo */}
          <BigFigure
            value={latest ? num(Math.round(latest.valor * 10) / 10) : '—'}
            lines={
              latest
                ? [
                    unit,
                    `${t('Latest value')} · ${new Date(latest.fecha).toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short' })}`,
                    isSample && t('sample data'),
                  ]
                : [t('No entries yet.')]
            }
          />
          {described ? <Text style={styles.describe}>{described}</Text> : null}

          {/* Con menos de dos mediciones no hay curva que enseñar: solo el valor y "+ Añadir medición" */}
          {shown.length >= 2 && (
            <>
              <FineRangeTabs value={range} onChange={setRange} />
              <View style={styles.chart}>
                <TrendChart height={150} labels={filtered.map((e) => shortDay(e.fecha))} series={[{ color, values }]} band={band} formatValue={fmt} />
              </View>
              <Text style={styles.tapHint}>{t('Tap the chart to see each reading')}</Text>

              <SecHead title={t('In numbers')} />
              <FRow title={t('Average')} value={withUnit(values.length ? num(Math.round(avg * 10) / 10) : '—')} />
              <FRow title={t('Lowest')} value={withUnit(values.length ? num(Math.min(...values)) : '—')} />
              <FRow title={t('Highest')} value={withUnit(values.length ? num(Math.max(...values)) : '—')} last />
            </>
          )}

          <View style={styles.add}>
            <Pill label={t('Add measurement')} onPress={onAddPress} />
          </View>
        </View>

        {/* Lo propio de cada ficha (peso: IMC y composición; VO2max: la tabla por edad) */}
        {extra ? <View style={styles.body}>{extra}</View> : null}

        <View style={styles.body}>
          {isSample && (
            <View style={styles.sampleNote}>
              <Ionicons name="flask-outline" size={15} color={FINE.mute} />
              <Text style={styles.sampleNoteText}>{t('Sample data: log your first reading to see your own.')}</Text>
            </View>
          )}

          <SecHead title={t('History')} />
          {historyDesc.length === 0 ? (
            <Text style={styles.emptyText}>{t('No entries yet.')}</Text>
          ) : (
            historyDesc.map((entry, i) => (
              <TouchableOpacity
                key={entry.id}
                style={[fine.row, i === historyDesc.length - 1 && styles.lastRow]}
                disabled={isSample}
                onPress={() =>
                  entry.uploadId ? router.push({ pathname: '/progress', params: { upload: entry.uploadId } }) : onEditPress(entry.id)
                }
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityState={{ disabled: isSample }}
              >
                <Text style={styles.historyDate}>{shortDay(entry.fecha)}</Text>
                <Text style={styles.historyValue}>
                  {num(entry.valor)} <Text style={styles.historyUnit}>{entry.unidad}</Text>
                  {entry.extra ? <Text style={styles.historyUnit}>{`  ·  ${entry.extra}`}</Text> : null}
                </Text>
                {!isSample && <Ionicons name={entry.uploadId ? 'flask-outline' : 'create-outline'} size={16} color={FINE.mute} />}
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: 'transparent' },
  content: { paddingBottom: 40 },
  body: { paddingHorizontal: 20 },
  describe: { ...ff('medium'), color: FINE.ivory, fontSize: 14, lineHeight: 20, marginTop: 10 },
  chart: { marginTop: 14 },
  tapHint: { ...fine.note, textAlign: 'center', marginTop: 6 },
  add: { alignItems: 'center', marginTop: 22 },
  sampleNote: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 16 },
  sampleNoteText: { ...fine.note, flex: 1, marginTop: 0 },
  emptyText: { ...fine.note, marginTop: 0 },
  lastRow: { borderBottomWidth: 0 },
  historyDate: { ...ff('regular'), color: FINE.mute, fontSize: 13, width: 44, fontVariant: ['tabular-nums'] },
  historyValue: { ...ff('regular'), flex: 1, color: FINE.ivory, fontSize: 15, fontVariant: ['tabular-nums'] },
  historyUnit: { ...ff('regular'), color: FINE.mute, fontSize: 13 },
});

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, withAlpha } from '@/constants/colors';
import { rangeBarLayout } from '@/utils/rangeBar';
import { num } from '@/i18n';

// El rango del laboratorio como una línea: en verde lo que está dentro, en naranja suave lo de fuera,
// los límites escritos debajo y el valor de la analítica señalado con un triángulo. Sin rojo: un valor
// fuera de rango no es un diagnóstico.
export const RangeBar = ({
  value,
  min,
  max,
  format = (n: number) => num(n),
}: {
  value: number;
  min: number | null;
  max: number | null;
  format?: (n: number) => string;
}) => {
  const L = rangeBarLayout(value, min, max);
  if (!L) return null;
  const start = L.minPct ?? 0;
  const end = L.maxPct ?? 100;
  return (
    <View style={styles.wrap} accessible accessibilityLabel={`${format(value)} · ${min !== null && min > 0 ? format(min) : ''}–${max !== null ? format(max) : ''}`}>
      <View style={styles.markerRow}>
        <View style={[styles.triangle, { left: `${L.valuePct}%` }]} />
      </View>
      <View style={styles.bar}>
        <View style={[styles.out, { width: `${start}%` }]} />
        <View style={[styles.in, { width: `${end - start}%` }]} />
        <View style={[styles.out, { flex: 1 }]} />
      </View>
      <View style={styles.labels}>
        {L.minPct !== null && min !== null && <Text style={[styles.label, { left: `${L.minPct}%` }]}>{format(min)}</Text>}
        {L.maxPct !== null && max !== null && <Text style={[styles.label, { left: `${L.maxPct}%` }]}>{format(max)}</Text>}
      </View>
    </View>
  );
};

const LABEL_W = 56;

const styles = StyleSheet.create({
  wrap: { marginTop: 6, marginHorizontal: LABEL_W / 2 - 4 },
  markerRow: { height: 9 },
  triangle: {
    position: 'absolute',
    top: 0,
    marginLeft: -6,
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: Colors.textPrimary,
  },
  bar: { flexDirection: 'row', height: 6, borderRadius: 3, overflow: 'hidden', marginTop: 1 },
  in: { backgroundColor: withAlpha(Colors.ok, 0.85) },
  out: { backgroundColor: withAlpha(Colors.attention, 0.5) },
  labels: { height: 16, marginTop: 3 },
  label: { position: 'absolute', width: LABEL_W, marginLeft: -LABEL_W / 2, textAlign: 'center', color: Colors.textMuted, fontSize: 11, fontWeight: '600' },
});

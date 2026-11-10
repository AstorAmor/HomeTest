import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, withAlpha } from '@/constants/colors';
import { ExtractedParametro } from '@/types/labReport';
import { getRangeStatus, RangeStatus, rangeStatusLabel } from '@/utils/rangeStatus';
import { markerKey } from '@/logic/labMarkers';
import { markerHref } from '@/utils/markerLinks';
import { RangeBar } from './RangeBar';
import { UnitLabel } from './UnitLabel';
import { num } from '@/i18n';

// Una fila de una analítica, igual en todos los grupos: el nombre con el valor debajo, a la derecha si está
// en rango o fuera y, debajo, la barra de rango. Al tocarla se abre ese marcador en Mis datos (fundador,
// 2026-11-06): su ficha con todos sus valores, qué es, para qué se mide, qué puede moverlo y, fuera de rango,
// qué se ha asociado a mejorarlo (antes eso se desplegaba aquí mismo). Textos de la base de conocimiento,
// pendientes de revisión médica: orientan, no diagnostican.
const ICON: Record<RangeStatus, string> = {
  en_rango: 'checkmark-circle',
  por_encima: 'arrow-up-circle',
  por_debajo: 'arrow-down-circle',
  sin_rango: 'remove-circle-outline',
};

export const statusColor = (s: RangeStatus) => (s === 'en_rango' ? Colors.ok : s === 'sin_rango' ? Colors.textMuted : Colors.attention);
export const statusIcon = (s: RangeStatus) => ICON[s];

export const LabValueRow = ({ p, divider, uploadId }: { p: ExtractedParametro; divider?: boolean; uploadId?: string }) => {
  const router = useRouter();
  const isNumber = typeof p.valor === 'number';
  const status: RangeStatus = isNumber ? getRangeStatus(p.valor, p.rango_min, p.rango_max) : 'sin_rango';
  const out = status === 'por_encima' || status === 'por_debajo';
  const color = statusColor(status);

  return (
    <TouchableOpacity
      style={[styles.item, divider && styles.divider]}
      onPress={() => router.push(markerHref(markerKey(p.nombre), uploadId ? `upload:${uploadId}` : undefined))}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={`${p.nombre}, ${rangeStatusLabel(status)}`}
    >
      <View style={styles.row}>
        <Ionicons name={ICON[status] as any} size={20} color={color} />
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{p.nombre}</Text>
          <View style={styles.valueRow}>
            <Text style={[styles.value, { color: out ? Colors.attention : Colors.textPrimary }]}>{isNumber ? num(p.valor) : String(p.valor ?? '—')}</Text>
            <UnitLabel unit={p.unidad} style={[styles.value, styles.unit, { color: out ? Colors.attention : Colors.textSecondary }]} />
          </View>
        </View>
        <Text style={[styles.badge, { color, backgroundColor: withAlpha(color, 0.12) }]}>{rangeStatusLabel(status)}</Text>
        <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
      </View>
      {isNumber && <RangeBar value={p.valor} min={p.rango_min} max={p.rango_max} />}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  item: { paddingVertical: 10 },
  divider: { borderTopWidth: 1, borderTopColor: Colors.divider },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  name: { color: Colors.textPrimary, fontSize: 14, fontWeight: '700' },
  valueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4, marginTop: 2 },
  value: { fontSize: 13, fontWeight: '800' },
  unit: { fontWeight: '600' },
  badge: { fontSize: 11, fontWeight: '800', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, overflow: 'hidden' },
});

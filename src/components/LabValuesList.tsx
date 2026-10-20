import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { ExtractedLabReport } from '@/types/labReport';
import { getRangeStatus, RangeStatus, rangeStatusLabel } from '@/utils/rangeStatus';
import { getParameterCard } from '@/utils/parameterInfo';
import { RangeBar } from './RangeBar';
import { UnitLabel } from './UnitLabel';
import { num } from '@/i18n';

// Todos los valores de una analítica guardada, compactos como «Para revisar»: una tarjeta por sección,
// una fila por valor con su barra de rango y, al tocarla, qué es. (Al revisar lo escaneado se sigue
// usando LabReportTable, que deja corregir cada valor.)
const ICON: Record<RangeStatus, string> = {
  en_rango: 'checkmark-circle',
  por_encima: 'arrow-up-circle',
  por_debajo: 'arrow-down-circle',
  sin_rango: 'remove-circle-outline',
};

const statusColor = (s: RangeStatus) => (s === 'en_rango' ? Colors.ok : s === 'sin_rango' ? Colors.textMuted : Colors.attention);

export const LabValuesList = ({ report }: { report: ExtractedLabReport }) => {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <>
      {report.secciones.map((sec, si) => (
        <View key={`${sec.titulo}-${si}`} style={styles.card}>
          <Text style={styles.title}>{sec.titulo}</Text>
          {sec.parametros.map((p, i) => {
            const key = `${si}-${i}`;
            const isNumber = typeof p.valor === 'number';
            const status: RangeStatus = isNumber ? getRangeStatus(p.valor, p.rango_min, p.rango_max) : 'sin_rango';
            const color = statusColor(status);
            const out = status === 'por_encima' || status === 'por_debajo';
            return (
              <View key={key} style={[styles.item, i > 0 && styles.divider]}>
                <TouchableOpacity
                  style={styles.row}
                  onPress={() => setOpen(open === key ? null : key)}
                  activeOpacity={0.8}
                  accessibilityLabel={`${p.nombre}, ${rangeStatusLabel(status)}`}
                >
                  <Ionicons name={ICON[status] as any} size={18} color={color} />
                  <Text style={styles.name}>{p.nombre}</Text>
                  <View style={styles.valueBox}>
                    <Text style={[styles.value, out && { color: Colors.attention }]}>{isNumber ? num(p.valor) : String(p.valor ?? '—')}</Text>
                    <UnitLabel unit={p.unidad} style={styles.unit} />
                  </View>
                </TouchableOpacity>
                {isNumber && <RangeBar value={p.valor} min={p.rango_min} max={p.rango_max} />}
                {open === key && <Text style={styles.info}>{getParameterCard(p.nombre).role}</Text>}
              </View>
            );
          })}
        </View>
      ))}
    </>
  );
};

const styles = StyleSheet.create({
  card: { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 12 },
  title: { color: Colors.textPrimary, fontSize: 15, fontWeight: '800', marginTop: 2, marginBottom: 2 },
  item: { paddingVertical: 9 },
  divider: { borderTopWidth: 1, borderTopColor: Colors.divider },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  name: { flex: 1, color: Colors.textPrimary, fontSize: 14, fontWeight: '600' },
  valueBox: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  value: { color: Colors.textPrimary, fontSize: 15, fontWeight: '800' },
  unit: { color: Colors.textSecondary, fontSize: 12 },
  info: { color: Colors.textSecondary, fontSize: 13, lineHeight: 18, marginTop: 8 },
});

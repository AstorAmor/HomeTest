import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '@/constants/colors';
import { ExtractedLabReport, ExtractedParametro } from '@/types/labReport';
import { getRangeStatus } from '@/utils/rangeStatus';
import { LabValueRow } from './LabValueRow';

// Los valores de una analítica guardada de un grupo («En rango» o «Sin referencia»; «Para revisar» es
// OutOfRangeSummary), con la misma fila que todos (LabValueRow): una tarjeta, con las secciones del
// laboratorio como subtítulos. (Al revisar lo escaneado se sigue usando LabReportTable, que deja
// corregir cada valor.)
export type ValueGroup = 'in' | 'none';

const inGroup = (p: ExtractedParametro, group: ValueGroup) => {
  const status = typeof p.valor === 'number' ? getRangeStatus(p.valor, p.rango_min, p.rango_max) : 'sin_rango';
  return group === 'in' ? status === 'en_rango' : status === 'sin_rango';
};

export const LabValuesList = ({ report, group, title }: { report: ExtractedLabReport; group: ValueGroup; title: string }) => {
  const [open, setOpen] = useState<string | null>(null);
  const sections = report.secciones
    .map((sec, si) => ({ sec, si, params: sec.parametros.map((p, i) => ({ p, i })).filter(({ p }) => inGroup(p, group)) }))
    .filter((x) => x.params.length);
  if (!sections.length) return null;
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      {sections.map(({ sec, si, params }) => (
        <View key={`${sec.titulo}-${si}`}>
          {sections.length > 1 && <Text style={styles.section}>{sec.titulo}</Text>}
          {params.map(({ p, i }, k) => {
            const key = `${si}-${i}`;
            return <LabValueRow key={key} p={p} open={open === key} onToggle={() => setOpen(open === key ? null : key)} divider={k > 0} />;
          })}
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  card: { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 16 },
  title: { color: Colors.textPrimary, fontSize: 16, fontWeight: '800', marginBottom: 2 },
  section: { color: Colors.textMuted, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 12 },
});

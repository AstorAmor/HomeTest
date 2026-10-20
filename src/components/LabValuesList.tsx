import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '@/constants/colors';
import { ExtractedLabReport } from '@/types/labReport';
import { LabValueRow } from './LabValueRow';
import { t } from '@/i18n';

// Todos los valores de una analítica guardada, con la misma fila que «Para revisar» (LabValueRow): una
// tarjeta por sección. (Al revisar lo escaneado se sigue usando LabReportTable, que deja corregir cada
// valor.)
export const LabValuesList = ({ report }: { report: ExtractedLabReport }) => {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <>
      <Text style={styles.hint}>{t('Tap a value to see what it is and what helps.')}</Text>
      {report.secciones.map((sec, si) => (
        <View key={`${sec.titulo}-${si}`} style={styles.card}>
          <Text style={styles.title}>{sec.titulo}</Text>
          {sec.parametros.map((p, i) => {
            const key = `${si}-${i}`;
            return <LabValueRow key={key} p={p} open={open === key} onToggle={() => setOpen(open === key ? null : key)} divider={i > 0} />;
          })}
        </View>
      ))}
    </>
  );
};

const styles = StyleSheet.create({
  hint: { color: Colors.textSecondary, fontSize: 12, marginBottom: 8 },
  card: { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 12 },
  title: { color: Colors.textPrimary, fontSize: 15, fontWeight: '800', marginTop: 2, marginBottom: 2 },
});

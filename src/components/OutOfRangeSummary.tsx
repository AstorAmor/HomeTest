import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, withAlpha } from '@/constants/colors';
import { ExtractedLabReport } from '@/types/labReport';
import { getRangeStatus } from '@/utils/rangeStatus';
import { LabValueRow } from './LabValueRow';
import { t } from '@/i18n';

// "Para revisar" de una analítica subida: los valores fuera del rango del laboratorio, cada uno con
// su resumen al tocarlo (qué es, para qué se mide, qué puede moverlo y qué ayuda según tu plan). La
// fila es la misma que en «Todos tus valores» (LabValueRow).
export const OutOfRangeSummary = ({ report }: { report: ExtractedLabReport }) => {
  const [open, setOpen] = useState<string | null>(null);
  const items = report.secciones.flatMap((sec) =>
    sec.parametros
      .filter((p) => typeof p.valor === 'number')
      .map((p) => ({ p, status: getRangeStatus(p.valor, p.rango_min, p.rango_max) }))
      .filter((x) => x.status === 'por_encima' || x.status === 'por_debajo'),
  );
  if (!items.length) {
    return (
      <View style={[styles.card, styles.allGood]}>
        <Ionicons name="checkmark-circle" size={20} color={Colors.ok} />
        <Text style={styles.allGoodText}>{t('Everything with a reference is within range.')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{t('To review')}</Text>
      <Text style={styles.sub}>{t('Tap a value to see what it is and what has been linked to better values.')}</Text>
      {items.map(({ p }, i) => {
        const key = `${p.nombre}-${i}`;
        return <LabValueRow key={key} p={p} open={open === key} onToggle={() => setOpen(open === key ? null : key)} divider={i > 0} />;
      })}
      <Text style={styles.note}>{t('A value out of range is not a diagnosis. Your doctor puts it in context.')}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: withAlpha(Colors.attention, 0.45),
    borderRadius: 16,
    padding: 14,
    marginHorizontal: 20,
    marginBottom: 16,
  },
  allGood: { flexDirection: 'row', alignItems: 'center', gap: 8, borderColor: Colors.cardBorder },
  allGoodText: { flex: 1, color: Colors.textPrimary, fontSize: 14, fontWeight: '600' },
  title: { color: Colors.textPrimary, fontSize: 16, fontWeight: '800' },
  sub: { color: Colors.textSecondary, fontSize: 12, marginTop: 2, marginBottom: 6 },
  note: { color: Colors.textMuted, fontSize: 11, marginTop: 8 },
});

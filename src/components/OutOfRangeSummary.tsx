import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ExtractedLabReport } from '@/types/labReport';
import { getRangeStatus } from '@/utils/rangeStatus';
import { SecHead } from './fine/Fine';
import { LabValueRow } from './LabValueRow';
import { t } from '@/i18n';
import { FINE, ff, fine } from '@/theme/fine';

// "Para revisar" de una analítica subida: los valores fuera del rango del laboratorio. Al tocar uno se abre
// ese marcador en Mis datos (qué es, qué puede moverlo y todos sus valores). La fila es la misma que en
// «En rango» (LabValueRow). Desde el 2026-11-16, sin tarjeta con borde de color: la cabecera fina de sección
// y las filas con línea fina (lo de fuera, en oro).
export const OutOfRangeSummary = ({ report, uploadId }: { report: ExtractedLabReport; uploadId?: string }) => {
  const items = report.secciones.flatMap((sec) =>
    sec.parametros
      .filter((p) => typeof p.valor === 'number')
      .map((p) => ({ p, status: getRangeStatus(p.valor, p.rango_min, p.rango_max) }))
      .filter((x) => x.status === 'por_encima' || x.status === 'por_debajo'),
  );
  if (!items.length) {
    return (
      <View style={[styles.wrap, styles.allGood]}>
        <Ionicons name="checkmark" size={17} color={FINE.jade} />
        <Text style={styles.allGoodText}>{t('Everything with a reference is within range.')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <SecHead title={t('To review')} style={styles.head} />
      <Text style={[fine.note, styles.sub]}>{t('Tap a value to see what it is and all your results for it.')}</Text>
      {items.map(({ p }, i) => (
        <LabValueRow key={`${p.nombre}-${i}`} p={p} divider={i > 0} uploadId={uploadId} />
      ))}
      <Text style={fine.note}>{t('A value out of range is not a diagnosis. Your doctor puts it in context.')}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { marginHorizontal: 20 },
  head: { marginBottom: 0 },
  sub: { marginTop: 0, marginBottom: 2 },
  allGood: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 24, paddingTop: 14, borderTopWidth: 1, borderTopColor: FINE.rule },
  allGoodText: { ...ff('regular'), flex: 1, color: FINE.ivory, fontSize: 14, lineHeight: 20 },
});

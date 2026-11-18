import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { ExtractedParametro } from '@/types/labReport';
import { getRangeStatus, RangeStatus, rangeStatusLabel, rangeText } from '@/utils/rangeStatus';
import { markerKey } from '@/logic/labMarkers';
import { markerHref } from '@/utils/markerLinks';
import { Chev } from './fine/Fine';
import { LabGauge, labStyles, labToneColor, rangeTone, StatusWord } from './fine/FineLab';
import { UnitLabel } from './UnitLabel';
import { num, t } from '@/i18n';
import { FINE, ff, fine } from '@/theme/fine';

// Una fila de una analítica, igual en todos los grupos: el nombre con el rango del laboratorio debajo y su línea
// de rango; a la derecha, el valor y si está en rango o fuera. Al tocarla se abre ese marcador en Mis datos
// (fundador, 2026-11-06): su ficha con todos sus valores, qué es, para qué se mide, qué puede moverlo y, fuera de
// rango, qué se ha asociado a mejorarlo. Textos de la base de conocimiento, pendientes de revisión médica:
// orientan, no diagnostican. Desde el 2026-11-16, en fino: fila con línea fina, la línea de rango con la franja
// jade y el punto de luz, y lo de fuera en oro, sin rojos ni iconos rellenos.
const ICON: Record<RangeStatus, string> = {
  en_rango: 'checkmark-circle',
  por_encima: 'arrow-up-circle',
  por_debajo: 'arrow-down-circle',
  sin_rango: 'remove-circle-outline',
};

// El color de un estado, en los tonos finos: jade en rango, oro fuera, apagado sin referencia
export const statusColor = (s: RangeStatus) => labToneColor(rangeTone(s));
export const statusIcon = (s: RangeStatus) => ICON[s];

export const LabValueRow = ({ p, divider, uploadId }: { p: ExtractedParametro; divider?: boolean; uploadId?: string }) => {
  const router = useRouter();
  const isNumber = typeof p.valor === 'number';
  const status: RangeStatus = isNumber ? getRangeStatus(p.valor, p.rango_min, p.rango_max) : 'sin_rango';
  const out = status === 'por_encima' || status === 'por_debajo';
  const range = rangeText(p.rango_min, p.rango_max);

  return (
    <TouchableOpacity
      style={[fine.row, styles.item, divider && styles.divider]}
      onPress={() => router.push(markerHref(markerKey(p.nombre), uploadId ? `upload:${uploadId}` : undefined))}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`${p.nombre}, ${rangeStatusLabel(status)}`}
    >
      <View style={styles.flex}>
        <Text style={fine.rowTitle} numberOfLines={2}>
          {p.nombre}
        </Text>
        {range ? <Text style={fine.rowSub}>{t('range {range}', { range })}</Text> : null}
        {isNumber && <LabGauge value={p.valor} low={p.rango_min} high={p.rango_max} style={labStyles.rowGauge} />}
      </View>
      <View style={styles.right}>
        <View style={styles.valueRow}>
          <Text style={[fine.rowValue, out && { color: FINE.gold }]}>{isNumber ? num(p.valor) : String(p.valor ?? '—')}</Text>
          {p.unidad ? <UnitLabel unit={p.unidad} style={styles.unit} /> : null}
        </View>
        <StatusWord label={rangeStatusLabel(status)} tone={rangeTone(status)} />
      </View>
      <Chev />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  // La línea va encima de cada fila menos la primera (como antes), no debajo
  item: { borderBottomWidth: 0 },
  divider: { borderTopWidth: 1, borderTopColor: FINE.line },
  flex: { flex: 1, minWidth: 0 },
  right: { alignItems: 'flex-end', gap: 2, maxWidth: '45%' },
  valueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  unit: { ...ff('regular'), color: FINE.mute, fontSize: 11.5 },
});

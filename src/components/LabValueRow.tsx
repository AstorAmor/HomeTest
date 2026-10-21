import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, withAlpha } from '@/constants/colors';
import { ExtractedParametro } from '@/types/labReport';
import { getRangeStatus, RangeStatus, rangeStatusLabel } from '@/utils/rangeStatus';
import { getParameterCard } from '@/utils/parameterInfo';
import { markerIdForExtractedName } from '@/data/markerMatching';
import { planRuleForMarker } from '@/utils/planUpdate';
import { RangeBar } from './RangeBar';
import { UnitLabel } from './UnitLabel';
import { labEvidence } from '@/utils/labEvidence';
import { num, t } from '@/i18n';

// Una fila de una analítica, igual en todos los grupos: el nombre con el valor debajo, a la derecha si
// está en rango o fuera y la flecha para desplegar qué es, para qué se mide y qué puede moverlo; fuera
// de rango, además, qué se ha asociado a mejorarlo (utils/labEvidence, lenguaje prudente) o, si no hay
// nada claro, que lo hable con un médico. Debajo, la barra de rango. Textos de la base de conocimiento
// (pendientes de revisión médica): orientan, no diagnostican.
const ICON: Record<RangeStatus, string> = {
  en_rango: 'checkmark-circle',
  por_encima: 'arrow-up-circle',
  por_debajo: 'arrow-down-circle',
  sin_rango: 'remove-circle-outline',
};

export const statusColor = (s: RangeStatus) => (s === 'en_rango' ? Colors.ok : s === 'sin_rango' ? Colors.textMuted : Colors.attention);

export const LabValueRow = ({ p, open, onToggle, divider }: { p: ExtractedParametro; open: boolean; onToggle: () => void; divider?: boolean }) => {
  const router = useRouter();
  const isNumber = typeof p.valor === 'number';
  const status: RangeStatus = isNumber ? getRangeStatus(p.valor, p.rango_min, p.rango_max) : 'sin_rango';
  const out = status === 'por_encima' || status === 'por_debajo';
  const color = statusColor(status);
  const markerId = markerIdForExtractedName(p.nombre);
  const rule = markerId ? planRuleForMarker(markerId) : null;
  const card = open ? getParameterCard(p.nombre) : null;
  const evidence = out ? labEvidence(markerId, status === 'por_encima' ? 'high' : 'low') : null;

  return (
    <View style={[styles.item, divider && styles.divider]}>
      <TouchableOpacity style={styles.row} onPress={onToggle} activeOpacity={0.8} accessibilityLabel={`${p.nombre}, ${rangeStatusLabel(status)}`}>
        <Ionicons name={ICON[status] as any} size={20} color={color} />
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{p.nombre}</Text>
          <View style={styles.valueRow}>
            <Text style={[styles.value, { color: out ? Colors.attention : Colors.textPrimary }]}>{isNumber ? num(p.valor) : String(p.valor ?? '—')}</Text>
            <UnitLabel unit={p.unidad} style={[styles.value, styles.unit, { color: out ? Colors.attention : Colors.textSecondary }]} />
          </View>
        </View>
        <Text style={[styles.badge, { color, backgroundColor: withAlpha(color, 0.12) }]}>{rangeStatusLabel(status)}</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={Colors.textMuted} />
      </TouchableOpacity>
      {isNumber && <RangeBar value={p.valor} min={p.rango_min} max={p.rango_max} />}
      {open && card && (
        <View style={styles.body}>
          <Text style={styles.label}>{t('What it is')}</Text>
          <Text style={styles.text}>{card.role}</Text>
          {card.relevance ? (
            <>
              <Text style={styles.label}>{t('Why it is measured')}</Text>
              <Text style={styles.text}>{card.relevance}</Text>
            </>
          ) : null}
          {card.factors ? (
            <>
              <Text style={styles.label}>{t('What can move it')}</Text>
              <Text style={styles.text}>{card.factors}</Text>
            </>
          ) : null}
          {out && (
            <>
              <Text style={styles.label}>{evidence ? t('What has been associated with better values') : t('What to do')}</Text>
              <Text style={styles.text}>{evidence ? t(evidence) : t('Talk to a doctor about this result before changing anything.')}</Text>
            </>
          )}
          {out && (
            <View style={styles.links}>
              {rule && (
                <TouchableOpacity style={styles.link} onPress={() => router.push('/action-plan')}>
                  <Ionicons name="trending-up" size={16} color={Colors.accent} />
                  <Text style={styles.linkText}>{t('How it could change with your plan')}</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.link} onPress={() => router.push({ pathname: '/professionals', params: { role: 'doctor' } })}>
                <Ionicons name="medkit-outline" size={16} color={Colors.accent} />
                <Text style={styles.linkText}>{t('Talk to a doctor')}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}
    </View>
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
  body: { marginTop: 10, marginLeft: 30, gap: 3 },
  label: { color: Colors.textMuted, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', marginTop: 6 },
  text: { color: Colors.textPrimary, fontSize: 13, lineHeight: 19 },
  links: { gap: 8, marginTop: 10 },
  link: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  linkText: { color: Colors.accent, fontSize: 13, fontWeight: '700' },
});

import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, withAlpha } from '@/constants/colors';
import { ExtractedLabReport } from '@/types/labReport';
import { getRangeStatus, rangeStatusLabel, rangeText } from '@/utils/rangeStatus';
import { getParameterCard } from '@/utils/parameterInfo';
import { markerIdForExtractedName } from '@/data/markerMatching';
import { planRuleForMarker } from '@/utils/planUpdate';
import { num, t } from '@/i18n';

// "Para revisar" de una analítica subida: los valores fuera del rango del laboratorio, cada uno con
// su resumen al tocarlo (qué es, para qué se mide, qué puede moverlo y qué ayuda según tu plan).
// Textos de la base de conocimiento (pendientes de revisión médica): orientan, no diagnostican.
export const OutOfRangeSummary = ({ report }: { report: ExtractedLabReport }) => {
  const router = useRouter();
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
      <Text style={styles.sub}>{t('Tap a value to see what it is and what helps.')}</Text>
      {items.map(({ p, status }, i) => {
        const key = `${p.nombre}-${i}`;
        const isOpen = open === key;
        const color = Colors.attention;
        const range = rangeText(p.rango_min, p.rango_max);
        const markerId = markerIdForExtractedName(p.nombre);
        const card = getParameterCard(p.nombre);
        const rule = markerId ? planRuleForMarker(markerId) : null;
        return (
          <View key={key} style={[styles.item, i > 0 && styles.divider]}>
            <TouchableOpacity style={styles.row} onPress={() => setOpen(isOpen ? null : key)} activeOpacity={0.8}>
              <Ionicons name={status === 'por_encima' ? 'arrow-up-circle' : 'arrow-down-circle'} size={20} color={color} />
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{p.nombre}</Text>
                <Text style={styles.value}>
                  <Text style={{ color, fontWeight: '800' }}>
                    {num(p.valor)} {p.unidad}
                  </Text>
                  {range ? `  ·  ${t('Range: {range}', { range })}` : ''}
                </Text>
              </View>
              <Text style={[styles.badge, { color, backgroundColor: withAlpha(color, 0.12) }]}>{rangeStatusLabel(status)}</Text>
              <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={18} color={Colors.textMuted} />
            </TouchableOpacity>
            {isOpen && (
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
                <Text style={styles.label}>{t('What helps')}</Text>
                <Text style={styles.text}>
                  {rule ? `${rule.title}: ${rule.why}` : t('Talk to a doctor about this result before changing anything.')}
                </Text>
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
              </View>
            )}
          </View>
        );
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
  item: { paddingVertical: 10 },
  divider: { borderTopWidth: 1, borderTopColor: Colors.divider },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  name: { color: Colors.textPrimary, fontSize: 14, fontWeight: '700' },
  value: { color: Colors.textSecondary, fontSize: 12, marginTop: 2 },
  badge: { fontSize: 11, fontWeight: '800', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, overflow: 'hidden' },
  body: { marginTop: 10, marginLeft: 30, gap: 3 },
  label: { color: Colors.textMuted, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', marginTop: 6 },
  text: { color: Colors.textPrimary, fontSize: 13, lineHeight: 19 },
  links: { gap: 8, marginTop: 10 },
  link: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  linkText: { color: Colors.accent, fontSize: 13, fontWeight: '700' },
  note: { color: Colors.textMuted, fontSize: 11, marginTop: 8 },
});

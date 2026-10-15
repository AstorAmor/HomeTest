import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Colors, withAlpha } from '@/constants/colors';
import { baselineReport, currentReport } from '@/data/reportRepository';
import { showSamples } from '@/data/dataMode';
import { AppIcon } from '@/components/HealthIcons';
import { KuovaAgeBadge } from '@/components/KuovaAgeBadge';
import { kuovaAge, QUALITY_LABEL } from '@/logic/kuovaAge';
import { GaugeBar } from '@/components/GaugeBar';
import { getMarkerDisplayNameEn, getMarkerValueTextEn } from '@/data/reportContentEn';
import type { ReportMarker } from '@/types/report';
import { num, t } from '@/i18n';
import { TAB } from '@/constants/tabs';

// "Edad KUOVA" (tu edad biológica), al tocar la insignia de Mis datos. Arriba, como en Whoop: la
// insignia con los años de diferencia a un lado y el cambio desde la analítica anterior al otro; debajo,
// qué la mueve (los 9 valores de PhenoAge con su regla y si te quitan o te suman años) y cómo se
// calcula. Un único número con su grado de confianza (src/logic/kuovaAge.ts). Ahora es un
// EJEMPLO: el cálculo real está pendiente de validar con el asesor médico
// (src/logic/rulesEngine/biologicalAge.ts).

// Los 9 valores de una analítica normal que usa PhenoAge, agrupados por lo que reflejan
const INPUTS: { group: string; icon: string; markers: string[] }[] = [
  { group: 'Inflammation', icon: 'flame-outline', markers: ['hs_crp'] },
  { group: 'Sugar metabolism', icon: 'glucose', markers: ['glucose'] },
  { group: 'Liver and nutrition', icon: 'leaf-outline', markers: ['albumin', 'alp'] },
  { group: 'Kidneys', icon: 'kidney', markers: ['creatinine'] },
  { group: 'Blood and defences', icon: 'shield-checkmark-outline', markers: ['wbc', 'lymphocytes_pct', 'mcv', 'rdw'] },
];

const allMarkers = currentReport.sections.flatMap((sec) => sec.markers ?? []);
const findMarker = (id: string) => allMarkers.find((m) => m.marker_id === id);

// Lo que dice el informe de cada valor: si es de los que más te quitan o suman años, o si está en rango
const effectOf = (m: ReportMarker, drivers: { marker_id: string; direction: string }[]) => {
  const d = drivers.find((x) => x.marker_id === m.marker_id);
  if (d) return d.direction === 'resta' ? { label: 'Takes years off', color: Colors.ok, icon: 'arrow-down' } : { label: 'Adds years', color: Colors.attention, icon: 'arrow-up' };
  return m.flag === 'en_rango' ? { label: 'In range', color: Colors.textSecondary, icon: 'remove' } : { label: 'Out of range', color: Colors.warning, icon: 'alert' };
};

// Una fila por valor: nombre, cifra, regla (verde en el rango del laboratorio) y su efecto
const FactorRow = ({ m, drivers }: { m: ReportMarker; drivers: { marker_id: string; direction: string }[] }) => {
  const v = typeof m.value === 'number' ? m.value : null;
  const low = m.range?.low ?? null;
  const high = m.range?.high ?? null;
  const span = low != null && high != null ? high - low : Math.abs(v ?? 1) || 1;
  const min = low != null ? low - span * 0.6 : 0;
  const max = high != null ? high + span * 0.6 : (v ?? 0) * 2 || 1;
  const e = effectOf(m, drivers);
  return (
    <View style={styles.factor}>
      <View style={styles.factorHead}>
        <Text style={styles.factorName}>{getMarkerDisplayNameEn(m.marker_id, m.display_name)}</Text>
        <Text style={styles.factorValue}>{getMarkerValueTextEn(m.value, m.unit)}</Text>
      </View>
      {low != null && high != null && v != null && (
        <GaugeBar
          min={min}
          max={max}
          value={v}
          range={[low, high]}
          stops={[
            { at: min, color: Colors.attention },
            { at: low, color: Colors.green },
            { at: high, color: Colors.green },
            { at: max, color: Colors.attention },
          ]}
        />
      )}
      <View style={styles.factorFoot}>
        <Ionicons name={e.icon as any} size={12} color={e.color} />
        <Text style={[styles.factorEffect, { color: e.color }]}>{t(e.label)}</Text>
        {m.trend?.previous_value != null && (
          <Text style={styles.factorTrend}>{t('Previous: {v}', { v: getMarkerValueTextEn(m.trend.previous_value, m.unit) })}</Text>
        )}
      </View>
    </View>
  );
};

const SOURCES = [
  { label: 'Levine ME et al. An epigenetic biomarker of aging for lifespan and healthspan. Aging (Albany NY), 2018.', url: 'https://doi.org/10.18632/aging.101414' },
  { label: 'Liu Z et al. A new aging measure captures morbidity and mortality risk across diverse subpopulations from NHANES IV. PLoS Med, 2018.', url: 'https://doi.org/10.1371/journal.pmed.1002718' },
];

export const BiologicalAgeScreen = () => {
  const router = useRouter();
  const p = currentReport.summary.phenoage;
  // Cuenta real: la de ejemplo no se enseña (aún no hay cálculo real)
  const k = p.available && showSamples() ? kuovaAge(p) : null;
  const before = baselineReport.summary.phenoage;
  const change = k && before.available ? Math.round((k.age - kuovaAge(before).age) * 10) / 10 : null;
  const years = (n: number) => t(Math.abs(n) === 1 ? '{n} year' : '{n} years', { n: num(Math.abs(n)) });

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader title={t('KUOVA age')} showBack />

        {!k && (
          <View style={styles.sampleTag}>
            <Ionicons name="flask-outline" size={13} color={Colors.warning} />
            <Text style={styles.sampleText}>
              {t('You do not have your KUOVA age yet. We will work it out from 9 values of your blood test once our medical team has validated the method.')}
            </Text>
          </View>
        )}
        {k && (
          <>
            <View style={styles.top}>
              <View style={styles.topStat}>
                <Text style={[styles.topValue, { color: k.diff >= 0 ? Colors.gold : Colors.attention }]}>{num(Math.abs(k.diff).toFixed(1))}</Text>
                <Text style={styles.topLabel}>{k.diff >= 0 ? t('years younger') : t('years older')}</Text>
              </View>
              <KuovaAgeBadge size={176} value={num(k.age.toFixed(1))} good={k.diff >= 0} />
              <View style={styles.topStat}>
                <Text style={[styles.topValue, { color: change != null && change > 0 ? Colors.attention : Colors.ok }]}>
                  {change == null ? '—' : `${change > 0 ? '+' : change < 0 ? '−' : ''}${num(Math.abs(change).toFixed(1))}`}
                </Text>
                <Text style={styles.topLabel}>{t('since your previous test')}</Text>
              </View>
            </View>

            <View style={styles.confidence}>
              <View style={styles.confidenceIcon}>
                <Ionicons name="checkmark" size={16} color={Colors.background} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.confidenceTitle}>{t('{n}% confidence', { n: k.confidence })}</Text>
                <Text style={styles.confidenceSub}>{t(QUALITY_LABEL[k.quality])}</Text>
              </View>
            </View>
            <View style={styles.sampleTag}>
              <Ionicons name="flask-outline" size={13} color={Colors.warning} />
              <Text style={styles.sampleText}>
                {t('Sample for now: we will calculate yours from your blood tests once our medical team has validated the method.')}
              </Text>
            </View>

            {/* Qué la mueve: los 9 valores, por grupos */}
            <Text style={styles.section}>{t('What moves it')}</Text>
            {INPUTS.map((g) => (
              <View key={g.group} style={styles.groupCard}>
                <View style={styles.groupHead}>
                  <AppIcon name={g.icon} size={18} color={Colors.accent} />
                  <Text style={styles.groupTitle}>{t(g.group)}</Text>
                </View>
                {g.markers.map((id) => {
                  const m = findMarker(id);
                  return m ? <FactorRow key={id} m={m} drivers={p.drivers ?? []} /> : null;
                })}
              </View>
            ))}
            <TouchableOpacity style={styles.labLink} onPress={() => router.navigate({ pathname: '/(tabs)', params: { tab: String(TAB.lab) } } as any)}>
              <Ionicons name="flask-outline" size={18} color={Colors.accent} />
              <Text style={styles.labLinkText}>{t('See your values in Lab')}</Text>
              <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
            </TouchableOpacity>
          </>
        )}

        <Text style={styles.section}>{t('How it is calculated')}</Text>
        <Text style={styles.body}>
          {t(
            'We use PhenoAge, a method published by Levine and colleagues (2018). It combines your age with 9 values from an ordinary blood test and compares them with thousands of people followed for years in a large US health survey (NHANES).'
          )}
        </Text>
        <Text style={styles.body}>
          {t(
            'The result is the age at which, on average, people have a profile like yours. If it comes out below your real age, your body is ageing better than average; above it, there is room to improve.'
          )}
        </Text>

        <Text style={styles.section}>{t('What the confidence means')}</Text>
        <Text style={styles.body}>
          {t(
            'The same blood test varies a little from one day to another and from one lab to another. That is why next to your KUOVA age we show how much you can trust it: with high confidence, changes between your tests are real; with low confidence, repeat the test before drawing conclusions.'
          )}
        </Text>

        <Text style={styles.section}>{t('What improves it')}</Text>
        <Text style={styles.body}>
          {t(
            'Inflammation, blood sugar control and your general health weigh the most. Sleep, physical activity and diet can improve them. A recent cold or infection raises CRP for a few weeks and can make it look older than it is: in that case, repeat the test later.'
          )}
        </Text>

        <Text style={styles.section}>{t('What it is not')}</Text>
        <Text style={styles.body}>
          {t('It is not a diagnosis or a prediction for you personally: it is a statistical estimate. It is most useful to compare yourself with yourself over time.')}
        </Text>

        <Text style={styles.section}>{t('Sources')}</Text>
        {SOURCES.map((s) => (
          <TouchableOpacity key={s.url} onPress={() => Linking.openURL(s.url)}>
            <Text style={styles.source}>{s.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: 20, paddingBottom: 40 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4, marginBottom: 14 },
  topStat: { flex: 1, alignItems: 'center', gap: 2 },
  topValue: { fontSize: 26, fontWeight: '800' },
  topLabel: { color: Colors.textSecondary, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', textAlign: 'center', letterSpacing: 0.4 },
  groupCard: { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 16, padding: 14, marginBottom: 10, gap: 12 },
  groupHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  factor: { gap: 4 },
  factorHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
  factorName: { flex: 1, color: Colors.textPrimary, fontSize: 13, fontWeight: '700' },
  factorValue: { color: Colors.textPrimary, fontSize: 13, fontWeight: '800' },
  factorFoot: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  factorEffect: { fontSize: 11, fontWeight: '800' },
  factorTrend: { color: Colors.textMuted, fontSize: 11, marginLeft: 'auto' },
  changeChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.background, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 5, marginTop: 6 },
  changeText: { color: Colors.textPrimary, fontSize: 13, fontWeight: '700' },
  confidence: { flexDirection: 'row', alignItems: 'center', gap: 12, alignSelf: 'stretch', backgroundColor: withAlpha(Colors.ok, 0.1), borderRadius: 14, padding: 12, marginTop: 12 },
  confidenceIcon: { width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.ok, alignItems: 'center', justifyContent: 'center' },
  confidenceTitle: { color: Colors.ok, fontSize: 17, fontWeight: '800' },
  confidenceSub: { color: Colors.textSecondary, fontSize: 12, marginTop: 2 },
  sampleTag: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 10, backgroundColor: withAlpha(Colors.warning, 0.1), borderRadius: 10, padding: 10 },
  sampleText: { color: Colors.textSecondary, fontSize: 12, lineHeight: 17, flex: 1 },
  section: { color: Colors.textPrimary, fontSize: 17, fontWeight: '800', marginTop: 22, marginBottom: 8 },
  body: { color: Colors.textSecondary, fontSize: 14, lineHeight: 21, marginBottom: 8 },
  groupTitle: { color: Colors.textPrimary, fontSize: 15, fontWeight: '800' },
  labLink: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 14, padding: 14 },
  labLinkText: { flex: 1, color: Colors.textPrimary, fontSize: 14, fontWeight: '700' },
  source: { color: Colors.accent, fontSize: 12, lineHeight: 18, marginBottom: 8 },
});

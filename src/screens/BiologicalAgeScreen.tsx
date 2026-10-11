import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Colors, withAlpha } from '@/constants/colors';
import { baselineReport, currentReport } from '@/data/reportRepository';
import { AppIcon } from '@/components/HealthIcons';
import { kuovaAge, QUALITY_LABEL } from '@/logic/kuovaAge';
import { num, t } from '@/i18n';

// "Edad KUOVA" (tu edad biológica): un único número con su grado de confianza (src/logic/kuovaAge.ts)
// y cómo se calcula (PhenoAge); los resultados de la analítica viven en Laboratorio. Ahora es un
// EJEMPLO: el cálculo real está pendiente de validar con el asesor médico
// (src/logic/rulesEngine/biologicalAge.ts).

// Los 9 valores de una analítica normal que usa PhenoAge, agrupados por lo que reflejan
const INPUTS: { group: string; icon: string; markers: string[] }[] = [
  { group: 'Inflammation', icon: 'flame-outline', markers: ['C-reactive protein (CRP)'] },
  { group: 'Sugar metabolism', icon: 'glucose', markers: ['Glucose'] },
  { group: 'Liver and nutrition', icon: 'leaf-outline', markers: ['Albumin', 'Alkaline phosphatase'] },
  { group: 'Kidneys', icon: 'kidney', markers: ['Creatinine'] },
  { group: 'Blood and defences', icon: 'shield-checkmark-outline', markers: ['White blood cells', 'Lymphocytes (%)', 'Red cell size (MCV)', 'Red cell size variation (RDW)'] },
];

const SOURCES = [
  { label: 'Levine ME et al. An epigenetic biomarker of aging for lifespan and healthspan. Aging (Albany NY), 2018.', url: 'https://doi.org/10.18632/aging.101414' },
  { label: 'Liu Z et al. A new aging measure captures morbidity and mortality risk across diverse subpopulations from NHANES IV. PLoS Med, 2018.', url: 'https://doi.org/10.1371/journal.pmed.1002718' },
];

export const BiologicalAgeScreen = () => {
  const router = useRouter();
  const p = currentReport.summary.phenoage;
  const k = p.available ? kuovaAge(p) : null;
  const before = baselineReport.summary.phenoage;
  const change = k && before.available ? Math.round((k.age - kuovaAge(before).age) * 10) / 10 : null;
  const years = (n: number) => t(Math.abs(n) === 1 ? '{n} year' : '{n} years', { n: num(Math.abs(n)) });

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader title={t('KUOVA age')} showBack />

        {k && (
          <View style={styles.hero}>
            <Text style={styles.heroLabel}>{t('Your KUOVA age')}</Text>
            <Text style={styles.heroValue}>{num(k.age.toFixed(1))}</Text>
            <Text style={[styles.heroDiff, { color: k.diff >= 0 ? Colors.ok : Colors.attention }]}>
              {k.diff >= 0 ? t('{years} younger', { years: years(k.diff) }) : t('{years} older', { years: years(k.diff) })}
            </Text>
            <Text style={styles.heroSub}>{t('Your age: {age}', { age: p.chronological_age })}</Text>
            {change !== null && change !== 0 && (
              <View style={styles.changeChip}>
                <Ionicons name={change < 0 ? 'caret-down' : 'caret-up'} size={13} color={change < 0 ? Colors.ok : Colors.attention} />
                <Text style={styles.changeText}>{t('{n} since your previous test', { n: `${change > 0 ? '+' : '−'}${num(Math.abs(change).toFixed(1))}` })}</Text>
              </View>
            )}
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
          </View>
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

        <Text style={styles.section}>{t('The 9 values it uses')}</Text>
        <View style={styles.card}>
          {INPUTS.map((g, i) => (
            <View key={g.group} style={[styles.group, i > 0 && styles.divider]}>
              <AppIcon name={g.icon} size={18} color={Colors.accent} />
              <View style={{ flex: 1 }}>
                <Text style={styles.groupTitle}>{t(g.group)}</Text>
                <Text style={styles.groupMarkers}>{g.markers.map((m) => t(m)).join(' · ')}</Text>
              </View>
            </View>
          ))}
        </View>
        <TouchableOpacity style={styles.labLink} onPress={() => router.navigate({ pathname: '/(tabs)', params: { tab: '3' } } as any)}>
          <Ionicons name="flask-outline" size={18} color={Colors.accent} />
          <Text style={styles.labLinkText}>{t('See your values in Lab')}</Text>
          <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
        </TouchableOpacity>

        <Text style={styles.section}>{t('What the confidence means')}</Text>
        <Text style={styles.body}>
          {t(
            'The same blood test varies a little from one day to another and from one lab to another. That is why next to your KUOVA age we show how much you can trust it: with high confidence, changes between your tests are real; with low confidence, repeat the test before drawing conclusions.'
          )}
        </Text>

        <Text style={styles.section}>{t('What moves it')}</Text>
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
  hero: { alignItems: 'center', backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 18, padding: 18, marginTop: 8, gap: 4 },
  heroLabel: { color: Colors.textSecondary, fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
  heroValue: { color: Colors.textPrimary, fontSize: 64, fontWeight: '800', lineHeight: 72 },
  heroDiff: { fontSize: 18, fontWeight: '800' },
  changeChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.background, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 5, marginTop: 6 },
  changeText: { color: Colors.textPrimary, fontSize: 13, fontWeight: '700' },
  confidence: { flexDirection: 'row', alignItems: 'center', gap: 12, alignSelf: 'stretch', backgroundColor: withAlpha(Colors.ok, 0.1), borderRadius: 14, padding: 12, marginTop: 12 },
  confidenceIcon: { width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.ok, alignItems: 'center', justifyContent: 'center' },
  confidenceTitle: { color: Colors.ok, fontSize: 17, fontWeight: '800' },
  confidenceSub: { color: Colors.textSecondary, fontSize: 12, marginTop: 2 },
  heroSub: { color: Colors.textSecondary, fontSize: 13 },
  sampleTag: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 10, backgroundColor: withAlpha(Colors.warning, 0.1), borderRadius: 10, padding: 10 },
  sampleText: { color: Colors.textSecondary, fontSize: 12, lineHeight: 17, flex: 1 },
  section: { color: Colors.textPrimary, fontSize: 17, fontWeight: '800', marginTop: 22, marginBottom: 8 },
  body: { color: Colors.textSecondary, fontSize: 14, lineHeight: 21, marginBottom: 8 },
  card: { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 16, paddingHorizontal: 14 },
  group: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 12 },
  divider: { borderTopWidth: 1, borderTopColor: Colors.divider },
  groupTitle: { color: Colors.textPrimary, fontSize: 14, fontWeight: '700' },
  groupMarkers: { color: Colors.textSecondary, fontSize: 13, lineHeight: 18, marginTop: 2 },
  labLink: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 14, padding: 14 },
  labLinkText: { flex: 1, color: Colors.textPrimary, fontSize: 14, fontWeight: '700' },
  source: { color: Colors.accent, fontSize: 12, lineHeight: 18, marginBottom: 8 },
});

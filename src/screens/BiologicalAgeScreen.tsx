import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Colors, withAlpha } from '@/constants/colors';
import { currentReport } from '@/data/reportRepository';
import { t } from '@/i18n';

// "Tu edad biológica": cómo se calcula (PhenoAge), no los resultados de la analítica (esos viven en
// Laboratorio). Ahora es un EJEMPLO: el cálculo real está pendiente de validar con el asesor médico
// (src/logic/rulesEngine/biologicalAge.ts).

// Los 9 valores de una analítica normal que usa PhenoAge, agrupados por lo que reflejan
const INPUTS: { group: string; icon: string; markers: string[] }[] = [
  { group: 'Inflammation', icon: 'flame-outline', markers: ['C-reactive protein (CRP)'] },
  { group: 'Sugar metabolism', icon: 'water-outline', markers: ['Glucose'] },
  { group: 'Liver and nutrition', icon: 'leaf-outline', markers: ['Albumin', 'Alkaline phosphatase'] },
  { group: 'Kidneys', icon: 'funnel-outline', markers: ['Creatinine'] },
  { group: 'Blood and defences', icon: 'shield-checkmark-outline', markers: ['White blood cells', 'Lymphocytes (%)', 'Red cell size (MCV)', 'Red cell size variation (RDW)'] },
];

const SOURCES = [
  { label: 'Levine ME et al. An epigenetic biomarker of aging for lifespan and healthspan. Aging (Albany NY), 2018.', url: 'https://doi.org/10.18632/aging.101414' },
  { label: 'Liu Z et al. A new aging measure captures morbidity and mortality risk across diverse subpopulations from NHANES IV. PLoS Med, 2018.', url: 'https://doi.org/10.1371/journal.pmed.1002718' },
];

export const BiologicalAgeScreen = () => {
  const router = useRouter();
  const p = currentReport.summary.phenoage;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader title={t('Your biological age')} showBack />

        {p.available && (
          <View style={styles.hero}>
            <Text style={styles.heroValue}>
              {Math.round(p.low)}–{Math.round(p.high)} <Text style={styles.heroUnit}>{t('years')}</Text>
            </Text>
            <Text style={styles.heroSub}>{t('Your age: {age}', { age: p.chronological_age })}</Text>
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
              <Ionicons name={g.icon as any} size={18} color={Colors.accent} />
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

        <Text style={styles.section}>{t('Why a range and not one number')}</Text>
        <Text style={styles.body}>
          {t(
            'The same blood test varies a little from one day to another and from one lab to another. A range is more honest than a single number: what matters is how it moves between your tests.'
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
  heroValue: { color: Colors.accent, fontSize: 40, fontWeight: '800' },
  heroUnit: { color: Colors.textSecondary, fontSize: 15, fontWeight: '600' },
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

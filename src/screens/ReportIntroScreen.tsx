import { dateLocale, t } from '@/i18n';
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { GlowRing, ringTones } from '@/components/GlowRing';
import { FineButton } from '@/components/fine/FineMeasure';
import { currentReport } from '@/data/reportRepository';
import { FINE, ff } from '@/theme/fine';

const formatFullDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString(dateLocale(), { day: 'numeric', month: 'long', year: 'numeric' });
};

// «Ya tienes tu informe» (desde «Lo siguiente» de Hoy). Desde el 2026-11-16, en fino: el aro de luz jade con un
// icono a línea, la fecha pequeña en mayúsculas, el título grande y ligero y el botón esmeralda.
export const ReportIntroScreen = () => {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.content}>
        <GlowRing progress={1} colors={ringTones(FINE.jade)} size={84} stroke={3}>
          <Ionicons name="sparkles-outline" size={26} color={FINE.ivory} />
        </GlowRing>

        <Text style={styles.eyebrow}>{formatFullDate(currentReport.test_date)}</Text>
        <Text style={styles.title} accessibilityRole="header">
          {t('Your report is here!')}
        </Text>
        <Text style={styles.subtitle}>{t('And the improvement shows.')}</Text>

        <Text style={styles.teaser}>
          {t('Your cholesterol, glucose, and inflammation markers have clearly improved over the last 6 months — right in step with better sleep and more movement.')}
        </Text>

        <FineButton label={t('View my report')} onPress={() => router.replace('/report-summary')} />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: 'transparent' },
  content: { flex: 1, justifyContent: 'center', paddingHorizontal: 28 },
  eyebrow: { ...ff('regular'), color: FINE.mute, fontSize: 11, letterSpacing: 2.2, textTransform: 'uppercase', marginTop: 26 },
  title: { ...ff('light'), color: FINE.ivory, fontSize: 34, lineHeight: 40, letterSpacing: -0.3, marginTop: 10 },
  subtitle: { ...ff('regular'), color: FINE.jade, fontSize: 17, lineHeight: 23, marginTop: 6 },
  teaser: { ...ff('regular'), color: '#CFD6CF', fontSize: 15, lineHeight: 22, marginTop: 18, marginBottom: 36 },
});

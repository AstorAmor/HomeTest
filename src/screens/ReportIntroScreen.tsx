import { dateLocale, t } from '@/i18n';
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/colors';
import { currentReport } from '@/data/reportRepository';

const formatFullDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString(dateLocale(), { day: 'numeric', month: 'long', year: 'numeric' });
};

export const ReportIntroScreen = () => {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.content}>
        <View style={styles.badgeCircle}>
          <Ionicons name="sparkles" size={30} color={Colors.accent} />
        </View>

        <Text style={styles.eyebrow}>{formatFullDate(currentReport.test_date)}</Text>
        <Text style={styles.title}>{t('Your report is here!')}</Text>
        <Text style={styles.subtitle}>{t('And the improvement shows.')}</Text>

        <Text style={styles.teaser}>
          {t('Your cholesterol, glucose, and inflammation markers have clearly improved over the last 6 months — right in step with better sleep and more movement.')}
        </Text>

        <TouchableOpacity
          style={styles.cta}
          onPress={() => router.push('/report-summary')}
          activeOpacity={0.85}
        >
          <Text style={styles.ctaText}>{t('View my report')}</Text>
          <Ionicons name="arrow-forward" size={18} color={Colors.background} />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  badgeCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: Colors.accentSoft,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  eyebrow: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 10,
  },
  title: {
    color: Colors.textPrimary,
    fontSize: 34,
    fontWeight: '800',
    marginBottom: 6,
  },
  subtitle: {
    color: Colors.accent,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 20,
  },
  teaser: {
    color: Colors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 40,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: Colors.accent,
    borderRadius: 30,
    paddingVertical: 16,
  },
  ctaText: {
    color: Colors.background,
    fontSize: 16,
    fontWeight: '700',
  },
});

import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Colors } from '@/constants/colors';
import { ActionPlanList } from '@/components/ActionPlanList';
import { SharePlanButton } from '@/components/SharePlanButton';

// Plan personalizado del informe: solo qué puedes hacer y qué se espera que mejore.
// La comparativa de hábitos (sueño, HRV, pasos…) vive aparte en /habits.
export const ReportPlanScreen = () => {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader title="My Plan" showBack />

        <View style={styles.introBlock}>
          <Text style={styles.intro}>
            What you can do, and what we expect to improve by your next test in about 6 months.
          </Text>
          <SharePlanButton />
        </View>

        <ActionPlanList />

        <View style={styles.ctaRow}>
          <TouchableOpacity
            style={styles.ctaPrimary}
            onPress={() => router.push('/(tabs)')}
            activeOpacity={0.85}
          >
            <Text style={styles.ctaPrimaryText}>Let's do this!</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.ctaSecondary}
            onPress={() => router.push('/talk-to-specialist')}
            activeOpacity={0.85}
          >
            <Text style={styles.ctaSecondaryText}>Talk to a specialist</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    paddingBottom: 40,
  },
  introBlock: {
    paddingHorizontal: 20,
    gap: 12,
  },
  intro: {
    color: Colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  ctaRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
  },
  ctaPrimary: {
    flex: 1,
    backgroundColor: Colors.accent,
    borderRadius: 30,
    paddingVertical: 16,
    alignItems: 'center',
  },
  ctaPrimaryText: {
    color: Colors.background,
    fontSize: 15,
    fontWeight: '700',
  },
  ctaSecondary: {
    flex: 1,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 30,
    paddingVertical: 16,
    alignItems: 'center',
  },
  ctaSecondaryText: {
    color: Colors.accent,
    fontSize: 15,
    fontWeight: '700',
  },
});

import React from 'react';
import { StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenHeader } from '@/components/ScreenHeader';
import { PlanComparison } from '@/components/PlanComparison';
import { Colors } from '@/constants/colors';
import { t } from '@/i18n';

// "Compare subscriptions" (desde los bloqueos y la tienda); en «Mi suscripción» va lo mismo debajo
export const ComparePlansScreen = () => (
  <SafeAreaView style={styles.safeArea} edges={['top']}>
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <ScreenHeader title={t('Compare subscriptions')} showBack backFallback="/subscription" />
      <PlanComparison />
    </ScrollView>
  </SafeAreaView>
);

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  content: { paddingBottom: 40 },
});

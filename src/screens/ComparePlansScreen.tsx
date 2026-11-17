import React from 'react';
import { StyleSheet, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenHeader } from '@/components/ScreenHeader';
import { PlanComparison } from '@/components/PlanComparison';
import { t } from '@/i18n';

// "Compare subscriptions" (desde los bloqueos y la tienda); en «Mi suscripción» va lo mismo debajo.
// La comparación no lleva márgenes a los lados: los pone la pantalla
export const ComparePlansScreen = () => (
  <SafeAreaView style={styles.safeArea} edges={['top']}>
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <ScreenHeader title={t('Compare subscriptions')} showBack backFallback="/subscription" />
      <View style={styles.pad}>
        <PlanComparison />
      </View>
    </ScrollView>
  </SafeAreaView>
);

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: 'transparent' },
  content: { paddingBottom: 40 },
  pad: { paddingHorizontal: 20, paddingTop: 4 },
});

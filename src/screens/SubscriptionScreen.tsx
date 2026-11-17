import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ScreenHeader } from '@/components/ScreenHeader';
import { SubscriptionCard } from '@/components/SubscriptionCard';
import { PlanComparison } from '@/components/PlanComparison';
import { FRow, SecHead } from '@/components/fine/Fine';
import { t } from '@/i18n';
import { TAB, tabHref } from '@/constants/tabs';

// "My subscription" (More): suscripción activa, renovación y próxima analítica; debajo, la comparación de
// suscripciones con la tuya marcada, y el catálogo de pruebas.
// En el lenguaje fino (src/theme/fine.ts) desde el 2026-11-17: la comparación bajo una cabecera pequeña en versalitas
// y el catálogo como una fila más, sin icono.
export const SubscriptionScreen = () => {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader title={t('My subscription')} showBack backFallback={tabHref(TAB.you)} />
        <View style={styles.pad}>
          <SubscriptionCard />
          <SecHead title={t('Compare subscriptions')} />
          <PlanComparison />
          <FRow title={t('Test catalogue')} onPress={() => router.push({ pathname: '/store', params: { view: 'tests' } })} last />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: 'transparent' },
  content: { paddingBottom: 40 },
  pad: { paddingHorizontal: 20 },
});

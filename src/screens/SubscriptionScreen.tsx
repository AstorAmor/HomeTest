import React from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ScreenHeader } from '@/components/ScreenHeader';
import { SubscriptionCard } from '@/components/SubscriptionCard';
import { PlanComparison } from '@/components/PlanComparison';
import { Colors } from '@/constants/colors';
import { t } from '@/i18n';
import { TAB, tabHref } from '@/constants/tabs';

// "My subscription" (More): suscripción activa, renovación y próxima analítica; debajo, la comparación de
// suscripciones con la tuya marcada, y el catálogo de pruebas.
export const SubscriptionScreen = () => {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader title={t('My subscription')} showBack backFallback={tabHref(TAB.more)} />
        <View style={{ marginHorizontal: 20 }}>
          <SubscriptionCard />
        </View>
        <Text style={styles.section}>{t('Compare subscriptions')}</Text>
        <PlanComparison />
        <TouchableOpacity style={styles.link} onPress={() => router.push({ pathname: '/store', params: { view: 'tests' } })}>
          <Ionicons name="pricetags-outline" size={18} color={Colors.accent} />
          <Text style={styles.linkText}>{t('See test catalogue')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  content: { paddingBottom: 40 },
  section: { color: Colors.textPrimary, fontSize: 17, fontWeight: '800', marginHorizontal: 20, marginTop: 22, marginBottom: 10 },
  link: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 24, marginTop: 18 },
  linkText: { color: Colors.accent, fontSize: 14, fontWeight: '700' },
});

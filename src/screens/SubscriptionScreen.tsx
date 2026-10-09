import React from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ScreenHeader } from '@/components/ScreenHeader';
import { SubscriptionCard } from '@/components/SubscriptionCard';
import { Colors } from '@/constants/colors';
import { t } from '@/i18n';

// "My subscription" (More): suscripción activa, renovación, próxima analítica y planes.
export const SubscriptionScreen = () => {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader title={t('My subscription')} showBack backFallback="/(tabs)?tab=4" />
        <View style={{ marginHorizontal: 20 }}>
          <SubscriptionCard />
        </View>
        <TouchableOpacity style={styles.link} onPress={() => router.push('/store')}>
          <Ionicons name="pricetags-outline" size={18} color={Colors.accent} />
          <Text style={styles.linkText}>{t('Plans and tests')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  content: { paddingBottom: 40 },
  link: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 24, marginTop: 18 },
  linkText: { color: Colors.accent, fontSize: 14, fontWeight: '700' },
});

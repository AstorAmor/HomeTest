import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { AppIcon } from '@/components/HealthIcons';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Colors } from '@/constants/colors';
import { useFeature } from '@/data/access';
import { t } from '@/i18n';
import { INTER } from '@/theme/fine';

// Pantallas enteras que van con la suscripción (filas con candado de data/access.ts). En modo gratis, en su lugar,
// qué incluye, «Ver suscripciones» y «Tengo un código» (el fundador manda códigos: fundador, 2026-11-06). Con la
// demo, un admin, un código o una suscripción, la pantalla tal cual. Se usa en las rutas: gated('workouts', X).

type GatedScreen = 'workouts';

const INFO: Record<GatedScreen, { title: string; icon: keyof typeof Ionicons.glyphMap; head: string; text: string }> = {
  workouts: {
    title: 'Workouts',
    icon: 'barbell-outline',
    head: 'Workouts come with a subscription',
    text: 'Your training plan made for you, each session guided step by step, and the log of everything you do.',
  },
};

export const FeatureLocked = ({ feature }: { feature: GatedScreen }) => {
  const router = useRouter();
  const info = INFO[feature];
  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <ScreenHeader title={t(info.title)} showBack />
        <View style={styles.card}>
          <View style={styles.icon}>
            <Ionicons name="lock-closed" size={13} color={Colors.background} style={styles.lock} />
            {/* AppIcon: las pesas salen con el dibujo único de la app (fine/dumbbell.ts) */}
            <AppIcon name={info.icon} size={26} color={Colors.gold} />
          </View>
          <Text style={styles.title}>{t(info.head)}</Text>
          <Text style={styles.text}>{t(info.text)}</Text>
          <TouchableOpacity style={styles.primary} onPress={() => router.push('/compare-plans')}>
            <Text style={styles.primaryText}>{t('See subscriptions')}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/redeem-code')} hitSlop={8}>
            <Text style={styles.link}>{t('I have a code')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export function gated<P extends object>(feature: GatedScreen, Screen: React.ComponentType<P>) {
  const Gated = (props: P) => {
    const allowed = useFeature(feature);
    if (allowed === null)
      return (
        <SafeAreaView style={[styles.safeArea, styles.center]}>
          <ActivityIndicator color={Colors.accent} />
        </SafeAreaView>
      );
    return allowed ? <Screen {...props} /> : <FeatureLocked feature={feature} />;
  };
  Gated.displayName = `Gated(${feature})`;
  return Gated;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: 'transparent' },
  center: { alignItems: 'center', justifyContent: 'center' },
  content: { paddingBottom: 40 },
  card: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 16,
    padding: 18,
    marginHorizontal: 20,
    gap: 12,
    alignItems: 'center',
  },
  icon: { width: 56, height: 56, borderRadius: 28, backgroundColor: Colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  lock: { position: 'absolute', top: -2, right: -2, backgroundColor: Colors.gold, borderRadius: 10, padding: 3, overflow: 'hidden' },
  title: { color: Colors.textPrimary, fontSize: 17, fontFamily: INTER.medium, textAlign: 'center' },
  text: { color: Colors.textSecondary, fontFamily: INTER.regular, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  primary: { alignSelf: 'stretch', alignItems: 'center', backgroundColor: Colors.accent, borderRadius: 22, paddingVertical: 12, marginTop: 4 },
  primaryText: { color: Colors.background, fontSize: 15, fontFamily: INTER.medium },
  link: { color: Colors.accent, fontSize: 14, fontFamily: INTER.medium },
});

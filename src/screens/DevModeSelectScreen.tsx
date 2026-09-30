import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, withAlpha } from '@/constants/colors';
import { CosmicBackground } from '@/components/CosmicBackground';
import { DemoMode, useAuth } from '@/context/AuthContext';
import { currentReport } from '@/data/reportRepository';
import { reportSeenKey, userFlags } from '@/data/userFlags';

const OPTIONS: { mode: DemoMode; title: string; subtitle: string; icon: string; color: string }[] = [
  {
    mode: 'new',
    title: 'New user',
    subtitle: 'Onboarding questionnaire: age, sex, weight, habits and goals',
    icon: 'person-add-outline',
    color: Colors.violet,
  },
  {
    mode: 'results',
    title: 'User who just got results',
    subtitle: 'Celebration and the full lab report',
    icon: 'sparkles-outline',
    color: Colors.amber,
  },
  {
    mode: 'returning',
    title: 'Returning user',
    subtitle: 'Straight to Today, like a normal day',
    icon: 'home-outline',
    color: Colors.accent,
  },
  {
    mode: 'pro',
    title: 'Specialist portal',
    subtitle: 'What doctors, dietitians and trainers see (sample patients)',
    icon: 'medkit-outline',
    color: Colors.coral,
  },
];

// Pantalla solo para el prototipo: elige qué "momento" del usuario enseñar.
export const DevModeSelectScreen = () => {
  const router = useRouter();
  const { setDemoMode } = useAuth();

  const choose = (mode: DemoMode) => {
    setDemoMode(mode);
    if (mode === 'new') router.replace('/onboarding');
    else if (mode === 'results') {
      // Demo: al elegir "acaba de recibir resultados" el aviso de informe vuelve a salir
      userFlags.set(reportSeenKey(currentReport.report_id), false);
      router.replace('/results-ready');
    }
    else if (mode === 'pro') router.replace('/pro');
    else router.replace('/(tabs)');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <CosmicBackground />
      <View style={styles.content}>
        <View style={styles.devPill}>
          <Ionicons name="code-slash" size={13} color={Colors.warning} />
          <Text style={styles.devPillText}>Developer mode</Text>
        </View>
        <Text style={styles.title}>Which user do you want to show?</Text>
        <Text style={styles.subtitle}>Prototype only. Log out from More → Settings to come back here.</Text>

        <View style={styles.list}>
          {OPTIONS.map((o) => (
            <TouchableOpacity
              key={o.mode}
              style={styles.card}
              onPress={() => choose(o.mode)}
              activeOpacity={0.85}
            >
              <View style={[styles.iconWrap, { backgroundColor: `${o.color}26` }]}>
                <Ionicons name={o.icon as any} size={24} color={o.color} />
              </View>
              <View style={styles.textWrap}>
                <Text style={styles.cardTitle}>{o.title}</Text>
                <Text style={styles.cardSubtitle}>{o.subtitle}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.cosmicBase,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  devPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    borderWidth: 1,
    borderColor: withAlpha(Colors.amber, 0.4),
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 14,
  },
  devPillText: {
    color: Colors.warning,
    fontSize: 12,
    fontWeight: '600',
  },
  title: {
    color: Colors.textPrimary,
    fontSize: 26,
    fontWeight: '800',
    marginBottom: 8,
  },
  subtitle: {
    color: Colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 28,
  },
  list: {
    gap: 12,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: withAlpha(Colors.card, 0.78),
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 16,
    padding: 16,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textWrap: {
    flex: 1,
  },
  cardTitle: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 3,
  },
  cardSubtitle: {
    color: Colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
});

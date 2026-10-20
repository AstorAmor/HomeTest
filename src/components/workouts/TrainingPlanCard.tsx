import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/colors';
import { programRepository } from '@/data/workouts/programRepository';
import type { WorkoutProgram } from '@/data/workouts/types';
import { useReloadOnFocus } from '@/hooks/useReloadOnFocus';
import { t, tn } from '@/i18n';

// En «Sigue aprendiendo → Entrenamiento», como «Construye tu plan» en Alimentación: si aún no tiene
// programa, crear uno (/workout-new); si lo tiene, ir a él. Más adelante irá con las suscripciones más
// completas: entonces se bloqueará con SubscribePopup, como el menú semanal (fila de la tabla de planes).
export const TrainingPlanCard = () => {
  const router = useRouter();
  const [program, setProgram] = useState<WorkoutProgram | null | undefined>(undefined);
  useReloadOnFocus(
    useCallback(async () => {
      const list = await programRepository.list().catch(() => []);
      setProgram(list.find((p) => p.active) ?? null);
    }, []),
  );

  if (program === undefined) return <ActivityIndicator color={Colors.accent} style={{ marginVertical: 20 }} />;

  if (!program) {
    return (
      <View style={styles.card}>
        <Text style={styles.badge}>{t('Your training plan')}</Text>
        <Text style={styles.title}>{t('Build your plan')}</Text>
        <Text style={styles.text}>
          {t('Tell us your goal, how many days you can train, for how long and with what. We build the sessions with short videos of each exercise.')}
        </Text>
        <TouchableOpacity style={styles.primary} onPress={() => router.push('/workout-new')}>
          <Ionicons name="sparkles-outline" size={16} color={Colors.background} />
          <Text style={styles.primaryText}>{t('Create my workout')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.badge}>{t('Your training plan')}</Text>
      <Text style={styles.title}>{t(program.title)}</Text>
      <Text style={styles.text}>{tn(program.sessions.length, '{n} session', '{n} sessions')}</Text>
      <TouchableOpacity style={styles.primary} onPress={() => router.push('/workouts')}>
        <Ionicons name="barbell-outline" size={16} color={Colors.background} />
        <Text style={styles.primaryText}>{t('Go to my workouts')}</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  card: { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 16, padding: 14, marginHorizontal: 20, marginBottom: 16, gap: 10 },
  badge: { color: Colors.accent, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  title: { color: Colors.textPrimary, fontSize: 17, fontWeight: '800' },
  text: { color: Colors.textSecondary, fontSize: 13, lineHeight: 19 },
  primary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, alignSelf: 'stretch', backgroundColor: Colors.accent, borderRadius: 22, paddingVertical: 11 },
  primaryText: { color: Colors.background, fontSize: 14, fontWeight: '800' },
});

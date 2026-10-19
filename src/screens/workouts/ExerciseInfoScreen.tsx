import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Colors } from '@/constants/colors';
import { EXERCISE_LIST, LEVEL_LABEL, exerciseEquipmentText, exerciseName, exerciseSteps, getExercise, muscleLabel, patternLabel } from '@/data/workouts/catalog';
import type { CatalogExercise } from '@/data/workouts/types';
import { ExerciseLoop } from '@/components/workouts/ExerciseLoop';
import { t } from '@/i18n';

// Ficha de un ejercicio: el movimiento en bucle, qué trabaja, qué hace falta y cómo hacerlo.
// La comparten la app y el portal (el entrenador la abre desde la biblioteca o desde un programa).
export const ExerciseDetail = ({ ex, onOpenSimilar }: { ex: CatalogExercise; onOpenSimilar?: (ex: CatalogExercise) => void }) => {
  const { width } = useWindowDimensions();
  const similar = EXERCISE_LIST.filter((o) => o.pattern === ex.pattern && o.id !== ex.id).slice(0, 6);
  return (
    <View style={styles.detail}>
      <ExerciseLoop exercise={ex} width={Math.min(width - 40, 640)} radius={18} showProvisional />
      <View style={styles.tags}>
        <Text style={styles.tag}>{patternLabel(ex.pattern)}</Text>
        <Text style={styles.tag}>{t(LEVEL_LABEL[ex.level])}</Text>
        <Text style={styles.tag}>{exerciseEquipmentText(ex)}</Text>
        {ex.impact ? <Text style={styles.tag}>{t('With jumps')}</Text> : null}
      </View>
      <Text style={styles.label}>{t('Works')}</Text>
      <Text style={styles.text}>
        {ex.primary.map(muscleLabel).join(', ')}
        {ex.secondary.length ? <Text style={styles.muted}> · {t('also')} {ex.secondary.map(muscleLabel).join(', ')}</Text> : null}
      </Text>
      <Text style={styles.label}>{t('How to do it')}</Text>
      {exerciseSteps(ex).map((s, i) => (
        <View key={i} style={styles.step}>
          <Text style={styles.stepNum}>{i + 1}</Text>
          <Text style={styles.stepText}>{s}</Text>
        </View>
      ))}
      {onOpenSimilar && similar.length > 0 && (
        <>
          <Text style={styles.label}>{t('Similar exercises')}</Text>
          <View style={styles.similar}>
            {similar.map((o) => (
              <TouchableOpacity key={o.id} style={styles.similarItem} onPress={() => onOpenSimilar(o)}>
                <ExerciseLoop exercise={o} size={56} radius={10} />
                <Text style={styles.similarName} numberOfLines={2}>
                  {exerciseName(o)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}
      <Text style={styles.credit}>{t('Provisional images from the open free-exercise-db database. Kuova will replace them with its own videos.')}</Text>
    </View>
  );
};

export const ExerciseInfoScreen = () => {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const ex = getExercise(id ?? '');
  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScreenHeader title={ex ? exerciseName(ex) : t('Exercise')} showBack backFallback="/exercise-library" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {ex ? <ExerciseDetail ex={ex} onOpenSimilar={(o) => router.setParams({ id: o.id })} /> : <Text style={styles.muted}>{t('Exercise not found.')}</Text>}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: 20, paddingBottom: 40 },
  detail: { gap: 8 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  tag: { color: Colors.textPrimary, backgroundColor: Colors.accentSoft, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4, fontSize: 12, fontWeight: '700', overflow: 'hidden' },
  label: { color: Colors.textPrimary, fontSize: 16, fontWeight: '800', marginTop: 14 },
  text: { color: Colors.textPrimary, fontSize: 14, lineHeight: 20 },
  muted: { color: Colors.textSecondary, fontSize: 13 },
  step: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  stepNum: { width: 22, height: 22, borderRadius: 11, backgroundColor: Colors.accent, color: Colors.background, textAlign: 'center', lineHeight: 22, fontSize: 12, fontWeight: '800', overflow: 'hidden' },
  stepText: { flex: 1, color: Colors.textPrimary, fontSize: 14, lineHeight: 20 },
  similar: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  similarItem: { width: 96, gap: 4 },
  similarName: { color: Colors.textSecondary, fontSize: 11, fontWeight: '600' },
  credit: { color: Colors.textMuted, fontSize: 11, marginTop: 18 },
});

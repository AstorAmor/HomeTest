import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Colors } from '@/constants/colors';
import { EXERCISE_LIST, LEVEL_LABEL, exerciseEquipmentText, exerciseName, exerciseSteps, getExercise, muscleLabel, patternLabel } from '@/data/workouts/catalog';
import type { CatalogExercise } from '@/data/workouts/types';
import { ExerciseLoop } from '@/components/workouts/ExerciseLoop';
import { MuscleMap, hasMuscleMap } from '@/components/workouts/MuscleMap';
import { profileRepository } from '@/data/profileRepository';
import { figureSexOf, type FigureSex } from '@/logic/bodyFigure';
import { t } from '@/i18n';
import { FINE, INTER, ff, fine } from '@/theme/fine';

// Ficha de un ejercicio: el movimiento en bucle, qué trabaja, qué hace falta y cómo hacerlo.
// La comparten la app y el portal (el entrenador la abre desde la biblioteca o desde un programa). En la app, con
// `fineLook`, en el lenguaje fino del prototipo (rediseño del 2026-11-16): etiquetas con borde, cabeceras pequeñas en
// mayúsculas y cada paso con su número a línea; el portal la sigue viendo como antes.
// «Trabaja» es el mapa de músculos (MuscleMap, fundador 2026-11-16: «para cada ejercicio, los músculos que
// implica»): la figura de frente y de espaldas con los grupos del ejercicio encendidos, de hombre o de mujer según
// el perfil; si el ejercicio no tiene músculos con capa, el texto de siempre.
export const ExerciseDetail = ({ ex, onOpenSimilar, fineLook }: { ex: CatalogExercise; onOpenSimilar?: (ex: CatalogExercise) => void; fineLook?: boolean }) => {
  const { width } = useWindowDimensions();
  const similar = EXERCISE_LIST.filter((o) => o.pattern === ex.pattern && o.id !== ex.id).slice(0, 6);
  const styles = fineLook ? fineStyles : classic;
  const [sex, setSex] = useState<FigureSex>('male');
  useEffect(() => {
    let alive = true;
    profileRepository
      .get()
      .then((p) => alive && setSex(figureSexOf(p.sex)))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);
  return (
    <View style={styles.detail}>
      <ExerciseLoop exercise={ex} width={Math.min(width - 40, 640)} radius={18} showProvisional />
      <View style={styles.tags}>
        <Text style={styles.tag}>{patternLabel(ex.pattern)}</Text>
        <Text style={styles.tag}>{t(LEVEL_LABEL[ex.level])}</Text>
        <Text style={styles.tag}>{exerciseEquipmentText(ex)}</Text>
        {ex.impact ? <Text style={styles.tag}>{t('With jumps')}</Text> : null}
      </View>
      <Text style={styles.label} accessibilityRole={fineLook ? 'header' : undefined}>
        {/* «Músculos ejercitados», no «Trabaja» (fundador, 2026-11-17) */}
        {t('Muscles worked')}
      </Text>
      {hasMuscleMap(ex.primary, ex.secondary) ? (
        <MuscleMap primary={ex.primary} secondary={ex.secondary} sex={sex} />
      ) : (
        <Text style={styles.text}>
          {ex.primary.map(muscleLabel).join(', ')}
          {ex.secondary.length ? <Text style={styles.muted}> · {t('also')} {ex.secondary.map(muscleLabel).join(', ')}</Text> : null}
        </Text>
      )}
      <Text style={styles.label} accessibilityRole={fineLook ? 'header' : undefined}>
        {t('How to do it')}
      </Text>
      {exerciseSteps(ex).map((s, i) => (
        <View key={i} style={styles.step}>
          <Text style={styles.stepNum}>{i + 1}</Text>
          <Text style={styles.stepText}>{s}</Text>
        </View>
      ))}
      {onOpenSimilar && similar.length > 0 && (
        <>
          <Text style={styles.label} accessibilityRole={fineLook ? 'header' : undefined}>
            {t('Similar exercises')}
          </Text>
          <View style={styles.similar}>
            {similar.map((o) => (
              <TouchableOpacity key={o.id} style={styles.similarItem} onPress={() => onOpenSimilar(o)} accessibilityRole="button" accessibilityLabel={exerciseName(o)}>
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
    <SafeAreaView style={screen.safeArea} edges={['top']}>
      <ScreenHeader title={ex ? exerciseName(ex) : t('Exercise')} showBack backFallback="/exercise-library" />
      <ScrollView contentContainerStyle={screen.content} showsVerticalScrollIndicator={false}>
        {ex ? <ExerciseDetail ex={ex} onOpenSimilar={(o) => router.setParams({ id: o.id })} fineLook /> : <Text style={fine.note}>{t('Exercise not found.')}</Text>}
      </ScrollView>
    </SafeAreaView>
  );
};

const screen = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: 'transparent' },
  content: { paddingHorizontal: 20, paddingBottom: 40 },
});

// Como se veía (el portal del especialista la sigue usando así)
const classic = StyleSheet.create({
  detail: { gap: 8 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  tag: { color: Colors.textPrimary, backgroundColor: Colors.accentSoft, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4, fontSize: 12, fontFamily: INTER.medium, overflow: 'hidden' },
  label: { color: Colors.textPrimary, fontSize: 16, fontFamily: INTER.medium, marginTop: 14 },
  text: { color: Colors.textPrimary, fontFamily: INTER.regular, fontSize: 14, lineHeight: 20 },
  muted: { color: Colors.textSecondary, fontFamily: INTER.regular, fontSize: 13 },
  step: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  stepNum: { width: 22, height: 22, borderRadius: 11, backgroundColor: Colors.accent, color: Colors.background, textAlign: 'center', lineHeight: 22, fontSize: 12, fontFamily: INTER.medium, overflow: 'hidden' },
  stepText: { flex: 1, color: Colors.textPrimary, fontFamily: INTER.regular, fontSize: 14, lineHeight: 20 },
  similar: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  similarItem: { width: 96, gap: 4 },
  similarName: { color: Colors.textSecondary, fontSize: 11, fontFamily: INTER.medium },
  credit: { color: Colors.textMuted, fontFamily: INTER.regular, fontSize: 11, marginTop: 18 },
});

// En la app: sin rellenos de color; etiquetas con borde, cabeceras pequeñas y los pasos con su número a línea
const fineStyles = StyleSheet.create({
  detail: { gap: 8 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  tag: { ...ff('regular'), color: FINE.mute, borderWidth: 1, borderColor: FINE.line, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3, fontSize: 12, overflow: 'hidden' },
  label: { ...fine.secTitle, marginTop: 22, marginBottom: 2 },
  text: { ...fine.body, fontSize: 14.5 },
  muted: { ...ff('regular'), color: FINE.mute, fontSize: 13.5 },
  step: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', paddingVertical: 3 },
  stepNum: { ...ff('regular'), width: 24, height: 24, borderRadius: 12, borderWidth: 1, borderColor: FINE.jadeLine, color: FINE.jade, textAlign: 'center', lineHeight: 22, fontSize: 12, overflow: 'hidden' },
  stepText: { ...fine.body, flex: 1, fontSize: 14.5 },
  similar: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  similarItem: { width: 96, gap: 6 },
  similarName: { ...ff('regular'), color: FINE.mute, fontSize: 11.5, lineHeight: 15 },
  credit: { ...fine.note, fontSize: 11.5, marginTop: 22 },
});

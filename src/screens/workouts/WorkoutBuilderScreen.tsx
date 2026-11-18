import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ScreenHeader } from '@/components/ScreenHeader';
import { SecHead } from '@/components/fine/Fine';
import { FButton, FChip, FChips, FLink, FOption, formStyles } from '@/components/fine/FineForm';
import { EQUIPMENT, getExercise, exerciseName } from '@/data/workouts/catalog';
import { GOALS, LEVELS, PLACES, doseText, goalLabel, sessionTitle } from '@/data/workouts/labels';
import { programRepository } from '@/data/workouts/programRepository';
import type { Equipment, WorkoutPrefs, WorkoutSession } from '@/data/workouts/types';
import { DEFAULT_PREFS, equipmentForPlace, estimateMinutes, generateProgram, newProgram } from '@/logic/workoutGenerator';
import { ExerciseLoop } from '@/components/workouts/ExerciseLoop';
import { t } from '@/i18n';
import { FINE, ff, fine } from '@/theme/fine';

// "Crear mi entrenamiento": unas pocas preguntas (objetivo, nivel, días, minutos, dónde y con qué) y
// el programa al momento. Se puede pedir otra variación antes de guardarlo.
// Rediseño del 2026-11-16 (lenguaje fino): cada pregunta con su cabecera pequeña, las opciones en filas con línea fina
// y un círculo, los números en chips con borde y la vista previa en filas, sin tarjetas.

const HOME_KIT: Equipment[] = ['dumbbells', 'kettlebell', 'bands', 'bench', 'bar'];

const SessionPreview = ({ s }: { s: WorkoutSession }) => {
  const main = s.exercises.filter((e) => e.block === 'main' || e.block === 'finisher');
  return (
    <View style={styles.preview}>
      <View style={fine.secHead}>
        <Text style={fine.secTitle} accessibilityRole="header">
          {sessionTitle(s)}
        </Text>
        <Text style={styles.previewMeta}>~{estimateMinutes(s)} min</Text>
      </View>
      {main.map((e, i) => {
        const ex = getExercise(e.exerciseId);
        if (!ex) return null;
        return (
          <View key={`${e.exerciseId}-${i}`} style={styles.row}>
            <ExerciseLoop exercise={ex} size={44} radius={10} />
            <Text style={styles.rowName} numberOfLines={2}>
              {exerciseName(ex)}
            </Text>
            <Text style={styles.rowDose}>{doseText(e)}</Text>
          </View>
        );
      })}
      <Text style={styles.previewFoot}>{t('Plus warm-up and stretches')}</Text>
    </View>
  );
};

export const WorkoutBuilderScreen = () => {
  const router = useRouter();
  const [prefs, setPrefs] = useState<WorkoutPrefs>(DEFAULT_PREFS);
  const [kit, setKit] = useState<Equipment[]>(['dumbbells']);
  const [step, setStep] = useState<'ask' | 'preview'>('ask');
  const [saving, setSaving] = useState(false);

  // Se parte de lo que eligió la última vez
  useEffect(() => {
    programRepository.list().then((list) => {
      const mine = list.find((p) => p.source === 'self' && !p.prefs.custom); // las rutinas a mano no tienen respuestas
      if (mine) {
        setPrefs({ ...mine.prefs, seed: mine.prefs.seed + 1 });
        if (mine.prefs.place === 'home_kit') setKit(mine.prefs.equipment);
      }
    });
  }, []);

  const full: WorkoutPrefs = useMemo(() => ({ ...prefs, equipment: equipmentForPlace(prefs.place, kit) }), [prefs, kit]);
  const sessions = useMemo(() => (step === 'preview' ? generateProgram(full) : []), [full, step]);
  const set = (patch: Partial<WorkoutPrefs>) => setPrefs((p) => ({ ...p, ...patch }));
  const toggleKit = (id: Equipment) => setKit((k) => (k.includes(id) ? k.filter((x) => x !== id) : [...k, id]));

  const save = async () => {
    setSaving(true);
    const title = `${goalLabel(full.goal)} · ${t('{n} days', { n: full.daysPerWeek })}`;
    await programRepository.save({ ...newProgram(full, { title }), sessions });
    // Vuelve a la lista que ya estaba abierta (si no, quedaban dos y «atrás» volvía a la misma)
    router.dismissTo('/workouts');
  };

  // Sale sin guardar: a la pantalla de antes (Entrenamientos u otra) o, si no hay, a Entrenamientos
  const discard = () => (router.canGoBack() ? router.back() : router.replace('/workouts'));

  if (step === 'preview') {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScreenHeader title={t('Your workout')} showBack backFallback="/workouts" />
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.intro}>
            {t('{n} sessions a week of about {m} minutes. Do them in order, with at least one day of rest between two sessions that work the same muscles.', {
              n: full.daysPerWeek,
              m: full.minutes,
            })}
          </Text>
          {sessions.map((s) => (
            <SessionPreview key={s.id} s={s} />
          ))}
          <View style={styles.buttons}>
            <FButton label={t('Save and follow it')} onPress={save} busy={saving} />
            <FLink label={t('Another version')} icon="shuffle-outline" onPress={() => set({ seed: prefs.seed + 1 })} />
            <FLink label={t('Change my answers')} muted onPress={() => setStep('ask')} />
            {/* Descartar (fundador, 2026-11-06): vuelve sin guardar nada */}
            <FLink label={t('Discard this workout')} icon="close-circle-outline" muted onPress={discard} />
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScreenHeader title={t('Create my workout')} showBack backFallback="/workouts" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <SecHead title={t('What do you want most?')} style={styles.firstHead} />
        <View accessibilityRole="radiogroup">
          {GOALS.map((g, i) => (
            <FOption key={g.id} title={t(g.label)} hint={t(g.hint)} on={prefs.goal === g.id} onPress={() => set({ goal: g.id })} last={i === GOALS.length - 1} />
          ))}
        </View>

        <SecHead title={t('Your level')} />
        <View accessibilityRole="radiogroup">
          {LEVELS.map((l, i) => (
            <FOption key={l.id} title={t(l.label)} hint={t(l.hint)} on={prefs.level === l.id} onPress={() => set({ level: l.id })} last={i === LEVELS.length - 1} />
          ))}
        </View>

        <SecHead title={t('Days a week')} />
        <FChips options={[2, 3, 4, 5].map((n) => ({ id: n, label: String(n) }))} value={prefs.daysPerWeek} onChange={(n) => set({ daysPerWeek: n })} />

        <SecHead title={t('Minutes per session')} />
        <FChips options={[20, 30, 45, 60].map((n) => ({ id: n, label: `${n} min` }))} value={prefs.minutes} onChange={(n) => set({ minutes: n })} />

        <SecHead title={t('Where do you train?')} />
        <FChips options={PLACES.map((p) => ({ id: p.id, label: t(p.label) }))} value={prefs.place} onChange={(place) => set({ place })} />

        {prefs.place === 'home_kit' && (
          <>
            <SecHead title={t('What do you have?')} />
            <View style={styles.kit}>
              {EQUIPMENT.filter((e) => HOME_KIT.includes(e.id)).map((e) => (
                <FChip key={e.id} label={t(e.label)} on={kit.includes(e.id)} check multi onPress={() => toggleKit(e.id)} />
              ))}
            </View>
          </>
        )}

        <View style={styles.toggle}>
          <FOption
            multi
            last
            title={t('No jumping')}
            hint={t('Easier on the knees, the pelvic floor and the neighbours')}
            on={prefs.lowImpact}
            onPress={() => set({ lowImpact: !prefs.lowImpact })}
          />
        </View>

        <View style={styles.buttons}>
          <FButton label={t('Create my workout')} icon="sparkles-outline" onPress={() => setStep('preview')} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: 'transparent' },
  content: { paddingHorizontal: 20, paddingBottom: 40 },
  firstHead: { marginTop: 8 },
  intro: { ...formStyles.lead, marginTop: 4, marginBottom: 4 },
  kit: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  toggle: { marginTop: 20, borderTopWidth: 1, borderTopColor: FINE.line },
  buttons: { gap: 4, marginTop: 24 },
  // Vista previa: cada sesión con su cabecera pequeña y sus ejercicios en filas
  preview: { marginBottom: 4 },
  previewMeta: { ...ff('regular'), color: FINE.mute, fontSize: 12.5, marginLeft: 'auto', fontVariant: ['tabular-nums'] },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: FINE.line },
  rowName: { flex: 1, ...fine.rowTitle, fontSize: 14.5 },
  rowDose: { ...ff('regular'), color: FINE.mute, fontSize: 13, fontVariant: ['tabular-nums'] },
  previewFoot: { ...fine.note },
});

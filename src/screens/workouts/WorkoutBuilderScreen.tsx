import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ScreenHeader } from '@/components/ScreenHeader';
import { ChoiceChips } from '@/components/ChoiceChips';
import { Colors } from '@/constants/colors';
import { EQUIPMENT, getExercise, exerciseName } from '@/data/workouts/catalog';
import { GOALS, LEVELS, PLACES, doseText, goalLabel, sessionTitle } from '@/data/workouts/labels';
import { programRepository } from '@/data/workouts/programRepository';
import type { Equipment, WorkoutPrefs, WorkoutSession } from '@/data/workouts/types';
import { DEFAULT_PREFS, equipmentForPlace, estimateMinutes, generateProgram, newProgram } from '@/logic/workoutGenerator';
import { ExerciseLoop } from '@/components/workouts/ExerciseLoop';
import { t } from '@/i18n';

// "Crear mi entrenamiento": unas pocas preguntas (objetivo, nivel, días, minutos, dónde y con qué) y
// el programa al momento. Se puede pedir otra variación antes de guardarlo.

const HOME_KIT: Equipment[] = ['dumbbells', 'kettlebell', 'bands', 'bench', 'bar'];

const SessionPreview = ({ s }: { s: WorkoutSession }) => {
  const main = s.exercises.filter((e) => e.block === 'main' || e.block === 'finisher');
  return (
    <View style={styles.preview}>
      <View style={styles.previewHead}>
        <Text style={styles.previewTitle}>{sessionTitle(s)}</Text>
        <Text style={styles.previewMeta}>~{estimateMinutes(s)} min</Text>
      </View>
      {main.map((e, i) => {
        const ex = getExercise(e.exerciseId);
        if (!ex) return null;
        return (
          <View key={`${e.exerciseId}-${i}`} style={styles.row}>
            <ExerciseLoop exercise={ex} size={48} radius={10} />
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
            <TouchableOpacity style={styles.primary} onPress={save} disabled={saving}>
              {saving ? <ActivityIndicator color={Colors.background} /> : <Text style={styles.primaryText}>{t('Save and follow it')}</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondary} onPress={() => set({ seed: prefs.seed + 1 })}>
              <Ionicons name="shuffle" size={18} color={Colors.accent} />
              <Text style={styles.secondaryText}>{t('Another version')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.link} onPress={() => setStep('ask')}>
              <Text style={styles.linkText}>{t('Change my answers')}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScreenHeader title={t('Create my workout')} showBack backFallback="/workouts" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.q}>{t('What do you want most?')}</Text>
        <View style={styles.options}>
          {GOALS.map((g) => {
            const on = prefs.goal === g.id;
            return (
              <TouchableOpacity key={g.id} style={[styles.option, on && styles.optionOn]} onPress={() => set({ goal: g.id })}>
                <Text style={[styles.optionTitle, on && { color: Colors.textPrimary }]}>{t(g.label)}</Text>
                <Text style={styles.optionHint}>{t(g.hint)}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.q}>{t('Your level')}</Text>
        <View style={styles.options}>
          {LEVELS.map((l) => {
            const on = prefs.level === l.id;
            return (
              <TouchableOpacity key={l.id} style={[styles.option, on && styles.optionOn]} onPress={() => set({ level: l.id })}>
                <Text style={[styles.optionTitle, on && { color: Colors.textPrimary }]}>{t(l.label)}</Text>
                <Text style={styles.optionHint}>{t(l.hint)}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.q}>{t('Days a week')}</Text>
        <ChoiceChips options={[2, 3, 4, 5].map((n) => ({ id: n, label: String(n) }))} value={prefs.daysPerWeek} onChange={(n) => set({ daysPerWeek: n })} />

        <Text style={styles.q}>{t('Minutes per session')}</Text>
        <ChoiceChips options={[20, 30, 45, 60].map((n) => ({ id: n, label: `${n} min` }))} value={prefs.minutes} onChange={(n) => set({ minutes: n })} />

        <Text style={styles.q}>{t('Where do you train?')}</Text>
        <ChoiceChips options={PLACES.map((p) => ({ id: p.id, label: t(p.label) }))} value={prefs.place} onChange={(place) => set({ place })} />

        {prefs.place === 'home_kit' && (
          <>
            <Text style={styles.q}>{t('What do you have?')}</Text>
            <View style={styles.kit}>
              {EQUIPMENT.filter((e) => HOME_KIT.includes(e.id)).map((e) => {
                const on = kit.includes(e.id);
                return (
                  <TouchableOpacity key={e.id} style={[styles.kitItem, on && styles.optionOn]} onPress={() => toggleKit(e.id)}>
                    <Ionicons name={on ? 'checkbox' : 'square-outline'} size={18} color={on ? Colors.accent : Colors.textMuted} />
                    <Text style={styles.kitText}>{t(e.label)}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}

        <TouchableOpacity style={styles.toggle} onPress={() => set({ lowImpact: !prefs.lowImpact })}>
          <Ionicons name={prefs.lowImpact ? 'checkbox' : 'square-outline'} size={20} color={Colors.accent} />
          <View style={{ flex: 1 }}>
            <Text style={styles.toggleTitle}>{t('No jumping')}</Text>
            <Text style={styles.optionHint}>{t('Easier on the knees, the pelvic floor and the neighbours')}</Text>
          </View>
        </TouchableOpacity>

        <View style={styles.buttons}>
          <TouchableOpacity style={styles.primary} onPress={() => setStep('preview')}>
            <Ionicons name="sparkles-outline" size={18} color={Colors.background} />
            <Text style={styles.primaryText}>{t('Create my workout')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: 20, paddingBottom: 40 },
  intro: { color: Colors.textSecondary, fontSize: 14, lineHeight: 20, marginBottom: 14 },
  q: { color: Colors.textPrimary, fontSize: 16, fontWeight: '800', marginTop: 18, marginBottom: 10 },
  options: { gap: 8 },
  option: { borderWidth: 1, borderColor: Colors.cardBorder, backgroundColor: Colors.card, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10 },
  optionOn: { borderColor: Colors.accent, backgroundColor: Colors.accentSoft },
  optionTitle: { color: Colors.textSecondary, fontSize: 15, fontWeight: '700' },
  optionHint: { color: Colors.textMuted, fontSize: 12, marginTop: 2 },
  kit: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  kitItem: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: Colors.cardBorder, backgroundColor: Colors.card, borderRadius: 18, paddingHorizontal: 12, paddingVertical: 8 },
  kitText: { color: Colors.textPrimary, fontSize: 14, fontWeight: '600' },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 20 },
  toggleTitle: { color: Colors.textPrimary, fontSize: 15, fontWeight: '700' },
  buttons: { gap: 10, marginTop: 24 },
  primary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.accent, borderRadius: 24, paddingVertical: 14 },
  primaryText: { color: Colors.background, fontSize: 15, fontWeight: '800' },
  secondary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 24, paddingVertical: 12 },
  secondaryText: { color: Colors.accent, fontSize: 14, fontWeight: '700' },
  link: { alignItems: 'center', paddingVertical: 8 },
  linkText: { color: Colors.textSecondary, fontSize: 14, fontWeight: '600' },
  preview: { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 16, padding: 14, marginBottom: 12, gap: 8 },
  previewHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  previewTitle: { color: Colors.textPrimary, fontSize: 16, fontWeight: '800' },
  previewMeta: { color: Colors.textMuted, fontSize: 13, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowName: { flex: 1, color: Colors.textPrimary, fontSize: 14, fontWeight: '600' },
  rowDose: { color: Colors.textSecondary, fontSize: 13, fontWeight: '700' },
  previewFoot: { color: Colors.textMuted, fontSize: 12 },
});

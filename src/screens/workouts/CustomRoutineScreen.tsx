import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScreenHeader } from '@/components/ScreenHeader';
import { confirmAsk } from '@/components/dev/confirmAsk';
import { Colors } from '@/constants/colors';
import { exerciseName, getExercise, isLoadable } from '@/data/workouts/catalog';
import { blockLabel, doseText, restText } from '@/data/workouts/labels';
import { programRepository } from '@/data/workouts/programRepository';
import type { CatalogExercise, WorkoutExercise, WorkoutProgram, WorkoutSession } from '@/data/workouts/types';
import { addExercises, customProgram, dayLetter, emptyDay, isCustomProgram, moveExercise } from '@/logic/customRoutine';
import { estimateMinutes } from '@/logic/workoutGenerator';
import { DoseEditor } from '@/components/workouts/DoseEditor';
import { ExerciseLibrary } from '@/components/workouts/ExerciseLibrary';
import { ExerciseLoop } from '@/components/workouts/ExerciseLoop';
import { WorkoutModal } from '@/components/workouts/WorkoutModal';
import { ExerciseDetail } from './ExerciseInfoScreen';
import { t, tn } from '@/i18n';

// "Crear mi propia rutina", como en Hevy o Strong: nombre, uno o varios días (A, B, C…) y, en cada uno,
// los ejercicios de la biblioteca (buscador y filtros por músculo y material, se eligen varios a la
// vez), en el orden que se quiera y con series, repeticiones o tiempo, peso y descanso. Se guarda como
// un programa más (src/logic/customRoutine.ts). Con ?program= se cambia uno que ya existe: una rutina
// propia o cualquier otro programa (del generador o del entrenador: quitar, añadir, ordenar); ?day=B abre
// ese día.

const MAX_DAYS = 7;

export const CustomRoutineScreen = () => {
  const router = useRouter();
  const { program: programId, day: dayParam } = useLocalSearchParams<{ program?: string; day?: string }>();
  const [base, setBase] = useState<WorkoutProgram | null>(null);
  const [loaded, setLoaded] = useState(!programId);
  const [title, setTitle] = useState('');
  const [days, setDays] = useState<WorkoutSession[]>([emptyDay(0)]);
  const [current, setCurrent] = useState(0);
  const [picking, setPicking] = useState(false);
  const [chosen, setChosen] = useState<string[]>([]);
  const [editAt, setEditAt] = useState<number | null>(null);
  const [info, setInfo] = useState<CatalogExercise | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!programId) return;
    programRepository.get(programId).then((p) => {
      if (p) {
        setBase(p);
        setTitle(t(p.title));
        // Los títulos del generador están en inglés ("Full body"): en la casilla, ya traducidos
        setDays(p.sessions.length ? p.sessions.map((d) => ({ ...d, title: d.title ? t(d.title) : '' })) : [emptyDay(0)]);
        setCurrent(Math.max(0, p.sessions.findIndex((d) => d.id === dayParam)));
      }
      setLoaded(true);
    });
  }, [programId, dayParam]);

  const day = days[current] ?? days[0];
  const updateDay = (fn: (d: WorkoutSession) => WorkoutSession) => setDays((all) => all.map((d, i) => (i === current ? fn(d) : d)));
  const updateItem = (index: number, patch: Partial<WorkoutExercise>) =>
    updateDay((d) => ({ ...d, exercises: d.exercises.map((it, j) => (j === index ? { ...it, ...patch } : it)) }));

  const addDay = () => {
    if (days.length >= MAX_DAYS) return;
    setDays((all) => [...all, emptyDay(all.length)]);
    setCurrent(days.length);
  };
  const removeDay = async () => {
    if (days.length < 2) return;
    if (day.exercises.length && !(await confirmAsk(t('Remove this day?'), t('Its exercises will be removed from the routine.'), t('Remove')))) return;
    setDays((all) => all.filter((_, i) => i !== current).map((d, i) => ({ ...d, id: dayLetter(i) })));
    setCurrent((c) => Math.max(0, c - 1));
  };

  const togglePick = (ex: CatalogExercise) => setChosen((c) => (c.includes(ex.id) ? c.filter((id) => id !== ex.id) : [...c, ex.id]));
  const closePicker = () => {
    setPicking(false);
    setChosen([]);
  };
  const addChosen = () => {
    updateDay((d) => addExercises(d, chosen));
    closePicker();
  };

  const save = async (follow: boolean) => {
    const prog = customProgram(title, days, { base, follow });
    if (!prog.sessions.length) {
      setError(t('Add at least one exercise.'));
      return;
    }
    setError('');
    setSaving(true);
    try {
      await programRepository.save(prog);
      router.dismissTo('/workouts');
    } catch {
      setError(t('The routine could not be saved. Check your connection and try again.'));
      setSaving(false);
    }
  };

  const editing = editAt !== null ? day.exercises[editAt] : undefined;
  const editingEx = editing ? getExercise(editing.exerciseId) : undefined;
  const count = day.exercises.length;
  const routine = !base || isCustomProgram(base); // rutina propia (si no, un programa del generador o del entrenador)

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <ScreenHeader title={!base ? t('Create my own routine') : routine ? t('Edit routine') : t('Edit programme')} showBack backFallback="/workouts" />
      {!loaded ? (
        <ActivityIndicator color={Colors.accent} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {base?.source === 'professional' && (
            <Text style={styles.proHint}>{t('{name} will see the change.', { name: base.professionalName || t('Your trainer') })}</Text>
          )}
          <Text style={styles.label}>{routine ? t('Routine name') : t('Programme name')}</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={(v) => setTitle(v.slice(0, 120))}
            placeholder={t('e.g. Upper and lower body')}
            placeholderTextColor={Colors.textMuted}
          />

          <Text style={styles.label}>{t('Days')}</Text>
          <View style={styles.tabs}>
            {days.map((d, i) => (
              <TouchableOpacity key={d.id} style={[styles.tab, i === current && styles.tabOn]} onPress={() => setCurrent(i)} accessibilityLabel={t('Day {id}', { id: d.id })}>
                <Text style={[styles.tabText, i === current && styles.tabTextOn]}>{d.id}</Text>
              </TouchableOpacity>
            ))}
            {days.length < MAX_DAYS && (
              <TouchableOpacity style={styles.addDay} onPress={addDay}>
                <Ionicons name="add" size={16} color={Colors.accent} />
                <Text style={styles.addDayText}>{t('Add day')}</Text>
              </TouchableOpacity>
            )}
          </View>
          <View style={styles.dayRow}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              value={day.title}
              onChangeText={(v) => updateDay((d) => ({ ...d, title: v.slice(0, 60) }))}
              placeholder={t('Day {id}', { id: day.id })}
              placeholderTextColor={Colors.textMuted}
              accessibilityLabel={t('Day name (optional)')}
            />
            {days.length > 1 && (
              <TouchableOpacity style={styles.iconBtn} onPress={removeDay} accessibilityLabel={t('Remove this day?')}>
                <Ionicons name="trash-outline" size={18} color={Colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>
          <Text style={styles.meta}>{count ? `~${estimateMinutes(day)} min · ${tn(count, '{n} exercise', '{n} exercises')}` : ' '}</Text>

          {day.exercises.map((it, i) => {
            const ex = getExercise(it.exerciseId);
            if (!ex) return null;
            return (
              <View key={`${it.exerciseId}-${i}`} style={styles.item}>
                <TouchableOpacity onPress={() => setInfo(ex)} accessibilityLabel={exerciseName(ex)}>
                  <ExerciseLoop exercise={ex} size={56} radius={10} />
                </TouchableOpacity>
                <TouchableOpacity style={{ flex: 1 }} onPress={() => setEditAt(i)} accessibilityLabel={t('Edit {name}', { name: exerciseName(ex) })}>
                  <Text style={styles.itemName} numberOfLines={2}>
                    {exerciseName(ex)}
                  </Text>
                  <Text style={styles.itemDose}>
                    {it.block !== 'main' ? `${blockLabel(it.block)} · ` : ''}
                    {doseText(it)}
                    {it.restSec ? ` · ${restText(it.restSec)}` : ''}
                  </Text>
                </TouchableOpacity>
                <View style={styles.order}>
                  <TouchableOpacity onPress={() => updateDay((d) => moveExercise(d, i, -1))} hitSlop={6} disabled={i === 0} accessibilityLabel={t('Move up')}>
                    <Ionicons name="chevron-up" size={18} color={i === 0 ? Colors.cardBorder : Colors.textSecondary} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => updateDay((d) => moveExercise(d, i, 1))} hitSlop={6} disabled={i === count - 1} accessibilityLabel={t('Move down')}>
                    <Ionicons name="chevron-down" size={18} color={i === count - 1 ? Colors.cardBorder : Colors.textSecondary} />
                  </TouchableOpacity>
                </View>
                <TouchableOpacity style={styles.iconSoft} onPress={() => setEditAt(i)} hitSlop={6} accessibilityLabel={t('Edit {name}', { name: exerciseName(ex) })}>
                  <Ionicons name="pencil" size={15} color={Colors.accent} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => updateDay((d) => ({ ...d, exercises: d.exercises.filter((_, j) => j !== i) }))}
                  hitSlop={6}
                  accessibilityLabel={t('Remove')}
                >
                  <Ionicons name="close" size={20} color={Colors.textMuted} />
                </TouchableOpacity>
              </View>
            );
          })}

          {!count && <Text style={styles.empty}>{t('Add exercises from the library: search by name, muscle or equipment.')}</Text>}
          <TouchableOpacity style={styles.add} onPress={() => setPicking(true)}>
            <Ionicons name="add-circle-outline" size={20} color={Colors.accent} />
            <Text style={styles.addText}>{t('Add exercises')}</Text>
          </TouchableOpacity>

          {error ? <Text style={styles.error}>{error}</Text> : null}
        </ScrollView>
      )}

      {loaded && (
        <View style={styles.bottom}>
          <TouchableOpacity style={styles.primary} onPress={() => save(base ? base.active : true)} disabled={saving}>
            {saving ? <ActivityIndicator color={Colors.background} /> : <Text style={styles.primaryText}>{base ? t('Save changes') : t('Save and follow this routine')}</Text>}
          </TouchableOpacity>
          {!base && (
            <TouchableOpacity style={styles.link} onPress={() => save(false)} disabled={saving}>
              <Text style={styles.linkText}>{t('Save without following it')}</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      <WorkoutModal
        visible={picking}
        title={t('Add exercises')}
        onClose={closePicker}
        footer={
          <TouchableOpacity style={[styles.primary, !chosen.length && styles.disabled]} onPress={addChosen} disabled={!chosen.length}>
            <Text style={styles.primaryText}>{chosen.length ? tn(chosen.length, 'Add {n} exercise', 'Add {n} exercises') : t('Choose one or more')}</Text>
          </TouchableOpacity>
        }
      >
        <ExerciseLibrary forSelf onPick={togglePick} selectedIds={chosen} />
      </WorkoutModal>

      <WorkoutModal visible={editAt !== null} title={editingEx ? exerciseName(editingEx) : ''} onClose={() => setEditAt(null)}>
        {editing && editingEx && (
          <DoseEditor
            key={editAt}
            item={editing}
            perSide={editingEx.perSide}
            withWeight={isLoadable(editingEx)}
            onSave={(change) => {
              updateItem(editAt!, change);
              setEditAt(null);
            }}
            onCancel={() => setEditAt(null)}
          />
        )}
      </WorkoutModal>

      <WorkoutModal visible={!!info} title={info ? exerciseName(info) : ''} onClose={() => setInfo(null)}>
        {info && <ExerciseDetail ex={info} onOpenSimilar={setInfo} />}
      </WorkoutModal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: 20, paddingBottom: 24 },
  label: { color: Colors.textPrimary, fontSize: 15, fontWeight: '800', marginTop: 14, marginBottom: 8 },
  input: { borderWidth: 1, borderColor: Colors.cardBorder, backgroundColor: Colors.card, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, color: Colors.textPrimary, fontSize: 15 },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 10 },
  tab: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, borderColor: Colors.cardBorder, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.card },
  tabOn: { borderColor: Colors.accent, backgroundColor: Colors.accentSoft },
  tabText: { color: Colors.textSecondary, fontSize: 14, fontWeight: '800' },
  tabTextOn: { color: Colors.textPrimary },
  addDay: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 10, paddingVertical: 8 },
  addDayText: { color: Colors.accent, fontSize: 13, fontWeight: '700' },
  dayRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  meta: { color: Colors.textMuted, fontSize: 12, marginTop: 8, marginBottom: 10 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 14, padding: 8, marginBottom: 8 },
  itemName: { color: Colors.textPrimary, fontSize: 14, fontWeight: '800' },
  itemDose: { color: Colors.textSecondary, fontSize: 12, marginTop: 2 },
  order: { gap: 2 },
  iconSoft: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.accentSoft },
  empty: { color: Colors.textSecondary, fontSize: 14, lineHeight: 20, marginVertical: 8 },
  add: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderStyle: 'dashed', borderColor: Colors.accent, borderRadius: 14, paddingVertical: 14, marginTop: 4 },
  addText: { color: Colors.accent, fontSize: 15, fontWeight: '800' },
  error: { color: Colors.danger, fontSize: 13, marginTop: 12 },
  proHint: { color: Colors.textSecondary, fontSize: 13, lineHeight: 18, marginTop: 8 },
  bottom: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 8, borderTopWidth: 1, borderTopColor: Colors.divider },
  primary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.accent, borderRadius: 24, paddingVertical: 14 },
  primaryText: { color: Colors.background, fontSize: 15, fontWeight: '800' },
  disabled: { opacity: 0.45 },
  link: { alignItems: 'center', paddingVertical: 10 },
  linkText: { color: Colors.textSecondary, fontSize: 14, fontWeight: '600' },
});

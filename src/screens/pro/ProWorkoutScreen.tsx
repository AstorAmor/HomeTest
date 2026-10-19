import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ProLayout, useIsWide, useProIdentity } from '@/components/pro/ProLayout';
import { ChoiceChips } from '@/components/ChoiceChips';
import { ExerciseLibrary } from '@/components/workouts/ExerciseLibrary';
import { ExerciseLoop } from '@/components/workouts/ExerciseLoop';
import { WorkoutModal } from '@/components/workouts/WorkoutModal';
import { ExerciseDetail } from '@/screens/workouts/ExerciseInfoScreen';
import { confirmAsk } from '@/components/dev/confirmAsk';
import { Colors } from '@/constants/colors';
import { portal } from '@/data/specialistPortal';
import type { PatientSummary } from '@/data/specialistTypes';
import { EQUIPMENT, exerciseName, getExercise, patternLabel } from '@/data/workouts/catalog';
import { BLOCK_ORDER, GOALS, LEVELS, PLACES, blockLabel, goalLabel } from '@/data/workouts/labels';
import type { CatalogExercise, Equipment, WorkoutBlock, WorkoutExercise, WorkoutPrefs, WorkoutProgram, WorkoutSession } from '@/data/workouts/types';
import { DEFAULT_PREFS, defaultDose, equipmentForPlace, estimateMinutes, generateProgram, goalFromPatientGoals, newProgram, progressionText } from '@/logic/workoutGenerator';
import { useReloadOnFocus } from '@/hooks/useReloadOnFocus';
import { t } from '@/i18n';

// Portal → crear o editar el programa de entrenamiento de un paciente. El generador hace el primer
// borrador con el objetivo del paciente; el entrenador lo ajusta (cambiar un ejercicio por otro del mismo
// patrón, series, repeticiones, descanso, una indicación por ejercicio, orden) y lo manda. Al paciente
// le sale en Entrenamientos, con el vídeo de cada ejercicio y el modo guiado.

const HOME_KIT: Equipment[] = ['dumbbells', 'kettlebell', 'bands', 'bench', 'bar'];
type Picker = { mode: 'swap'; index: number } | { mode: 'add'; block: WorkoutBlock } | null;

export const ProWorkoutScreen = () => {
  const router = useRouter();
  const wide = useIsWide();
  const me = useProIdentity();
  const { patient: patientId, program: programId } = useLocalSearchParams<{ patient: string; program?: string }>();
  const [patient, setPatient] = useState<PatientSummary | null>(null);
  const [programIdState, setProgramIdState] = useState<string | null>(programId ?? null);
  const [existing, setExisting] = useState<WorkoutProgram | null>(null); // al editar: conserva fecha y sesiones hechas
  const [prefs, setPrefs] = useState<WorkoutPrefs>({ ...DEFAULT_PREFS, minutes: 45 });
  const [kit, setKit] = useState<Equipment[]>(['dumbbells']);
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [current, setCurrent] = useState(0);
  const [edited, setEdited] = useState(false);
  const [picker, setPicker] = useState<Picker>(null);
  const [info, setInfo] = useState<CatalogExercise | null>(null);
  const [state, setState] = useState<'idle' | 'saving' | 'sent' | 'error'>('idle');
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);

  const full = useMemo(() => ({ ...prefs, equipment: equipmentForPlace(prefs.place, kit) }), [prefs, kit]);

  useReloadOnFocus(
    useCallback(async () => {
      if (loaded) return;
      const patients = await portal.listPatients().catch(() => [] as PatientSummary[]);
      const p = patients.find((x) => x.id === patientId) ?? null;
      setPatient(p);
      const existing = programId ? (await portal.listWorkouts(patientId).catch(() => [])).find((w) => w.id === programId) : undefined;
      if (existing) {
        setExisting(existing);
        setPrefs(existing.prefs);
        if (existing.prefs.place === 'home_kit') setKit(existing.prefs.equipment);
        setTitle(existing.title);
        setNote(existing.note ?? '');
        setSessions(existing.sessions);
      } else {
        const goal = goalFromPatientGoals(p?.goals);
        const start: WorkoutPrefs = { ...DEFAULT_PREFS, goal, minutes: 45 };
        setPrefs(start);
        setTitle(`${goalLabel(goal)} · ${t('{n} days', { n: start.daysPerWeek })}`);
        setSessions(generateProgram({ ...start, equipment: equipmentForPlace(start.place, kit) }));
      }
      setLoaded(true);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [patientId, programId, loaded]),
  );

  const set = (patch: Partial<WorkoutPrefs>) => setPrefs((p) => ({ ...p, ...patch }));
  const regenerate = async (seed = prefs.seed) => {
    if (edited && !(await confirmAsk(t('Make a new draft?'), t('Your changes to the sessions will be replaced.'), t('Make it')))) return;
    const next = { ...full, seed };
    setPrefs((p) => ({ ...p, seed }));
    setSessions(generateProgram(next));
    setCurrent(0);
    setEdited(false);
    if (!programIdState) setTitle(`${goalLabel(next.goal)} · ${t('{n} days', { n: next.daysPerWeek })}`);
  };

  const session = sessions[current];
  const updateItems = (fn: (items: WorkoutExercise[]) => WorkoutExercise[]) => {
    setSessions((all) => all.map((s, i) => (i === current ? { ...s, exercises: fn(s.exercises) } : s)));
    setEdited(true);
  };
  const updateItem = (index: number, patch: Partial<WorkoutExercise>) => updateItems((items) => items.map((it, j) => (j === index ? { ...it, ...patch } : it)));
  const move = (index: number, dir: -1 | 1) =>
    updateItems((items) => {
      const j = index + dir;
      if (j < 0 || j >= items.length || items[j].block !== items[index].block) return items;
      const copy = [...items];
      [copy[index], copy[j]] = [copy[j], copy[index]];
      return copy;
    });

  const onPick = (ex: CatalogExercise) => {
    if (!picker || !session) return;
    if (picker.mode === 'swap') {
      const old = session.exercises[picker.index];
      updateItem(picker.index, { exerciseId: ex.id, ...(old.block === 'main' ? {} : defaultDose(ex.id, full, old.block, session.focus)) });
    } else {
      const block = picker.block;
      const dose = defaultDose(ex.id, full, block, session.focus);
      updateItems((items) => {
        // Al final de su bloque (los ejercicios van ordenados por bloque)
        const at = items.filter((it) => BLOCK_ORDER.indexOf(it.block) <= BLOCK_ORDER.indexOf(block)).length;
        const copy = [...items];
        copy.splice(at, 0, { exerciseId: ex.id, block, ...dose });
        return copy;
      });
    }
    setPicker(null);
  };

  const send = async () => {
    const clean = sessions.map((s) => ({ ...s, exercises: s.exercises.filter((e) => getExercise(e.exerciseId)) })).filter((s) => s.exercises.length);
    if (!clean.length) {
      setError(t('Add at least one exercise.'));
      setState('error');
      return;
    }
    setState('saving');
    setError('');
    try {
      const base: WorkoutProgram = existing ?? { ...newProgram(full, { id: programIdState ?? `wp-${Date.now().toString(36)}` }), sessions: [] };
      const prog: WorkoutProgram = { ...base, title: title.trim() || goalLabel(full.goal), note: note.trim() || undefined, sessions: clean, prefs: full, active: true };
      await portal.sendWorkout(patientId, prog, me.name);
      setProgramIdState(prog.id);
      setExisting(prog);
      setState('sent');
    } catch (e) {
      setError(e instanceof Error ? e.message : t('Could not send the programme'));
      setState('error');
    }
  };

  const name = patient?.name ?? t('Patient');
  const back = { label: t('Workouts'), onPress: () => router.replace('/pro-workouts') };

  if (state === 'sent') {
    return (
      <ProLayout active="workouts" title={t('Workout programme')} back={back}>
        <View style={styles.done}>
          <Ionicons name="checkmark-circle" size={56} color={Colors.ok} />
          <Text style={styles.doneTitle}>{t('Programme sent to {name}', { name })}</Text>
          <Text style={styles.mutedCenter}>{t('It appears in their app under Workouts, with the video of each exercise and a guided mode. You will see here the sessions they complete.')}</Text>
          <TouchableOpacity style={styles.primary} onPress={() => router.replace('/pro-workouts')}>
            <Text style={styles.primaryText}>{t('Back to Workouts')}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setState('idle')}>
            <Text style={styles.link}>{t('Keep editing')}</Text>
          </TouchableOpacity>
        </View>
      </ProLayout>
    );
  }

  const settings = (
    <View style={[styles.panel, wide && styles.panelWide]}>
      <Text style={styles.label}>{t('Goal')}</Text>
      <ChoiceChips options={GOALS.map((g) => ({ id: g.id, label: t(g.label) }))} value={prefs.goal} onChange={(goal) => set({ goal })} />
      <Text style={styles.label}>{t('Level')}</Text>
      <ChoiceChips options={LEVELS.map((l) => ({ id: l.id, label: t(l.label) }))} value={prefs.level} onChange={(level) => set({ level })} />
      <Text style={styles.label}>{t('Days a week')}</Text>
      <ChoiceChips options={[2, 3, 4, 5].map((n) => ({ id: n, label: String(n) }))} value={prefs.daysPerWeek} onChange={(n) => set({ daysPerWeek: n })} />
      <Text style={styles.label}>{t('Minutes per session')}</Text>
      <ChoiceChips options={[20, 30, 45, 60].map((n) => ({ id: n, label: `${n} min` }))} value={prefs.minutes} onChange={(n) => set({ minutes: n })} />
      <Text style={styles.label}>{t('Where they train')}</Text>
      <ChoiceChips options={PLACES.map((p) => ({ id: p.id, label: t(p.label) }))} value={prefs.place} onChange={(place) => set({ place })} />
      {prefs.place === 'home_kit' && (
        <View style={styles.kit}>
          {EQUIPMENT.filter((e) => HOME_KIT.includes(e.id)).map((e) => {
            const on = kit.includes(e.id);
            return (
              <TouchableOpacity key={e.id} style={[styles.kitItem, on && styles.kitOn]} onPress={() => setKit((k) => (on ? k.filter((x) => x !== e.id) : [...k, e.id]))}>
                <Ionicons name={on ? 'checkbox' : 'square-outline'} size={16} color={on ? Colors.accent : Colors.textMuted} />
                <Text style={styles.kitText}>{t(e.label)}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
      <TouchableOpacity style={styles.toggle} onPress={() => set({ lowImpact: !prefs.lowImpact })}>
        <Ionicons name={prefs.lowImpact ? 'checkbox' : 'square-outline'} size={18} color={Colors.accent} />
        <Text style={styles.kitText}>{t('No jumping')}</Text>
      </TouchableOpacity>
      <View style={styles.genRow}>
        <TouchableOpacity style={styles.secondary} onPress={() => regenerate(prefs.seed)}>
          <Ionicons name="sparkles-outline" size={16} color={Colors.accent} />
          <Text style={styles.secondaryText}>{t('Make the draft')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondary} onPress={() => regenerate(prefs.seed + 1)}>
          <Ionicons name="shuffle" size={16} color={Colors.accent} />
          <Text style={styles.secondaryText}>{t('Another version')}</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.hint}>{t(progressionText(prefs.goal))}</Text>
    </View>
  );

  const editor = session ? (
    <View style={{ flex: 1 }}>
      <Text style={styles.label}>{t('Programme name')}</Text>
      <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder={t('e.g. Strength for the half marathon')} placeholderTextColor={Colors.textMuted} />

      <View style={styles.tabs}>
        {sessions.map((s, i) => (
          <TouchableOpacity key={s.id} style={[styles.tab, i === current && styles.tabOn]} onPress={() => setCurrent(i)}>
            <Text style={[styles.tabText, i === current && styles.tabTextOn]}>
              {s.id} · {t(s.title)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <Text style={styles.meta}>~{estimateMinutes(session)} min</Text>

      {BLOCK_ORDER.map((block) => {
        const rows = session.exercises.map((it, index) => ({ it, index })).filter((x) => x.it.block === block);
        if (!rows.length && block !== 'main') return null;
        return (
          <View key={block} style={{ marginBottom: 6 }}>
            <View style={styles.blockHead}>
              <Text style={styles.blockTitle}>{blockLabel(block)}</Text>
              <TouchableOpacity style={styles.addSmall} onPress={() => setPicker({ mode: 'add', block })}>
                <Ionicons name="add" size={16} color={Colors.accent} />
                <Text style={styles.addText}>{t('Add exercise')}</Text>
              </TouchableOpacity>
            </View>
            {rows.map(({ it, index }) => {
              const ex = getExercise(it.exerciseId);
              if (!ex) return null;
              return (
                <View key={`${it.exerciseId}-${index}`} style={styles.item}>
                  <TouchableOpacity onPress={() => setInfo(ex)}>
                    <ExerciseLoop exercise={ex} size={wide ? 72 : 56} radius={10} />
                  </TouchableOpacity>
                  <View style={{ flex: 1, gap: 6 }}>
                    <View style={styles.itemHead}>
                      <TouchableOpacity style={{ flex: 1 }} onPress={() => setInfo(ex)}>
                        <Text style={styles.itemName}>{exerciseName(ex)}</Text>
                        <Text style={styles.itemMeta}>
                          {patternLabel(ex.pattern)}
                          {ex.perSide ? ` · ${t('per side')}` : ''}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => move(index, -1)} hitSlop={6} accessibilityLabel={t('Move up')}>
                        <Ionicons name="chevron-up" size={18} color={Colors.textSecondary} />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => move(index, 1)} hitSlop={6} accessibilityLabel={t('Move down')}>
                        <Ionicons name="chevron-down" size={18} color={Colors.textSecondary} />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => setPicker({ mode: 'swap', index })} hitSlop={6} accessibilityLabel={t('Swap')}>
                        <Ionicons name="swap-horizontal" size={18} color={Colors.accent} />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => updateItems((items) => items.filter((_, j) => j !== index))} hitSlop={6} accessibilityLabel={t('Remove')}>
                        <Ionicons name="trash-outline" size={17} color={Colors.textMuted} />
                      </TouchableOpacity>
                    </View>
                    <View style={styles.doseRow}>
                      <View style={styles.doseField}>
                        <Text style={styles.doseLabel}>{t('Sets')}</Text>
                        <TextInput
                          style={styles.doseInput}
                          value={String(it.sets)}
                          keyboardType="number-pad"
                          onChangeText={(v) => updateItem(index, { sets: Math.max(1, Math.min(10, Number(v.replace(/\D/g, '')) || 1)) })}
                        />
                      </View>
                      <View style={[styles.doseField, { flex: 1.4 }]}>
                        <Text style={styles.doseLabel}>{ex.timed ? t('Duration') : t('Reps')}</Text>
                        <TextInput style={styles.doseInput} value={it.reps} onChangeText={(v) => updateItem(index, { reps: v.slice(0, 16) })} />
                      </View>
                      <View style={styles.doseField}>
                        <Text style={styles.doseLabel}>{t('Rest (s)')}</Text>
                        <TextInput
                          style={styles.doseInput}
                          value={String(it.restSec)}
                          keyboardType="number-pad"
                          onChangeText={(v) => updateItem(index, { restSec: Math.min(600, Number(v.replace(/\D/g, '')) || 0) })}
                        />
                      </View>
                    </View>
                    <TextInput
                      style={styles.noteInput}
                      value={it.note ?? ''}
                      onChangeText={(v) => updateItem(index, { note: v.slice(0, 200) || undefined })}
                      placeholder={t('Tip for the patient (optional)')}
                      placeholderTextColor={Colors.textMuted}
                    />
                  </View>
                </View>
              );
            })}
          </View>
        );
      })}

      <Text style={styles.label}>{t('Note to the patient')}</Text>
      <TextInput
        style={[styles.input, { minHeight: 70, textAlignVertical: 'top' }]}
        multiline
        value={note}
        onChangeText={setNote}
        placeholder={t('When to do it, how it should feel, what to tell you')}
        placeholderTextColor={Colors.textMuted}
      />
    </View>
  ) : (
    <ActivityIndicator color={Colors.accent} />
  );

  const pickerSession = session;
  const swapping = picker?.mode === 'swap' && pickerSession ? getExercise(pickerSession.exercises[picker.index]?.exerciseId) : undefined;

  return (
    <ProLayout
      active="workouts"
      title={`${t('Workout programme')} · ${name}`}
      back={back}
      right={
        <TouchableOpacity style={styles.send} onPress={send} disabled={state === 'saving'}>
          {state === 'saving' ? <ActivityIndicator size="small" color={Colors.background} /> : <Text style={styles.sendText}>{programIdState ? t('Update') : t('Send to patient')}</Text>}
        </TouchableOpacity>
      }
    >
      <Text style={styles.intro}>
        {t('Draft made from their goal. Choose the settings, then swap, adjust or add exercises before sending.')}
        {patient?.goals?.length ? ` ${t('Their goals: {g}.', { g: patient.goals.join(', ') })}` : ''}
      </Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={wide ? styles.columns : undefined}>
        {settings}
        {editor}
      </View>

      <WorkoutModal
        visible={!!picker}
        title={picker?.mode === 'swap' && swapping ? t('Swap {name}', { name: exerciseName(swapping) }) : t('Add exercise')}
        onClose={() => setPicker(null)}
      >
        {picker && (
          <ExerciseLibrary
            onPick={onPick}
            onOpen={setInfo}
            pickLabel={picker.mode === 'swap' ? t('Use this one') : t('Add')}
            equipment={full.equipment}
            onlyPatterns={picker.mode === 'swap' && swapping ? [swapping.pattern] : undefined}
            excludeId={swapping?.id}
          />
        )}
      </WorkoutModal>
      <WorkoutModal visible={!!info && !picker} title={info ? exerciseName(info) : ''} onClose={() => setInfo(null)}>
        {info && <ExerciseDetail ex={info} onOpenSimilar={setInfo} />}
      </WorkoutModal>
    </ProLayout>
  );
};

const styles = StyleSheet.create({
  intro: { color: Colors.textSecondary, fontSize: 13, marginBottom: 10 },
  error: { color: Colors.danger, fontSize: 13, marginBottom: 8 },
  columns: { flexDirection: 'row', gap: 20, alignItems: 'flex-start' },
  panel: { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 14, padding: 14, marginBottom: 14 },
  panelWide: { width: 340 },
  label: { color: Colors.textPrimary, fontSize: 14, fontWeight: '800', marginTop: 12, marginBottom: 8 },
  kit: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  kitItem: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 6 },
  kitOn: { borderColor: Colors.accent, backgroundColor: Colors.accentSoft },
  kitText: { color: Colors.textPrimary, fontSize: 13, fontWeight: '600' },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  genRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  secondary: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 18, paddingHorizontal: 12, paddingVertical: 8 },
  secondaryText: { color: Colors.accent, fontSize: 13, fontWeight: '700' },
  hint: { color: Colors.textMuted, fontSize: 12, lineHeight: 17, marginTop: 12 },
  input: { borderWidth: 1, borderColor: Colors.cardBorder, backgroundColor: Colors.card, borderRadius: 10, padding: 10, color: Colors.textPrimary, fontSize: 14 },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 14 },
  tab: { borderWidth: 1, borderColor: Colors.cardBorder, backgroundColor: Colors.card, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 7 },
  tabOn: { borderColor: Colors.accent, backgroundColor: Colors.accentSoft },
  tabText: { color: Colors.textSecondary, fontSize: 13, fontWeight: '700' },
  tabTextOn: { color: Colors.textPrimary },
  meta: { color: Colors.textMuted, fontSize: 12, marginTop: 6 },
  blockHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, marginBottom: 6 },
  blockTitle: { color: Colors.textPrimary, fontSize: 15, fontWeight: '800' },
  addSmall: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  addText: { color: Colors.accent, fontSize: 13, fontWeight: '700' },
  item: { flexDirection: 'row', gap: 10, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 14, padding: 10, marginBottom: 8 },
  itemHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  itemName: { color: Colors.textPrimary, fontSize: 14, fontWeight: '800' },
  itemMeta: { color: Colors.textMuted, fontSize: 11 },
  doseRow: { flexDirection: 'row', gap: 8 },
  doseField: { flex: 1, gap: 2 },
  doseLabel: { color: Colors.textMuted, fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  doseInput: { borderWidth: 1, borderColor: Colors.cardBorder, backgroundColor: Colors.background, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5, color: Colors.textPrimary, fontSize: 13 },
  noteInput: { borderWidth: 1, borderColor: Colors.cardBorder, backgroundColor: Colors.background, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5, color: Colors.textPrimary, fontSize: 12 },
  send: { backgroundColor: Colors.accent, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 7 },
  sendText: { color: Colors.background, fontSize: 13, fontWeight: '800' },
  done: { alignItems: 'center', gap: 12, marginTop: 60, paddingHorizontal: 20 },
  doneTitle: { color: Colors.textPrimary, fontSize: 22, fontWeight: '900', textAlign: 'center' },
  mutedCenter: { color: Colors.textSecondary, fontSize: 13, textAlign: 'center', maxWidth: 520 },
  primary: { backgroundColor: Colors.accent, borderRadius: 22, paddingHorizontal: 20, paddingVertical: 12, marginTop: 8 },
  primaryText: { color: Colors.background, fontSize: 14, fontWeight: '800' },
  link: { color: Colors.accent, fontSize: 14, fontWeight: '700', marginTop: 4 },
});

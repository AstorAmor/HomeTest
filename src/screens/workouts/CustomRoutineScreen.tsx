import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { confirmAsk } from '@/components/dev/confirmAsk';
import { KeyboardAwareScroll, useRevealOnFocus } from '@/components/KeyboardAwareScroll';
import { Colors } from '@/constants/colors';
import { exerciseName, getExercise } from '@/data/workouts/catalog';
import { programRepository } from '@/data/workouts/programRepository';
import type { CatalogExercise, WorkoutExercise, WorkoutProgram, WorkoutSession } from '@/data/workouts/types';
import { addExercises, customProgram, dayLetter, emptyDay, fromDraft, isCustomProgram, switchTimed, toDraft, type DraftSet } from '@/logic/customRoutine';
import { estimateMinutes } from '@/logic/workoutGenerator';
import { isTimedReps } from '@/logic/workoutTimer';
import { ExerciseLibrary } from '@/components/workouts/ExerciseLibrary';
import { RoutineExerciseCard } from '@/components/workouts/RoutineExerciseCard';
import { WorkoutModal } from '@/components/workouts/WorkoutModal';
import { ExerciseDetail } from './ExerciseInfoScreen';
import { num, t, tn } from '@/i18n';

// "Crear mi propia rutina" y «Editar» de cualquier programa, como «Edit Routine» de Hevy: nombre, uno o
// varios días (A, B, C…) y, en cada uno, todos sus ejercicios a la vista y editables en el sitio, cada
// serie con su peso y sus repeticiones (src/components/workouts/RoutineExerciseCard.tsx). Los ejercicios
// salen de la biblioteca (buscador y filtros por músculo y material, varios a la vez). Se guarda como un
// programa más (src/logic/customRoutine.ts): las series distintas, serie a serie (`setPlan`); si son
// todas iguales, como antes. Con ?program= se cambia uno que ya existe (también los del generador y los
// del entrenador: «Álex verá el cambio»); ?day=B abre ese día. El teclado no tapa la casilla
// (KeyboardAwareScroll) y salir con cambios sin guardar pregunta antes.

const MAX_DAYS = 7;

// En el editor, cada ejercicio lleva lo escrito en sus casillas, serie a serie
type EditItem = WorkoutExercise & { draft: DraftSet[] };
type EditDay = Omit<WorkoutSession, 'exercises'> & { exercises: EditItem[] };

const withDraft = (it: WorkoutExercise): EditItem => ('draft' in it ? (it as EditItem) : { ...it, draft: toDraft(it, num) });
const editDay = (d: WorkoutSession): EditDay => ({ ...d, exercises: d.exercises.map(withDraft) });

export const CustomRoutineScreen = () => {
  const router = useRouter();
  const navigation = useNavigation();
  const { program: programId, day: dayParam } = useLocalSearchParams<{ program?: string; day?: string }>();
  const [base, setBase] = useState<WorkoutProgram | null>(null);
  const [loaded, setLoaded] = useState(!programId);
  const [title, setTitle] = useState('');
  const [days, setDays] = useState<EditDay[]>([editDay(emptyDay(0))]);
  const [current, setCurrent] = useState(0);
  const [picking, setPicking] = useState(false);
  const [replaceAt, setReplaceAt] = useState<number | null>(null); // cambiar ese ejercicio por otro
  const [chosen, setChosen] = useState<string[]>([]);
  const [info, setInfo] = useState<CatalogExercise | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const initial = useRef(JSON.stringify({ title: '', days })); // para saber si hay cambios sin guardar
  const leaving = useRef(false);

  useEffect(() => {
    if (!programId) return;
    programRepository.get(programId).then((p) => {
      if (p) {
        // Los títulos del generador están en inglés ("Full body"): en la casilla, ya traducidos
        const ds = p.sessions.length ? p.sessions.map((d) => editDay({ ...d, title: d.title ? t(d.title) : '' })) : [editDay(emptyDay(0))];
        setBase(p);
        setTitle(t(p.title));
        setDays(ds);
        setCurrent(Math.max(0, p.sessions.findIndex((d) => d.id === dayParam)));
        initial.current = JSON.stringify({ title: t(p.title), days: ds });
      }
      setLoaded(true);
    });
  }, [programId, dayParam]);

  const dirty = loaded && JSON.stringify({ title, days }) !== initial.current;

  // «Atrás», el gesto o Cancelar con cambios sin guardar: pregunta antes
  useEffect(() => {
    if (!dirty) return;
    return navigation.addListener('beforeRemove', (e) => {
      if (leaving.current) return;
      e.preventDefault();
      confirmAsk(t('Leave without saving?'), t('Your changes will be lost.'), t('Leave')).then((ok) => {
        if (!ok) return;
        leaving.current = true;
        navigation.dispatch(e.data.action);
      });
    });
  }, [navigation, dirty]);

  const day = days[current] ?? days[0];
  const updateDay = (fn: (d: EditDay) => EditDay) => setDays((all) => all.map((d, i) => (i === current ? fn(d) : d)));
  const updateItem = (index: number, fn: (it: EditItem) => EditItem) => updateDay((d) => ({ ...d, exercises: d.exercises.map((it, j) => (j === index ? fn(it) : it)) }));
  const move = (index: number, dir: -1 | 1) =>
    updateDay((d) => {
      const j = index + dir;
      if (j < 0 || j >= d.exercises.length) return d;
      const exercises = [...d.exercises];
      [exercises[index], exercises[j]] = [exercises[j], exercises[index]];
      return { ...d, exercises };
    });
  const remove = async (index: number) => {
    const ex = getExercise(day.exercises[index]?.exerciseId ?? '');
    if (!(await confirmAsk(t('Remove {name}?', { name: ex ? exerciseName(ex) : '' }), t('You can add it again from the library.'), t('Remove')))) return;
    updateDay((d) => ({ ...d, exercises: d.exercises.filter((_, j) => j !== index) }));
  };

  const addDay = () => {
    if (days.length >= MAX_DAYS) return;
    setDays((all) => [...all, editDay(emptyDay(all.length))]);
    setCurrent(days.length);
  };
  const removeDay = async () => {
    if (days.length < 2) return;
    if (day.exercises.length && !(await confirmAsk(t('Remove this day?'), t('Its exercises will be removed from the routine.'), t('Remove')))) return;
    setDays((all) => all.filter((_, i) => i !== current).map((d, i) => ({ ...d, id: dayLetter(i) })));
    setCurrent((c) => Math.max(0, c - 1));
  };

  const closePicker = () => {
    setPicking(false);
    setReplaceAt(null);
    setChosen([]);
  };
  const pick = (ex: CatalogExercise) => {
    if (replaceAt !== null) {
      // Cambiar: el nuevo ejercicio se queda con sus series, su descanso y su nota
      updateItem(replaceAt, (it) => ({ ...it, exerciseId: ex.id }));
      closePicker();
      return;
    }
    setChosen((c) => (c.includes(ex.id) ? c.filter((id) => id !== ex.id) : [...c, ex.id]));
  };
  const addChosen = () => {
    updateDay((d) => {
      const added = addExercises({ ...d, exercises: d.exercises }, chosen);
      return { ...d, exercises: added.exercises.map(withDraft) };
    });
    closePicker();
  };

  const save = async (follow: boolean) => {
    const plain: WorkoutSession[] = days.map((d) => ({ ...d, exercises: d.exercises.map(({ draft, ...it }) => fromDraft(it, draft)) }));
    const prog = customProgram(title, plain, { base, follow });
    if (!prog.sessions.length) {
      setError(t('Add at least one exercise.'));
      return;
    }
    setError('');
    setSaving(true);
    try {
      await programRepository.save(prog);
      leaving.current = true;
      router.dismissTo('/workouts');
    } catch {
      setError(t('The routine could not be saved. Check your connection and try again.'));
      setSaving(false);
    }
  };
  const cancel = () => (router.canGoBack() ? router.back() : router.replace('/workouts'));

  const count = day.exercises.length;
  const routine = !base || isCustomProgram(base); // rutina propia (si no, un programa del generador o del entrenador)
  const replacing = replaceAt !== null ? getExercise(day.exercises[replaceAt]?.exerciseId ?? '') : undefined;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.top}>
        <TouchableOpacity onPress={cancel} hitSlop={10}>
          <Text style={styles.cancel}>{t('Cancel')}</Text>
        </TouchableOpacity>
        <Text style={styles.topTitle} numberOfLines={1}>
          {!base ? t('Create my own routine') : routine ? t('Edit routine') : t('Edit programme')}
        </Text>
        <TouchableOpacity style={styles.saveBtn} onPress={() => save(base ? base.active : true)} disabled={saving || !loaded}>
          {saving ? <ActivityIndicator size="small" color={Colors.background} /> : <Text style={styles.saveText}>{t('Save')}</Text>}
        </TouchableOpacity>
      </View>
      {!loaded ? (
        <ActivityIndicator color={Colors.accent} style={{ marginTop: 40 }} />
      ) : (
        <KeyboardAwareScroll contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {base?.source === 'professional' && (
            <Text style={styles.proHint}>{t('{name} will see the change.', { name: base.professionalName || t('Your trainer') })}</Text>
          )}
          <NameInput value={title} onChange={setTitle} placeholder={routine ? t('Routine name') : t('Programme name')} />

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
            <DayNameInput value={day.title} dayId={day.id} onChange={(v) => updateDay((d) => ({ ...d, title: v.slice(0, 60) }))} />
            {days.length > 1 && (
              <TouchableOpacity style={styles.iconBtn} onPress={removeDay} accessibilityLabel={t('Remove this day?')}>
                <Ionicons name="trash-outline" size={18} color={Colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>
          {count ? (
            <Text style={styles.meta}>
              ~{estimateMinutes({ exercises: day.exercises.map(({ draft, ...it }) => fromDraft(it, draft)) })} min · {tn(count, '{n} exercise', '{n} exercises')}
            </Text>
          ) : null}

          {day.exercises.map((it, i) => {
            const ex = getExercise(it.exerciseId);
            if (!ex) return null;
            return (
              <RoutineExerciseCard
                key={`${day.id}-${i}-${it.exerciseId}`}
                item={it}
                ex={ex}
                draft={it.draft}
                first={i === 0}
                last={i === count - 1}
                onOpen={() => setInfo(ex)}
                onChange={(patch) => updateItem(i, (x) => ({ ...x, ...patch }))}
                onDraft={(draft) => updateItem(i, (x) => ({ ...x, draft }))}
                onToggleTimed={() =>
                  updateItem(i, (x) => {
                    const { draft, ...plain } = x;
                    const next = switchTimed(plain, draft, !isTimedReps(x.reps));
                    return { ...next.item, draft: next.draft };
                  })
                }
                onMove={(dir) => move(i, dir)}
                onReplace={() => setReplaceAt(i)}
                onRemove={() => remove(i)}
              />
            );
          })}

          {!count && <Text style={styles.empty}>{t('Add exercises from the library: search by name, muscle or equipment.')}</Text>}
          <TouchableOpacity style={styles.add} onPress={() => setPicking(true)}>
            <Ionicons name="add" size={20} color={Colors.background} />
            <Text style={styles.addText}>{t('Add exercises')}</Text>
          </TouchableOpacity>
          {!base && (
            <TouchableOpacity style={styles.link} onPress={() => save(false)} disabled={saving}>
              <Text style={styles.linkText}>{t('Save without following it')}</Text>
            </TouchableOpacity>
          )}
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </KeyboardAwareScroll>
      )}

      <WorkoutModal
        visible={picking || replaceAt !== null}
        title={replacing ? t('Swap {name}', { name: exerciseName(replacing) }) : t('Add exercises')}
        onClose={closePicker}
        footer={
          replaceAt === null ? (
            <TouchableOpacity style={[styles.primary, !chosen.length && styles.disabled]} onPress={addChosen} disabled={!chosen.length}>
              <Text style={styles.primaryText}>{chosen.length ? tn(chosen.length, 'Add {n} exercise', 'Add {n} exercises') : t('Choose one or more')}</Text>
            </TouchableOpacity>
          ) : undefined
        }
      >
        {replaceAt !== null ? (
          <ExerciseLibrary forSelf onPick={pick} pickLabel={t('Use this one')} excludeId={replacing?.id} />
        ) : (
          <ExerciseLibrary forSelf onPick={pick} selectedIds={chosen} />
        )}
      </WorkoutModal>

      <WorkoutModal visible={!!info} title={info ? exerciseName(info) : ''} onClose={() => setInfo(null)}>
        {info && <ExerciseDetail ex={info} onOpenSimilar={setInfo} />}
      </WorkoutModal>
    </SafeAreaView>
  );
};

// El nombre, grande y con su ✕ para borrarlo (como en Hevy)
const NameInput = ({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) => {
  const reveal = useRevealOnFocus();
  return (
    <View style={styles.nameRow}>
      <TextInput
        style={styles.name}
        value={value}
        onChangeText={(v) => onChange(v.slice(0, 120))}
        placeholder={placeholder}
        placeholderTextColor={Colors.textMuted}
        onFocus={reveal}
        accessibilityLabel={placeholder}
      />
      {value ? (
        <TouchableOpacity style={styles.clear} onPress={() => onChange('')} hitSlop={8} accessibilityLabel={t('Clear the name')}>
          <Ionicons name="close" size={16} color={Colors.textSecondary} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

const DayNameInput = ({ value, dayId, onChange }: { value: string; dayId: string; onChange: (v: string) => void }) => {
  const reveal = useRevealOnFocus();
  return (
    <TextInput
      style={[styles.input, { flex: 1 }]}
      value={value}
      onChangeText={onChange}
      placeholder={t('Day {id}', { id: dayId })}
      placeholderTextColor={Colors.textMuted}
      onFocus={reveal}
      accessibilityLabel={t('Day name (optional)')}
    />
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  top: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.divider },
  cancel: { color: Colors.accent, fontSize: 16, fontWeight: '600' },
  topTitle: { flex: 1, color: Colors.textPrimary, fontSize: 16, fontWeight: '800', textAlign: 'center' },
  saveBtn: { backgroundColor: Colors.accent, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 9, minWidth: 80, alignItems: 'center' },
  saveText: { color: Colors.background, fontSize: 15, fontWeight: '800' },
  content: { paddingHorizontal: 16, paddingBottom: 32 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.divider, marginTop: 6 },
  name: { flex: 1, color: Colors.textPrimary, fontSize: 21, fontWeight: '800', paddingVertical: 6 },
  clear: { width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.card, alignItems: 'center', justifyContent: 'center' },
  input: { borderWidth: 1, borderColor: Colors.cardBorder, backgroundColor: Colors.card, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, color: Colors.textPrimary, fontSize: 15 },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 14, marginBottom: 10 },
  tab: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, borderColor: Colors.cardBorder, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.card },
  tabOn: { borderColor: Colors.accent, backgroundColor: Colors.accentSoft },
  tabText: { color: Colors.textSecondary, fontSize: 14, fontWeight: '800' },
  tabTextOn: { color: Colors.textPrimary },
  addDay: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 10, paddingVertical: 8 },
  addDayText: { color: Colors.accent, fontSize: 13, fontWeight: '700' },
  dayRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  meta: { color: Colors.textMuted, fontSize: 12, marginTop: 8 },
  empty: { color: Colors.textSecondary, fontSize: 14, lineHeight: 20, marginVertical: 12 },
  add: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: Colors.accent, borderRadius: 12, paddingVertical: 13, marginTop: 18 },
  addText: { color: Colors.background, fontSize: 15, fontWeight: '800' },
  error: { color: Colors.danger, fontSize: 13, marginTop: 12 },
  proHint: { color: Colors.textSecondary, fontSize: 13, lineHeight: 18, marginTop: 8 },
  primary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.accent, borderRadius: 24, paddingVertical: 14 },
  primaryText: { color: Colors.background, fontSize: 15, fontWeight: '800' },
  disabled: { opacity: 0.45 },
  link: { alignItems: 'center', paddingVertical: 12 },
  linkText: { color: Colors.textSecondary, fontSize: 14, fontWeight: '600' },
});

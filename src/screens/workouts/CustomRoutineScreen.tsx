import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { confirmAsk } from '@/components/dev/confirmAsk';
import { KeyboardAwareScroll, useRevealOnFocus } from '@/components/KeyboardAwareScroll';
import { Colors } from '@/constants/colors';
import { exerciseName, getExercise } from '@/data/workouts/catalog';
import { moveActiveWorkout } from '@/data/workouts/activeWorkout';
import { programRepository } from '@/data/workouts/programRepository';
import type { CatalogExercise, WorkoutExercise, WorkoutProgram, WorkoutSession } from '@/data/workouts/types';
import {
  addExercises,
  customProgram,
  dayLetter,
  emptyDay,
  firstEmptyRoutine,
  fromDraft,
  isCustomProgram,
  routineIdMap,
  switchTimed,
  toDraft,
  type DraftRoutine,
  type DraftSet,
} from '@/logic/customRoutine';
import { estimateMinutes } from '@/logic/workoutGenerator';
import { isTimedReps } from '@/logic/workoutTimer';
import { WEEK_ORDER, daysText, isScheduled, normWeekdays, routineDays, toggleWeekday, weekdayShort } from '@/logic/workoutWeek';
import { ExerciseLibrary } from '@/components/workouts/ExerciseLibrary';
import { RoutineExerciseCard } from '@/components/workouts/RoutineExerciseCard';
import { WorkoutModal } from '@/components/workouts/WorkoutModal';
import { ExerciseDetail } from './ExerciseInfoScreen';
import { num, t, tn } from '@/i18n';

// "Crear mi propio entrenamiento" y «Editar» de cualquier programa, como «Edit Routine» de Hevy, con varias rutinas
// (fundador, 2026-11-06: «un entrenamiento con varias rutinas que pueden repetirse varios días cada una»):
// - arriba, el nombre del entrenamiento y, si hay días puestos, «Tu semana» (qué rutina toca cada día);
// - las rutinas, cada una con su letra, su nombre y sus días a la vista (antes solo se veía la letra y el nombre iba
//   aparte); tocar una la abre debajo: su nombre, sus días de la semana (un día es de una sola rutina: si era de
//   otra, pasa a esta) y sus ejercicios a modo lista, cerrados (foto, nombre y «4 × 6–8 · 90–100 kg»); tocar uno lo
//   abre para cambiarlo serie a serie (RoutineExerciseCard), uno a la vez (fundador, 2026-11-06);
// - los ejercicios salen de la biblioteca (buscador y filtros por músculo y material, varios a la vez).
// Se guarda como un programa más (src/logic/customRoutine.ts): las letras vuelven a ir en orden y lo ya hecho se va con
// su rutina. Con ?program= se cambia uno que ya existe (también los del generador y los del entrenador: «Álex verá el
// cambio»); ?day=B abre esa rutina. El teclado no tapa la casilla (KeyboardAwareScroll) y salir con cambios sin
// guardar pregunta antes.

const MAX_ROUTINES = 7;

// En el editor, cada ejercicio lleva lo escrito en sus casillas, serie a serie; cada rutina, una clave fija (para la
// lista) y la letra que tenía en el programa guardado
type EditItem = WorkoutExercise & { draft: DraftSet[] };
type EditRoutine = Omit<DraftRoutine, 'exercises'> & { key: string; exercises: EditItem[] };

let seq = 0;
const withDraft = (it: WorkoutExercise): EditItem => ('draft' in it ? (it as EditItem) : { ...it, draft: toDraft(it, num) });
const editRoutine = (d: WorkoutSession, orig: string | null): EditRoutine => ({
  ...d,
  key: `r${++seq}`,
  orig,
  weekdays: normWeekdays(d.weekdays),
  exercises: d.exercises.map(withDraft),
});

const routineLabel = (d: Pick<WorkoutSession, 'title'>, i: number) => d.title.trim() || t('Routine {id}', { id: dayLetter(i) });

export const CustomRoutineScreen = () => {
  const router = useRouter();
  const navigation = useNavigation();
  const { program: programId, day: dayParam } = useLocalSearchParams<{ program?: string; day?: string }>();
  const [base, setBase] = useState<WorkoutProgram | null>(null);
  const [loaded, setLoaded] = useState(!programId);
  const [title, setTitle] = useState('');
  const [days, setDays] = useState<EditRoutine[]>(() => [editRoutine(emptyDay(0), null)]);
  const [current, setCurrent] = useState(0);
  const [picking, setPicking] = useState(false);
  const [replaceAt, setReplaceAt] = useState<number | null>(null); // cambiar ese ejercicio por otro
  const [chosen, setChosen] = useState<string[]>([]);
  const [info, setInfo] = useState<CatalogExercise | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  // El ejercicio abierto (uno a la vez; la lista empieza cerrada, a modo lista): de qué rutina y en qué posición
  const [openEx, setOpenEx] = useState<{ routine: string; i: number } | null>(null);
  const initial = useRef(JSON.stringify({ title: '', days })); // para saber si hay cambios sin guardar
  const leaving = useRef(false);

  useEffect(() => {
    if (!programId) return;
    programRepository.get(programId).then((p) => {
      if (p) {
        // Los títulos del generador están en inglés ("Full body"): en la casilla, ya traducidos. Los que escribiste tú,
        // tal cual (una rutina llamada «Push» no se vuelve «Empuje»)
        const own = isCustomProgram(p);
        const ds = p.sessions.length ? p.sessions.map((d) => editRoutine({ ...d, title: d.title && !own ? t(d.title) : d.title }, d.id)) : [editRoutine(emptyDay(0), null)];
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

  const at = Math.min(current, days.length - 1);
  const day = days[at];
  const letter = dayLetter(at);
  const updateDay = (fn: (d: EditRoutine) => EditRoutine) => setDays((all) => all.map((d, i) => (i === at ? fn(d) : d)));
  const updateItem = (index: number, fn: (it: EditItem) => EditItem) => updateDay((d) => ({ ...d, exercises: d.exercises.map((it, j) => (j === index ? fn(it) : it)) }));
  const openAt = openEx?.routine === day.key ? openEx.i : null;
  const toggleEx = (i: number) => setOpenEx(openAt === i ? null : { routine: day.key, i });
  const move = (index: number, dir: -1 | 1) => {
    const j = index + dir;
    if (j < 0 || j >= day.exercises.length) return;
    // El abierto sigue abierto aunque cambie de sitio
    if (openAt === index || openAt === j) setOpenEx({ routine: day.key, i: openAt === index ? j : index });
    updateDay((d) => {
      const exercises = [...d.exercises];
      [exercises[index], exercises[j]] = [exercises[j], exercises[index]];
      return { ...d, exercises };
    });
  };
  const remove = async (index: number) => {
    const ex = getExercise(day.exercises[index]?.exerciseId ?? '');
    if (!(await confirmAsk(t('Remove {name}?', { name: ex ? exerciseName(ex) : '' }), t('You can add it again from the library.'), t('Remove')))) return;
    if (openAt !== null && openAt >= index) setOpenEx(openAt === index ? null : { routine: day.key, i: openAt - 1 });
    updateDay((d) => ({ ...d, exercises: d.exercises.filter((_, j) => j !== index) }));
  };

  const addRoutine = () => {
    if (days.length >= MAX_ROUTINES) return;
    setDays((all) => [...all, editRoutine(emptyDay(all.length), null)]);
    setCurrent(days.length);
    setError('');
  };
  const removeRoutine = async () => {
    if (days.length < 2) return;
    if (day.exercises.length && !(await confirmAsk(t('Remove this routine?'), t('Its exercises will be removed from the workout.'), t('Remove')))) return;
    setDays((all) => all.filter((_, i) => i !== at));
    setCurrent(Math.max(0, at - 1));
  };
  const toggleDay = (wd: number) => setDays((all) => toggleWeekday(all, at, wd));

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
    setError('');
  };

  const save = async (follow: boolean) => {
    const plain: DraftRoutine[] = days.map(({ key, exercises, ...d }) => ({ ...d, exercises: exercises.map(({ draft, ...it }) => fromDraft(it, draft)) }));
    const empty = firstEmptyRoutine(plain);
    if (empty >= 0) {
      setCurrent(empty);
      setError(t('{name} has no exercises yet: add some or remove it.', { name: routineLabel(plain[empty], empty) }));
      return;
    }
    const prog = customProgram(title, plain, { base, follow });
    if (!prog.sessions.length) {
      setError(t('Add at least one exercise.'));
      return;
    }
    setError('');
    setSaving(true);
    try {
      await programRepository.save(prog);
      if (base) await moveActiveWorkout(base.id, routineIdMap(plain, base));
      leaving.current = true;
      router.dismissTo('/workouts');
    } catch {
      setError(t('The workout could not be saved. Check your connection and try again.'));
      setSaving(false);
    }
  };
  const cancel = () => (router.canGoBack() ? router.back() : router.replace('/workouts'));

  const count = day.exercises.length;
  const routine = !base || isCustomProgram(base); // hecho a mano (si no, un programa del generador o del entrenador)
  const replacing = replaceAt !== null ? getExercise(day.exercises[replaceAt]?.exerciseId ?? '') : undefined;
  const scheduled = isScheduled({ sessions: days });
  const othersHaveDays = days.some((d, i) => i !== at && routineDays(d).length > 0);
  const dayHint = !routineDays(day).length
    ? othersHaveDays
      ? t('No days: it will not come up as the session of the day, but you can do it whenever you want.')
      : t('No days chosen: your routines go in order (A, B, C…), one each time you train.')
    : othersHaveDays
      ? t('One routine per day: a day that belonged to another routine moves to this one.')
      : '';

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.top}>
        <TouchableOpacity onPress={cancel} hitSlop={10}>
          <Text style={styles.cancel}>{t('Cancel')}</Text>
        </TouchableOpacity>
        <Text style={styles.topTitle} numberOfLines={1}>
          {!base ? t('Create my own workout') : routine ? t('Edit workout') : t('Edit programme')}
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
          <NameInput value={title} onChange={setTitle} placeholder={routine ? t('Workout name') : t('Programme name')} />

          {/* Tu semana: qué rutina toca cada día (tocar un día abre su rutina) */}
          {scheduled && (
            <>
              <Text style={styles.label}>{t('Your week')}</Text>
              <View style={styles.week}>
                {WEEK_ORDER.map((wd) => {
                  const i = days.findIndex((d) => routineDays(d).includes(wd));
                  return (
                    <TouchableOpacity
                      key={wd}
                      style={styles.weekCol}
                      disabled={i < 0}
                      onPress={() => setCurrent(i)}
                      accessibilityLabel={`${weekdayShort(wd)}: ${i < 0 ? t('Rest') : routineLabel(days[i], i)}`}
                    >
                      <Text style={styles.weekDay}>{weekdayShort(wd)}</Text>
                      <View style={[styles.weekBadge, i < 0 && styles.weekRest, i === at && styles.weekBadgeOn]}>
                        <Text style={[styles.weekLetter, i < 0 && { color: Colors.textMuted }, i === at && { color: Colors.background }]}>{i < 0 ? '–' : dayLetter(i)}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}

          <Text style={styles.label}>{t('Routines')}</Text>
          <Text style={styles.hint}>{t('Each routine is one session. Give it a name and choose the days you do it: it can repeat on several days.')}</Text>
          <View style={styles.routines}>
            {days.map((d, i) => {
              const on = i === at;
              return (
                <TouchableOpacity
                  key={d.key}
                  style={[styles.routine, on && styles.routineOn]}
                  onPress={() => setCurrent(i)}
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={routineLabel(d, i)}
                >
                  <View style={[styles.letter, on && styles.letterOn]}>
                    <Text style={[styles.letterText, on && { color: Colors.background }]}>{dayLetter(i)}</Text>
                  </View>
                  <View style={{ flexShrink: 1 }}>
                    <Text style={styles.routineName} numberOfLines={1}>
                      {routineLabel(d, i)}
                    </Text>
                    <Text style={styles.routineSub} numberOfLines={1}>
                      {daysText(d) || tn(d.exercises.length, '{n} exercise', '{n} exercises')}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
            {days.length < MAX_ROUTINES && (
              <TouchableOpacity style={styles.addRoutine} onPress={addRoutine}>
                <Ionicons name="add" size={18} color={Colors.accent} />
                <Text style={styles.addRoutineText}>{t('Add routine')}</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* La rutina abierta: su nombre, sus días y sus ejercicios */}
          <View style={styles.panel}>
            <View style={styles.panelHead}>
              <View style={[styles.letter, styles.letterOn]}>
                <Text style={[styles.letterText, { color: Colors.background }]}>{letter}</Text>
              </View>
              <RoutineNameInput
                key={day.key}
                value={day.title}
                placeholder={t('Routine {id}', { id: letter })}
                onChange={(v) => updateDay((d) => ({ ...d, title: v.slice(0, 60) }))}
              />
              {days.length > 1 && (
                <TouchableOpacity style={styles.iconBtn} onPress={removeRoutine} accessibilityLabel={t('Remove this routine?')}>
                  <Ionicons name="trash-outline" size={18} color={Colors.textMuted} />
                </TouchableOpacity>
              )}
            </View>
            <Text style={styles.panelLabel}>{t('Days')}</Text>
            <View style={styles.weekdays}>
              {WEEK_ORDER.map((wd) => {
                const owner = days.findIndex((d) => routineDays(d).includes(wd));
                const on = owner === at;
                const other = owner >= 0 && !on;
                return (
                  <TouchableOpacity
                    key={wd}
                    style={[styles.wd, on && styles.wdOn]}
                    onPress={() => toggleDay(wd)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: on }}
                    accessibilityLabel={other ? `${weekdayShort(wd)} · ${routineLabel(days[owner], owner)}` : weekdayShort(wd)}
                  >
                    <Text style={[styles.wdText, on && styles.wdTextOn]}>{weekdayShort(wd)}</Text>
                    <Text style={[styles.wdOther, on && { color: Colors.background }]}>{other ? dayLetter(owner) : on ? letter : ' '}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {dayHint ? <Text style={styles.hint}>{dayHint}</Text> : null}
            {count ? (
              <Text style={styles.meta}>
                ~{estimateMinutes({ exercises: day.exercises.map(({ draft, ...it }) => fromDraft(it, draft)) })} min · {tn(count, '{n} exercise', '{n} exercises')}
              </Text>
            ) : null}
          </View>

          {day.exercises.map((it, i) => {
            const ex = getExercise(it.exerciseId);
            if (!ex) return null;
            return (
              <RoutineExerciseCard
                key={`${day.key}-${i}-${it.exerciseId}`}
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
                open={openAt === i}
                onToggle={() => toggleEx(i)}
              />
            );
          })}

          {!count && <Text style={styles.empty}>{t('Add exercises from the library: search by name, muscle or equipment.')}</Text>}
          <TouchableOpacity style={styles.add} onPress={() => setPicking(true)}>
            <Ionicons name="add" size={20} color={Colors.background} />
            <Text style={styles.addText} numberOfLines={1}>
              {t('Add exercises to {name}', { name: routineLabel(day, at) })}
            </Text>
          </TouchableOpacity>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {!base && (
            <TouchableOpacity style={styles.link} onPress={() => save(false)} disabled={saving}>
              <Text style={styles.linkText}>{t('Save without following it')}</Text>
            </TouchableOpacity>
          )}
        </KeyboardAwareScroll>
      )}

      <WorkoutModal
        visible={picking || replaceAt !== null}
        title={replacing ? t('Swap {name}', { name: exerciseName(replacing) }) : t('Add exercises to {name}', { name: routineLabel(day, at) })}
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

const RoutineNameInput = ({ value, placeholder, onChange }: { value: string; placeholder: string; onChange: (v: string) => void }) => {
  const reveal = useRevealOnFocus();
  return (
    <TextInput
      style={styles.routineInput}
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      placeholderTextColor={Colors.textMuted}
      onFocus={reveal}
      accessibilityLabel={t('Routine name')}
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
  label: { color: Colors.textPrimary, fontSize: 15, fontWeight: '800', marginTop: 18, marginBottom: 6 },
  hint: { color: Colors.textSecondary, fontSize: 13, lineHeight: 18, marginBottom: 8 },
  week: { flexDirection: 'row', justifyContent: 'space-between', gap: 4 },
  weekCol: { flex: 1, alignItems: 'center', gap: 4 },
  weekDay: { color: Colors.textMuted, fontSize: 11, fontWeight: '700' },
  weekBadge: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: Colors.accent, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.accentSoft },
  weekBadgeOn: { backgroundColor: Colors.accent },
  weekRest: { borderColor: Colors.cardBorder, backgroundColor: Colors.card },
  weekLetter: { color: Colors.textPrimary, fontSize: 13, fontWeight: '800' },
  routines: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  routine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    maxWidth: '100%',
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    backgroundColor: Colors.card,
    borderRadius: 14,
    paddingLeft: 8,
    paddingRight: 12,
    paddingVertical: 7,
  },
  routineOn: { borderColor: Colors.accent, backgroundColor: Colors.accentSoft },
  routineName: { color: Colors.textPrimary, fontSize: 14, fontWeight: '800', maxWidth: 160 },
  routineSub: { color: Colors.textSecondary, fontSize: 12, maxWidth: 160 },
  letter: { width: 30, height: 30, borderRadius: 15, borderWidth: 1, borderColor: Colors.accent, alignItems: 'center', justifyContent: 'center' },
  letterOn: { backgroundColor: Colors.accent },
  letterText: { color: Colors.accent, fontSize: 13, fontWeight: '800' },
  addRoutine: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderStyle: 'dashed', borderColor: Colors.accent, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 12 },
  addRoutineText: { color: Colors.accent, fontSize: 13, fontWeight: '700' },
  panel: { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.accent, borderRadius: 16, padding: 12, marginTop: 14, marginBottom: 4 },
  panelHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  routineInput: {
    flex: 1,
    minWidth: 0,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    backgroundColor: Colors.background,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  iconBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  panelLabel: { color: Colors.textSecondary, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 12, marginBottom: 6 },
  weekdays: { flexDirection: 'row', gap: 5, marginBottom: 8 },
  wd: { flex: 1, minWidth: 0, alignItems: 'center', borderWidth: 1, borderColor: Colors.cardBorder, backgroundColor: Colors.background, borderRadius: 10, paddingVertical: 6 },
  wdOn: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  wdText: { color: Colors.textSecondary, fontSize: 12, fontWeight: '700' },
  wdTextOn: { color: Colors.background },
  wdOther: { color: Colors.textMuted, fontSize: 10, fontWeight: '800', marginTop: 1 },
  meta: { color: Colors.textMuted, fontSize: 12 },
  empty: { color: Colors.textSecondary, fontSize: 14, lineHeight: 20, marginVertical: 12 },
  add: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.accent,
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 12,
    marginTop: 18,
  },
  addText: { color: Colors.background, fontSize: 15, fontWeight: '800', flexShrink: 1 },
  error: { color: Colors.danger, fontSize: 13, marginTop: 12 },
  proHint: { color: Colors.textSecondary, fontSize: 13, lineHeight: 18, marginTop: 8 },
  primary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.accent, borderRadius: 24, paddingVertical: 14 },
  primaryText: { color: Colors.background, fontSize: 15, fontWeight: '800' },
  disabled: { opacity: 0.45 },
  link: { alignItems: 'center', paddingVertical: 12 },
  linkText: { color: Colors.textSecondary, fontSize: 14, fontWeight: '600' },
});

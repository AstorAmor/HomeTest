import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, View, Text, StyleSheet, ScrollView, TouchableOpacity, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScreenHeader } from '@/components/ScreenHeader';
import { ChoiceChips } from '@/components/ChoiceChips';
import { Confetti } from '@/components/Confetti';
import { confirmAsk } from '@/components/dev/confirmAsk';
import { Colors } from '@/constants/colors';
import { exerciseName, getExercise } from '@/data/workouts/catalog';
import { BLOCK_ORDER, blockLabel, doseText, restText, sessionTitle } from '@/data/workouts/labels';
import { programRepository } from '@/data/workouts/programRepository';
import type { WorkoutExercise, WorkoutProgram, WorkoutSession } from '@/data/workouts/types';
import { workoutRepository, WorkoutEntry, WorkoutType } from '@/data/planRepository';
import { defaultDose, estimateMinutes } from '@/logic/workoutGenerator';
import { WorkoutModal } from '@/components/workouts/WorkoutModal';
import { ExerciseLibrary } from '@/components/workouts/ExerciseLibrary';
import type { CatalogExercise } from '@/data/workouts/types';
import { ExerciseLoop } from '@/components/workouts/ExerciseLoop';
import { BellSheet } from '@/components/workouts/BellSheet';
import {
  BELL_TONES,
  BellAlarm,
  cancelBellAlarms,
  offerBellOnLock,
  prepareBell,
  releaseBells,
  ringBell,
  scheduleBellAlarms,
  useBellPrefs,
} from '@/data/workouts/bell';
import { isTimedReps, secondsLeft, timedSeconds, upcomingEnds } from '@/logic/workoutTimer';
import { DoseEditor } from '@/components/workouts/DoseEditor';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { t, tn } from '@/i18n';

// Una sesión del programa: primero la lista (calentamiento, ejercicios, remate y estiramientos) y,
// al pulsar Empezar, el modo guiado: un ejercicio cada vez con su vídeo, la serie en la que vas,
// el temporizador si va por tiempo y el descanso con cuenta atrás. Al acabar cada cuenta atrás suena
// el timbre elegido, también con la pantalla bloqueada (src/data/workouts/bell.ts). Al terminar se
// guarda como sesión hecha del programa y como entrenamiento del plan (cuenta para las 3 de fuerza a
// la semana).

type Step = { item: number; set: number };
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.max(0, Math.floor(s % 60))).padStart(2, '0')}`;

const isTimed = (it: WorkoutExercise) => isTimedReps(it.reps);

const workoutType = (s: WorkoutSession): WorkoutType => (s.focus === 'mobility' ? 'mobility' : s.focus === 'conditioning' ? 'cardio' : 'strength');

export const WorkoutSessionScreen = () => {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { program: programId, session: sessionParam } = useLocalSearchParams<{ program: string; session?: string }>();
  const [program, setProgram] = useState<WorkoutProgram | null>(null);
  const [sessionId, setSessionId] = useState(sessionParam ?? 'A');
  const [mode, setMode] = useState<'overview' | 'run' | 'done'>('overview');
  const [cursor, setCursor] = useState(0);
  const [phase, setPhase] = useState<'work' | 'rest'>('work');
  const [left, setLeft] = useState(0); // segundos que quedan del descanso o del ejercicio por tiempo
  const [timerOn, setTimerOn] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [setsDone, setSetsDone] = useState(0);
  const [intensity, setIntensity] = useState<WorkoutEntry['intensity']>('moderate');
  const [saved, setSaved] = useState(false);
  const [swapAt, setSwapAt] = useState<number | null>(null); // índice en session.exercises
  const [editAt, setEditAt] = useState<number | null>(null); // ídem, para cambiar series, reps o tiempo y descanso
  const startedAt = useRef<number>(0);
  const endsAt = useRef(0); // cuándo acaba la cuenta atrás en marcha (hora del reloj, en ms)
  const sideRung = useRef(false); // ya sonó el cambio de lado de este ejercicio
  const [bell, setBell] = useBellPrefs();
  const [bellOpen, setBellOpen] = useState(false);

  useEffect(() => {
    programRepository.get(programId).then(setProgram);
  }, [programId]);

  const session = program?.sessions.find((s) => s.id === sessionId) ?? program?.sessions[0];
  const steps: Step[] = useMemo(
    () => (session ? session.exercises.flatMap((it, i) => Array.from({ length: Math.max(1, it.sets) }, (_, s) => ({ item: i, set: s + 1 }))) : []),
    [session],
  );
  const step = steps[cursor];
  const item = step && session ? session.exercises[step.item] : undefined;
  const ex = item ? getExercise(item.exerciseId) : undefined;
  const nextStep = steps[cursor + 1];
  const nextItem = nextStep && session ? session.exercises[nextStep.item] : undefined;
  const nextEx = nextItem ? getExercise(nextItem.exerciseId) : undefined;
  const timed = !!item && isTimed(item);
  const total = item && timed ? timedSeconds(item.reps) * (ex?.perSide ? 2 : 1) : 0;

  // Reloj general y cuentas atrás, por la hora: con la pantalla bloqueada no hay tics y al volver
  // tiene que marcar lo que de verdad queda
  useEffect(() => {
    if (mode !== 'run') return;
    const id = setInterval(() => {
      setElapsed(Math.round((Date.now() - startedAt.current) / 1000));
      if (phase === 'rest' || timerOn) setLeft(secondsLeft(endsAt.current, Date.now()));
    }, 250);
    return () => clearInterval(id);
  }, [mode, phase, timerOn]);

  const countTo = useCallback((at: number) => {
    endsAt.current = at;
    setLeft(secondsLeft(at, Date.now()));
  }, []);

  // Suena si el final acaba de pasar con la app delante; si pasó con la pantalla bloqueada ya sonó
  // el aviso del móvil
  const ringFor = useCallback(
    (at: number) => {
      if (bell.on && AppState.currentState === 'active' && Date.now() - at < 3000) ringBell(bell.tone);
    },
    [bell.on, bell.tone],
  );

  const startStep = useCallback(
    (i: number) => {
      const s = steps[i];
      const it = s && session ? session.exercises[s.item] : undefined;
      setCursor(i);
      setPhase('work');
      setTimerOn(false);
      sideRung.current = false;
      if (it && isTimed(it)) setLeft(timedSeconds(it.reps) * (getExercise(it.exerciseId)?.perSide ? 2 : 1));
    },
    [steps, session],
  );

  // done = false cuando se salta: pasa al siguiente sin contarla como serie hecha. at = cuándo acabó
  // (el final de su cuenta atrás, aunque se note al volver de la pantalla bloqueada)
  const finishStep = useCallback((done = true, at = Date.now()) => {
    if (done) setSetsDone((n) => n + 1);
    setTimerOn(false);
    if (cursor >= steps.length - 1) {
      setMode('done');
      return;
    }
    const rest = item?.restSec ?? 0;
    if (rest > 0) {
      setPhase('rest');
      countTo(at + rest * 1000);
    } else startStep(cursor + 1);
  }, [cursor, steps.length, item, startStep, countTo]);

  // Fin de la cuenta atrás: descanso → siguiente; ejercicio por tiempo → hecho
  useEffect(() => {
    if (mode !== 'run' || left > 0) return;
    if (phase === 'rest') {
      ringFor(endsAt.current);
      startStep(cursor + 1);
    } else if (timerOn) {
      ringFor(endsAt.current);
      finishStep(true, endsAt.current);
    }
  }, [left, mode, phase, timerOn, cursor, startStep, finishStep, ringFor]);

  // A mitad de un ejercicio por tiempo que va por lado: cambia de lado
  useEffect(() => {
    if (mode !== 'run' || phase !== 'work' || !timerOn || !ex?.perSide || sideRung.current || left > total / 2) return;
    sideRung.current = true;
    ringFor(endsAt.current - total * 500);
  }, [left, mode, phase, timerOn, ex, total, ringFor]);

  // Con la pantalla bloqueada o fuera de la app: un aviso del móvil por cada final que quede. Se
  // calcula al salir, con lo que haya en ese momento.
  const planAlarms = useRef<() => BellAlarm[]>(() => []);
  useEffect(() => {
    planAlarms.current = () => {
      if (mode !== 'run' || !bell.on || !item || !ex) return [];
      const next = nextEx ? exerciseName(nextEx) : '';
      return upcomingEnds({
        now: Date.now(),
        phase,
        timerOn,
        endsAt: endsAt.current,
        totalSec: total,
        perSide: !!ex.perSide,
        restAfterSec: cursor < steps.length - 1 ? (item.restSec ?? 0) : 0,
      }).map((e) => ({
        at: e.at,
        title: e.kind === 'side' ? t('Switch sides') : e.kind === 'work' ? t('Time!') : t('Rest is over'),
        body: e.kind === 'rest' ? (next ? `${t('Next')}: ${next}` : '') : exerciseName(ex),
      }));
    };
  });
  useEffect(() => {
    if (mode !== 'run') return;
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'background') scheduleBellAlarms(planAlarms.current(), bell.tone);
      else if (s === 'active') cancelBellAlarms();
    });
    return () => {
      sub.remove();
      cancelBellAlarms();
    };
  }, [mode, bell.tone]);

  useEffect(() => {
    if (mode === 'run' && bell.on) prepareBell(bell.tone);
  }, [mode, bell.on, bell.tone]);
  useEffect(() => releaseBells, []);

  // Durante la sesión la pantalla no se apaga sola: así el timbre suena desde la app aunque no se
  // toque el móvil en todo el descanso. Si se bloquea a mano, avisa el móvil (arriba).
  useEffect(() => {
    if (mode !== 'run') return;
    activateKeepAwakeAsync('workout').catch(() => undefined);
    return () => {
      deactivateKeepAwake('workout').catch(() => undefined);
    };
  }, [mode]);

  const start = () => {
    startedAt.current = Date.now();
    setElapsed(0);
    setSetsDone(0);
    setMode('run');
    startStep(0);
    if (bell.on) offerBellOnLock(bell.tone);
  };

  const toneLabel = t(BELL_TONES.find((x) => x.id === bell.tone)?.label ?? 'Bell');
  const bellSheet = <BellSheet visible={bellOpen} prefs={bell} onChange={setBell} onClose={() => setBellOpen(false)} />;

  const quit = async () => {
    const ok = await confirmAsk(t('Stop the session?'), t('What you did so far will not be saved.'), t('Stop'));
    if (ok) setMode('overview');
  };

  const save = async () => {
    if (!program || !session || saved) return;
    setSaved(true);
    const minutes = Math.max(1, Math.round(elapsed / 60));
    const now = new Date().toISOString();
    await programRepository.logCompletion(program.id, { sessionId: session.id, at: now, minutes });
    await workoutRepository.save({ id: `workout-${Date.now()}`, fecha: now, createdAt: now, type: workoutType(session), minutes, intensity });
    // Vuelve a la lista que ya estaba abierta (si no, quedaban dos y «atrás» volvía a la misma)
    router.dismissTo('/workouts');
  };

  if (!program || !session) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScreenHeader title={t('Workout')} showBack backFallback="/workouts" />
        <Text style={styles.muted}>{program === null ? '' : t('This session does not exist any more.')}</Text>
      </SafeAreaView>
    );
  }

  // ── Terminado ──
  if (mode === 'done') {
    return (
      <SafeAreaView style={[styles.safeArea, styles.centered]}>
        <Confetti count={60} />
        <View style={styles.doneIcon}>
          <MaterialCommunityIcons name="trophy-outline" size={40} color={Colors.accent} />
        </View>
        <Text style={styles.doneTitle}>{t('Session complete!')}</Text>
        <Text style={styles.doneText}>
          {t('{m} min', { m: Math.max(1, Math.round(elapsed / 60)) })} · {tn(setsDone, '{n} set', '{n} sets')}
        </Text>
        <Text style={styles.q}>{t('How did it feel?')}</Text>
        <ChoiceChips
          center
          options={[
            { id: 'easy' as const, label: t('Easy') },
            { id: 'moderate' as const, label: t('Moderate') },
            { id: 'hard' as const, label: t('Hard') },
          ]}
          value={intensity}
          onChange={setIntensity}
        />
        <TouchableOpacity style={[styles.primary, { alignSelf: 'stretch', marginTop: 24 }]} onPress={save} disabled={saved}>
          <Text style={styles.primaryText}>{t('Save')}</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // ── Modo guiado ──
  if (mode === 'run' && item && ex) {
    const secondSide = timed && ex.perSide && left <= total / 2;
    const big = Math.min(width - 40, 520);
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.runTop}>
          <TouchableOpacity onPress={quit} hitSlop={10} accessibilityLabel={t('Stop')}>
            <Ionicons name="close" size={26} color={Colors.textPrimary} />
          </TouchableOpacity>
          <View style={styles.progress}>
            <View style={[styles.progressFill, { width: `${(cursor / steps.length) * 100}%` }]} />
          </View>
          <Text style={styles.clock}>{fmt(elapsed)}</Text>
          <TouchableOpacity onPress={() => setBellOpen(true)} hitSlop={10} accessibilityLabel={t('Sound')}>
            <MaterialCommunityIcons name={bell.on ? 'bell-outline' : 'bell-off-outline'} size={22} color={bell.on ? Colors.accent : Colors.textMuted} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.runBody}>
          {phase === 'rest' ? (
            <>
              <Text style={styles.blockTag}>{t('Rest')}</Text>
              <Text style={styles.restClock}>{fmt(Math.max(0, left))}</Text>
              <View style={styles.restButtons}>
                <TouchableOpacity style={styles.secondary} onPress={() => countTo(Math.max(Date.now(), endsAt.current - 15000))}>
                  <Text style={styles.secondaryText}>−15 s</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.secondary} onPress={() => countTo(endsAt.current + 15000)}>
                  <Text style={styles.secondaryText}>+15 s</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.secondary} onPress={() => startStep(cursor + 1)}>
                  <Text style={styles.secondaryText}>{t('Skip rest')}</Text>
                </TouchableOpacity>
              </View>
              {nextItem && nextEx && (
                <View style={styles.upNext}>
                  <ExerciseLoop exercise={nextEx} size={72} radius={12} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.nextLabel}>{t('Next')}</Text>
                    <Text style={styles.upNextName}>{exerciseName(nextEx)}</Text>
                    <Text style={styles.muted}>
                      {t('Set {a} of {b}', { a: nextStep.set, b: nextItem.sets })} · {nextItem.reps}
                      {nextEx.perSide ? ` ${t('per side')}` : ''}
                    </Text>
                  </View>
                </View>
              )}
            </>
          ) : (
            <>
              <Text style={styles.blockTag}>{blockLabel(item.block)}</Text>
              <TouchableOpacity activeOpacity={0.9} onPress={() => router.push({ pathname: '/exercise-info', params: { id: ex.id } })}>
                <ExerciseLoop exercise={ex} width={big} radius={18} showProvisional />
              </TouchableOpacity>
              <Text style={styles.runName}>{exerciseName(ex)}</Text>
              <Text style={styles.runSet}>
                {t('Set {a} of {b}', { a: step.set, b: item.sets })}
                {timed ? '' : ` · ${item.reps} ${t('reps')}${ex.perSide ? ` ${t('per side')}` : ''}`}
              </Text>
              {item.note ? <Text style={styles.proNote}>“{item.note}”</Text> : null}
              {timed && (
                <>
                  <Text style={styles.timer}>{fmt(timerOn ? Math.max(0, left) : total)}</Text>
                  {ex.perSide && timerOn ? <Text style={styles.muted}>{secondSide ? t('Second side') : t('First side')}</Text> : null}
                </>
              )}
            </>
          )}
        </ScrollView>

        {phase === 'work' && (
          <View style={styles.runBottom}>
            {timed && !timerOn ? (
              <TouchableOpacity
                style={styles.primary}
                onPress={() => {
                  setTimerOn(true);
                  countTo(Date.now() + total * 1000);
                }}
              >
                <Ionicons name="play" size={18} color={Colors.background} />
                <Text style={styles.primaryText}>{t('Start timer')}</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.primary} onPress={() => finishStep()}>
                <Ionicons name="checkmark" size={20} color={Colors.background} />
                <Text style={styles.primaryText}>{t('Set done')}</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.link} onPress={() => finishStep(false)}>
              <Text style={styles.linkText}>{t('Skip')}</Text>
            </TouchableOpacity>
          </View>
        )}
        {bellSheet}
      </SafeAreaView>
    );
  }

  // ── Lista de la sesión ──
  const indexed = session.exercises.map((it, idx) => ({ it, idx }));
  const byBlock = BLOCK_ORDER.map((b) => ({ block: b, items: indexed.filter((x) => x.it.block === b) })).filter((g) => g.items.length);
  const swapping = swapAt !== null ? getExercise(session.exercises[swapAt]?.exerciseId) : undefined;

  // Cambiar un ejercicio por otro del mismo tipo de movimiento (como los platos del menú). En los
  // principales se mantienen las series y repeticiones; en calentamiento y vuelta a la calma, las suyas.
  const swap = async (ex: CatalogExercise) => {
    if (swapAt === null) return;
    const old = session.exercises[swapAt];
    const next: WorkoutProgram = {
      ...program,
      sessions: program.sessions.map((s) =>
        s.id !== session.id
          ? s
          : { ...s, exercises: s.exercises.map((it, j) => (j === swapAt ? { ...it, exerciseId: ex.id, ...(old.block === 'main' ? {} : defaultDose(ex.id, program.prefs, old.block, s.focus)) } : it)) }
      ),
    };
    setSwapAt(null);
    setProgram(next);
    await programRepository.save(next).catch(() => undefined);
  };

  const editing = editAt !== null ? session.exercises[editAt] : undefined;
  const editingEx = editing ? getExercise(editing.exerciseId) : undefined;
  const saveDose = async (change: Pick<WorkoutExercise, 'sets' | 'reps' | 'restSec'>) => {
    if (editAt === null) return;
    const next: WorkoutProgram = {
      ...program,
      sessions: program.sessions.map((s) => (s.id !== session.id ? s : { ...s, exercises: s.exercises.map((it, j) => (j === editAt ? { ...it, ...change } : it)) })),
    };
    setEditAt(null);
    setProgram(next);
    await programRepository.save(next).catch(() => undefined);
  };
  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <ScreenHeader title={sessionTitle(session)} showBack backFallback="/workouts" />
      {program.sessions.length > 1 && (
        <View style={styles.tabs}>
          {program.sessions.map((s) => (
            <TouchableOpacity key={s.id} style={[styles.tab, s.id === session.id && styles.tabOn]} onPress={() => setSessionId(s.id)}>
              <Text style={[styles.tabText, s.id === session.id && styles.tabTextOn]}>{s.id}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.meta}>
          ~{estimateMinutes(session)} min · {tn(session.exercises.filter((e) => e.block === 'main' || e.block === 'finisher').length, '{n} exercise', '{n} exercises')}
        </Text>
        <TouchableOpacity style={styles.soundRow} onPress={() => setBellOpen(true)} accessibilityLabel={t('Sound')}>
          <MaterialCommunityIcons name={bell.on ? 'bell-outline' : 'bell-off-outline'} size={16} color={bell.on ? Colors.accent : Colors.textMuted} />
          <Text style={styles.soundText}>{bell.on ? t('Sound: {tone}', { tone: toneLabel }) : t('No sound')}</Text>
          <Ionicons name="chevron-forward" size={14} color={Colors.textMuted} />
        </TouchableOpacity>
        {byBlock.map((g) => (
          <View key={g.block} style={{ marginBottom: 8 }}>
            <Text style={styles.section}>{blockLabel(g.block)}</Text>
            {g.items.map(({ it, idx }) => {
              const e = getExercise(it.exerciseId);
              if (!e) return null;
              return (
                <TouchableOpacity key={`${it.exerciseId}-${idx}`} style={styles.row} onPress={() => router.push({ pathname: '/exercise-info', params: { id: e.id } })}>
                  <ExerciseLoop exercise={e} size={64} radius={12} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowName}>{exerciseName(e)}</Text>
                    <Text style={styles.rowDose}>
                      {doseText(it)}
                      {it.restSec ? ` · ${restText(it.restSec)}` : ''}
                    </Text>
                    {it.note ? <Text style={styles.rowNote}>{it.note}</Text> : null}
                  </View>
                  <TouchableOpacity style={styles.swap} onPress={() => setEditAt(idx)} hitSlop={8} accessibilityLabel={t('Edit {name}', { name: exerciseName(e) })}>
                    <Ionicons name="pencil" size={16} color={Colors.accent} />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.swap} onPress={() => setSwapAt(idx)} hitSlop={8} accessibilityLabel={t('Swap {name}', { name: exerciseName(e) })}>
                    <Ionicons name="swap-horizontal" size={18} color={Colors.accent} />
                  </TouchableOpacity>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </ScrollView>
      <View style={styles.runBottom}>
        <TouchableOpacity style={styles.primary} onPress={start}>
          <Ionicons name="play" size={18} color={Colors.background} />
          <Text style={styles.primaryText}>{t('Start')}</Text>
        </TouchableOpacity>
      </View>
      <WorkoutModal visible={swapAt !== null} title={swapping ? t('Swap {name}', { name: exerciseName(swapping) }) : ''} onClose={() => setSwapAt(null)}>
        {swapping && (
          <>
            <Text style={styles.swapHint}>
              {program.source === 'professional'
                ? t('Same type of movement, with your equipment. {name} will see the change.', { name: program.professionalName || t('Your trainer') })
                : t('Same type of movement, with your equipment.')}
            </Text>
            <ExerciseLibrary forSelf onPick={swap} pickLabel={t('Use this one')} equipment={program.prefs.equipment} onlyPatterns={[swapping.pattern]} excludeId={swapping.id} />
          </>
        )}
      </WorkoutModal>
      <WorkoutModal visible={editAt !== null} title={editingEx ? exerciseName(editingEx) : ''} onClose={() => setEditAt(null)}>
        {editing && (
          <>
            {program.source === 'professional' && (
              <Text style={styles.swapHint}>{t('{name} will see the change.', { name: program.professionalName || t('Your trainer') })}</Text>
            )}
            <DoseEditor item={editing} perSide={editingEx?.perSide} onSave={saveDose} onCancel={() => setEditAt(null)} />
          </>
        )}
      </WorkoutModal>
      {bellSheet}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  swap: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.accentSoft },
  swapHint: { color: Colors.textSecondary, fontSize: 13, lineHeight: 18, marginBottom: 10 },
  safeArea: { flex: 1, backgroundColor: Colors.background },
  centered: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  content: { paddingHorizontal: 20, paddingBottom: 24 },
  muted: { color: Colors.textSecondary, fontSize: 13, marginHorizontal: 0 },
  meta: { color: Colors.textSecondary, fontSize: 14, marginBottom: 6 },
  soundRow: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingVertical: 4, marginBottom: 4 },
  soundText: { color: Colors.textSecondary, fontSize: 13, fontWeight: '600' },
  section: { color: Colors.textPrimary, fontSize: 16, fontWeight: '800', marginTop: 10, marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 14, padding: 8, marginBottom: 8 },
  rowName: { color: Colors.textPrimary, fontSize: 15, fontWeight: '700' },
  rowDose: { color: Colors.textSecondary, fontSize: 13, marginTop: 2 },
  rowNote: { color: Colors.accent, fontSize: 12, marginTop: 2, fontStyle: 'italic' },
  tabs: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, marginBottom: 8 },
  tab: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, borderColor: Colors.cardBorder, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.card },
  tabOn: { borderColor: Colors.accent, backgroundColor: Colors.accentSoft },
  tabText: { color: Colors.textSecondary, fontSize: 14, fontWeight: '800' },
  tabTextOn: { color: Colors.textPrimary },
  primary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.accent, borderRadius: 24, paddingVertical: 14 },
  primaryText: { color: Colors.background, fontSize: 16, fontWeight: '800' },
  secondary: { borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 22, paddingHorizontal: 18, paddingVertical: 10 },
  secondaryText: { color: Colors.accent, fontSize: 14, fontWeight: '700' },
  link: { alignItems: 'center', paddingVertical: 10 },
  linkText: { color: Colors.textSecondary, fontSize: 14, fontWeight: '600' },
  runTop: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10 },
  progress: { flex: 1, height: 6, borderRadius: 3, backgroundColor: Colors.cardBorder, overflow: 'hidden' },
  progressFill: { height: 6, backgroundColor: Colors.accent },
  clock: { color: Colors.textSecondary, fontSize: 14, fontWeight: '700', minWidth: 44, textAlign: 'right' },
  runBody: { alignItems: 'center', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 20, gap: 10 },
  blockTag: { color: Colors.accent, fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6 },
  runName: { color: Colors.textPrimary, fontSize: 24, fontWeight: '900', textAlign: 'center', marginTop: 6 },
  runSet: { color: Colors.textSecondary, fontSize: 16, fontWeight: '700', textAlign: 'center' },
  proNote: { color: Colors.textPrimary, fontSize: 14, fontStyle: 'italic', textAlign: 'center' },
  timer: { color: Colors.textPrimary, fontSize: 56, fontWeight: '900', fontVariant: ['tabular-nums'] },
  restClock: { color: Colors.textPrimary, fontSize: 72, fontWeight: '900', fontVariant: ['tabular-nums'], marginVertical: 8 },
  restButtons: { flexDirection: 'row', gap: 10 },
  upNext: { flexDirection: 'row', alignItems: 'center', gap: 12, alignSelf: 'stretch', backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 16, padding: 12, marginTop: 24 },
  nextLabel: { color: Colors.accent, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  upNextName: { color: Colors.textPrimary, fontSize: 16, fontWeight: '800' },
  runBottom: { paddingHorizontal: 20, paddingBottom: 12, paddingTop: 6 },
  doneIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.accentSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  doneTitle: { color: Colors.textPrimary, fontSize: 26, fontWeight: '900', textAlign: 'center' },
  doneText: { color: Colors.textSecondary, fontSize: 15, marginTop: 6 },
  q: { color: Colors.textPrimary, fontSize: 15, fontWeight: '700', marginTop: 24, marginBottom: 10 },
});

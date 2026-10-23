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
import { exerciseName, getExercise, isLoadable } from '@/data/workouts/catalog';
import { BLOCK_ORDER, blockLabel, doseText, restText, sessionTitle, setText, setsText } from '@/data/workouts/labels';
import { programRepository } from '@/data/workouts/programRepository';
import type { WorkoutExercise, WorkoutProgram, WorkoutSession } from '@/data/workouts/types';
import { workoutRepository, WorkoutEntry, WorkoutType } from '@/data/planRepository';
import { defaultDose, estimateMinutes } from '@/logic/workoutGenerator';
import { WorkoutModal } from '@/components/workouts/WorkoutModal';
import { ExerciseLibrary } from '@/components/workouts/ExerciseLibrary';
import type { CatalogExercise } from '@/data/workouts/types';
import { ExerciseLoop } from '@/components/workouts/ExerciseLoop';
import { BellSheet } from '@/components/workouts/BellSheet';
import { SetTable } from '@/components/workouts/SetTable';
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
import { allSteps, checkRow, lastTimes, nextPending, rowHints, setLogs, startRows, summarize, type Change, type LastTime, type SetRow, type Step } from '@/logic/workoutLog';
import { DoseEditor } from '@/components/workouts/DoseEditor';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { dateLocale, num, t, tn } from '@/i18n';

// Una sesión del programa. Primero la lista (calentamiento, ejercicios, remate y estiramientos) con lo
// que se hizo la última vez en cada ejercicio. Al empezar, dos formas de hacerla (src/logic/workoutLog.ts):
// - Lista, como Hevy o Strong (por defecto): todos los ejercicios con su tabla de series; se marca cada
//   serie con su peso y sus repeticiones y empieza el descanso, en una barra abajo.
// - Modo guiado: un ejercicio cada vez con su vídeo, la serie en la que vas y su tabla, el temporizador
//   si va por tiempo y el descanso a pantalla completa.
// Se cambia de una a otra sin perder nada. Al acabar cada cuenta atrás suena el timbre elegido, también
// con la pantalla bloqueada (src/data/workouts/bell.ts). Al terminar, un resumen (series, kilos y la mejor
// serie de cada ejercicio frente a la última vez); se guarda como sesión hecha del programa, con cada
// serie, y como entrenamiento del plan (cuenta para las 3 de fuerza a la semana).

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.max(0, Math.floor(s % 60))).padStart(2, '0')}`;

const isTimed = (it: WorkoutExercise) => isTimedReps(it.reps);
const sameStep = (a: Step | null, b: Step | null) => !!a && !!b && a.item === b.item && a.set === b.set;

const workoutType = (s: WorkoutSession): WorkoutType => (s.focus === 'mobility' ? 'mobility' : s.focus === 'conditioning' ? 'cardio' : 'strength');

const CHANGE_TEXT: Record<Exclude<Change, 'less'>, string> = {
  first: 'First time you log it',
  more_weight: 'More weight than last time',
  more_reps: 'More reps than last time',
  more_time: 'Longer than last time',
  same: 'Same as last time',
};

export const WorkoutSessionScreen = () => {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { program: programId, session: sessionParam } = useLocalSearchParams<{ program: string; session?: string }>();
  const [program, setProgram] = useState<WorkoutProgram | null | undefined>(undefined); // undefined = cargando
  const [last, setLast] = useState<Map<string, LastTime>>(new Map()); // la última vez de cada ejercicio
  const [sessionId, setSessionId] = useState(sessionParam ?? 'A');
  const [mode, setMode] = useState<'overview' | 'run' | 'done'>('overview');
  const [view, setView] = useState<'list' | 'guided'>('list');
  const [rows, setRows] = useState<SetRow[][]>([]); // una tabla de series por ejercicio de la sesión
  const [at, setAt] = useState<Step>({ item: 0, set: 1 }); // modo guiado: la serie en curso (en el descanso, la siguiente)
  const [phase, setPhase] = useState<'work' | 'rest'>('work');
  const [left, setLeft] = useState(0); // segundos que quedan del descanso o del ejercicio por tiempo
  const [restTotal, setRestTotal] = useState(0);
  const [timerOn, setTimerOn] = useState(false);
  const [timerAt, setTimerAt] = useState<Step | null>(null); // la serie por tiempo con la cuenta atrás en marcha
  const [elapsed, setElapsed] = useState(0);
  const [intensity, setIntensity] = useState<WorkoutEntry['intensity']>('moderate');
  const [saved, setSaved] = useState(false);
  const [swapAt, setSwapAt] = useState<number | null>(null); // índice en session.exercises
  const [editAt, setEditAt] = useState<number | null>(null); // ídem, para cambiar series, reps o tiempo, peso y descanso
  const startedAt = useRef<number>(0);
  const endsAt = useRef(0); // cuándo acaba la cuenta atrás en marcha (hora del reloj, en ms)
  const sideRung = useRef(false); // ya sonó el cambio de lado de este ejercicio
  const [bell, setBell] = useBellPrefs();
  const [bellOpen, setBellOpen] = useState(false);

  useEffect(() => {
    programRepository.list().then((all) => {
      setProgram(all.find((p) => p.id === programId) ?? null);
      setLast(lastTimes(all));
    });
  }, [programId]);

  const session = program?.sessions.find((s) => s.id === sessionId) ?? program?.sessions[0];
  const items = useMemo(() => session?.exercises ?? [], [session]);
  const steps = useMemo(() => allSteps(rows), [rows]);
  const doneCount = rows.reduce((n, r) => n + r.filter((x) => x.done).length, 0);
  const hintFor = useCallback(
    (s: Step, base: SetRow[][] = rows) => rowHints(items[s.item], last.get(items[s.item]?.exerciseId)?.sets, base[s.item] ?? [])[s.set - 1] ?? {},
    [items, last, rows],
  );

  // La serie en curso del modo guiado
  const item = items[at.item];
  const ex = item ? getExercise(item.exerciseId) : undefined;
  const timed = !!item && isTimed(item);
  const total = item && timed ? timedSeconds(item.reps) * (ex?.perSide ? 2 : 1) : 0;
  // La serie por tiempo en marcha (en cualquiera de las dos vistas)
  const tItem = timerAt ? items[timerAt.item] : undefined;
  const tEx = tItem ? getExercise(tItem.exerciseId) : undefined;
  const tTotal = tItem && isTimed(tItem) ? timedSeconds(tItem.reps) * (tEx?.perSide ? 2 : 1) : 0;

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

  const countTo = useCallback((end: number) => {
    endsAt.current = end;
    setLeft(secondsLeft(end, Date.now()));
  }, []);

  const rest = useCallback(
    (sec: number, from: number) => {
      setRestTotal(sec);
      setPhase('rest');
      countTo(from + sec * 1000);
    },
    [countTo],
  );

  // Suena si el final acaba de pasar con la app delante; si pasó con la pantalla bloqueada ya sonó
  // el aviso del móvil
  const ringFor = useCallback(
    (end: number) => {
      if (bell.on && AppState.currentState === 'active' && Date.now() - end < 3000) ringBell(bell.tone);
    },
    [bell.on, bell.tone],
  );

  const startStep = useCallback((s: Step) => {
    setAt(s);
    setPhase('work');
    setTimerOn(false);
    setTimerAt(null);
    sideRung.current = false;
  }, []);

  const startTimer = useCallback(
    (s: Step) => {
      const it = items[s.item];
      if (!it) return;
      const sec = timedSeconds(it.reps) * (getExercise(it.exerciseId)?.perSide ? 2 : 1);
      sideRung.current = false;
      setPhase('work');
      setTimerAt(s);
      setTimerOn(true);
      countTo(Date.now() + sec * 1000);
    },
    [items, countTo],
  );

  // Marca la serie con lo escrito o, si no, con la pista
  const markDone = useCallback(
    (s: Step, base: SetRow[][]) => base.map((r, i) => (i !== s.item ? r : r.map((row, j) => (j !== s.set - 1 ? row : checkRow(row, hintFor(s, base), num))))),
    [hintFor],
  );

  // Lista: marcar o desmarcar una serie. Al marcarla empieza su descanso (si queda algo por hacer).
  // at = cuándo acabó (el final de su cuenta atrás, aunque se note al volver de la pantalla bloqueada)
  const toggleRow = useCallback(
    (s: Step, withRest = true, end = Date.now()) => {
      const row = rows[s.item]?.[s.set - 1];
      if (!row) return;
      if (sameStep(s, timerAt)) {
        setTimerOn(false);
        setTimerAt(null);
      }
      if (row.done) {
        setRows(rows.map((r, i) => (i !== s.item ? r : r.map((x, j) => (j === s.set - 1 ? { ...x, done: false } : x)))));
        return;
      }
      const next = markDone(s, rows);
      setRows(next);
      const sec = items[s.item]?.restSec ?? 0;
      const more = next.some((r) => r.some((x) => !x.done));
      if (withRest && sec > 0 && more) rest(sec, end);
      else if (!more) setPhase('work'); // todo hecho: sin descanso pendiente

    },
    [rows, timerAt, markDone, items, rest],
  );

  // Modo guiado: serie hecha (o saltada, done = false: pasa a la siguiente sin contarla ni descansar)
  const finishStep = useCallback(
    (done = true, end = Date.now()) => {
      const next = done ? markDone(at, rows) : rows;
      if (done) setRows(next);
      setTimerOn(false);
      setTimerAt(null);
      const upcoming = nextPending(next, at);
      if (!upcoming) {
        setPhase('work');
        setMode('done');
        return;
      }
      setAt(upcoming);
      const sec = done ? (items[at.item]?.restSec ?? 0) : 0;
      if (sec > 0) rest(sec, end);
      else startStep(upcoming);
    },
    [at, rows, markDone, items, rest, startStep],
  );

  // Fin de la cuenta atrás: descanso → (guiado) siguiente serie; ejercicio por tiempo → hecho
  useEffect(() => {
    if (mode !== 'run' || left > 0) return;
    if (phase === 'rest') {
      ringFor(endsAt.current);
      if (view === 'guided') startStep(at);
      else setPhase('work');
    } else if (timerOn && timerAt) {
      ringFor(endsAt.current);
      if (view === 'guided' && sameStep(timerAt, at)) finishStep(true, endsAt.current);
      else toggleRow(timerAt, true, endsAt.current);
    }
  }, [left, mode, phase, timerOn, timerAt, at, view, startStep, finishStep, toggleRow, ringFor]);

  // A mitad de un ejercicio por tiempo que va por lado: cambia de lado
  useEffect(() => {
    if (mode !== 'run' || phase !== 'work' || !timerOn || !tEx?.perSide || sideRung.current || left > tTotal / 2) return;
    sideRung.current = true;
    ringFor(endsAt.current - tTotal * 500);
  }, [left, mode, phase, timerOn, tEx, tTotal, ringFor]);

  // Con la pantalla bloqueada o fuera de la app: un aviso del móvil por cada final que quede. Se
  // calcula al salir, con lo que haya en ese momento.
  const planAlarms = useRef<() => BellAlarm[]>(() => []);
  useEffect(() => {
    planAlarms.current = () => {
      if (mode !== 'run' || !bell.on) return [];
      const s = timerOn && timerAt ? timerAt : view === 'guided' ? at : null;
      const it = s ? items[s.item] : undefined;
      const e = it ? getExercise(it.exerciseId) : undefined;
      const upcoming = view !== 'guided' ? null : phase === 'rest' ? at : nextPending(rows, at);
      const upEx = upcoming ? getExercise(items[upcoming.item]?.exerciseId ?? '') : undefined;
      const next = upEx ? exerciseName(upEx) : '';
      const sec = it && isTimed(it) ? timedSeconds(it.reps) * (e?.perSide ? 2 : 1) : 0;
      const more = rows.some((r, i) => r.some((x, j) => !x.done && !sameStep({ item: i, set: j + 1 }, s))); // queda algo más por hacer
      return upcomingEnds({
        now: Date.now(),
        phase,
        timerOn,
        endsAt: endsAt.current,
        totalSec: sec,
        perSide: !!e?.perSide,
        restAfterSec: timerOn && it && more ? (it.restSec ?? 0) : 0,
      }).map((x) => ({
        at: x.at,
        title: x.kind === 'side' ? t('Switch sides') : x.kind === 'work' ? t('Time!') : t('Rest is over'),
        body: x.kind === 'rest' ? (next ? `${t('Next')}: ${next}` : '') : e ? exerciseName(e) : '',
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

  const start = (v: 'list' | 'guided') => {
    const fresh = items.map((it) => (getExercise(it.exerciseId) ? startRows(it) : []));
    startedAt.current = Date.now();
    setElapsed(0);
    setRows(fresh);
    setView(v);
    setMode('run');
    startStep(nextPending(fresh) ?? { item: 0, set: 1 });
    if (bell.on) offerBellOnLock(bell.tone);
  };

  // Cambiar de vista sin perder nada: el guiado sigue por la primera serie sin hacer (o por la que
  // tenga la cuenta atrás en marcha); el descanso sigue contando
  const switchView = (v: 'list' | 'guided') => {
    if (v === 'guided') {
      const s = timerAt ?? nextPending(rows);
      if (s) setAt(s);
      else {
        setMode('done');
        return;
      }
    }
    setView(v);
  };

  const editRow = (i: number, j: number, patch: Partial<SetRow>) =>
    setRows((all) => all.map((r, a) => (a !== i ? r : r.map((x, b) => (b === j ? { ...x, ...patch } : x)))));
  const addSet = (i: number) => setRows((all) => all.map((r, a) => (a === i ? [...r, { kg: '', reps: '', done: false }] : r)));
  const removeSet = (i: number) => setRows((all) => all.map((r, a) => (a === i && r.length > 1 && !r[r.length - 1].done ? r.slice(0, -1) : r)));

  const toneLabel = t(BELL_TONES.find((x) => x.id === bell.tone)?.label ?? 'Bell');
  const bellSheet = <BellSheet visible={bellOpen} prefs={bell} onChange={setBell} onClose={() => setBellOpen(false)} />;

  const quit = async () => {
    const ok = await confirmAsk(t('Stop the session?'), t('What you did so far will not be saved.'), t('Stop'));
    if (ok) {
      setTimerOn(false);
      setTimerAt(null);
      setPhase('work');
      setMode('overview');
    }
  };

  const finish = async () => {
    if (!doneCount) return quit();
    const pending = steps.length - doneCount;
    if (pending && !(await confirmAsk(t('Finish the workout?'), tn(pending, '{n} set is not marked and will not be saved.', '{n} sets are not marked and will not be saved.'), t('Finish')))) return;
    setTimerOn(false);
    setTimerAt(null);
    setPhase('work');
    setMode('done');
  };

  const save = async () => {
    if (!program || !session || saved) return;
    setSaved(true);
    const minutes = Math.max(1, Math.round(elapsed / 60));
    const now = new Date().toISOString();
    const sets = setLogs(items, rows);
    await programRepository.logCompletion(program.id, { sessionId: session.id, at: now, minutes, ...(sets.length ? { sets } : {}) });
    await workoutRepository.save({ id: `workout-${Date.now()}`, fecha: now, createdAt: now, type: workoutType(session), minutes, intensity });
    // Vuelve a la lista que ya estaba abierta (si no, quedaban dos y «atrás» volvía a la misma)
    router.dismissTo('/workouts');
  };

  if (!program || !session) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScreenHeader title={t('Workout')} showBack backFallback="/workouts" />
        <Text style={[styles.muted, { marginHorizontal: 20 }]}>{program === undefined ? '' : t('This session does not exist any more.')}</Text>
      </SafeAreaView>
    );
  }

  // ── Terminado: resumen ──
  if (mode === 'done') {
    const logs = setLogs(items, rows);
    const sum = summarize(logs, last);
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <Confetti count={60} />
        <ScrollView contentContainerStyle={styles.doneBody} showsVerticalScrollIndicator={false}>
          <View style={styles.doneIcon}>
            <MaterialCommunityIcons name="trophy-outline" size={40} color={Colors.accent} />
          </View>
          <Text style={styles.doneTitle}>{t('Session complete!')}</Text>
          <Text style={styles.doneText}>
            {[
              t('{m} min', { m: Math.max(1, Math.round(elapsed / 60)) }),
              tn(sum.sets, '{n} set', '{n} sets'),
              sum.volumeKg ? t('{kg} kg in total', { kg: sum.volumeKg.toLocaleString(dateLocale()) }) : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </Text>
          {sum.exercises.length > 0 && (
            <View style={styles.results}>
              {sum.exercises.map((r) => {
                const e = getExercise(r.exerciseId);
                if (!e) return null;
                const better = r.change === 'more_weight' || r.change === 'more_reps' || r.change === 'more_time';
                return (
                  <View key={r.exerciseId} style={styles.result}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.resultName} numberOfLines={2}>
                        {exerciseName(e)}
                      </Text>
                      <Text style={styles.resultBest}>
                        {tn(r.sets, '{n} set', '{n} sets')} · {t('best {set}', { set: setText(r.best) })}
                      </Text>
                      <Text style={[styles.resultChange, better && { color: Colors.accent }]}>
                        {r.change === 'less' ? t('Last time: {sets}', { sets: setText(r.previous!) }) : t(CHANGE_TEXT[r.change])}
                      </Text>
                    </View>
                    {better && <Ionicons name="trending-up" size={18} color={Colors.accent} />}
                  </View>
                );
              })}
            </View>
          )}
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
        </ScrollView>
        <View style={styles.runBottom}>
          <TouchableOpacity style={styles.primary} onPress={save} disabled={saved}>
            <Text style={styles.primaryText}>{t('Save')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Modo guiado ──
  if (mode === 'run' && view === 'guided' && item && ex) {
    const running = timerOn && sameStep(timerAt, at);
    const secondSide = running && ex.perSide && left <= total / 2;
    const big = Math.min(width - 40, 460);
    const setsHere = rows[at.item]?.length ?? item.sets;
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.runTop}>
          <TouchableOpacity onPress={quit} hitSlop={10} accessibilityLabel={t('Stop')}>
            <Ionicons name="close" size={26} color={Colors.textPrimary} />
          </TouchableOpacity>
          <View style={styles.progress}>
            <View style={[styles.progressFill, { width: `${steps.length ? (doneCount / steps.length) * 100 : 0}%` }]} />
          </View>
          <Text style={styles.clock}>{fmt(elapsed)}</Text>
          <TouchableOpacity onPress={() => setBellOpen(true)} hitSlop={10} accessibilityLabel={t('Sound')}>
            <MaterialCommunityIcons name={bell.on ? 'bell-outline' : 'bell-off-outline'} size={22} color={bell.on ? Colors.accent : Colors.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => switchView('list')} hitSlop={10} accessibilityLabel={t('See all exercises')}>
            <Ionicons name="list" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.runBody} keyboardShouldPersistTaps="handled">
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
                <TouchableOpacity style={styles.secondary} onPress={() => startStep(at)}>
                  <Text style={styles.secondaryText}>{t('Skip rest')}</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.upNext}>
                <ExerciseLoop exercise={ex} size={72} radius={12} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.nextLabel}>{t('Next')}</Text>
                  <Text style={styles.upNextName}>{exerciseName(ex)}</Text>
                  <Text style={styles.muted}>
                    {t('Set {a} of {b}', { a: at.set, b: setsHere })} · {timed ? item.reps : setText(hintFor(at))}
                    {ex.perSide ? ` ${t('per side')}` : ''}
                  </Text>
                </View>
              </View>
            </>
          ) : (
            <>
              <Text style={styles.blockTag}>{blockLabel(item.block)}</Text>
              <TouchableOpacity activeOpacity={0.9} onPress={() => router.push({ pathname: '/exercise-info', params: { id: ex.id } })}>
                <ExerciseLoop exercise={ex} width={big} radius={18} showProvisional />
              </TouchableOpacity>
              <Text style={styles.runName}>{exerciseName(ex)}</Text>
              <Text style={styles.runSet}>
                {t('Set {a} of {b}', { a: at.set, b: setsHere })}
                {timed ? '' : ` · ${item.reps} ${t('reps')}${ex.perSide ? ` ${t('per side')}` : ''}`}
              </Text>
              {item.note ? <Text style={styles.proNote}>“{item.note}”</Text> : null}
              {timed && (
                <>
                  <Text style={styles.timer}>{fmt(running ? Math.max(0, left) : total)}</Text>
                  {ex.perSide && running ? <Text style={styles.muted}>{secondSide ? t('Second side') : t('First side')}</Text> : null}
                </>
              )}
              <View style={styles.guidedTable}>
                <SetTable
                  item={item}
                  ex={ex}
                  rows={rows[at.item] ?? []}
                  last={last.get(item.exerciseId)?.sets}
                  current={at.set - 1}
                  timer={timerOn && timerAt?.item === at.item ? { row: timerAt.set - 1, left: Math.max(0, left) } : null}
                  canRemove={at.set < (rows[at.item]?.length ?? 0)}
                  onChange={(j, patch) => editRow(at.item, j, patch)}
                  onCheck={(j) => (j === at.set - 1 ? finishStep() : toggleRow({ item: at.item, set: j + 1 }, false))}
                  onAddSet={() => addSet(at.item)}
                  onRemoveSet={() => removeSet(at.item)}
                />
              </View>
            </>
          )}
        </ScrollView>

        {phase === 'work' && (
          <View style={styles.runBottom}>
            {timed && !running ? (
              <TouchableOpacity style={styles.primary} onPress={() => startTimer(at)}>
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

  // ── Lista, como Hevy: todos los ejercicios con su tabla de series ──
  if (mode === 'run') {
    const allDone = steps.length > 0 && doneCount === steps.length;
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.runTop}>
          <TouchableOpacity onPress={quit} hitSlop={10} accessibilityLabel={t('Stop')}>
            <Ionicons name="close" size={26} color={Colors.textPrimary} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.listTitle} numberOfLines={1}>
              {sessionTitle(session)}
            </Text>
            <Text style={styles.listMeta}>
              {fmt(elapsed)} · {t('{a} of {b} sets', { a: doneCount, b: steps.length })}
            </Text>
          </View>
          <TouchableOpacity onPress={() => setBellOpen(true)} hitSlop={10} accessibilityLabel={t('Sound')}>
            <MaterialCommunityIcons name={bell.on ? 'bell-outline' : 'bell-off-outline'} size={22} color={bell.on ? Colors.accent : Colors.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.finishBtn} onPress={finish}>
            <Text style={styles.finishText}>{t('Finish')}</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.progressRow}>
          <View style={styles.progress}>
            <View style={[styles.progressFill, { width: `${steps.length ? (doneCount / steps.length) * 100 : 0}%` }]} />
          </View>
          <TouchableOpacity style={styles.guidedBtn} onPress={() => switchView('guided')}>
            <Ionicons name="play-circle-outline" size={16} color={Colors.accent} />
            <Text style={styles.guidedText}>{t('Guided mode')}</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {items.map((it, i) => {
            const e = getExercise(it.exerciseId);
            if (!e || !rows[i]?.length) return null;
            const prev = last.get(it.exerciseId);
            return (
              <View key={`${it.exerciseId}-${i}`} style={styles.exCard}>
                <TouchableOpacity style={styles.exHead} onPress={() => router.push({ pathname: '/exercise-info', params: { id: e.id } })}>
                  <ExerciseLoop exercise={e} size={48} radius={10} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowName} numberOfLines={2}>
                      {exerciseName(e)}
                    </Text>
                    <Text style={styles.rowDose}>
                      {doseText(it)}
                      {it.restSec ? ` · ${restText(it.restSec)}` : ''}
                    </Text>
                  </View>
                  <Ionicons name="information-circle-outline" size={20} color={Colors.textMuted} />
                </TouchableOpacity>
                {it.note ? <Text style={styles.rowNote}>{it.note}</Text> : null}
                {prev ? <Text style={styles.lastLine}>{t('Last time ({date}): {sets}', { date: dayMonth(prev.at), sets: setsText(prev.sets) })}</Text> : null}
                <SetTable
                  item={it}
                  ex={e}
                  rows={rows[i]}
                  last={prev?.sets}
                  timer={timerOn && timerAt?.item === i ? { row: timerAt.set - 1, left: Math.max(0, left) } : null}
                  onChange={(j, patch) => editRow(i, j, patch)}
                  onCheck={(j) => toggleRow({ item: i, set: j + 1 })}
                  onStartTimer={(j) => startTimer({ item: i, set: j + 1 })}
                  onAddSet={() => addSet(i)}
                  onRemoveSet={() => removeSet(i)}
                />
              </View>
            );
          })}
          <TouchableOpacity style={[styles.primary, !allDone && styles.primaryQuiet]} onPress={finish}>
            <Ionicons name="flag-outline" size={18} color={allDone ? Colors.background : Colors.accent} />
            <Text style={[styles.primaryText, !allDone && { color: Colors.accent }]}>{t('Finish workout')}</Text>
          </TouchableOpacity>
        </ScrollView>

        {phase === 'rest' && (
          <View style={styles.restBar}>
            <View style={[styles.restFill, { width: `${restTotal ? Math.max(0, Math.min(1, left / restTotal)) * 100 : 0}%` }]} />
            <Text style={styles.restLabel}>{t('Rest')}</Text>
            <Text style={styles.restBarClock}>{fmt(Math.max(0, left))}</Text>
            <View style={{ flex: 1 }} />
            <TouchableOpacity style={styles.restBtn} onPress={() => countTo(Math.max(Date.now(), endsAt.current - 15000))}>
              <Text style={styles.secondaryText}>−15</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.restBtn} onPress={() => countTo(endsAt.current + 15000)}>
              <Text style={styles.secondaryText}>+15</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.restBtn} onPress={() => setPhase('work')}>
              <Text style={styles.secondaryText}>{t('Skip')}</Text>
            </TouchableOpacity>
          </View>
        )}
        {bellSheet}
      </SafeAreaView>
    );
  }

  // ── Vista previa de la sesión ──
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
  const saveDose = async (change: Pick<WorkoutExercise, 'sets' | 'reps' | 'restSec' | 'weightKg'>) => {
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
              const prev = last.get(it.exerciseId);
              return (
                <TouchableOpacity key={`${it.exerciseId}-${idx}`} style={styles.row} onPress={() => router.push({ pathname: '/exercise-info', params: { id: e.id } })}>
                  <ExerciseLoop exercise={e} size={64} radius={12} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowName}>{exerciseName(e)}</Text>
                    <Text style={styles.rowDose}>
                      {doseText(it)}
                      {it.restSec ? ` · ${restText(it.restSec)}` : ''}
                    </Text>
                    {prev ? (
                      <Text style={styles.rowLast} numberOfLines={2}>
                        {t('Last time: {sets}', { sets: setsText(prev.sets) })}
                      </Text>
                    ) : null}
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
      <View style={[styles.runBottom, styles.startRow]}>
        <TouchableOpacity style={[styles.primary, { flex: 1 }]} onPress={() => start('list')}>
          <Ionicons name="play" size={18} color={Colors.background} />
          <Text style={styles.primaryText}>{t('Start')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.guidedStart} onPress={() => start('guided')}>
          <Ionicons name="videocam-outline" size={18} color={Colors.accent} />
          <Text style={styles.secondaryText}>{t('Guided mode')}</Text>
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
            <DoseEditor item={editing} perSide={editingEx?.perSide} withWeight={!!editingEx && isLoadable(editingEx)} onSave={saveDose} onCancel={() => setEditAt(null)} />
          </>
        )}
      </WorkoutModal>
      {bellSheet}
    </SafeAreaView>
  );
};

const dayMonth = (iso: string) => new Date(iso).toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short' });

const styles = StyleSheet.create({
  swap: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.accentSoft },
  swapHint: { color: Colors.textSecondary, fontSize: 13, lineHeight: 18, marginBottom: 10 },
  safeArea: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: 20, paddingBottom: 24 },
  muted: { color: Colors.textSecondary, fontSize: 13, marginHorizontal: 0 },
  meta: { color: Colors.textSecondary, fontSize: 14, marginBottom: 6 },
  soundRow: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingVertical: 4, marginBottom: 4 },
  soundText: { color: Colors.textSecondary, fontSize: 13, fontWeight: '600' },
  section: { color: Colors.textPrimary, fontSize: 16, fontWeight: '800', marginTop: 10, marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 14, padding: 8, marginBottom: 8 },
  rowName: { color: Colors.textPrimary, fontSize: 15, fontWeight: '700' },
  rowDose: { color: Colors.textSecondary, fontSize: 13, marginTop: 2 },
  rowLast: { color: Colors.textMuted, fontSize: 12, marginTop: 2 },
  rowNote: { color: Colors.accent, fontSize: 12, marginTop: 2, fontStyle: 'italic' },
  tabs: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, marginBottom: 8 },
  tab: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, borderColor: Colors.cardBorder, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.card },
  tabOn: { borderColor: Colors.accent, backgroundColor: Colors.accentSoft },
  tabText: { color: Colors.textSecondary, fontSize: 14, fontWeight: '800' },
  tabTextOn: { color: Colors.textPrimary },
  primary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.accent, borderRadius: 24, paddingVertical: 14 },
  primaryQuiet: { backgroundColor: 'transparent', borderWidth: 1, borderColor: Colors.accent },
  primaryText: { color: Colors.background, fontSize: 16, fontWeight: '800' },
  secondary: { borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 22, paddingHorizontal: 18, paddingVertical: 10 },
  secondaryText: { color: Colors.accent, fontSize: 14, fontWeight: '700' },
  link: { alignItems: 'center', paddingVertical: 10 },
  linkText: { color: Colors.textSecondary, fontSize: 14, fontWeight: '600' },
  startRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  guidedStart: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 24, paddingHorizontal: 16, paddingVertical: 13 },
  runTop: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10 },
  progress: { flex: 1, height: 6, borderRadius: 3, backgroundColor: Colors.cardBorder, overflow: 'hidden' },
  progressFill: { height: 6, backgroundColor: Colors.accent },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 10 },
  guidedBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 5 },
  guidedText: { color: Colors.accent, fontSize: 12, fontWeight: '700' },
  clock: { color: Colors.textSecondary, fontSize: 14, fontWeight: '700', minWidth: 44, textAlign: 'right' },
  listTitle: { color: Colors.textPrimary, fontSize: 16, fontWeight: '800' },
  listMeta: { color: Colors.textSecondary, fontSize: 12, fontWeight: '600', fontVariant: ['tabular-nums'] },
  finishBtn: { backgroundColor: Colors.accent, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 7 },
  finishText: { color: Colors.background, fontSize: 13, fontWeight: '800' },
  exCard: { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 16, padding: 10, marginBottom: 12, gap: 6 },
  exHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  lastLine: { color: Colors.textMuted, fontSize: 12 },
  restBar: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 12, marginBottom: 8, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 16, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.accent, overflow: 'hidden' },
  restFill: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: Colors.accentSoft },
  restLabel: { color: Colors.accent, fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  restBarClock: { color: Colors.textPrimary, fontSize: 22, fontWeight: '900', fontVariant: ['tabular-nums'] },
  restBtn: { borderWidth: 1, borderColor: Colors.cardBorder, backgroundColor: Colors.background, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 6 },
  runBody: { alignItems: 'center', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 20, gap: 10 },
  guidedTable: { alignSelf: 'stretch', marginTop: 4 },
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
  doneBody: { alignItems: 'center', paddingHorizontal: 24, paddingTop: 32, paddingBottom: 16 },
  doneIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.accentSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  doneTitle: { color: Colors.textPrimary, fontSize: 26, fontWeight: '900', textAlign: 'center' },
  doneText: { color: Colors.textSecondary, fontSize: 15, marginTop: 6, textAlign: 'center' },
  results: { alignSelf: 'stretch', marginTop: 20, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 16, paddingHorizontal: 14 },
  result: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.divider },
  resultName: { color: Colors.textPrimary, fontSize: 14, fontWeight: '800' },
  resultBest: { color: Colors.textSecondary, fontSize: 13, marginTop: 2 },
  resultChange: { color: Colors.textMuted, fontSize: 12, marginTop: 2 },
  q: { color: Colors.textPrimary, fontSize: 15, fontWeight: '700', marginTop: 24, marginBottom: 10 },
});

import { getExercise } from '@/data/workouts/catalog';
import type { WorkoutExercise, WorkoutPrefs, WorkoutProgram, WorkoutSession } from '@/data/workouts/types';
import { DEFAULT_PREFS, defaultDose, newProgram } from './workoutGenerator';
import { plannedSet, plannedSets, withPlan } from './setPlan';
import { parseCount, parseKg } from './workoutLog';
import { isTimedReps, timedSeconds, timeText } from './workoutTimer';
import { normWeekdays } from './workoutWeek';

// "Crear mi propio entrenamiento" (como en Hevy o Strong): un nombre, una o varias rutinas (A, B, C…), cada una con
// su nombre, los días de la semana en que se hace (puede repetirse varios días: logic/workoutWeek.ts) y los
// ejercicios que se eligen de la biblioteca, en el orden que se quiera, con series, repeticiones o tiempo, peso y
// descanso. Se guarda como un WorkoutProgram más (source 'self' y prefs.custom) para que la lista, la sesión guiada y
// el portal lo traten igual que los del generador. El mismo editor cambia cualquier programa (también los del
// generador y los del entrenador): ahí se respetan su calentamiento, sus estiramientos y el tipo de cada rutina.
// Hasta el 2026-11-06 se llamaba «rutina» al todo y «día» a cada rutina (fundador: «hay un lío con rutina, día y
// nombres»).

export const CUSTOM_PREFS: WorkoutPrefs = { ...DEFAULT_PREFS, level: 'intermediate', custom: true };

export const isCustomProgram = (p: Pick<WorkoutProgram, 'prefs'>) => !!p.prefs?.custom;

export const dayLetter = (i: number) => String.fromCharCode(65 + i);

// Sin título: la pantalla la llama "Rutina A" (sessionName en labels.ts)
export const emptyDay = (i: number): WorkoutSession => ({ id: dayLetter(i), title: '', focus: 'full', exercises: [] });

// En el editor, cada rutina recuerda qué letra tenía en el programa guardado (`orig`; null si es nueva; sin el campo,
// la suya), para que al guardar lo ya hecho se vaya con su rutina aunque cambie de letra
export type DraftRoutine = WorkoutSession & { orig?: string | null };

// Al final del día (antes de los estiramientos, si los hay), con la dosis de partida del generador
// para alguien de nivel intermedio (3 × 10–12 en los grandes, 1 × 30 s en los estiramientos…). Luego
// se cambia con el lápiz.
export function addExercises(day: WorkoutSession, ids: string[]): WorkoutSession {
  const added = ids.filter((id) => getExercise(id)).map((id) => ({ exerciseId: id, block: 'main' as const, ...defaultDose(id, CUSTOM_PREFS, 'main') }));
  const cool = day.exercises.findIndex((e) => e.block === 'cooldown');
  const at = cool < 0 ? day.exercises.length : cool;
  return { ...day, exercises: [...day.exercises.slice(0, at), ...added, ...day.exercises.slice(at)] };
}

export function moveExercise(day: WorkoutSession, index: number, dir: -1 | 1): WorkoutSession {
  const j = index + dir;
  if (j < 0 || j >= day.exercises.length) return day;
  const exercises = [...day.exercises];
  [exercises[index], exercises[j]] = [exercises[j], exercises[index]];
  return { ...day, exercises };
}

// Qué tipo de día es por sus ejercicios (decide si cuenta en el plan como fuerza, cardio o movilidad)
export function focusFor(exercises: WorkoutSession['exercises']): WorkoutSession['focus'] {
  const patterns = exercises.map((e) => getExercise(e.exerciseId)?.pattern).filter(Boolean);
  if (!patterns.length) return 'full';
  if (patterns.every((p) => p === 'mobility' || p === 'stretch')) return 'mobility';
  if (patterns.every((p) => p === 'conditioning')) return 'conditioning';
  return 'full';
}

const tidy = (d: DraftRoutine): DraftRoutine => ({ ...d, title: d.title.trim().slice(0, 60), exercises: d.exercises.filter((e) => getExercise(e.exerciseId)) });
const kept = (days: DraftRoutine[]) => days.map(tidy).filter((d) => d.exercises.length);

// Al guardar: fuera los ejercicios que ya no están en el catálogo y las rutinas vacías; las letras van en orden (A, B,
// C…), cada día de la semana es de una sola rutina y cada rutina lleva su tipo (en un programa del generador, el que
// ya tenía: "Tren superior" sigue siéndolo aunque se quite un ejercicio)
export function cleanDays(days: DraftRoutine[], keepFocus = false): WorkoutSession[] {
  const taken = new Set<number>();
  return kept(days).map((d, i) => {
    const { orig, weekdays, ...rest } = d;
    const wd = normWeekdays(weekdays).filter((x) => !taken.has(x));
    wd.forEach((x) => taken.add(x));
    return { ...rest, id: dayLetter(i), focus: keepFocus ? d.focus : focusFor(d.exercises), ...(wd.length ? { weekdays: wd } : {}) };
  });
}

// La primera rutina con nombre o días pero sin ejercicios (no se guarda vacía sin avisar); -1 si no hay
export const firstEmptyRoutine = (days: DraftRoutine[]) => days.map(tidy).findIndex((d) => !d.exercises.length && (!!d.title || normWeekdays(d.weekdays).length > 0));

// De qué letra a qué letra pasa cada rutina del programa guardado. Las que se quitan van a una que no es de ninguna
// ("xB"): lo hecho con ellas sigue en el historial, con el nombre del programa, y no se pega a otra rutina.
export function routineIdMap(days: DraftRoutine[], base: Pick<WorkoutProgram, 'sessions'> | null | undefined): Record<string, string> {
  const map: Record<string, string> = {};
  if (!base) return map;
  base.sessions.forEach((s) => (map[s.id] = `x${s.id}`));
  kept(days).forEach((d, i) => {
    const from = d.orig === undefined ? d.id : d.orig;
    if (from && from in map) map[from] = dayLetter(i);
  });
  return map;
}

// Nuevo (se sigue al guardarlo, como los del generador, salvo que se diga lo contrario) o cambiado (conserva id,
// fecha, sesiones hechas, si se sigue y de dónde salió: uno del generador sigue siéndolo)
export function customProgram(title: string, days: DraftRoutine[], opts: { base?: WorkoutProgram | null; follow?: boolean } = {}): WorkoutProgram {
  const name = title.trim().slice(0, 120);
  if (opts.base) {
    const map = routineIdMap(days, opts.base);
    const completions = opts.base.completions.map((c) => (map[c.sessionId] && map[c.sessionId] !== c.sessionId ? { ...c, sessionId: map[c.sessionId] } : c));
    return { ...opts.base, title: name || opts.base.title, sessions: cleanDays(days, !isCustomProgram(opts.base)), completions };
  }
  const sessions = cleanDays(days);
  return newProgram(CUSTOM_PREFS, { title: name || 'My workout', sessions, active: opts.follow ?? true });
}

// ── Editar serie a serie, como en Hevy ──
// En el editor cada serie es una fila con su peso y sus repeticiones (o sus segundos, si va por
// tiempo), escritos como texto para poder dejar "22," a medias. Al guardar se pasan a la rutina.
export type DraftSet = { kg: string; reps: string };

export function toDraft(it: WorkoutExercise, fmt: (n: number) => string = String): DraftSet[] {
  const timed = isTimedReps(it.reps);
  return plannedSets(it).map((p) => ({ kg: !timed && p.kg !== undefined ? fmt(p.kg) : '', reps: timed ? String(timedSeconds(p.reps)) : p.reps }));
}

// Repeticiones válidas: "8" o un rango "8-10" (se guarda con raya, "8–10"); si no, se queda la de antes
const repsText = (s: string) => {
  const n = s.replace(/\s/g, '').replace(/[-‐-―]/g, '–');
  return /^\d{1,3}(–\d{1,3})?$/.test(n) ? n : null;
};

export function fromDraft(it: WorkoutExercise, draft: DraftSet[]): WorkoutExercise {
  const timed = isTimedReps(it.reps);
  const plan = draft.map((d, i) => {
    const before = plannedSet(it, i).reps;
    if (timed) return { reps: timeText(Math.max(5, Math.min(3600, parseCount(d.reps) ?? timedSeconds(before)))) };
    const kg = parseKg(d.kg);
    return { ...(kg ? { kg } : {}), reps: repsText(d.reps) ?? (isTimedReps(before) ? '10' : before) };
  });
  return withPlan(it, plan);
}

// Pasar un ejercicio de repeticiones a tiempo o al revés (con valores de partida: 10 repeticiones o 30 s)
export function switchTimed(it: WorkoutExercise, draft: DraftSet[], toTimed: boolean): { item: WorkoutExercise; draft: DraftSet[] } {
  const reps = toTimed ? '30 s' : '10';
  const item: WorkoutExercise = { ...it, reps };
  delete item.setPlan;
  delete item.weightKg;
  return { item, draft: draft.map(() => ({ kg: '', reps: toTimed ? '30' : '10' })) };
}

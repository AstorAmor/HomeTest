import type { SetLog, WorkoutExercise, WorkoutProgram } from '@/data/workouts/types';
import { isTimedReps } from './workoutTimer';
import { plannedSet, plannedSets, setSeconds } from './setPlan';

// Registro de series durante la sesión, como en Hevy o Strong: en cada ejercicio una fila por serie con
// el peso y las repeticiones que se hacen de verdad y, al lado, lo que se hizo la última vez en ese
// ejercicio (en cualquier programa). Al terminar, el resumen compara la mejor serie con la de entonces.
// Lógica pura; la pantalla es src/screens/workouts/WorkoutSessionScreen.tsx.

// Una fila mientras se entrena: lo escrito en las casillas (texto, para poder dejar "22," a medias) y
// si la serie está hecha. En los ejercicios por tiempo, `reps` son los segundos.
export interface SetRow {
  kg: string;
  reps: string;
  done: boolean;
}

export type LastTime = { at: string; sets: SetLog[] };
export type Step = { item: number; set: number }; // set empieza en 1
type Hint = { kg?: number; reps?: number };

// "22,5" o "22.5" → 22.5; vacío o sin sentido → undefined
export function parseKg(s: string): number | undefined {
  const v = Number(s.trim().replace(',', '.'));
  if (!s.trim() || !Number.isFinite(v) || v < 0 || v > 1000) return undefined;
  return Math.round(v * 100) / 100;
}

export function parseCount(s: string): number | undefined {
  const v = Number(s.trim());
  if (!s.trim() || !Number.isInteger(v) || v < 0 || v > 10000) return undefined;
  return v;
}

// El primer número de lo que pide la rutina: "8–10" → 8, "12" → 12
export const targetReps = (reps: string) => {
  const n = reps.match(/\d+/);
  return n ? Number(n[0]) : undefined;
};

// La última vez de cada ejercicio, mirando todos los programas: sirve aunque se haya cambiado de
// programa o de día. Con `before`, solo lo anterior a esa fecha.
export function lastTimes(programs: Pick<WorkoutProgram, 'completions'>[], before?: string): Map<string, LastTime> {
  const out = new Map<string, LastTime>();
  const done = programs
    .flatMap((p) => p.completions ?? [])
    .filter((c) => c.sets?.length && (!before || c.at < before))
    .sort((a, b) => b.at.localeCompare(a.at));
  for (const c of done) {
    const byExercise = new Map<string, SetLog[]>();
    for (const s of c.sets ?? []) byExercise.set(s.exerciseId, [...(byExercise.get(s.exerciseId) ?? []), s]);
    for (const [id, sets] of byExercise) if (!out.has(id)) out.set(id, { at: c.at, sets });
  }
  return out;
}

type Planned = Pick<WorkoutExercise, 'sets' | 'reps' | 'weightKg' | 'setPlan'>;

// Lo que sale en gris en cada casilla y se guarda si se marca sin escribir. Manda la rutina, serie a
// serie (es el objetivo, como en Hevy; lo de la última vez se ve al lado, en «Anterior»):
// - repeticiones: las de esa serie en la rutina ("8–10" → 8); por tiempo, sus segundos (los del
//   temporizador);
// - peso: el de esa serie en la rutina; si la rutina no lo dice, lo de esa misma serie la última vez;
//   si entonces no se hizo, el de la fila de arriba hoy (`aboveKg`: quien pone 16 kg en la primera no
//   tiene que repetirlo en cada serie); si no, la última serie de la última vez.
export function setHint(item: Planned, last: SetLog[] | undefined, index: number, aboveKg?: number): Hint {
  if (isTimedReps(item.reps)) return { reps: setSeconds(item, index) };
  const plan = plannedSet(item, index);
  return { kg: plan.kg ?? last?.[index]?.kg ?? aboveKg ?? last?.[last.length - 1]?.kg, reps: targetReps(plan.reps) };
}

// Las pistas de todas las filas de un ejercicio, de arriba abajo (el peso de cada una pasa a la siguiente)
export function rowHints(item: Planned, last: SetLog[] | undefined, rows: SetRow[]): Hint[] {
  const out: Hint[] = [];
  rows.forEach((_, i) => {
    const aboveKg = i ? (parseKg(rows[i - 1].kg) ?? out[i - 1].kg) : undefined;
    out.push(setHint(item, last, i, aboveKg));
  });
  return out;
}

export const startRows = (item: Planned): SetRow[] => plannedSets(item).map(() => ({ kg: '', reps: '', done: false }));

// Marcar una serie: lo escrito o, si se dejó vacío, la pista. Se escribe en la fila para que se vea lo
// que se guarda. `fmt` pone el número como en el idioma (22,5).
export function checkRow(row: SetRow, hint: Hint, fmt: (n: number) => string = String): SetRow {
  const kg = parseKg(row.kg) ?? hint.kg;
  const reps = parseCount(row.reps) ?? hint.reps;
  return { kg: kg === undefined ? '' : fmt(kg), reps: reps === undefined ? '' : String(reps), done: true };
}

// Lo que se guarda de la sesión: las series hechas, ejercicio a ejercicio y en orden
export function setLogs(items: Pick<WorkoutExercise, 'exerciseId' | 'reps'>[], rows: SetRow[][]): SetLog[] {
  return items.flatMap((it, i) =>
    (rows[i] ?? [])
      .filter((r) => r.done)
      .map((r) => {
        const n = parseCount(r.reps);
        if (isTimedReps(it.reps)) return { exerciseId: it.exerciseId, ...(n !== undefined ? { sec: n } : {}) };
        const kg = parseKg(r.kg);
        return { exerciseId: it.exerciseId, ...(kg ? { kg } : {}), ...(n !== undefined ? { reps: n } : {}) };
      }),
  );
}

export const allSteps = (rows: SetRow[][]): Step[] => rows.flatMap((r, i) => r.map((_, s) => ({ item: i, set: s + 1 })));

// Modo guiado: la siguiente serie sin hacer después de `from` (desde el principio si no se pasa).
// Las hechas en la lista se saltan.
export function nextPending(rows: SetRow[][], from?: Step): Step | null {
  const steps = allSteps(rows);
  const start = from ? steps.findIndex((s) => s.item === from.item && s.set === from.set) + 1 : 0;
  return steps.slice(Math.max(0, start)).find((s) => !rows[s.item]?.[s.set - 1]?.done) ?? null;
}

// La serie más fuerte: más peso y, a igual peso, más repeticiones (o más segundos)
export const compareSets = (a: SetLog, b: SetLog) => (a.kg ?? 0) - (b.kg ?? 0) || (a.reps ?? 0) - (b.reps ?? 0) || (a.sec ?? 0) - (b.sec ?? 0);
export const bestSet = (sets: SetLog[]): SetLog | undefined => sets.reduce<SetLog | undefined>((b, s) => (!b || compareSets(s, b) > 0 ? s : b), undefined);

export type Change = 'first' | 'more_weight' | 'more_reps' | 'more_time' | 'same' | 'less';

export interface ExerciseResult {
  exerciseId: string;
  sets: number;
  best: SetLog;
  previous?: SetLog; // la mejor serie de la última vez
  change: Change;
}

function changeFrom(best: SetLog, prev: SetLog | undefined): Change {
  if (!prev) return 'first';
  const kg = (best.kg ?? 0) - (prev.kg ?? 0);
  if (kg) return kg > 0 ? 'more_weight' : 'less';
  const reps = (best.reps ?? 0) - (prev.reps ?? 0);
  if (reps) return reps > 0 ? 'more_reps' : 'less';
  const sec = (best.sec ?? 0) - (prev.sec ?? 0);
  if (sec) return sec > 0 ? 'more_time' : 'less';
  return 'same';
}

// Resumen al terminar: series, kilos movidos (peso × repeticiones de cada serie) y, por ejercicio, la
// mejor serie frente a la mejor de la última vez. `last` se calcula antes de guardar esta sesión.
export function summarize(logs: SetLog[], last: Map<string, LastTime>) {
  const ids = [...new Set(logs.map((l) => l.exerciseId))];
  const exercises: ExerciseResult[] = ids.map((id) => {
    const mine = logs.filter((l) => l.exerciseId === id);
    const best = bestSet(mine)!;
    const prevSets = last.get(id)?.sets;
    const previous = prevSets ? bestSet(prevSets) : undefined;
    return { exerciseId: id, sets: mine.length, best, previous, change: changeFrom(best, previous) };
  });
  const volumeKg = Math.round(logs.reduce((sum, l) => sum + (l.kg ?? 0) * (l.reps ?? 0), 0));
  return { sets: logs.length, volumeKg, exercises };
}

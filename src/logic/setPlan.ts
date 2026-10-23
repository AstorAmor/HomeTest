import type { PlannedSet, WorkoutExercise } from '@/data/workouts/types';
import { isTimedReps, timedSeconds } from './workoutTimer';

// Las series de la rutina, serie a serie, como en Hevy (100 × 6, 100 × 6, 90 × 7…). Un ejercicio guarda
// siempre su resumen (sets, reps y weightKg, lo que leen el generador, el portal y lo guardado antes) y,
// solo si las series no son todas iguales, además `setPlan`. Lógica pura.

type Dose = Pick<WorkoutExercise, 'sets' | 'reps' | 'weightKg' | 'setPlan'>;

// Las series de un ejercicio: las suyas si las tiene; si no, sets iguales de reps con weightKg
export function plannedSets(it: Dose): PlannedSet[] {
  if (it.setPlan?.length) return it.setPlan;
  return Array.from({ length: Math.max(1, it.sets) }, () => ({ ...(it.weightKg ? { kg: it.weightKg } : {}), reps: it.reps }));
}

// La serie `index` (empieza en 0); las que se añaden en la sesión copian la última
export const plannedSet = (it: Dose, index: number): PlannedSet => {
  const all = plannedSets(it);
  return all[Math.min(index, all.length - 1)];
};

// Segundos de una serie por tiempo ("30 s", "1 min 30 s")
export const setSeconds = (it: Dose, index: number) => timedSeconds(plannedSet(it, index).reps);

const numbers = (reps: string) => (reps.match(/\d+/g) ?? []).map(Number);

// Guardar unas series. Si son todas iguales, como siempre (sin setPlan); si no, serie a serie y con
// el resumen: repeticiones de la menor a la mayor ("6–7") y el peso de la primera.
export function withPlan<T extends WorkoutExercise>(it: T, plan: PlannedSet[]): T {
  const sets = plan.length ? plan : plannedSets(it);
  const first = sets[0];
  const allSame = sets.every((p) => p.reps === first.reps && p.kg === first.kg);
  let reps = first.reps;
  if (!allSame && !isTimedReps(first.reps)) {
    const all = sets.flatMap((p) => numbers(p.reps));
    if (all.length) {
      const lo = Math.min(...all);
      const hi = Math.max(...all);
      reps = lo === hi ? String(lo) : `${lo}–${hi}`;
    }
  }
  const { setPlan: _old, weightKg: _kg, ...rest } = it;
  return { ...rest, sets: sets.length, reps, ...(first.kg ? { weightKg: first.kg } : {}), ...(allSame ? {} : { setPlan: sets }) } as T;
}

// El lápiz pone una misma dosis a todas las series: si cambia las series, las repeticiones o el peso,
// dejan de ir serie a serie; si solo cambia el descanso, se quedan como estaban
export function applyDose<T extends WorkoutExercise>(it: T, change: Pick<WorkoutExercise, 'sets' | 'reps' | 'restSec' | 'weightKg'>): T {
  const same = change.sets === it.sets && change.reps === it.reps && (!('weightKg' in change) || change.weightKg === it.weightKg);
  const next = { ...it, ...change };
  if (!same) delete next.setPlan;
  return next;
}

// El peso que pide la rutina en una serie (el suyo o, si no va serie a serie, el de todas)
export const plannedKg = (it: Dose, index: number) => plannedSet(it, index).kg;

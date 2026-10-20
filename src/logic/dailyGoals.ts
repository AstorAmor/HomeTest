import type { PlanItem } from './plan';

// Objetivos del día de «Tu estado de hoy»: pasos, kcal activas, sueño y distancia. Cada círculo se
// completa con su objetivo. Se sugieren los del plan (pasos y sueño, cuando están entre tus acciones) y,
// si no, unos generales; el usuario puede cambiar cualquiera (se guardan en user_flags 'daily_goals.v1').

export interface DailyGoals {
  steps: number;
  activeKcal: number;
  sleepMin: number;
  distanceM: number;
}

export type GoalKey = keyof DailyGoals;

// Generales: 8.000 pasos (beneficio que sigue subiendo hasta 8.000-10.000 antes de los 60), 7 h 30 de
// sueño (los adultos necesitan 7 o más), 500 kcal activas y 6 km. SUPUESTO para kcal y distancia.
export const DEFAULT_GOALS: DailyGoals = { steps: 8000, activeKcal: 500, sleepMin: 450, distanceM: 6000 };

export function suggestedGoals(plan: PlanItem[]): { goals: DailyGoals; fromPlan: Record<GoalKey, boolean> } {
  const steps = plan.find((i) => i.kind === 'steps')?.target;
  const sleepHours = plan.find((i) => i.kind === 'sleep')?.target;
  return {
    goals: {
      ...DEFAULT_GOALS,
      ...(steps ? { steps } : {}),
      ...(sleepHours ? { sleepMin: Math.round(sleepHours * 60) } : {}),
    },
    fromPlan: { steps: !!steps, activeKcal: false, sleepMin: !!sleepHours, distanceM: false },
  };
}

// Lo guardado manda; lo que no se haya cambiado (o no sea un número válido) sigue la sugerencia
export function effectiveGoals(suggested: DailyGoals, saved: Partial<DailyGoals> | null | undefined): DailyGoals {
  const out = { ...suggested };
  for (const k of Object.keys(out) as GoalKey[]) {
    const v = saved?.[k];
    if (typeof v === 'number' && Number.isFinite(v) && v > 0) out[k] = v;
  }
  return out;
}

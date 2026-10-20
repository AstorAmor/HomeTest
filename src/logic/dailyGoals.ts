import type { PlanItem, PlanProfile } from './plan';

// Objetivos del día de «Tu estado de hoy»: pasos, kcal activas, sueño y distancia. Cada círculo se
// completa con su objetivo. Pasos y sueño salen del plan cuando están entre tus acciones; si no, de tu
// edad. Las kcal y la distancia se calculan a partir de esos pasos, tu sexo, tu peso y tu altura. El
// usuario puede cambiar cualquiera (se guardan en user_flags 'daily_goals.v1'). Fuentes en
// src/data/evidence.ts (tema 'daily_goals'). PENDIENTE de revisión médica.

export interface DailyGoals {
  steps: number;
  activeKcal: number;
  sleepMin: number;
  distanceM: number;
}

export type GoalKey = keyof DailyGoals;

// De dónde sale cada sugerencia (para decirlo en la pantalla)
export type GoalBasis = 'plan' | 'age' | 'body';

// Sin perfil: lo de un adulto de menos de 60 con peso y altura de referencia
export const DEFAULT_GOALS: DailyGoals = { steps: 8000, activeKcal: 350, sleepMin: 450, distanceM: 6000 };

const ageFrom = (dob?: string) => {
  if (!dob) return null;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  if (now.getMonth() < d.getMonth() || (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())) age--;
  return age;
};

const roundTo = (v: number, step: number) => Math.max(step, Math.round(v / step) * step);

// Pasos y sueño por edad. Pasos: el beneficio sigue subiendo hasta 8.000-10.000 al día antes de los 60
// y hasta 6.000-8.000 desde los 60 (Paluch 2022): se propone el inicio de la franja alta. Sueño: los
// adultos, 7 horas o más (7 h 30); menores de 18, 8 a 10 (9 h).
export const stepsForAge = (age: number | null) => (age !== null && age >= 60 ? 7000 : 8000);
export const sleepForAge = (age: number | null) => (age !== null && age < 18 ? 540 : 450);

// kcal activas y distancia a partir de los pasos. Zancada ≈ 41,5 % de la altura (41,3 % en mujeres).
// Caminar gasta ≈ 0,5 kcal por kg y km por encima del reposo (ecuación de la marcha del ACSM), y se
// suman 30 min al día de actividad moderada (≈ 3 MET por encima del reposo), que es como se reparten los
// 150-300 min a la semana de la OMS. Peso y altura de referencia si faltan (75 kg y 176 cm; 62 kg y 163 cm).
export function fromSteps(steps: number, p?: PlanProfile | null): Pick<DailyGoals, 'activeKcal' | 'distanceM'> {
  const female = p?.sex === 'female';
  const kg = p?.weightKg && p.weightKg > 25 ? p.weightKg : female ? 62 : 75;
  const cm = p?.heightCm && p.heightCm > 100 ? p.heightCm : female ? 163 : 176;
  const km = (steps * (cm / 100) * (female ? 0.413 : 0.415)) / 1000;
  const kcal = 0.5 * kg * km + 3 * kg * 0.5;
  return { activeKcal: roundTo(kcal, 50), distanceM: roundTo(km * 1000, 500) };
}

export function suggestedGoals(plan: PlanItem[], profile?: PlanProfile | null): { goals: DailyGoals; basis: Record<GoalKey, GoalBasis> } {
  const age = ageFrom(profile?.dateOfBirth);
  const planSteps = plan.find((i) => i.kind === 'steps')?.target;
  const planSleep = plan.find((i) => i.kind === 'sleep')?.target;
  const steps = planSteps || stepsForAge(age);
  return {
    goals: { steps, sleepMin: planSleep ? Math.round(planSleep * 60) : sleepForAge(age), ...fromSteps(steps, profile) },
    basis: { steps: planSteps ? 'plan' : 'age', sleepMin: planSleep ? 'plan' : 'age', activeKcal: 'body', distanceM: 'body' },
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

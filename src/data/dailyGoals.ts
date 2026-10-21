import { userFlags } from './userFlags';
import { profileRepository } from './profileRepository';
import { DailyGoals, effectiveGoals, GoalsShown, suggestedGoals } from '@/logic/dailyGoals';
import { buildPlan } from '@/logic/plan';

// Los objetivos del día que el usuario ha cambiado (solo esos: lo demás sigue lo que sugiera su plan,
// que puede cambiar). En user_flags, así valen en todos sus dispositivos.
const KEY = 'daily_goals.v1';

export const dailyGoalsStore = {
  async get(): Promise<Partial<DailyGoals> | null> {
    const v = await userFlags.get(KEY).catch(() => undefined);
    return v && typeof v === 'object' ? (v as Partial<DailyGoals>) : null;
  },
  async set(changed: Partial<DailyGoals>): Promise<void> {
    await userFlags.set(KEY, changed as Record<string, unknown>);
  },
};

// Cuáles salen como círculo en Hoy (solo los que ha cambiado; ver goalsShown)
const SHOWN_KEY = 'daily_goals_shown.v1';
export const goalsShownStore = {
  async get(): Promise<Partial<GoalsShown> | null> {
    const v = await userFlags.get(SHOWN_KEY).catch(() => undefined);
    return v && typeof v === 'object' ? (v as Partial<GoalsShown>) : null;
  },
  set: (shown: Partial<GoalsShown>) => userFlags.set(SHOWN_KEY, shown as Record<string, unknown>),
};

// Los objetivos que valen hoy, para pantallas que no tienen ya el perfil (p. ej. Hidratación)
export async function loadDailyGoals(): Promise<DailyGoals> {
  const [profile, saved] = await Promise.all([profileRepository.get().catch(() => null), dailyGoalsStore.get()]);
  return effectiveGoals(suggestedGoals(buildPlan(profile), profile).goals, saved);
}

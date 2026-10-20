import { userFlags } from './userFlags';
import type { DailyGoals } from '@/logic/dailyGoals';

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

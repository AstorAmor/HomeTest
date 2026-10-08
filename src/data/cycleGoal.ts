import { userFlags } from './userFlags';
import { CycleGoalAnswers } from '@/types/cycleGoal';

// Respuestas de la encuesta del ciclo (user_flags "cycle_goal"). Sin respuesta, la primera vez
// que se abre el ciclo se enseña la encuesta.
const KEY = 'cycle_goal';
// Ya se le enseñó la encuesta (aunque la saltara): no volver a abrirla sola
export const CYCLE_GOAL_PROMPTED = 'cycle_goal_prompted';

export const cycleGoalStore = {
  async get(): Promise<CycleGoalAnswers | null> {
    const v = await userFlags.get(KEY);
    return v && typeof v === 'object' && 'goal' in v ? (v as unknown as CycleGoalAnswers) : null;
  },
  async set(answers: CycleGoalAnswers): Promise<void> {
    await userFlags.set(KEY, answers as unknown as Record<string, unknown>);
  },
};

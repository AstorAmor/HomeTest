import { t, tn } from '@/i18n';
import { getExercise } from './catalog';
import type { Level, TrainingPlace, WorkoutBlock, WorkoutExercise, WorkoutGoal, WorkoutSession } from './types';

// Textos de los entrenamientos que comparten la app y el portal (fuente en inglés, ver workoutsEs.ts)

export const GOALS: { id: WorkoutGoal; label: string; hint: string }[] = [
  { id: 'health', label: 'Health and energy', hint: 'Strength and movement for everyday life' },
  { id: 'strength', label: 'Get stronger', hint: 'Fewer reps, more weight, longer rests' },
  { id: 'muscle', label: 'Build muscle', hint: '8–12 reps, a bit more volume' },
  { id: 'fat_loss', label: 'Lose fat', hint: 'Short rests and a bit of cardio at the end' },
  { id: 'mobility', label: 'Mobility', hint: 'Move better and with less stiffness' },
];
export const goalLabel = (g: WorkoutGoal) => t(GOALS.find((x) => x.id === g)?.label ?? g);

export const LEVELS: { id: Level; label: string; hint: string }[] = [
  { id: 'beginner', label: 'Beginner', hint: 'Starting out or coming back' },
  { id: 'intermediate', label: 'Intermediate', hint: 'I train regularly' },
  { id: 'advanced', label: 'Advanced', hint: 'Years of training' },
];
export const levelLabel = (l: Level) => t(LEVELS.find((x) => x.id === l)?.label ?? l);

export const PLACES: { id: TrainingPlace; label: string }[] = [
  { id: 'home', label: 'At home, no equipment' },
  { id: 'home_kit', label: 'At home, with some equipment' },
  { id: 'gym', label: 'At the gym' },
];
export const placeLabel = (p: TrainingPlace) => t(PLACES.find((x) => x.id === p)?.label ?? p);

export const BLOCK_LABEL: Record<WorkoutBlock, string> = {
  warmup: 'Warm-up',
  main: 'Workout',
  finisher: 'Finisher',
  cooldown: 'Cool-down',
};
export const blockLabel = (b: WorkoutBlock) => t(BLOCK_LABEL[b]);
export const BLOCK_ORDER: WorkoutBlock[] = ['warmup', 'main', 'finisher', 'cooldown'];

// Objetivo y días del programa, sin repetir lo que ya dice el nombre ("Ganar fuerza · 3 días")
export function programFacts(p: { title: string; prefs: { goal: WorkoutGoal }; sessions: unknown[] }): string[] {
  const name = t(p.title);
  const out: string[] = [];
  if (!name.includes(goalLabel(p.prefs.goal))) out.push(goalLabel(p.prefs.goal));
  if (!name.includes(t('{n} days', { n: p.sessions.length }))) out.push(tn(p.sessions.length, '{n} day a week', '{n} days a week'));
  return out;
}

// "Cuerpo completo · A"
export const sessionTitle = (s: Pick<WorkoutSession, 'title' | 'id'>) => `${t(s.title)} · ${s.id}`;

// "3 × 10–12 por lado" / "1 × 30 s"
export function doseText(it: Pick<WorkoutExercise, 'sets' | 'reps' | 'exerciseId'>) {
  const ex = getExercise(it.exerciseId);
  const side = ex?.perSide ? ` ${t('per side')}` : '';
  return `${it.sets} × ${it.reps}${side}`;
}

export const restText = (sec: number) => (sec > 0 ? t('rest {s}', { s: sec >= 60 && sec % 60 === 0 ? `${sec / 60} min` : `${sec} s` }) : '');

import { num, t, tn } from '@/i18n';
import { getExercise } from './catalog';
import { plannedSets } from '@/logic/setPlan';
import { isScheduled, sessionsPerWeek } from '@/logic/workoutWeek';
import type { Level, SetLog, TrainingPlace, WorkoutBlock, WorkoutExercise, WorkoutGoal, WorkoutSession } from './types';

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

// Objetivo y días del programa, sin repetir lo que ya dice el nombre ("Ganar fuerza · 3 días"). En los hechos a
// mano no hay objetivo; con días de la semana, cuántos días y cuántas rutinas ("4 días a la semana · 2 rutinas"); sin
// días, cuántas rutinas (van en orden)
export function programFacts(p: { title: string; prefs: { goal: WorkoutGoal; custom?: boolean }; sessions: Pick<WorkoutSession, 'weekdays'>[] }): string[] {
  const name = t(p.title);
  const out: string[] = [];
  const n = p.sessions.length;
  if (!p.prefs.custom && !name.includes(goalLabel(p.prefs.goal))) out.push(goalLabel(p.prefs.goal));
  if (isScheduled(p)) {
    out.push(tn(sessionsPerWeek(p), '{n} day a week', '{n} days a week'));
    if (n > 1) out.push(tn(n, '{n} routine', '{n} routines'));
  } else if (p.prefs.custom) out.push(tn(n, '{n} routine', '{n} routines'));
  else if (!name.includes(t('{n} days', { n }))) out.push(tn(n, '{n} day a week', '{n} days a week'));
  return out;
}

// "Cuerpo completo · A"; una rutina sin nombre, "Rutina A" (hasta el 2026-11-06, "Día A": el día es ahora el de la
// semana)
// (`own`: un programa hecho a mano, cuyos nombres se escribieron tal cual y no se traducen: «Push» no es «Empuje»)
export const sessionName = (s: Pick<WorkoutSession, 'title' | 'id'>, own = false) => (s.title ? (own ? s.title : t(s.title)) : t('Routine {id}', { id: s.id }));
export const sessionTitle = (s: Pick<WorkoutSession, 'title' | 'id'>, own = false) => (s.title ? `${sessionName(s, own)} · ${s.id}` : sessionName(s, own));

export const kgText = (kg: number) => `${num(kg)} kg`;

// "3 × 10–12 por lado" / "1 × 30 s" / "3 × 10 · 20 kg" / serie a serie "4 × 6–7 · 90–100 kg" / lastrado "3 × 8 · +10 kg"
export function doseText(it: Pick<WorkoutExercise, 'sets' | 'reps' | 'exerciseId' | 'weightKg' | 'setPlan'>) {
  const ex = getExercise(it.exerciseId);
  const side = ex?.perSide ? ` ${t('per side')}` : '';
  const kgs = plannedSets(it).flatMap((p) => (p.kg ? [p.kg] : []));
  const lo = Math.min(...kgs);
  const hi = Math.max(...kgs);
  const plus = ex?.load === 'added' ? '+' : '';
  const kg = !kgs.length ? '' : lo === hi ? ` · ${plus}${kgText(lo)}` : ` · ${plus}${num(lo)}–${kgText(hi)}`;
  return `${plannedSets(it).length} × ${it.reps}${side}${kg}`;
}

// Una serie hecha: "20 kg × 10", "× 12" (sin peso), "0:30"
export const setText = (s: Pick<SetLog, 'kg' | 'reps' | 'sec'>) =>
  s.sec !== undefined ? `${Math.floor(s.sec / 60)}:${String(s.sec % 60).padStart(2, '0')}` : `${s.kg ? `${kgText(s.kg)} ` : ''}× ${s.reps ?? '–'}`;

// Lo de la última vez en una línea: "20 kg × 10, 10, 8" si todas con el mismo peso; si no, cada serie
export function setsText(sets: SetLog[]): string {
  if (!sets.length) return '';
  const sameKg = sets.every((s) => s.kg === sets[0].kg && s.sec === undefined);
  if (sameKg) return `${sets[0].kg ? `${kgText(sets[0].kg)} ` : ''}× ${sets.map((s) => s.reps ?? '–').join(', ')}`;
  return sets.map(setText).join(' · ');
}

export const restText = (sec: number) => (sec > 0 ? t('rest {s}', { s: sec >= 60 && sec % 60 === 0 ? `${sec / 60} min` : `${sec} s` }) : '');

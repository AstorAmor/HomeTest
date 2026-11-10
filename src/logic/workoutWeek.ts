import type { WorkoutProgram, WorkoutSession } from '@/data/workouts/types';
import { dateLocale, t } from '@/i18n';

// Un entrenamiento con varias rutinas y cada rutina en uno o varios días de la semana (fundador, 2026-11-06:
// «que puedas crear un entrenamiento con varias rutinas que pueden repetirse varios días cada una»). Los días van en
// `weekdays` de cada rutina (0 = domingo … 6 = sábado, como getDay() y la medicación), dentro del jsonb `sessions`:
// sin migración. Un día es de una sola rutina. Si ninguna rutina tiene días, todo sigue como antes: las rutinas van
// en orden (A, B, C…), una cada vez que se entrena.

export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0]; // de lunes a domingo
const SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
export const weekdayShort = (d: number) => cap(t(SHORT[d] ?? ''));

// Lo guardado, limpio: enteros de 0 a 6, sin repetir y de lunes a domingo
export function normWeekdays(w: unknown): number[] {
  if (!Array.isArray(w)) return [];
  const ok = w.filter((x): x is number => Number.isInteger(x) && x >= 0 && x <= 6);
  return [...new Set(ok)].sort((a, b) => WEEK_ORDER.indexOf(a) - WEEK_ORDER.indexOf(b));
}

export const routineDays = (s: Pick<WorkoutSession, 'weekdays'>) => normWeekdays(s.weekdays);

// "Lun, Jue"
export const daysText = (s: Pick<WorkoutSession, 'weekdays'>) => routineDays(s).map(weekdayShort).join(', ');

export const isScheduled = (p: { sessions: Pick<WorkoutSession, 'weekdays'>[] }) => p.sessions.some((s) => routineDays(s).length > 0);

export const routineOn = <T extends Pick<WorkoutSession, 'weekdays'>>(sessions: T[], wd: number): T | undefined =>
  sessions.find((s) => routineDays(s).includes(wd));

// Poner o quitar un día en una rutina. Si el día era de otra, pasa a esta (un día, una rutina).
export function toggleWeekday<T extends Pick<WorkoutSession, 'weekdays'>>(routines: T[], index: number, wd: number): T[] {
  const had = routineDays(routines[index] ?? {}).includes(wd);
  return routines.map((r, i) => {
    const days = routineDays(r);
    if (i === index) return { ...r, weekdays: normWeekdays(had ? days.filter((d) => d !== wd) : [...days, wd]) };
    return days.includes(wd) && !had ? { ...r, weekdays: days.filter((d) => d !== wd) } : r;
  });
}

// Sesiones a la semana: con días, los días puestos; si no, una por rutina
export const sessionsPerWeek = (p: { sessions: Pick<WorkoutSession, 'weekdays'>[] }) =>
  isScheduled(p) ? p.sessions.reduce((n, s) => n + routineDays(s).length, 0) : p.sessions.length;

const sameDay = (iso: string, d: Date) => {
  const x = new Date(iso);
  return x.getFullYear() === d.getFullYear() && x.getMonth() === d.getMonth() && x.getDate() === d.getDate();
};

// Lo que toca. Con días: la rutina de hoy si hoy aún no has entrenado; si no, la del siguiente día con rutina
// (`inDays`: 0 hoy, 1 mañana…). Sin días: la siguiente en orden después de la última hecha (`inDays` null).
export function nextUp(p: Pick<WorkoutProgram, 'sessions' | 'completions'>, now = new Date()): { id: string; inDays: number | null } | null {
  if (!p.sessions.length) return null;
  if (isScheduled(p)) {
    const trainedToday = p.completions.some((c) => sameDay(c.at, now));
    for (let k = 0; k <= 7; k++) {
      if (k === 0 && trainedToday) continue;
      const s = routineOn(p.sessions, (now.getDay() + k) % 7);
      if (s) return { id: s.id, inDays: k };
    }
  }
  const last = [...p.completions].sort((a, b) => b.at.localeCompare(a.at))[0];
  const i = last ? p.sessions.findIndex((s) => s.id === last.sessionId) : -1;
  return { id: p.sessions[(i + 1) % p.sessions.length].id, inDays: null };
}

// "Hoy", "Mañana", "El jueves" (o "Siguiente sesión", sin días)
export function whenText(inDays: number | null, now = new Date()): string {
  if (inDays === null) return t('Next session');
  if (inDays === 0) return t('Today');
  if (inDays === 1) return t('Tomorrow');
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + inDays, 12);
  return t('On {day}', { day: d.toLocaleDateString(dateLocale(), { weekday: 'long' }) });
}

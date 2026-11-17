// Cada objetivo, su métrica (fundador, 2026-11-16: «cada objetivo tiene que abrir su propia pantalla, unida a una
// métrica concreta»). Especificación: borradores/app-estructura/ESPECIFICACION.md §7 «Objetivo» y la tabla
// objetivo → medida de la octava vuelta de la propuesta. Lógica pura, sin React ni almacenamiento (tests en
// src/logic/__tests__/goalMetrics.test.ts): qué se mide en cada objetivo, la media de los últimos 14 días y la de
// los 14 de antes, el ánimo que más se repite, lo que va por semana y la escala de la línea de rango de un
// biomarcador. La pantalla está en src/screens/GoalDetailScreen.tsx.
// - La app no guarda cuándo elegiste cada objetivo (MetasState solo tiene la lista): por eso la cifra de ahora se
//   compara con la de «los 14 días de antes» y no con «cuando lo elegiste». No se inventan datos.
// - Nunca un porcentaje de avance ni qué meta lo mueve (ESPECIFICACION.md, regla 5).
import type { CheckInEntry, Mood } from '@/types/checkIn';
import { checkInDayKey } from './checkInDay';
import { addDays, dayKeyOf, type GoalKey, type LabReading } from './metas';

export const GOAL_DAYS = 14;

// Lo que se mide en cada objetivo, en el orden en que sale
export type GoalMetric =
  | 'lab' // el biomarcador del análisis que lo recomienda
  | 'sleepHours' // horas de sueño del reloj
  | 'sleepCheckIn' // «¿Qué tal has dormido?», del check-in de la mañana
  | 'energy'
  | 'mood'
  | 'stress'
  | 'hrv' // VFC del reloj
  | 'weight'
  | 'steps'
  | 'workouts'
  | 'vo2max'
  | 'tobacco' // cigarrillos (la meta de tabaco)
  | 'smokeFree' // días sin fumar (la meta de sí o no)
  | 'alcohol' // bebidas (la meta de alcohol)
  | 'kuovaAge';

export const GOAL_METRICS: Record<GoalKey, GoalMetric[]> = {
  ldl: ['lab'],
  tg: ['lab'],
  glucosa: ['lab'],
  hdl: ['lab'],
  sueno: ['sleepHours', 'sleepCheckIn'],
  energia: ['energy'],
  animo: ['mood'],
  estres: ['stress', 'hrv'],
  peso: ['weight'],
  forma: ['steps', 'workouts', 'vo2max'],
  tabaco: ['tobacco', 'smokeFree'],
  alcohol: ['alcohol'],
  salud: ['kuovaAge'],
  longev: ['kuovaAge', 'vo2max'],
};

// Las que solo salen si hay datos: el reloj (sueño, VFC), una prueba que no todo el mundo se hace (VO2max) o
// una meta que no todo el mundo lleva (días sin fumar)
const ONLY_WITH_DATA: GoalMetric[] = ['sleepHours', 'hrv', 'vo2max', 'smokeFree'];

// Lo que se enseña de un objetivo según lo que tiene datos. El resto sale siempre (con «—» si no hay nada). En
// «Dejar de fumar», si solo apuntas los días sin fumar, no sale la de cigarrillos vacía.
export function visibleMetrics(goal: GoalKey, has: Partial<Record<GoalMetric, boolean>>): GoalMetric[] {
  return GOAL_METRICS[goal].filter((m) => {
    if (ONLY_WITH_DATA.includes(m)) return !!has[m];
    if (m === 'tobacco') return !!has.tobacco || !has.smokeFree;
    return true;
  });
}

// Día (YYYY-MM-DD) → valor
export type ByDay = Record<string, number>;

// Los `n` días que acaban en `today` (el último es hoy) y los `n` de antes
export const windowDays = (today: string, n = GOAL_DAYS) => Array.from({ length: n }, (_, i) => addDays(today, i - n + 1));
export const daysBefore = (today: string, n = GOAL_DAYS) => windowDays(addDays(today, -n), n);

export function mean(xs: (number | null | undefined)[]): number | null {
  const v = xs.filter((x): x is number => typeof x === 'number' && Number.isFinite(x));
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}
export const round1 = (x: number) => Math.round(x * 10) / 10;

export interface GoalWindow {
  values: (number | null)[]; // los 14 días, del más antiguo a hoy (null: sin dato)
  now: number | null; // la de ahora (null: nada en esos días)
  before: number | null; // la de los 14 días de antes
}

// La media de los días con dato (un día sin dato no cuenta como 0)
export function windowOf(byDay: ByDay, today: string, n = GOAL_DAYS): GoalWindow {
  const values = windowDays(today, n).map((d) => byDay[d] ?? null);
  return { values, now: mean(values), before: mean(daysBefore(today, n).map((d) => byDay[d])) };
}

// Lo que se cuenta por semana (entrenamientos, bebidas a la semana): lo de los 14 días entre 2. Un día sin
// apuntar cuenta como 0; si no hay nada en todo el periodo, null.
export function weeklyOf(byDay: ByDay, today: string, n = GOAL_DAYS): GoalWindow {
  const perWeek = (days: string[]) => {
    const xs = days.map((d) => byDay[d]).filter((x): x is number => typeof x === 'number');
    return xs.length ? (xs.reduce((a, b) => a + b, 0) * 7) / n : null;
  };
  return { values: windowDays(today, n).map((d) => byDay[d] ?? null), now: perWeek(windowDays(today, n)), before: perWeek(daysBefore(today, n)) };
}

// ¿Hay algo en los 14 días o en los 14 de antes?
export const hasAny = (byDay: ByDay, today: string, n = GOAL_DAYS) => [...daysBefore(today, n), ...windowDays(today, n)].some((d) => byDay[d] != null);

// Un valor del check-in (1 a 5) por día: la media de los check-ins de ese día que lo traen. El sueño solo se
// pregunta por la mañana, y el estrés a mitad del día.
export type CheckInField = 'energy' | 'stress' | 'sleep';
export function checkInByDay(entries: Pick<CheckInEntry, 'fecha' | 'moment' | CheckInField>[], field: CheckInField): ByDay {
  const acc: Record<string, number[]> = {};
  for (const e of entries) {
    const v = e[field];
    if (typeof v === 'number') (acc[checkInDayKey(e)] ??= []).push(v);
  }
  return Object.fromEntries(Object.entries(acc).map(([d, xs]) => [d, mean(xs)!]));
}

// Lo del reloj ({ date, value }) por día, en otra escala si hace falta (el sueño llega en minutos)
export function pointsByDay(points: { date: string; value: number }[] | undefined, scale = 1): ByDay {
  const out: ByDay = {};
  for (const p of points ?? []) if (Number.isFinite(p.value)) out[p.date] = p.value * scale;
  return out;
}

// Lo apuntado a mano con su hora (el peso): lo último de cada día
export function entriesByDay(entries: { fecha: string; valor: number }[]): ByDay {
  const out: ByDay = {};
  for (const e of [...entries].sort((a, b) => a.fecha.localeCompare(b.fecha))) if (Number.isFinite(e.valor)) out[dayKeyOf(new Date(e.fecha))] = e.valor;
  return out;
}

// Cuántos hay cada día (entrenamientos)
export function countByDay(items: { fecha: string }[]): ByDay {
  const out: ByDay = {};
  for (const x of items) {
    const d = dayKeyOf(new Date(x.fecha));
    out[d] = (out[d] ?? 0) + 1;
  }
  return out;
}

// El que más se repite (con empate, el más reciente). Sirve para un día y para los 14.
export function topMood(moods: (Mood | null | undefined)[]): Mood | null {
  const n = new Map<Mood, number>();
  const last = new Map<Mood, number>();
  moods.forEach((m, i) => {
    if (!m) return;
    n.set(m, (n.get(m) ?? 0) + 1);
    last.set(m, i);
  });
  let best: Mood | null = null;
  for (const [m, k] of n) {
    const b = best ? n.get(best)! : 0;
    if (k > b || (k === b && last.get(m)! > last.get(best!)!)) best = m;
  }
  return best;
}

// El ánimo de cada día: el que más se repite en sus check-ins (con empate, el último)
export function moodByDay(entries: Pick<CheckInEntry, 'fecha' | 'moment' | 'mood'>[]): Record<string, Mood> {
  const acc: Record<string, Mood[]> = {};
  for (const e of [...entries].sort((a, b) => a.fecha.localeCompare(b.fecha))) if (e.mood) (acc[checkInDayKey(e)] ??= []).push(e.mood);
  return Object.fromEntries(Object.entries(acc).map(([d, ms]) => [d, topMood(ms)!]));
}

// Los 14 días de ánimo, el que más se repite en ellos y en los 14 de antes
export function moodWindow(byDay: Record<string, Mood>, today: string, n = GOAL_DAYS) {
  const days = windowDays(today, n).map((d) => byDay[d] ?? null);
  return { days, now: topMood(days), before: topMood(daysBefore(today, n).map((d) => byDay[d])) };
}

// ===== Objetivos del análisis =====
// El marcador que recomienda cada uno (como labGoals en metas.ts). En la glucosa, la glucosa o la HbA1c que esté
// por encima del rango del laboratorio; si ninguna, la glucosa.
const LAB_MARKERS: Partial<Record<GoalKey, string[]>> = { ldl: ['ldl'], tg: ['triglycerides'], glucosa: ['glucose', 'hba1c'], hdl: ['hdl'] };
export function labReadingFor(goal: GoalKey, readings: LabReading[]): LabReading | null {
  const found = (LAB_MARKERS[goal] ?? []).map((id) => readings.find((r) => r.marker === id)).filter((r): r is LabReading => !!r);
  if (goal === 'glucosa') return found.find((r) => r.high != null && r.value > r.high) ?? found[0] ?? null;
  return found[0] ?? null;
}

// La escala de la línea de rango (FineGauge): la franja del laboratorio con margen a cada lado, y siempre con sitio
// para el punto de tu valor. Un mínimo de 0 cuenta como sin mínimo («menos de 130»).
export function rangeScale(value: number, low: number | null, high: number | null): { min: number; max: number; range: [number, number] | null } {
  const lo = low != null && low > 0 ? low : null;
  const hi = high;
  let min: number;
  let max: number;
  if (lo != null && hi != null && hi > lo) {
    const span = hi - lo;
    min = lo - span * 0.6;
    max = hi + span * 0.6;
  } else if (hi != null && hi > 0) {
    min = 0;
    max = hi * 1.6;
  } else if (lo != null) {
    min = 0;
    max = lo * 2;
  } else {
    min = 0;
    max = Math.abs(value) * 2 || 1;
  }
  const pad = (max - min) * 0.1;
  if (value > max - pad) max = value + pad;
  if (value < min + pad) min = value - pad;
  if (value >= 0) min = Math.max(0, min);
  const range: [number, number] | null = lo == null && (hi == null || hi <= 0) ? null : [lo ?? min, hi != null && hi > 0 ? hi : max];
  return { min, max, range };
}

// 425 minutos → «7 h 05»
export function hoursText(minutes: number): string {
  const m = Math.round(minutes);
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}`;
}

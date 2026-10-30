// Lo que el plan mira de tus últimas semanas para decirte dónde estás de verdad, en lugar de dar
// consejos genéricos: pasos y sueño del reloj (14 días), cuánto varían tus horas de acostarte y de
// levantarte, los entrenos de fuerza y las sesiones de calma que has registrado (4 semanas), el
// estrés que marcas en los check-ins y el azúcar añadido de las comidas que apuntas (14 días).
// Lógica pura (tests en src/logic/__tests__/planAndHydration.test.ts).
import { DailySeries, localDayKey, sleepNights } from '@/wearables/seriesLogic';

const DAY = 86400000;

// Cuánto hace falta para fiarse de una media: con menos, el plan sigue con tus respuestas
export const HABIT_WINDOW = { days: 14, weeks: 4, minDays: 7, minNights: 5, minCheckIns: 3, minMeals: 5 };

export interface SleepTiming {
  sd: number; // desviación típica entre noches, en minutos
  mean: number; // hora media en minutos desde la medianoche del día en que te despiertas (negativo = la víspera)
  weekday: number | null; // media de las noches en que te despiertas de lunes a viernes
  weekend: number | null; // y de las que te despiertas en sábado o domingo
  nights: number;
}

export interface LoggedPerWeek {
  count: number; // registradas en la ventana
  weeks: number; // semanas de la ventana (de 1 a 4: menos si empezaste a registrar hace poco)
  perWeek: number;
}

export interface PlanHabits {
  steps?: { avg: number; days: number; weekday: number | null; weekend: number | null };
  sleep?: { avg: number; nights: number; bed: SleepTiming | null; wake: SleepTiming | null };
  strength?: LoggedPerWeek & { lastDaysAgo: number | null };
  calm?: LoggedPerWeek;
  stress?: { high: number; of: number }; // check-ins con estrés alto (4-5 de 5, o ánimo estresado o ansioso)
  meals?: { logged: number; sugar: number }; // comidas con el azúcar añadido marcado, y cuántas lo llevaban
}

export interface HabitLogs {
  workouts: { fecha: string; type: string }[];
  calm: { fecha: string }[];
  checkIns: { fecha: string; stress?: number; mood?: string }[];
  meals: { fecha: string; addedSugar: boolean | null }[];
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const sd = (xs: number[]) => {
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / (xs.length - 1));
};
// Fin de semana = el día (de los pasos, o en que te despiertas) es sábado o domingo
const isWeekend = (date: string) => [0, 6].includes(new Date(`${date}T12:00:00`).getDay());
const split = <T extends { date: string }>(xs: T[], value: (x: T) => number, minWeekday = 3, minWeekend = 2) => {
  const wd = xs.filter((x) => !isWeekend(x.date)).map(value);
  const we = xs.filter((x) => isWeekend(x.date)).map(value);
  return { weekday: wd.length >= minWeekday ? mean(wd) : null, weekend: we.length >= minWeekend ? mean(we) : null };
};

function timing(nights: { date: string; at: number | null }[]): SleepTiming | null {
  const ok = nights.filter((n): n is { date: string; at: number } => n.at != null);
  if (ok.length < HABIT_WINDOW.minNights) return null;
  const at = ok.map((n) => n.at);
  return { sd: sd(at), mean: mean(at), ...split(ok, (n) => n.at), nights: ok.length };
}

const timesUpTo = (list: { fecha: string }[], now: Date) =>
  list.map((e) => new Date(e.fecha).getTime()).filter((x) => Number.isFinite(x) && x <= now.getTime());

// Cuántas a la semana en las últimas 4 semanas (menos si empezó a registrar hace poco). Solo si
// alguna vez ha registrado algo en `all` (cualquier entreno, cualquier sesión): sin ningún registro
// no sabemos si lo hace por su cuenta.
function perWeek(all: { fecha: string }[], hits: { fecha: string }[], now: Date): LoggedPerWeek | undefined {
  const times = timesUpTo(all, now);
  if (!times.length) return undefined;
  const sinceFirst = (now.getTime() - Math.min(...times)) / DAY;
  const weeks = Math.min(HABIT_WINDOW.weeks, Math.max(1, Math.ceil(sinceFirst / 7)));
  const from = now.getTime() - weeks * 7 * DAY;
  const count = timesUpTo(hits, now).filter((x) => x > from).length;
  return { count, weeks, perWeek: count / weeks };
}

export function planHabits(series: DailySeries, logs: HabitLogs, now = new Date()): PlanHabits {
  const out: PlanHabits = {};
  const today = localDayKey(now);
  const since = localDayKey(new Date(now.getTime() - HABIT_WINDOW.days * DAY));

  // Pasos: los 14 días anteriores a hoy (hoy no cuenta: el día no ha terminado)
  const steps = (series.steps ?? []).filter((p) => p.date >= since && p.date < today && p.value > 0);
  if (steps.length >= HABIT_WINDOW.minDays)
    out.steps = { avg: mean(steps.map((p) => p.value)), days: steps.length, ...split(steps, (p) => p.value) };

  // Sueño: las 14 últimas noches, la de hoy incluida (es la de anoche)
  const nights = sleepNights(series).filter((n) => n.date > since && n.date <= today && n.asleep > 0);
  if (nights.length >= HABIT_WINDOW.minNights)
    out.sleep = {
      avg: mean(nights.map((n) => n.asleep)),
      nights: nights.length,
      bed: timing(nights.map((n) => ({ date: n.date, at: n.start }))),
      wake: timing(nights.map((n) => ({ date: n.date, at: n.end }))),
    };

  const strengthLogs = logs.workouts.filter((w) => w.type === 'strength');
  const strength = perWeek(logs.workouts, strengthLogs, now);
  if (strength) {
    const last = timesUpTo(strengthLogs, now).sort((a, b) => b - a)[0];
    out.strength = { ...strength, lastDaysAgo: last != null ? Math.floor((now.getTime() - last) / DAY) : null };
  }
  const calm = perWeek(logs.calm, logs.calm, now);
  if (calm) out.calm = calm;

  const recent = (fecha: string) => {
    const x = new Date(fecha).getTime();
    return x > now.getTime() - HABIT_WINDOW.days * DAY && x <= now.getTime();
  };
  const felt = logs.checkIns.filter((c) => recent(c.fecha) && (c.stress != null || c.mood != null));
  if (felt.length >= HABIT_WINDOW.minCheckIns)
    out.stress = {
      high: felt.filter((c) => (c.stress ?? 0) >= 4 || c.mood === 'stressed' || c.mood === 'anxious').length,
      of: felt.length,
    };

  const meals = logs.meals.filter((m) => recent(m.fecha) && m.addedSugar != null);
  if (meals.length >= HABIT_WINDOW.minMeals) out.meals = { logged: meals.length, sugar: meals.filter((m) => m.addedSugar).length };

  return out;
}

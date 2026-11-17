import { dateLocale, num, t } from '@/i18n';
// Logros (gamificación). Cada logro es UNA insignia con niveles (bronce → diamante),
// no una insignia nueva por cada hito, para no repetirlas. Se calculan a partir de
// los datos del usuario cada vez; no hace falta guardarlos.

export type TierName = 'Bronze' | 'Silver' | 'Gold' | 'Platinum' | 'Diamond';

export const TIER_COLORS: Record<TierName, string> = {
  Bronze: '#CD7F32',
  Silver: '#C9CED6',
  Gold: '#F0B84D',
  Platinum: '#7FD6CF',
  Diamond: '#A5C8FF',
};

// Degradado de la medalla a pantalla completa: sombra → color → brillo
export const TIER_GRADIENTS: Record<TierName, [string, string, string]> = {
  Bronze: ['#7A3E16', '#CD7F32', '#F5BE8A'],
  Silver: ['#7D858F', '#C9CED6', '#F7F9FB'],
  Gold: ['#9C6A12', '#F0B84D', '#FFEAB0'],
  Platinum: ['#2F8C86', '#7FD6CF', '#E3FBF8'],
  Diamond: ['#4C63E8', '#A5C8FF', '#F3F8FF'],
};

export const TIER_NAMES: TierName[] = ['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond'];

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string; // Ionicons
  value: number;
  unit: string;
  thresholds: number[]; // uno por nivel (vacío salvo el primero = logro único)
  level: number; // 0 = aún no conseguido
  tier: TierName | null;
  nextThreshold: number | null;
  progressToNext: number; // 0..1
  // El día (YYYY-MM-DD) en que se llegó a cada nivel conseguido, en orden; null si no se puede saber. En las rachas,
  // dentro de la racha de ahora (si se corta, el nivel baja y la fecha con él). Lo enseña la insignia en grande.
  reachedOn?: (string | null)[];
}

export interface AchievementInput {
  dailySteps: { date: string; value: number }[]; // YYYY-MM-DD
  workouts: { fecha: string; type: string }[];
  meals: { fecha: string }[];
  checkIns: { fecha: string }[];
  mindful: { fecha: string }[];
  badges: string[]; // insignias guardadas en el perfil (ninguna en uso ahora mismo)
  stepGoal?: number;
}

const DAY = 24 * 3600 * 1000;
const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const localDay = (iso: string) => dayKey(new Date(iso));

const daysBefore = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() - n);
  return x;
};

type Run = { streak: number; last: Date };

// Días seguidos que cumplen la condición, terminando hoy (o ayer si hoy aún no se cumple), y el último de ellos.
function dayStreak(days: Set<string>, today = new Date()): Run {
  let cursor = new Date(today);
  if (!days.has(dayKey(cursor))) cursor = new Date(cursor.getTime() - DAY);
  const last = new Date(cursor);
  let streak = 0;
  while (days.has(dayKey(cursor))) {
    streak++;
    cursor = new Date(cursor.getTime() - DAY);
  }
  return { streak, last };
}

// El día en que la racha de ahora llegó a `n` días: el último menos los que vinieron después
const dayReached = (run: Run) => (n: number) => (n <= run.streak ? dayKey(daysBefore(run.last, run.streak - n)) : null);

// El día del registro número `n` (comidas, sesiones de respiración)
const nthDay = (fechas: string[]) => {
  const days = fechas.map(localDay).sort();
  return (n: number) => days[n - 1] ?? null;
};

// El día en que la suma de pasos llegó a `n`
const stepsReached = (points: { date: string; value: number }[]) => {
  const sorted = [...points].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return (n: number) => {
    let sum = 0;
    for (const p of sorted) {
      sum += p.value;
      if (sum >= n) return p.date;
    }
    return null;
  };
};

const weekStart = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
};

// Semanas seguidas con al menos `min` entrenos de fuerza (la actual cuenta si ya se cumple), y cuándo se llegó a
// cada número de semanas: el día del entreno número `min` de esa semana.
function strengthWeekStreak(workouts: { fecha: string; type: string }[], min = 3, today = new Date()) {
  const perWeek = new Map<string, string[]>();
  for (const w of workouts) {
    if (w.type !== 'strength') continue;
    const k = dayKey(weekStart(new Date(w.fecha)));
    perWeek.set(k, [...(perWeek.get(k) ?? []), localDay(w.fecha)]);
  }
  const count = (d: Date) => perWeek.get(dayKey(d))?.length ?? 0;
  let cursor = weekStart(today);
  if (count(cursor) < min) cursor = new Date(cursor.getTime() - 7 * DAY);
  const last = new Date(cursor);
  let streak = 0;
  while (count(cursor) >= min) {
    streak++;
    cursor = new Date(cursor.getTime() - 7 * DAY);
  }
  const reached = (n: number) => {
    if (n > streak) return null;
    const week = perWeek.get(dayKey(weekStart(daysBefore(last, (streak - n) * 7))));
    return week ? ([...week].sort()[min - 1] ?? null) : null;
  };
  return { streak, reached };
}

function build(
  id: string,
  title: string,
  description: string,
  icon: string,
  value: number,
  unit: string,
  thresholds: number[],
  reached?: (threshold: number) => string | null
): Achievement {
  const level = thresholds.filter((t) => value >= t).length;
  const next = thresholds[level] ?? null;
  const prev = level > 0 ? thresholds[level - 1] : 0;
  return {
    id,
    title,
    description,
    icon,
    value,
    unit,
    thresholds,
    level,
    tier: level > 0 ? TIER_NAMES[Math.min(level, TIER_NAMES.length) - 1] : null,
    nextThreshold: next,
    progressToNext: next ? Math.max(0, Math.min(1, (value - prev) / (next - prev))) : 1,
    reachedOn: thresholds.slice(0, level).map((th) => reached?.(th) ?? null),
  };
}

export function computeAchievements(input: AchievementInput): Achievement[] {
  const goal = input.stepGoal ?? 8000;
  const totalSteps = input.dailySteps.reduce((a, p) => a + p.value, 0);
  const stepDays = new Set(input.dailySteps.filter((p) => p.value >= goal).map((p) => p.date));

  // "Plan del día cumplido": objetivo de pasos + al menos una acción registrada ese día
  const actionDays = new Set([
    ...input.workouts.map((w) => localDay(w.fecha)),
    ...input.meals.map((m) => localDay(m.fecha)),
    ...input.checkIns.map((c) => localDay(c.fecha)),
    ...input.mindful.map((m) => localDay(m.fecha)),
  ]);
  const planDays = new Set([...stepDays].filter((d) => actionDays.has(d)));

  const moving = dayStreak(stepDays);
  const plan = dayStreak(planDays);
  const strength = strengthWeekStreak(input.workouts);
  const aware = dayStreak(new Set(input.checkIns.map((c) => localDay(c.fecha))));
  const list = [
    build('step_collector', t('Step collector'), t('Total steps walked'), 'footsteps', totalSteps, 'steps', [100000, 250000, 500000, 1000000, 2500000], stepsReached(input.dailySteps)),
    build('daily_mover', t('Daily mover'), t('Days in a row with {n}+ steps', { n: goal.toLocaleString(dateLocale()) }), 'walk', moving.streak, 'days', [3, 7, 14, 30, 100], dayReached(moving)),
    build('plan_champion', t('Plan champion'), t('Days in a row meeting your daily plan'), 'trophy', plan.streak, 'days', [3, 7, 14, 30, 100], dayReached(plan)),
    build('strength_streak', t('Strength streak'), t('Weeks in a row with 3 strength sessions'), 'barbell', strength.streak, 'weeks', [1, 4, 8, 12, 26], strength.reached),
    build('self_aware', t('Self-aware'), t('Days in a row with a check-in'), 'happy', aware.streak, 'days', [3, 7, 14, 30, 100], dayReached(aware)),
    build('food_logger', t('Food logger'), t('Meals logged'), 'restaurant', input.meals.length, 'meals', [5, 20, 50, 100, 250], nthDay(input.meals.map((m) => m.fecha))),
    build('calm_mind', t('Calm mind'), t('Breathing and relaxation sessions'), 'leaf', input.mindful.length, 'sessions', [1, 5, 15, 30, 60], nthDay(input.mindful.map((m) => m.fecha))),
  ];

  // Conseguidos primero (mayor nivel antes), luego los más cerca de conseguirse
  return list.sort((a, b) => b.level - a.level || b.progressToNext - a.progressToNext);
}

// El día de un nivel, entero y sobrio: «12 de noviembre de 2026» (`short`: «12 nov 2026», para las filas)
export const formatReachedDay = (key: string, short?: boolean) =>
  new Date(`${key}T12:00:00`).toLocaleDateString(dateLocale(), { day: 'numeric', month: short ? 'short' : 'long', year: 'numeric' });

// De qué parte de tu salud es cada insignia (el antetítulo «INSIGNIA · MOVIMIENTO» de la insignia en grande)
const CATEGORY: Record<string, string> = {
  step_collector: 'Movement',
  daily_mover: 'Movement',
  plan_champion: 'Your plan',
  strength_streak: 'Strength',
  self_aware: 'Check-in',
  food_logger: 'Nutrition',
  calm_mind: 'Breathing and relaxation',
};
export const achievementCategory = (a: Achievement) => (CATEGORY[a.id] ? t(CATEGORY[a.id]) : null);

// En singular cuando es uno («1 día», no «1 días»)
const ONE: Record<string, string> = { steps: 'step', days: 'day', weeks: 'week', meals: 'meal', sessions: 'session' };
const unitWord = (unit: string, v: number) => t(v === 1 ? (ONE[unit] ?? unit) : unit);

// Los pasos, abreviados: «250k pasos», «1 M pasos», «2,5 M pasos»
const stepsShort = (v: number) => (v >= 1e6 ? `${num(Math.round(v / 1e5) / 10)} M` : v >= 1000 ? `${Math.round(v / 1000)}k` : String(v));

export const formatAchievementValue = (a: Achievement, v: number) =>
  a.unit === 'steps' ? `${stepsShort(v)} ${unitWord('steps', v)}` : `${v} ${a.unit ? unitWord(a.unit, v) : ''}`.trim();

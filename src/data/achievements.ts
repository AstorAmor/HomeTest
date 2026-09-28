// Logros (gamificación). Cada logro es UNA insignia con niveles (bronce → platino),
// no una insignia nueva por cada hito, para no repetirlas. Se calculan a partir de
// los datos del usuario cada vez; no hace falta guardarlos.

export type TierName = 'Bronze' | 'Silver' | 'Gold' | 'Platinum';

export const TIER_COLORS: Record<TierName, string> = {
  Bronze: '#CD7F32',
  Silver: '#C9CED6',
  Gold: '#F0B84D',
  Platinum: '#9B8CFF',
};

const TIER_NAMES: TierName[] = ['Bronze', 'Silver', 'Gold', 'Platinum'];

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
}

export interface AchievementInput {
  dailySteps: { date: string; value: number }[]; // YYYY-MM-DD
  workouts: { fecha: string; type: string }[];
  meals: { fecha: string }[];
  checkIns: { fecha: string }[];
  mindful: { fecha: string }[];
  badges: string[]; // insignias guardadas en el perfil (p. ej. plan_builder)
  stepGoal?: number;
}

const DAY = 24 * 3600 * 1000;
const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const localDay = (iso: string) => dayKey(new Date(iso));

// Días seguidos que cumplen la condición, terminando hoy (o ayer si hoy aún no se cumple).
function dayStreak(days: Set<string>, today = new Date()): number {
  let cursor = new Date(today);
  if (!days.has(dayKey(cursor))) cursor = new Date(cursor.getTime() - DAY);
  let streak = 0;
  while (days.has(dayKey(cursor))) {
    streak++;
    cursor = new Date(cursor.getTime() - DAY);
  }
  return streak;
}

const weekStart = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
};

// Semanas seguidas con al menos `min` entrenos de fuerza (la actual cuenta si ya se cumple).
function strengthWeekStreak(workouts: { fecha: string; type: string }[], min = 3, today = new Date()): number {
  const perWeek = new Map<string, number>();
  for (const w of workouts) {
    if (w.type !== 'strength') continue;
    const k = dayKey(weekStart(new Date(w.fecha)));
    perWeek.set(k, (perWeek.get(k) ?? 0) + 1);
  }
  let cursor = weekStart(today);
  if ((perWeek.get(dayKey(cursor)) ?? 0) < min) cursor = new Date(cursor.getTime() - 7 * DAY);
  let streak = 0;
  while ((perWeek.get(dayKey(cursor)) ?? 0) >= min) {
    streak++;
    cursor = new Date(cursor.getTime() - 7 * DAY);
  }
  return streak;
}

function build(
  id: string,
  title: string,
  description: string,
  icon: string,
  value: number,
  unit: string,
  thresholds: number[]
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
    tier: level > 0 ? TIER_NAMES[Math.min(level, 4) - 1] : null,
    nextThreshold: next,
    progressToNext: next ? Math.max(0, Math.min(1, (value - prev) / (next - prev))) : 1,
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

  const list = [
    build('plan_builder', 'Plan builder', 'You created your personalised plan', 'ribbon', input.badges.includes('plan_builder') ? 1 : 0, '', [1]),
    build('step_collector', 'Step collector', 'Total steps walked', 'footsteps', totalSteps, 'steps', [100000, 250000, 500000, 1000000]),
    build('daily_mover', 'Daily mover', `Days in a row with ${goal.toLocaleString('en-GB')}+ steps`, 'walk', dayStreak(stepDays), 'days', [3, 7, 14, 30]),
    build('plan_champion', 'Plan champion', 'Days in a row meeting your daily plan', 'trophy', dayStreak(planDays), 'days', [3, 7, 14, 30]),
    build('strength_streak', 'Strength streak', 'Weeks in a row with 3 strength sessions', 'barbell', strengthWeekStreak(input.workouts), 'weeks', [1, 4, 8, 12]),
    build('self_aware', 'Self-aware', 'Days in a row with a check-in', 'happy', dayStreak(new Set(input.checkIns.map((c) => localDay(c.fecha)))), 'days', [3, 7, 14, 30]),
    build('food_logger', 'Food logger', 'Meals logged', 'restaurant', input.meals.length, 'meals', [5, 20, 50, 100]),
    build('calm_mind', 'Calm mind', 'Breathing and relaxation sessions', 'leaf', input.mindful.length, 'sessions', [1, 5, 15, 30]),
  ];

  // Conseguidos primero (mayor nivel antes), luego los más cerca de conseguirse
  return list.sort((a, b) => b.level - a.level || b.progressToNext - a.progressToNext);
}

export const formatAchievementValue = (a: Achievement, v: number) =>
  a.unit === 'steps' ? `${v >= 1000 ? `${Math.round(v / 1000)}k` : v} steps` : `${v} ${a.unit}`.trim();

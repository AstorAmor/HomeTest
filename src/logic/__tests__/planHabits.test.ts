import { describe, expect, it } from 'vitest';
import { buildPlan, planKept, PlanProfile } from '@/logic/plan';
import { HabitLogs, planHabits } from '@/logic/planHabits';
import { DailySeries, localDayKey } from '@/wearables/seriesLogic';

// Con datos, cada acción dice dónde estás frente a lo recomendable y lo que ya cumples sale del plan
// (fundador, 2026-10-30: «quiero que se note personalizado de verdad»). Hoy es viernes 30/10/2026.
const NOW = new Date('2026-10-30T10:00:00');
const DAY = 86400000;
const dayKey = (n: number) => localDayKey(new Date(NOW.getTime() - n * DAY));
const iso = (n: number) => new Date(NOW.getTime() - n * DAY).toISOString();
const noLogs: HabitLogs = { workouts: [], calm: [], checkIns: [], meals: [] };

// 14 días de pasos (los anteriores a hoy) y 14 noches (la de hoy incluida)
const watch = (opts: { steps?: (n: number) => number; asleep?: (n: number) => number; bed?: (n: number) => number }): DailySeries => {
  const s: DailySeries = { steps: [], sleep_duration: [], sleep_start: [], sleep_end: [] };
  for (let n = 14; n >= 0; n--) {
    if (opts.steps && n >= 1) s.steps!.push({ date: dayKey(n), value: opts.steps(n) });
    if (opts.asleep && n <= 13) {
      const asleep = opts.asleep(n);
      const bed = opts.bed ? opts.bed(n) : -60;
      s.sleep_duration!.push({ date: dayKey(n), value: asleep });
      s.sleep_start!.push({ date: dayKey(n), value: bed });
      s.sleep_end!.push({ date: dayKey(n), value: bed + asleep + 15 });
    }
  }
  return s;
};

const plan = (profile: PlanProfile, series: DailySeries, logs: HabitLogs = noLogs) => {
  const habits = planHabits(series, logs, NOW);
  return { items: buildPlan(profile, habits), kept: planKept(profile, habits) };
};

describe('lo que el plan mira de tus semanas', () => {
  it('pasos: media de los 14 días anteriores (hoy no cuenta) y el bache del fin de semana', () => {
    const series = watch({ steps: (n) => ([0, 6].includes(new Date(NOW.getTime() - n * DAY).getDay()) ? 4000 : 9000) });
    series.steps!.push({ date: dayKey(0), value: 50 }); // hoy, a medias
    const h = planHabits(series, noLogs, NOW);
    expect(h.steps?.days).toBe(14);
    expect(h.steps?.weekend).toBe(4000);
    expect(h.steps?.weekday).toBe(9000);
  });

  it('sin datos suficientes (menos de 7 días, 5 noches), nada: el plan sigue con tus respuestas', () => {
    const s = watch({ steps: () => 5000, asleep: () => 400 });
    const h = planHabits({ steps: s.steps!.slice(-6), sleep_duration: s.sleep_duration!.slice(-4) }, noLogs, NOW);
    expect(h.steps).toBeUndefined();
    expect(h.sleep).toBeUndefined();
  });

  it('entrenos: por semana en las últimas 4, solo si alguna vez ha registrado alguno', () => {
    expect(planHabits({}, noLogs, NOW).strength).toBeUndefined();
    const logs = { ...noLogs, workouts: [2, 9, 16, 23].map((n) => ({ fecha: iso(n), type: 'strength' })) };
    expect(planHabits({}, logs, NOW).strength).toMatchObject({ count: 4, weeks: 4, perWeek: 1, lastDaysAgo: 2 });
  });
});

describe('sueño regular: solo si de verdad varía', () => {
  it('se acuesta unas noches a las 23:00 y otras a la 01:00 (±60 min): «Acuéstate a la misma hora», con su variación', () => {
    const { items } = plan({ sleep: '7to8' }, watch({ asleep: () => 450, bed: (n) => (n % 2 ? -60 : 60) }));
    const sleep = items.find((i) => i.kind === 'sleep');
    expect(sleep?.title).toBe('Go to bed at the same time every night');
    expect(sleep?.detail).toMatch(/^Your bedtime varies ±6\d min from night to night \(last 14 nights\); the aim is under ±30 min\.$/);
    expect(sleep?.why).toMatch(/already sleep 7 h 30 min/);
  });

  it('horas regulares y 7 h 30 de media: no entra, sale en «Ya cumples»', () => {
    const { items, kept } = plan({ sleep: '7to8', goals: ['sleep_better'] }, watch({ asleep: () => 450, bed: (n) => -60 + (n % 3) * 10 }));
    expect(items.some((i) => i.kind === 'sleep')).toBe(false);
    expect(kept.find((k) => k.kind === 'sleep')?.text).toMatch(/^7 h 30 min of sleep on average, at steady times \(±\d+ min\)$/);
  });

  it('duerme 6 h 20 de media: primero las horas, con cuánto le falta y desde qué hora adelantar', () => {
    const { items } = plan({ sleep: '7to8' }, watch({ asleep: () => 380, bed: () => 30 }));
    const sleep = items.find((i) => i.kind === 'sleep');
    expect(sleep?.title).toBe('Sleep 40 min more a night');
    expect(sleep?.detail).toBe('You sleep 6 h 20 min a night on average (last 14 nights); adults need 7 h or more.');
    expect(sleep?.how[0]).toBe('Go to bed 20 min earlier each week: start at 00:10 instead of 00:30');
  });
});

describe('fuerza, pasos, calma y comida con tus datos', () => {
  it('1 sesión de fuerza a la semana con meta 2: «Añade 1», con lo que haces y lo recomendable', () => {
    const logs = { ...noLogs, workouts: [2, 9, 16, 23].map((n) => ({ fecha: iso(n), type: 'strength' })) };
    const strength = plan({ activity: 'light' }, {}, logs).items.find((i) => i.kind === 'strength');
    expect(strength?.title).toBe('Add 1 strength session a week');
    expect(strength?.detail).toBe('You have logged 4 in the last 4 weeks (1 a week); 2 or more a week is the recommendation.');
  });

  it('solo cardio registrado: «Empieza con 2 sesiones de fuerza»', () => {
    const logs = { ...noLogs, workouts: [3, 10, 20].map((n) => ({ fecha: iso(n), type: 'cardio' })) };
    const strength = plan({ activity: 'light' }, {}, logs).items.find((i) => i.kind === 'strength');
    expect(strength?.title).toBe('Start with 2 strength sessions a week');
    expect(strength?.detail).toMatch(/^You have not logged any in the last 3 weeks/);
  });

  it('ya hace 2 o más sesiones de fuerza a la semana: no se le pide, sale en «Ya cumples»', () => {
    const logs = { ...noLogs, workouts: [1, 3, 8, 10, 15, 17, 22, 24].map((n) => ({ fecha: iso(n), type: 'strength' })) };
    const { items, kept } = plan({ activity: 'light' }, {}, logs);
    expect(items.some((i) => i.kind === 'strength')).toBe(false);
    expect(kept.find((k) => k.kind === 'strength')?.text).toBe('8 strength sessions in the last 4 weeks (your goal: 2 a week)');
  });

  it('pasos por debajo de la meta: cuántos más, con su media; por encima: fuera del plan', () => {
    const below = plan({ activity: 'light' }, watch({ steps: () => 5600 })).items.find((i) => i.kind === 'steps');
    expect(below?.title).toBe('Walk 2,000 more steps a day');
    expect(below?.detail).toBe('You average 5,600 steps a day (last 14 days); your goal is 7,500.');
    const { items, kept } = plan({ activity: 'light' }, watch({ steps: () => 9100 }));
    expect(items.some((i) => i.kind === 'steps')).toBe(false);
    expect(kept.find((k) => k.kind === 'steps')?.text).toBe('9,100 steps a day on average (your goal: 7,500)');
  });

  it('estrés alto en sus check-ins: entran las sesiones de calma, con lo que ha marcado', () => {
    const checkIns = [1, 2, 4, 6].map((n, i) => ({ fecha: iso(n), stress: i < 3 ? 4 : 2 }));
    const calm = plan({}, {}, { ...noLogs, checkIns }).items.find((i) => i.kind === 'mindfulness');
    expect(calm?.detail).toBe('You marked high stress in 3 of your last 4 check-ins.');
  });

  it('azúcar añadido en muchas de sus comidas: la acción de comida pasa a ser reducirlo', () => {
    const meals = [1, 1, 2, 3, 4, 5].map((n, i) => ({ fecha: iso(n), addedSugar: i < 3 }));
    const food = plan({}, {}, { ...noLogs, meals }).items.find((i) => i.kind === 'nutrition');
    expect(food?.title).toBe('Cut down on added sugar');
    expect(food?.detail).toBe('Added sugar in 3 of your last 6 logged meals.');
  });
});

describe('el sueño medido entra aunque ya haya otras 3 acciones', () => {
  it('pasos bajos, fuerza a medias, azúcar y hora de acostarse irregular: el sueño entra como cuarta', () => {
    const logs = {
      ...noLogs,
      workouts: [3, 11, 25].map((n) => ({ fecha: iso(n), type: 'strength' })),
      meals: [1, 1, 2, 3, 4, 5].map((n, i) => ({ fecha: iso(n), addedSugar: i < 3 })),
    };
    const series = { ...watch({ steps: () => 6600 }), ...watch({ asleep: () => 445, bed: (n) => (n % 4 === 0 ? 90 : -35) }) };
    series.steps = watch({ steps: () => 6600 }).steps;
    const { items } = plan({}, series, logs);
    expect(items.map((i) => i.kind).sort()).toEqual(['nutrition', 'sleep', 'steps', 'strength']);
  });
});

describe('en Hoy, en corto; el porqué entero, en el plan completo', () => {
  it('cada acción con datos trae su línea corta y lo cumplido también', () => {
    const logs = { ...noLogs, workouts: [2, 9, 16, 23].map((n) => ({ fecha: iso(n), type: 'strength' })) };
    const series = { ...watch({ asleep: () => 450, bed: (n) => (n % 2 ? -60 : 60) }), steps: watch({ steps: () => 9100 }).steps };
    const { items, kept } = plan({ activity: 'light' }, series, logs);
    expect(items.find((i) => i.kind === 'strength')?.short).toBe('1 a week · goal 2');
    expect(items.find((i) => i.kind === 'sleep')?.short).toMatch(/^Bedtime: ±6\d min · goal ±30$/);
    expect(kept.find((k) => k.kind === 'steps')?.short).toBe('Steps: 9,100 a day · goal 7,500');
  });
});

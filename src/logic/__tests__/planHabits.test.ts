import { describe, expect, it } from 'vitest';
import { buildFullPlan, buildPlan, planKept, PlanProfile } from '@/logic/plan';
import { HabitLogs, planHabits, sessionsThisWeek } from '@/logic/planHabits';
import { DailySeries, localDayKey } from '@/wearables/seriesLogic';
import type { DoseLog, MedicationItem } from '@/types/medication';

// Con datos, cada acción dice dónde estás frente a lo recomendable y lo que ya cumples sale del plan
// (fundador, 2026-10-30: «quiero que se note personalizado de verdad»). El título es la meta
// («Completa 3 sesiones de fuerza a la semana») y el detalle, para el plan completo, dónde estás
// según tus registros o lo que nos contaste y lo que recomiendan las guías. Hoy es viernes 30/10/2026.
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
  return { items: buildPlan(profile, habits), full: buildFullPlan(profile, habits), kept: planKept(profile, habits) };
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
    expect(sleep?.detail).toMatch(/^According to your watch, your bedtime varies ±6\d min from night to night \(last 14 nights\); the aim is under ±30 min\.$/);
    expect(sleep?.why).toMatch(/already sleep 7 h 30 min/);
    // En Hoy, el avance es la variación frente a la meta
    expect(sleep?.progress?.text).toMatch(/^Bedtime: ±6\d min · goal ±30$/);
  });

  it('horas regulares y 7 h 30 de media: no entra, sale en «Ya cumples»', () => {
    const { items, kept } = plan({ sleep: '7to8', goals: ['sleep_better'] }, watch({ asleep: () => 450, bed: (n) => -60 + (n % 3) * 10 }));
    expect(items.some((i) => i.kind === 'sleep')).toBe(false);
    expect(kept.find((k) => k.kind === 'sleep')?.text).toMatch(/^7 h 30 min of sleep on average, at steady times \(±\d+ min\)$/);
  });

  it('duerme 6 h 20 de media: la meta de 7 h, con cuánto le falta y desde qué hora adelantar', () => {
    const { items } = plan({ sleep: '7to8' }, watch({ asleep: () => 380, bed: () => 30 }));
    const sleep = items.find((i) => i.kind === 'sleep');
    expect(sleep?.title).toBe('Sleep 7 hours or more a night');
    expect(sleep?.detail).toBe('According to your watch, you sleep 6 h 20 min a night on average (last 14 nights), 40 min less than the 7 h adults need.');
    expect(sleep?.how[0]).toBe('Go to bed 20 min earlier each week: start at 00:10 instead of 00:30');
  });
});

describe('fuerza, pasos, calma y comida con tus datos', () => {
  it('1 sesión de fuerza a la semana con meta 2: el título es la meta; el detalle, lo que hace y lo que dicen las guías', () => {
    const logs = { ...noLogs, workouts: [2, 9, 16, 23].map((n) => ({ fecha: iso(n), type: 'strength' })) };
    const strength = plan({ activity: 'light' }, {}, logs).items.find((i) => i.kind === 'strength');
    expect(strength?.title).toBe('Do 2 strength sessions a week');
    expect(strength?.detail).toBe(
      'According to your logs, you have done 4 strength sessions in the last 4 weeks: 1 a week on average. Guidelines recommend strength training on 2 or more days a week.'
    );
  });

  it('con meta 3 por su objetivo, el detalle lo dice', () => {
    const logs = { ...noLogs, workouts: [2, 9, 16, 23, 24].map((n) => ({ fecha: iso(n), type: 'strength' })) };
    const strength = plan({ activity: 'active', goals: ['performance'] }, {}, logs).items.find((i) => i.kind === 'strength');
    expect(strength?.title).toBe('Do 3 strength sessions a week');
    expect(strength?.detail).toMatch(/1\.3 a week on average\. Guidelines recommend strength training on 2 or more days a week; for your goal, 3\.$/);
  });

  it('solo cardio registrado y nada contado de fuerza: ninguna sesión de fuerza', () => {
    const logs = { ...noLogs, workouts: [3, 10, 20].map((n) => ({ fecha: iso(n), type: 'cardio' })) };
    const strength = plan({ activity: 'light' }, {}, logs).items.find((i) => i.kind === 'strength');
    expect(strength?.title).toBe('Do 2 strength sessions a week');
    expect(strength?.detail).toMatch(/^According to your logs, you have not done any strength sessions in the last 3 weeks\./);
  });

  it('ya hace 2 o más sesiones de fuerza a la semana: no se le pide, sale en «Ya cumples»', () => {
    const logs = { ...noLogs, workouts: [1, 3, 8, 10, 15, 17, 22, 24].map((n) => ({ fecha: iso(n), type: 'strength' })) };
    const { items, kept } = plan({ activity: 'light' }, {}, logs);
    expect(items.some((i) => i.kind === 'strength')).toBe(false);
    expect(kept.find((k) => k.kind === 'strength')?.text).toBe('8 strength sessions in the last 4 weeks (your goal: 2 a week)');
  });

  it('pasos por debajo de la meta: la meta, con su media; por encima: fuera del plan', () => {
    const below = plan({ activity: 'light' }, watch({ steps: () => 5600 })).items.find((i) => i.kind === 'steps');
    expect(below?.title).toBe('Walk 7,500 steps a day');
    expect(below?.detail).toBe('According to your watch, you walk 5,600 steps a day on average (last 14 days); your goal is 7,500.');
    const { items, kept } = plan({ activity: 'light' }, watch({ steps: () => 9100 }));
    expect(items.some((i) => i.kind === 'steps')).toBe(false);
    expect(kept.find((k) => k.kind === 'steps')?.text).toBe('9,100 steps a day on average (your goal: 7,500)');
  });

  it('estrés alto en sus check-ins: entran las sesiones de calma, con lo que ha marcado', () => {
    const checkIns = [1, 2, 4, 6].map((n, i) => ({ fecha: iso(n), stress: i < 3 ? 4 : 2 }));
    const calm = plan({}, {}, { ...noLogs, checkIns }).items.find((i) => i.kind === 'mindfulness');
    expect(calm?.title).toBe('Do 3 short calm sessions a week');
    expect(calm?.detail).toBe('You marked high stress in 3 of your last 4 check-ins. 3 a week is a good aim.');
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

describe('lo que nos contó al empezar: fuerza, cardio y pasos', () => {
  it('fuerza 1 día a la semana: la meta, con lo que nos dijo y lo que recomiendan las guías', () => {
    const strength = plan({ activity: 'light', strengthDays: 1 }, {}).items.find((i) => i.kind === 'strength');
    expect(strength?.title).toBe('Do 2 strength sessions a week');
    expect(strength?.detail).toBe('You told us you do strength training 1 day a week. Guidelines recommend strength training on 2 or more days a week.');
  });

  it('fuerza 3 días o más: ya cumple, y en «Ya cumples» dice que lo contó', () => {
    const { full, kept } = plan({ activity: 'light', strengthDays: 3 }, {});
    expect(full.some((i) => i.kind === 'strength')).toBe(false);
    expect(kept.find((k) => k.kind === 'strength')?.text).toBe('Strength training 3 or more days a week, as you told us (your goal: 2)');
  });

  it('lo registrado en la app manda sobre lo que contó', () => {
    const logs = { ...noLogs, workouts: [2, 9, 16, 23].map((n) => ({ fecha: iso(n), type: 'strength' })) };
    const strength = plan({ activity: 'active', strengthDays: 3 }, {}, logs).items.find((i) => i.kind === 'strength');
    expect(strength?.detail).toMatch(/^According to your logs, you have done 4 strength sessions/);
  });

  it('sin cardio y quiere perder peso: el cardio entra en el plan completo, con lo que nos dijo', () => {
    const cardio = plan({ activity: 'light', cardioDays: 0, goals: ['lose_weight'] }, {}).full.find((i) => i.kind === 'cardio');
    expect(cardio?.title).toBe('Do cardio 3 days a week');
    expect(cardio?.detail).toBe(
      'You told us you do not do cardio yet. Guidelines recommend at least 150 minutes of moderate cardio a week: 3 sessions of 30-50 minutes, plus your walks.'
    );
  });

  it('cardio registrado (y deporte): cuenta lo de las últimas semanas', () => {
    const logs = { ...noLogs, workouts: [1, 4, 8, 15].map((n, i) => ({ fecha: iso(n), type: i === 1 ? 'sport' : 'cardio' })) };
    const cardio = plan({ activity: 'light', goals: ['longevity'] }, {}, logs).full.find((i) => i.kind === 'cardio');
    expect(cardio?.detail).toMatch(/^According to your logs, you have done 4 cardio sessions in the last 3 weeks: 1\.3 a week on average\./);
  });

  it('pasos que nos contó: frente a la meta, o en «Ya cumples»', () => {
    const steps = plan({ activity: 'active', stepsBand: '5to7k' }, {}).items.find((i) => i.kind === 'steps');
    expect(steps?.title).toBe('Walk 9,000 steps a day');
    expect(steps?.detail).toBe('You told us you walk between 5,000 and 7,500 steps a day; your goal is 9,000.');
    const { kept } = plan({ activity: 'active', stepsBand: 'gt10k' }, {});
    expect(kept.find((k) => k.kind === 'steps')?.text).toBe('You told us you walk more than 10,000 steps a day (your goal: 9,000)');
  });
});

describe('hábitos y tomas: agua, check-in y medicación', () => {
  it('bebe 1,2 L de media con meta 1,6 L: «Bebe 1,6 L al día», con lo que apunta', () => {
    const water = [1, 2, 3, 5, 6, 8].map((n) => ({ fecha: iso(n), valor: 1200 }));
    const item = plan({ sex: 'female' }, {}, { ...noLogs, water }).full.find((i) => i.kind === 'water');
    expect(item?.title).toBe('Drink 1.6 L a day');
    expect(item?.detail).toBe('According to what you log, you drink 1.2 L a day on average (6 days logged); your goal is 1.6 L.');
  });

  it('sin apuntar lo que bebe, nada de agua', () => {
    const { full, kept } = plan({ sex: 'female' }, {});
    expect(full.some((i) => i.kind === 'water')).toBe(false);
    expect(kept.some((k) => k.kind === 'water')).toBe(false);
  });

  it('check-in: solo a quien lo usó y lo dejó, y solo en el plan completo', () => {
    const checkIns = [20, 25, 30].map((n) => ({ fecha: iso(n), stress: 2 }));
    const { items, full } = plan({}, {}, { ...noLogs, checkIns });
    expect(items.some((i) => i.kind === 'checkin')).toBe(false);
    expect(full.find((i) => i.kind === 'checkin')?.detail).toBe('You have not done a check-in in the last 2 weeks.');
    expect(plan({}, {}).full.some((i) => i.kind === 'checkin')).toBe(false);
  });

  it('medicación: cuántas tomas se ha saltado (hasta ayer), solo en el plan completo', () => {
    const at = (n: number, hh: number) => new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate() - n, hh, 0).toISOString();
    const item: MedicationItem = {
      id: 'm1',
      fecha: at(10, 7),
      createdAt: at(10, 7),
      name: 'Levothyroxine',
      kind: 'medication',
      schedule: { type: 'times', times: ['08:00', '20:00'] },
      course: { type: 'ongoing' },
      reminders: true,
    };
    const logs: DoseLog[] = [];
    for (let n = 10; n >= 0; n--)
      for (const hh of n === 0 ? [8] : [8, 20]) {
        if (n === 7 && hh === 20) continue; // sin marcar
        const skipped = (n === 2 && hh === 20) || (n === 5 && hh === 8);
        logs.push({ id: `${n}-${hh}`, fecha: at(n, hh), createdAt: at(n, hh), medId: 'm1', scheduledFor: at(n, hh), status: skipped ? 'skipped' : 'taken' });
      }
    const { items, full } = plan({}, {}, { ...noLogs, meds: { items: [item], logs } });
    expect(items.some((i) => i.kind === 'medication')).toBe(false);
    const meds = full.find((i) => i.kind === 'medication');
    expect(meds?.title).toBe('Keep up with your doses');
    // La de hoy a las 08:00 no cuenta: 10 días, 20 tomas
    expect(meds?.detail).toBe('In the last 10 days you have skipped 3 of your 20 doses. 1 of them is not marked: if you took it, mark it in Medication.');
  });
});

describe('el avance de la semana en Hoy', () => {
  it('cuenta de lunes a hoy (hoy es viernes 30/10)', () => {
    const workouts = [
      { fecha: '2026-10-25T18:00:00', type: 'cardio' }, // domingo: semana pasada
      { fecha: '2026-10-27T18:00:00', type: 'strength' },
      { fecha: '2026-10-29T18:00:00', type: 'sport' },
    ];
    expect(sessionsThisWeek(workouts, ['cardio', 'sport'], NOW)).toBe(1);
    expect(sessionsThisWeek(workouts, ['strength'], NOW)).toBe(1);
  });
});

describe('en Hoy, de todo un poco', () => {
  it('como mucho 2 acciones del mismo bloque: la tercera de actividad sigue en el plan completo', () => {
    const profile: PlanProfile = { activity: 'active', goals: ['performance', 'lose_weight'], strengthDays: 1, cardioDays: 0, stepsBand: 'lt5k' };
    const { items, full } = plan(profile, {});
    expect(items.filter((i) => ['strength', 'cardio', 'steps'].includes(i.kind))).toHaveLength(2);
    expect(full.filter((i) => ['strength', 'cardio', 'steps'].includes(i.kind))).toHaveLength(3);
    expect(items.some((i) => i.kind === 'nutrition')).toBe(true);
  });
});

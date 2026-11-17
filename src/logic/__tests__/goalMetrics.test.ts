import { describe, expect, it } from 'vitest';
import {
  GOAL_DAYS,
  GOAL_METRICS,
  checkInByDay,
  countByDay,
  daysBefore,
  entriesByDay,
  hasAny,
  hoursText,
  labReadingFor,
  mean,
  moodByDay,
  moodWindow,
  pointsByDay,
  rangeScale,
  topMood,
  visibleMetrics,
  weeklyOf,
  windowDays,
  windowOf,
} from '@/logic/goalMetrics';
import { GOALS, addDays, type GoalKey, type LabReading } from '@/logic/metas';
import { es } from '@/i18n/es';
import { metasEs } from '@/i18n/metasEs';
import { workoutsEs } from '@/i18n/workoutsEs';
import { dietEs } from '@/i18n/dietEs';
import { historialEs } from '@/i18n/historialEs';
import { authEs } from '@/i18n/authEs';
import { checkinEs } from '@/i18n/checkinEs';

// Cada objetivo, su métrica (2026-11-16): lo que se mide en cada uno, las medias de 14 días y las de los 14 de antes,
// el ánimo que más se repite y la línea de rango de los objetivos del análisis
const TODAY = '2026-11-16';
const reading = (marker: string, value: number, low: number | null, high: number | null): LabReading => ({ marker, value, unit: 'mg/dL', low, high });

describe('qué mide cada objetivo', () => {
  it('todos los objetivos tienen algo que se mide', () => {
    for (const g of Object.keys(GOALS) as GoalKey[]) expect(GOAL_METRICS[g].length).toBeGreaterThan(0);
  });

  it('los del análisis, su biomarcador; dormir, el reloj y el check-in; energía, el check-in', () => {
    for (const g of ['ldl', 'tg', 'glucosa', 'hdl'] as GoalKey[]) expect(GOAL_METRICS[g]).toEqual(['lab']);
    expect(GOAL_METRICS.sueno).toEqual(['sleepHours', 'sleepCheckIn']);
    expect(GOAL_METRICS.energia).toEqual(['energy']);
    expect(GOAL_METRICS.salud).toEqual(['kuovaAge']);
  });

  it('sin reloj, «Dormir mejor» se queda con el check-in', () => {
    expect(visibleMetrics('sueno', {})).toEqual(['sleepCheckIn']);
    expect(visibleMetrics('sueno', { sleepHours: true })).toEqual(['sleepHours', 'sleepCheckIn']);
  });

  it('la VFC y el VO2max solo salen si hay datos', () => {
    expect(visibleMetrics('estres', {})).toEqual(['stress']);
    expect(visibleMetrics('estres', { hrv: true })).toEqual(['stress', 'hrv']);
    expect(visibleMetrics('forma', {})).toEqual(['steps', 'workouts']);
    expect(visibleMetrics('longev', { vo2max: true })).toEqual(['kuovaAge', 'vo2max']);
  });

  it('dejar de fumar: los cigarrillos, salvo que solo apuntes los días sin fumar', () => {
    expect(visibleMetrics('tabaco', {})).toEqual(['tobacco']);
    expect(visibleMetrics('tabaco', { smokeFree: true })).toEqual(['smokeFree']);
    expect(visibleMetrics('tabaco', { tobacco: true, smokeFree: true })).toEqual(['tobacco', 'smokeFree']);
  });
});

describe('los 14 días y los 14 de antes', () => {
  it('acaban hoy y van seguidos', () => {
    const w = windowDays(TODAY);
    expect(w).toHaveLength(GOAL_DAYS);
    expect(w[13]).toBe(TODAY);
    expect(w[0]).toBe('2026-11-03');
    expect(daysBefore(TODAY)[13]).toBe('2026-11-02');
    expect(daysBefore(TODAY)[0]).toBe('2026-10-20');
  });

  it('la media es de los días con dato: un día sin dato no cuenta como 0', () => {
    expect(mean([3, null, 4, undefined])).toBe(3.5);
    expect(mean([null])).toBeNull();
    const w = windowOf({ [TODAY]: 4, '2026-11-10': 2, '2026-11-01': 3, '2026-10-25': 5 }, TODAY);
    expect(w.now).toBe(3);
    expect(w.before).toBe(4);
    expect(w.values).toHaveLength(14);
    expect(w.values[13]).toBe(4);
    expect(w.values[12]).toBeNull();
  });

  it('sin nada en los 14 días, no hay cifra de ahora', () => {
    expect(windowOf({ '2026-10-25': 5 }, TODAY)).toMatchObject({ now: null, before: 5 });
  });

  it('lo que va por semana: lo de los 14 días entre 2 (null si no hay nada)', () => {
    const w = weeklyOf({ [TODAY]: 2, '2026-11-05': 1, '2026-11-01': 1 }, TODAY);
    expect(w.now).toBe(1.5);
    expect(w.before).toBe(0.5);
    expect(weeklyOf({}, TODAY).now).toBeNull();
  });

  it('hay datos si hay algo en los 28 días', () => {
    expect(hasAny({ '2026-10-20': 1 }, TODAY)).toBe(true);
    expect(hasAny({ '2026-10-19': 1 }, TODAY)).toBe(false);
  });
});

describe('de dónde salen los valores de cada día', () => {
  it('el check-in: la media del día; el de las 00:30 de la noche cuenta para el día anterior', () => {
    const c = [
      { fecha: '2026-11-16T08:00:00', moment: 'just_woke_up' as const, sleep: 4, energy: 3 },
      { fecha: '2026-11-16T14:00:00', moment: 'mid_day' as const, energy: 5, stress: 2 },
      { fecha: '2026-11-16T00:30:00', moment: 'winding_down' as const, energy: 1 },
    ];
    expect(checkInByDay(c, 'energy')).toEqual({ '2026-11-16': 4, '2026-11-15': 1 });
    expect(checkInByDay(c, 'sleep')).toEqual({ '2026-11-16': 4 });
    expect(checkInByDay(c, 'stress')).toEqual({ '2026-11-16': 2 });
  });

  it('el sueño del reloj llega en minutos y se puede pasar a horas', () => {
    expect(pointsByDay([{ date: TODAY, value: 450 }], 1 / 60)).toEqual({ [TODAY]: 7.5 });
    expect(pointsByDay(undefined)).toEqual({});
  });

  it('el peso: lo último de cada día', () => {
    const e = [
      { fecha: '2026-11-16T21:00:00', valor: 80.2 },
      { fecha: '2026-11-16T08:00:00', valor: 79.6 },
      { fecha: '2026-11-10T08:00:00', valor: 80 },
    ];
    expect(entriesByDay(e)).toEqual({ '2026-11-16': 80.2, '2026-11-10': 80 });
  });

  it('los entrenamientos: cuántos cada día', () => {
    expect(countByDay([{ fecha: '2026-11-16T08:00:00' }, { fecha: '2026-11-16T19:00:00' }, { fecha: '2026-11-14T10:00:00' }])).toEqual({
      '2026-11-16': 2,
      '2026-11-14': 1,
    });
  });
});

describe('el ánimo', () => {
  it('el que más se repite; con empate, el más reciente', () => {
    expect(topMood(['happy', 'calm', 'happy', null])).toBe('happy');
    expect(topMood(['happy', 'calm'])).toBe('calm');
    expect(topMood([null, undefined])).toBeNull();
  });

  it('uno por día y el de los 14 días, comparado con los 14 de antes', () => {
    const c = [
      { fecha: '2026-11-16T08:00:00', moment: 'just_woke_up' as const, mood: 'calm' as const },
      { fecha: '2026-11-16T20:00:00', moment: 'winding_down' as const, mood: 'happy' as const },
      { fecha: '2026-11-15T20:00:00', moment: 'winding_down' as const, mood: 'happy' as const },
      { fecha: '2026-11-01T20:00:00', moment: 'winding_down' as const, mood: 'sad' as const },
    ];
    const byDay = moodByDay(c);
    expect(byDay).toEqual({ '2026-11-16': 'happy', '2026-11-15': 'happy', '2026-11-01': 'sad' });
    const w = moodWindow(byDay, TODAY);
    expect(w.now).toBe('happy');
    expect(w.before).toBe('sad');
    expect(w.days).toHaveLength(14);
    expect(w.days[13]).toBe('happy');
    expect(w.days[0]).toBeNull();
  });
});

describe('los objetivos del análisis', () => {
  it('cada uno, el marcador que lo recomienda', () => {
    const rs = [reading('ldl', 158, 0, 130), reading('triglycerides', 120, 0, 150), reading('hdl', 35, 40, null)];
    expect(labReadingFor('ldl', rs)?.value).toBe(158);
    expect(labReadingFor('tg', rs)?.marker).toBe('triglycerides');
    expect(labReadingFor('hdl', rs)?.value).toBe(35);
    expect(labReadingFor('glucosa', rs)).toBeNull();
    expect(labReadingFor('energia', rs)).toBeNull();
  });

  it('la glucosa: la que está por encima del rango (glucosa o HbA1c); si ninguna, la glucosa', () => {
    expect(labReadingFor('glucosa', [reading('glucose', 92, 70, 99), reading('hba1c', 6.1, null, 5.7)])?.marker).toBe('hba1c');
    expect(labReadingFor('glucosa', [reading('glucose', 92, 70, 99), reading('hba1c', 5.4, null, 5.7)])?.marker).toBe('glucose');
    expect(labReadingFor('glucosa', [reading('hba1c', 5.4, null, 5.7)])?.marker).toBe('hba1c');
  });

  it('la línea de rango: la franja del laboratorio, con sitio para tu valor', () => {
    const between = rangeScale(92, 70, 99);
    expect(between.range).toEqual([70, 99]);
    expect(between.min).toBeLessThan(70);
    expect(between.max).toBeGreaterThan(99);

    // «Menos de 130»: un mínimo de 0 es como no tener mínimo; la franja va de 0 a 130
    const below = rangeScale(158, 0, 130);
    expect(below.range).toEqual([0, 130]);
    expect(below.min).toBe(0);
    expect(below.max).toBeGreaterThan(158);

    // «Más de 40» (HDL)
    const above = rangeScale(35, 40, null);
    expect(above.range![0]).toBe(40);
    expect(above.min).toBe(0);
    expect(above.max).toBeGreaterThan(40);

    // Muy por fuera: la escala se alarga para que quepa el punto
    const far = rangeScale(300, 70, 99);
    expect(far.max).toBeGreaterThan(300);
    // Sin rango: sin franja
    expect(rangeScale(5, null, null).range).toBeNull();
  });
});

describe('las horas de sueño', () => {
  it('«7 h 05»', () => {
    expect(hoursText(425)).toBe('7 h 05');
    expect(hoursText(480)).toBe('8 h 00');
    expect(hoursText(399.6)).toBe('6 h 40');
  });
});

// Igual que src/i18n/index.ts: es.ts gana a los demás
const ES: Record<string, string> = { ...authEs, ...workoutsEs, ...dietEs, ...metasEs, ...historialEs, ...es, ...checkinEs };
type Fs = { readFileSync: (p: string, enc: 'utf8') => string };

describe('en español', () => {
  it('cada t(«…») de la pantalla de un objetivo tiene su traducción', async () => {
    const fs = (await import('node:fs' as string)) as Fs;
    const src = fs.readFileSync('src/screens/GoalDetailScreen.tsx', 'utf8');
    const keys = new Set<string>();
    for (const m of src.matchAll(/\bt\(\s*'((?:\\'|[^'\n])*)'/g)) keys.add(m[1].replace(/\\'/g, "'"));
    // t(x ? '…' : '…') en una línea, con una condición sin comillas
    for (const m of src.matchAll(/\bt\([ \t]*[\w.!?=<> \t]+\?[ \t]*'((?:\\'|[^'\n])*)'[ \t]*:[ \t]*'((?:\\'|[^'\n])*)'/g)) {
      keys.add(m[1]);
      keys.add(m[2]);
    }
    // Los nombres de los marcadores, que se traducen al pintarse
    for (const k of ['LDL', 'HDL', 'Triglycerides', 'Glucose', 'HbA1c']) keys.add(k);
    const missing = [...keys].filter((k) => k !== 'ms' && !(k in ES));
    expect(missing).toEqual([]);
  });

  it('los 14 días de antes', () => {
    expect(ES['The {n} days before: {value}'].replace('{n}', '14').replace('{value}', '3,2')).toBe('Los 14 días de antes: 3,2');
    expect(addDays(TODAY, -GOAL_DAYS)).toBe('2026-11-02');
  });
});

import { describe, expect, it } from 'vitest';
import { es } from '@/i18n/es';
import { CycleEntry } from '@/types/cycle';
import { currentCyclePhase } from '@/utils/cyclePhase';
import { predictCycle } from '../../../supabase/functions/_shared/cycle';

// Hoy: 22/10/2026 a las 9:00. Las reglas se guardan a mediodía del día marcado (LogCycleScreen).
const TODAY = new Date(2026, 9, 22, 9, 0);
const daysAgo = (n: number): CycleEntry => {
  const d = new Date(2026, 9, 22 - n, 12);
  return { id: `${n}`, fecha: d.toISOString(), createdAt: d.toISOString() };
};
// Inicios de regla, "hace N días"
const starts = (...ago: number[]) => ago.map(daysAgo);

describe('Próxima regla según sus registros', () => {
  it('ciclos regulares de 28: día 9 de 28, faltan unos 20 días', () => {
    const info = currentCyclePhase(starts(92, 64, 36, 8), TODAY);
    expect(info).toMatchObject({ day: 9, length: 28, phase: 'follicular', isSample: false });
    expect(info.next).toMatchObject({
      date: '2026-11-11',
      daysLeft: 20,
      status: 'upcoming',
      basis: 'cycles',
      cyclesUsed: 3,
      text: 'Based on your last cycles, your next period would come in about {n} days.',
      vars: { n: 20 },
      note: null,
    });
  });

  it('el día cambia a medianoche, no a mediodía', () => {
    const entries = starts(36, 8);
    expect(currentCyclePhase(entries, new Date(2026, 9, 22, 0, 30)).day).toBe(9);
    expect(currentCyclePhase(entries, new Date(2026, 9, 22, 23, 30)).day).toBe(9);
    expect(currentCyclePhase(entries, new Date(2026, 9, 22, 23, 30)).next?.daysLeft).toBe(20);
  });

  it('la fecha y el margen coinciden con la predicción del detalle del ciclo (predictCycle)', () => {
    const cases = [
      starts(92, 64, 36, 8),
      starts(57, 30), // 2 reglas: un solo ciclo de 27
      starts(66, 39, 9), // ciclos de 27 y 30: mediana 28,5 → 28, como round() de Python
      starts(68, 39, 9), // 29 y 30: mediana 29,5 → 30
      starts(150, 126, 91, 63, 37, 3), // ciclos que varían
      starts(60, 34), // se esperaba hace 8 días
    ];
    for (const entries of cases) {
      const info = currentCyclePhase(entries, TODAY);
      const server = predictCycle(entries.map((e) => e.fecha.slice(0, 10)), TODAY);
      if ('error' in server) throw new Error(server.error);
      expect(info.next?.date).toBe(server.predicted_next_start);
      expect(info.next?.windowDays).toBe(server.window_days);
      expect(info.next?.status === 'late' || info.next?.status === 'stale').toBe(server.is_late);
    }
  });

  it('mañana y hoy', () => {
    expect(currentCyclePhase(starts(55, 27), TODAY).next).toMatchObject({
      daysLeft: 1,
      text: 'Based on your last cycles, your next period would come around tomorrow.',
    });
    expect(currentCyclePhase(starts(56, 28), TODAY).next).toMatchObject({
      daysLeft: 0,
      text: 'Based on your last cycles, your next period would come around today.',
    });
  });

  it('si se retrasa dentro del margen: «por estos días», y el día sigue contando (no vuelve al 1)', () => {
    const info = currentCyclePhase(starts(86, 58, 30), TODAY); // ciclos de 28; hoy sería el día 31
    expect(info).toMatchObject({ day: 31, length: 28, phase: 'luteal' });
    expect(info.next).toMatchObject({
      daysLeft: -2,
      windowDays: 2,
      status: 'due',
      text: 'Based on your last cycles, your period would come around these days.',
    });
  });

  it('si se retrasa más que el margen: se esperaba hace N días, sin nota', () => {
    const info = currentCyclePhase(starts(90, 62, 34), TODAY); // ciclos de 28; hoy sería el día 35
    expect(info).toMatchObject({ day: 35, phase: 'luteal' });
    expect(info.next).toMatchObject({
      daysLeft: -6,
      status: 'late',
      text: 'Based on your last cycles, your period was expected {n} days ago. If it has started, log it.',
      vars: { n: 6 },
      note: null,
    });
  });

  it('sin apuntar ninguna en más de un ciclo entero: pide apuntarla y la fase vuelve a dar la vuelta', () => {
    const info = currentCyclePhase(starts(84, 56), TODAY); // ciclo de 28, última hace 56 días
    expect(info.day).toBe(1);
    expect(info.next).toMatchObject({
      status: 'stale',
      text: 'Your last logged period was {n} days ago. If you have had one since, log it to estimate the next one.',
      vars: { n: 56 },
      note: null,
    });
    expect(currentCyclePhase(starts(84, 56), new Date(2026, 9, 21, 9)).next?.status).toBe('late');
  });

  it('ciclos irregulares: lo dice, con cuánto varían, y el margen crece', () => {
    // ciclos de 24, 35, 28 y 31: hasta 11 días de diferencia
    const info = currentCyclePhase(starts(128, 104, 69, 41, 10), TODAY);
    expect(info.length).toBe(30);
    expect(info.next).toMatchObject({
      daysLeft: 20,
      windowDays: 4,
      status: 'upcoming',
      note: 'Your last cycles differ by up to {n} days, so it may come earlier or later.',
      noteVars: { n: 11 },
    });
    // Con 13 días de retraso sobre una mediana de 30 y margen de 4: se esperaba hace 13 días
    expect(currentCyclePhase(starts(161, 137, 102, 74, 43), TODAY).next).toMatchObject({ status: 'late', vars: { n: 13 } });
  });

  it('pocos ciclos: lo dice', () => {
    expect(currentCyclePhase(starts(36, 8), TODAY).next).toMatchObject({
      cyclesUsed: 1,
      note: 'It is based on a single cycle: it will get more accurate as you log more periods.',
    });
    expect(currentCyclePhase(starts(64, 36, 8), TODAY).next).toMatchObject({
      cyclesUsed: 2,
      note: 'It is based on {n} cycles: it will get more accurate as you log more periods.',
      noteVars: { n: 2 },
    });
  });

  it('con una sola regla, usa la duración de la encuesta (y lo dice); sin ella, no estima', () => {
    const info = currentCyclePhase(starts(8), TODAY, 30);
    expect(info).toMatchObject({ day: 9, length: 30 });
    expect(info.next).toMatchObject({
      basis: 'questionnaire',
      cyclesUsed: 0,
      daysLeft: 22,
      text: 'Based on the cycle length you told us, your next period would come in about {n} days.',
      note: 'It will get more accurate as you log your periods.',
    });
    expect(currentCyclePhase(starts(8), TODAY).next).toBeNull();
    expect(currentCyclePhase(starts(8), TODAY, 90).next).toBeNull(); // duración fuera de rango
  });

  it('si marcó ciclos irregulares o un método hormonal, lo dice', () => {
    const irregular = currentCyclePhase(starts(8), TODAY, 30, { regularCycles: 'no' }).next;
    expect(irregular).toMatchObject({ windowDays: 7, note: 'You marked that your cycles are irregular: take it as a rough guide.' });
    const hormonal = currentCyclePhase(starts(92, 64, 36, 8), TODAY, null, { regularCycles: 'yes', hormonalContraception: 'pill' }).next;
    expect(hormonal?.note).toBe('You marked hormonal contraception, which changes how the cycle behaves: take it as a rough guide.');
    expect(currentCyclePhase(starts(92, 64, 36, 8), TODAY, null, { regularCycles: 'yes', hormonalContraception: 'none' }).next?.note).toBeNull();
  });

  it('el ciclo de ejemplo de la demo no da una fecha', () => {
    const info = currentCyclePhase([], TODAY);
    expect(info).toMatchObject({ isSample: true, day: 12, length: 28 });
    expect(info.next).toBeNull();
  });

  it('todos los textos están traducidos con las mismas variables', () => {
    const scenarios = [
      currentCyclePhase(starts(92, 64, 36, 8), TODAY),
      currentCyclePhase(starts(55, 27), TODAY),
      currentCyclePhase(starts(56, 28), TODAY),
      currentCyclePhase(starts(86, 58, 30), TODAY),
      currentCyclePhase(starts(90, 62, 34), TODAY),
      currentCyclePhase(starts(84, 56), TODAY),
      currentCyclePhase(starts(128, 104, 69, 41, 10), TODAY),
      currentCyclePhase(starts(36, 8), TODAY),
      currentCyclePhase(starts(64, 36, 8), TODAY),
      ...[8, 27, 28, 29, 33].map((ago) => currentCyclePhase(starts(ago), TODAY, 28)),
      currentCyclePhase(starts(8), TODAY, 30, { regularCycles: 'no' }),
      currentCyclePhase(starts(92, 64, 36, 8), TODAY, null, { regularCycles: 'yes', hormonalContraception: 'other' }),
    ];
    const texts = new Set(scenarios.flatMap((s) => [s.next?.text, s.next?.note]).filter((x): x is string => !!x));
    expect(texts.size).toBe(17);
    const vars = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort();
    for (const text of [...texts, 'Day {n}']) {
      expect(es[text], text).toBeTruthy();
      expect(vars(es[text]), text).toEqual(vars(text));
    }
  });
});

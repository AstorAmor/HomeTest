import { describe, expect, it } from 'vitest';
import { parseComp, weighAdvice, weightTrend } from '@/logic/weight';

const at = (y: number, m: number, d: number, h = 8) => new Date(y, m - 1, d, h).toISOString();

describe('Cada cuánto pesarse', () => {
  it('sin pesadas, toca pesarse', () => {
    expect(weighAdvice([], new Date(2026, 9, 19))).toMatchObject({ last: null, due: true, inLastWeek: 0 });
  });

  it('la próxima toca a los 7 días; antes, no', () => {
    const entries = [{ valor: 70, fecha: at(2026, 10, 15) }];
    const a = weighAdvice(entries, new Date(2026, 9, 19, 12));
    expect(a.daysSince).toBe(4);
    expect(a.due).toBe(false);
    expect(a.next?.getDate()).toBe(22);
    expect(weighAdvice(entries, new Date(2026, 9, 22, 7)).due).toBe(true);
  });

  it('el cambio de hora no mueve el día de la próxima pesada (25/10/2026)', () => {
    const a = weighAdvice([{ valor: 70, fecha: at(2026, 10, 19, 16) }], new Date(2026, 9, 19, 17));
    expect(a.next?.getDate()).toBe(26);
    expect(weighAdvice([{ valor: 70, fecha: at(2026, 10, 19, 16) }], new Date(2026, 9, 26, 8)).daysSince).toBe(7);
  });

  it('3 pesadas en una semana: se avisa de que no hace falta tanto', () => {
    const entries = [at(2026, 10, 16), at(2026, 10, 17), at(2026, 10, 19)].map((fecha) => ({ valor: 70, fecha }));
    expect(weighAdvice(entries, new Date(2026, 9, 19, 12)).tooOften).toBe(true);
  });
});

describe('Tendencia', () => {
  it('con menos de 3 semanas no hay tendencia', () => {
    const entries = [{ valor: 70, fecha: at(2026, 10, 12) }, { valor: 69.5, fecha: at(2026, 10, 19) }];
    expect(weightTrend(entries, new Date(2026, 9, 19, 12)).kind).toBe('unknown');
  });

  it('medio kilo menos por semana: bajando ~0,5 kg/semana (un valor por semana, el último)', () => {
    const entries = [
      { valor: 72, fecha: at(2026, 9, 28) },
      { valor: 71.5, fecha: at(2026, 10, 5) },
      { valor: 73, fecha: at(2026, 10, 9) }, // otro de la misma semana: cuenta el último de la semana
      { valor: 71, fecha: at(2026, 10, 12) },
      { valor: 70.5, fecha: at(2026, 10, 19) },
    ];
    const tr = weightTrend(entries, new Date(2026, 9, 19, 12));
    expect(tr.kind).toBe('down');
    expect(tr.weeks).toBe(4);
    expect(tr.perWeek).toBeLessThan(-0.2);
  });

  it('oscilaciones pequeñas: estable', () => {
    const fixed = [
      { valor: 70, fecha: at(2026, 9, 28) },
      { valor: 70.3, fecha: at(2026, 10, 5) },
      { valor: 69.9, fecha: at(2026, 10, 12) },
      { valor: 70.1, fecha: at(2026, 10, 19) },
    ];
    expect(weightTrend(fixed, new Date(2026, 9, 19, 12)).kind).toBe('stable');
  });
});

describe('Composición corporal escrita a mano', () => {
  it('acepta coma o punto y rechaza lo que no cabe', () => {
    expect(parseComp('body_fat', '23,46')).toBe(23.5);
    expect(parseComp('muscle_mass', '31.2')).toBe(31.2);
    expect(parseComp('bone_mass', '15')).toBeNull();
    expect(parseComp('body_water', '')).toBeNull();
  });
});

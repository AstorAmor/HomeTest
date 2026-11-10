import { describe, expect, it } from 'vitest';
import { kegelWeek } from '@/logic/kegel';

const at = (y: number, m: number, d: number, h = 10) => new Date(y, m - 1, d, h).toISOString();

describe('Histórico de Kegel', () => {
  const now = new Date(2026, 10, 5, 18); // jueves 5 de noviembre

  it('los últimos 7 días, del más antiguo a hoy, con los que tienen sesión', () => {
    const w = kegelWeek([at(2026, 11, 5, 8), at(2026, 11, 5, 20), at(2026, 11, 3), at(2026, 10, 30), at(2026, 10, 20)], now);
    expect(w.days.map((d) => d.key)).toEqual([
      '2026-10-30',
      '2026-10-31',
      '2026-11-01',
      '2026-11-02',
      '2026-11-03',
      '2026-11-04',
      '2026-11-05',
    ]);
    expect(w.days.map((d) => d.done)).toEqual([true, false, false, false, true, false, true]);
    expect(w.count).toBe(3); // dos sesiones el mismo día cuentan un día
    expect(w.last).toBe('2026-11-05');
  });

  it('sin sesiones recientes: ningún día marcado, pero se sabe la última', () => {
    const w = kegelWeek([at(2026, 10, 20)], now);
    expect(w.count).toBe(0);
    expect(w.last).toBe('2026-10-20');
    expect(kegelWeek([], now)).toMatchObject({ count: 0, last: null });
  });

  it('el día es el local (una sesión a las 0:30 cuenta ese día, no el anterior)', () => {
    expect(kegelWeek([new Date(2026, 10, 5, 0, 30).toISOString()], now).days[6].done).toBe(true);
  });
});

import { describe, expect, it } from 'vitest';
import { stressedOnDay, urineBusyDay } from '@/logic/bathroom';
import { UrineEntry } from '@/types/bathroom';

// Día de muchas más veces a orinar (src/logic/bathroom.ts, urineBusyDay): cuándo se pregunta y qué no se pregunta
const now = new Date('2026-11-16T20:00:00');
const noon = (n: number) => {
  const d = new Date(now);
  d.setDate(d.getDate() - n);
  d.setHours(12, 0, 0, 0);
  return d.toISOString();
};
const day = (n: number, count: number): UrineEntry => ({ id: `u${n}`, fecha: noon(n), createdAt: noon(n), count });
const dayKeyOf = (n: number) => noon(n).slice(0, 10);

describe('día de muchas veces', () => {
  it('ayer con 12 veces: pregunta todo', () => {
    const b = urineBusyDay([day(1, 12), day(2, 6)], now)!;
    expect(b.isToday).toBe(false);
    expect(b.count).toBe(12);
    expect(b.ask).toEqual(['coffee', 'drinks', 'alcohol', 'stress', 'none']);
  });

  it('un día normal no pregunta nada', () => {
    expect(urineBusyDay([day(0, 7), day(1, 8), day(2, 6)], now)).toBeNull();
  });

  it('hoy, en cuanto pasa de 10 (ya solo puede subir)', () => {
    const b = urineBusyDay([day(0, 11), day(1, 6)], now)!;
    expect(b.isToday).toBe(true);
  });

  it('frente a tu día normal: 9 cuando sueles ir 5', () => {
    const usual = [2, 3, 4, 5, 6].map((n) => day(n, 5));
    const b = urineBusyDay([day(1, 9), ...usual], now)!;
    expect(b.usual).toBe(5);
    expect(b.count).toBe(9);
    // Con 8 no llega (hacen falta 9 y 4 más que lo normal)
    expect(urineBusyDay([day(1, 8), ...usual], now)).toBeNull();
  });

  it('si el check-in dice estrés, no lo pregunta', () => {
    const b = urineBusyDay([day(1, 12)], now, () => ({ stressed: true }))!;
    expect(b.stressFromCheckIn).toBe(true);
    expect(b.ask).not.toContain('stress');
  });

  it('si apuntó mucha bebida, lo dice y no pregunta por ella', () => {
    const b = urineBusyDay([day(1, 12)], now, () => ({ drinksMl: 3000 }), 2000)!;
    expect(b.drinksMl).toBe(3000);
    expect(b.ask).not.toContain('drinks');
    // 2 L no basta para explicarlo
    expect(urineBusyDay([day(1, 12)], now, () => ({ drinksMl: 2000 }), 2000)!.ask).toContain('drinks');
  });

  it('el estrés del check-in: nivel 4-5, ánimo estresado o la etiqueta de nervios', () => {
    const d = dayKeyOf(1);
    expect(stressedOnDay([{ fecha: noon(1), stress: 4 }], [], d)).toBe(true);
    expect(stressedOnDay([{ fecha: noon(1), stress: 2, mood: 'calm' }], [], d)).toBe(false);
    expect(stressedOnDay([{ fecha: noon(1), mood: 'anxious' }], [], d)).toBe(true);
    expect(stressedOnDay([], [{ fecha: noon(1), tag: 'nervous' }], d)).toBe(true);
    expect(stressedOnDay([{ fecha: noon(2), stress: 5 }], [], d)).toBe(false);
  });
});

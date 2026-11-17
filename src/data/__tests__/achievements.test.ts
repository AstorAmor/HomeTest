import { describe, expect, it, vi } from 'vitest';

// Solo la cuenta de los niveles y del día en que se llegó a cada uno (la insignia en grande lo enseña)
vi.mock('@react-native-async-storage/async-storage', () => ({ default: { getItem: vi.fn(), setItem: vi.fn() } }));

const { computeAchievements } = await import('../achievements');

const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const ago = (n: number) => {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return d;
};
const empty = { dailySteps: [], workouts: [], meals: [], checkIns: [], mindful: [], badges: [] };
const find = (list: ReturnType<typeof computeAchievements>, id: string) => list.find((a) => a.id === id)!;

describe('insignias: el día de cada nivel', () => {
  it('en una racha, el día en que se llegó a los días del nivel', () => {
    // Check-in hoy y los 3 días anteriores: 4 seguidos → bronce (3), conseguido ayer
    const checkIns = [0, 1, 2, 3].map((n) => ({ fecha: ago(n).toISOString() }));
    const a = find(computeAchievements({ ...empty, checkIns }), 'self_aware');
    expect(a.level).toBe(1);
    expect(a.reachedOn).toEqual([key(ago(1))]);
  });

  it('en lo que se cuenta, el día del registro que hizo llegar al nivel', () => {
    const meals = [9, 7, 6, 4, 2, 1].map((n) => ({ fecha: ago(n).toISOString() }));
    const a = find(computeAchievements({ ...empty, meals }), 'food_logger');
    expect(a.level).toBe(1);
    // La quinta comida, por orden de fecha
    expect(a.reachedOn).toEqual([key(ago(2))]);
  });

  it('en los pasos, el día en que la suma llegó a la cifra', () => {
    const dailySteps = [3, 2, 1].map((n) => ({ date: key(ago(n)), value: 60000 }));
    const a = find(computeAchievements({ ...empty, dailySteps }), 'step_collector');
    expect(a.level).toBe(1);
    expect(a.reachedOn).toEqual([key(ago(2))]);
  });

  it('sin conseguir, sin fechas', () => {
    const a = find(computeAchievements(empty), 'calm_mind');
    expect(a.level).toBe(0);
    expect(a.reachedOn).toEqual([]);
  });
});

import { describe, expect, it } from 'vitest';
import { rangeBarLayout } from '@/utils/rangeBar';

describe('Barra de rango', () => {
  it('con los dos límites, el rango queda en medio y el valor en su sitio', () => {
    const L = rangeBarLayout(30, 20, 44)!;
    expect(L.minPct!).toBeGreaterThan(5);
    expect(L.maxPct!).toBeLessThan(95);
    expect(L.valuePct).toBeGreaterThan(L.minPct!);
    expect(L.valuePct).toBeLessThan(L.maxPct!);
  });

  it('un valor muy fuera sigue cabiendo en la barra', () => {
    const above = rangeBarLayout(300, 20, 44)!;
    expect(above.valuePct).toBeLessThanOrEqual(100);
    expect(above.valuePct).toBeGreaterThan(above.maxPct!);
    const below = rangeBarLayout(2, 20, 44)!;
    expect(below.valuePct).toBeGreaterThanOrEqual(0);
    expect(below.valuePct).toBeLessThan(below.minPct!);
  });

  it('solo máximo ("< 200") o mínimo 0: sin límite inferior', () => {
    const L = rangeBarLayout(180, null, 200)!;
    expect(L.minPct).toBeNull();
    expect(L.valuePct).toBeLessThan(L.maxPct!);
    expect(rangeBarLayout(3, 0, 5)!.minPct).toBeNull();
  });

  it('solo mínimo ("> 40") y sin rango', () => {
    const L = rangeBarLayout(55, 40, null)!;
    expect(L.maxPct).toBeNull();
    expect(L.valuePct).toBeGreaterThan(L.minPct!);
    expect(rangeBarLayout(5, null, null)).toBeNull();
  });
});

import { DEFAULT_GOALS, effectiveGoals, suggestedGoals } from '@/logic/dailyGoals';
import type { PlanItem } from '@/logic/plan';

describe('Objetivos del día', () => {
  const item = (kind: PlanItem['kind'], target: number): PlanItem => ({ kind, title: '', subtitle: '', target, why: '', how: [] });

  it('sugiere los del plan cuando están y los generales si no', () => {
    const s = suggestedGoals([item('steps', 9000), item('sleep', 7)]);
    expect(s.goals).toEqual({ ...DEFAULT_GOALS, steps: 9000, sleepMin: 420 });
    expect(s.fromPlan).toMatchObject({ steps: true, sleepMin: true, activeKcal: false });
    expect(suggestedGoals([]).goals).toEqual(DEFAULT_GOALS);
  });

  it('lo que cambia el usuario manda; lo demás sigue al plan', () => {
    const g = effectiveGoals({ ...DEFAULT_GOALS, steps: 9000 }, { activeKcal: 350, steps: undefined, sleepMin: -5 });
    expect(g).toEqual({ ...DEFAULT_GOALS, steps: 9000, activeKcal: 350 });
  });
});

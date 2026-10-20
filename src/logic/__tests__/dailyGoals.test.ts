import { describe, expect, it } from 'vitest';
import { DEFAULT_GOALS, effectiveGoals, fromSteps, suggestedGoals } from '@/logic/dailyGoals';
import type { PlanItem } from '@/logic/plan';

const item = (kind: PlanItem['kind'], target: number): PlanItem => ({ kind, title: '', subtitle: '', target, why: '', how: [] });
const yearsAgo = (n: number) => `${new Date().getFullYear() - n}-01-01`;

describe('Objetivos del día', () => {
  it('pasos y sueño del plan cuando están; kcal y distancia salen de esos pasos', () => {
    const s = suggestedGoals([item('steps', 9000), item('sleep', 7)], { sex: 'male', weightKg: 80, heightCm: 180 });
    expect(s.goals.steps).toBe(9000);
    expect(s.goals.sleepMin).toBe(420);
    expect(s.basis).toEqual({ steps: 'plan', sleepMin: 'plan', activeKcal: 'body', distanceM: 'body' });
    expect(s.goals.distanceM).toBe(fromSteps(9000, { sex: 'male', weightKg: 80, heightCm: 180 }).distanceM);
  });

  it('sin plan, por edad: 8.000 pasos antes de los 60 y 7.000 desde los 60', () => {
    expect(suggestedGoals([], { dateOfBirth: yearsAgo(40) }).goals.steps).toBe(8000);
    expect(suggestedGoals([], { dateOfBirth: yearsAgo(65) }).goals.steps).toBe(7000);
    expect(suggestedGoals([], { dateOfBirth: yearsAgo(16) }).goals.sleepMin).toBe(540);
    expect(suggestedGoals([], null).goals).toEqual(DEFAULT_GOALS);
  });

  it('las kcal y la distancia cambian con el sexo, el peso y la altura', () => {
    const man = fromSteps(8000, { sex: 'male', weightKg: 90, heightCm: 185 });
    const woman = fromSteps(8000, { sex: 'female', weightKg: 58, heightCm: 160 });
    expect(man.activeKcal).toBeGreaterThan(woman.activeKcal);
    expect(man.distanceM).toBeGreaterThan(woman.distanceM);
    expect(woman.activeKcal).toBeGreaterThanOrEqual(200);
    expect(man.activeKcal).toBeLessThanOrEqual(600);
  });

  it('lo que cambia el usuario manda; lo demás sigue la sugerencia', () => {
    const g = effectiveGoals({ ...DEFAULT_GOALS, steps: 9000 }, { activeKcal: 300, steps: undefined, sleepMin: -5 });
    expect(g).toEqual({ ...DEFAULT_GOALS, steps: 9000, activeKcal: 300 });
  });
});

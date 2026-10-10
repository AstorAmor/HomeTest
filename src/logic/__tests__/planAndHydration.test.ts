import { describe, expect, it } from 'vitest';
import { buildPlan } from '@/logic/plan';
import { hydrationFromUrine, urineAdvice } from '@/logic/bathroom';

// El plan de partida sale de las respuestas del onboarding, y la orina da hidratación y consejo.
describe('plan de partida', () => {
  it('sin respuestas: 3 acciones generales', () => {
    const plan = buildPlan(null);
    expect(plan).toHaveLength(3);
    expect(plan.map((p) => p.kind).sort()).toEqual(['nutrition', 'steps', 'strength']);
  });

  it('sedentario que quiere perder peso: pasos desde 6.000 primero', () => {
    const plan = buildPlan({ activity: 'sedentary', goals: ['lose_weight'] });
    expect(plan[0].kind).toBe('steps');
    expect(plan[0].target).toBe(6000);
    expect(plan[0].why).toMatch(/sitting/);
  });

  it('duerme menos de 6 h y quiere más energía: el sueño entra y va primero', () => {
    const plan = buildPlan({ activity: 'active', sleep: 'lt6', goals: ['more_energy'] });
    expect(plan[0].kind).toBe('sleep');
    expect(plan[0].title).toBe('Get to 7 hours of sleep');
  });

  it('tensión alta: la acción de comida es reducir la sal', () => {
    const plan = buildPlan({ conditions: ['hypertension'] });
    expect(plan.find((p) => p.kind === 'nutrition')?.title).toBe('Cut down on salt');
  });

  it('muy activo con objetivo de rendimiento: fuerza y proteína, sin pasos', () => {
    const plan = buildPlan({ activity: 'very_active', goals: ['performance'] });
    expect(plan[0].kind).toBe('strength');
    expect(plan.some((p) => p.kind === 'steps')).toBe(false);
    expect(plan.find((p) => p.kind === 'nutrition')?.title).toBe('Protein at every meal');
  });

  it('estrés: entran las sesiones de calma', () => {
    expect(buildPlan({ goals: ['reduce_stress'] }).some((p) => p.kind === 'mindfulness')).toBe(true);
  });
});

describe('hidratación por la orina', () => {
  it('sin apunte: regla vacía', () => {
    expect(hydrationFromUrine(null).position).toBeNull();
  });
  it('amarillo oscuro: podría beber un poco más; ámbar: signos de deshidratación (tono suave)', () => {
    expect(hydrationFromUrine({ color: 'dark', count: 6 }).label).toBe('Could drink a bit more');
    expect(hydrationFromUrine({ color: 'amber', count: 6 })).toMatchObject({ level: 'low', label: 'Signs of dehydration' });
  });
  it('pocas veces al día empuja hacia deshidratado', () => {
    expect(hydrationFromUrine({ color: 'yellow', count: 3 }).position).toBe(3);
  });
  it('marrón no es cuestión de hidratación', () => {
    expect(hydrationFromUrine({ color: 'brown', count: 5 }).level).toBe('check');
  });
});

describe('consejo al guardar la orina', () => {
  it('ámbar: puede que estés deshidratado', () => {
    expect(urineAdvice({ color: 'amber', count: 6 })?.title).toBe('You may be dehydrated');
  });
  it('rojo sin explicación: al médico; con explicación (remolacha), nada', () => {
    expect(urineAdvice({ color: 'red', count: 6 })?.level).toBe('see_doctor');
    expect(urineAdvice({ color: 'red', count: 6, explainedBy: 'Beetroot' })).toBeNull();
  });
  it('color normal y veces normales: se guarda sin más', () => {
    expect(urineAdvice({ color: 'pale', count: 6 })).toBeNull();
  });
});

describe('sueño: quien ya duerme bastante', () => {
  it('más de 8 h y quiere dormir mejor: horarios regulares, no "duerme más"', () => {
    const sleep = buildPlan({ sleep: 'gt8', goals: ['sleep_better'] }).find((p) => p.kind === 'sleep');
    expect(sleep?.title).toBe('Keep regular sleep times');
    expect(sleep?.why).not.toMatch(/need 7 hours/);
  });
  it('más de 8 h sin objetivo de sueño: el sueño no entra', () => {
    expect(buildPlan({ sleep: 'gt8' }).some((p) => p.kind === 'sleep')).toBe(false);
  });
});

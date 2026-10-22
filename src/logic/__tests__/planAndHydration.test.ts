import { describe, expect, it } from 'vitest';
import { buildPlan } from '@/logic/plan';
import { hydrationFromUrine, urineAdvice } from '@/logic/bathroom';
import { UrineEntry } from '@/types/bathroom';

// El apunte del día tal cual (con sus veces), como lo pasan las pantallas
const day = (e: Partial<UrineEntry>) => e;

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
    expect(plan.find((p) => p.kind === 'nutrition')?.title).toBe('Keep salt under 5 g a day');
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
    expect(hydrationFromUrine(day({ color: 'dark', count: 6 })).label).toBe('Could drink a bit more');
    expect(hydrationFromUrine(day({ color: 'amber', count: 6 }))).toMatchObject({ level: 'low', label: 'Signs of dehydration' });
  });
  it('las veces de hoy no cuentan (el día no ha terminado): solo el color', () => {
    expect(hydrationFromUrine(day({ color: 'yellow', count: 2 }))).toMatchObject({ position: 2, label: 'Hydrated', level: 'good' });
    expect(hydrationFromUrine(day({ color: 'yellow', count: 2 }))).toEqual(hydrationFromUrine(day({ color: 'yellow', count: 8 })));
    expect(hydrationFromUrine(day({ count: 1 }))).toMatchObject({ position: null, label: 'Add the colour' });
  });
  it('marrón no es cuestión de hidratación', () => {
    expect(hydrationFromUrine(day({ color: 'brown', count: 5 })).level).toBe('check');
  });
});

describe('consejo al guardar la orina', () => {
  it('ámbar: puede que estés deshidratado', () => {
    expect(urineAdvice(day({ color: 'amber', count: 6 }))?.title).toBe('You may be dehydrated');
  });
  it('rojo sin explicación: al médico; con explicación (remolacha), nada', () => {
    expect(urineAdvice(day({ color: 'red', count: 6 }))?.level).toBe('see_doctor');
    expect(urineAdvice(day({ color: 'red', count: 6, explainedBy: 'Beetroot' }))).toBeNull();
  });
  it('color normal y veces normales: se guarda sin más', () => {
    expect(urineAdvice(day({ color: 'pale', count: 6 }))).toBeNull();
  });
  it('pocas veces hoy no da aviso: el día no ha terminado (el color y el escozor, sí)', () => {
    for (const count of [0, 1, 2, 3]) {
      expect(urineAdvice(day({ color: 'pale', count }))).toBeNull();
      expect(urineAdvice(day({ count }))).toBeNull();
    }
    expect(urineAdvice(day({ color: 'dark', count: 2 }))?.title).toBe('You could drink a bit more');
    expect(urineAdvice(day({ color: 'pale', count: 2, burning: true }))?.level).toBe('see_doctor');
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

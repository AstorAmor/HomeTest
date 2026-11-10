import { describe, expect, it } from 'vitest';
import { CATALOG } from '@/data/testCatalog';
import { FINDER_STEPS, recommend, toggleOption, visibleOptions } from '@/logic/testFinder';

// Lo que puede pedir cada uno, en el orden del catálogo: lo de «Añadir a tu seguimiento», solo con la suscripción
const orderable = CATALOG.filter((p) => p.orderable !== false);
const MEMBER = orderable.map((p) => p.id);
const NON_MEMBER = orderable.filter((p) => !p.withFollowUp).map((p) => p.id);

describe('Cuestionario: qué analítica pedir', () => {
  it('cada prueba del cuestionario existe en el catálogo', () => {
    const ids = new Set(CATALOG.map((p) => p.id));
    const used = FINDER_STEPS.flatMap((s) => s.options.flatMap((o) => [...Object.keys(o.tests), ...Object.keys(o.female ?? {})]));
    expect(used.filter((id) => !ids.has(id))).toEqual([]);
  });

  it('perder peso sin buscarlo: celiaquía, lo que ya mira el análisis anual y aviso de comentarlo con un médico', () => {
    const r = recommend({ concerns: ['weight_loss'] }, 'male', NON_MEMBER);
    expect(r.picks.map((p) => p.id)).toEqual(['coeliac']);
    expect(r.flags).toContain('weight_loss');
    expect(r.covered).toEqual(expect.arrayContaining(['TSH', 'glucose and HbA1c', 'blood count']));
  });

  it('ganar peso: no hace falta una prueba suelta, lo mira el análisis anual (TSH, azúcar e insulina)', () => {
    const r = recommend({ concerns: ['weight_gain'] }, 'female', NON_MEMBER);
    expect(r.picks).toEqual([]);
    expect(r.covered).toEqual(['TSH', 'glucose and HbA1c', 'insulin']);
  });

  it('cansancio + poco sol: el análisis anual lo mira; con la suscripción, la vitamina D en el seguimiento', () => {
    const member = recommend({ concerns: ['tired'], surroundings: ['less_sun'] }, 'female', MEMBER);
    expect(member.covered).toEqual(['iron and ferritin', 'vitamin B12', 'TSH', 'vitamin D']);
    expect(member.picks.map((p) => p.id)).toEqual(['vitamin_d']);
    expect(member.picks[0].reasons).toEqual(['little sun']);
    // Sin suscripción no se ofrece lo que solo va en el seguimiento
    expect(recommend({ concerns: ['tired'], surroundings: ['less_sun'] }, 'female', NON_MEMBER).picks).toEqual([]);
  });

  it('sin nada concreto: un chequeo general, que es el análisis anual', () => {
    const r = recommend({ changes: ['none'], taking: ['none'] }, undefined, NON_MEMBER);
    expect(r.picks).toEqual([]);
    expect(r.covered).toEqual(expect.arrayContaining(['cholesterol and ApoB', 'glucose and HbA1c', 'TSH']));
  });

  it('estrés y sueño: ningún análisis los mide, se avisa en vez de vender una prueba', () => {
    const r = recommend({ concerns: ['stress', 'sleep'], changes: ['work'] }, 'male', MEMBER);
    expect(r.picks).toEqual([]);
    expect(r.flags).toEqual(['stress_sleep']);
  });

  it('solo una prueba de ITS y nada exclusivo de mujer para un hombre', () => {
    const r = recommend({ concerns: ['libido'], changes: ['partner', 'pregnancy'] }, 'male', NON_MEMBER);
    const ids = r.picks.map((p) => p.id);
    expect(ids.filter((id) => id.startsWith('sti_'))).toEqual(['sti_basic']);
    expect(ids).not.toContain('ovarian_reserve');
    expect(ids[0]).toBe('hormones_m');
  });

  it('deseo sexual en una mujer: sus hormonas, no las del hombre', () => {
    const ids = recommend({ concerns: ['libido'] }, 'female', NON_MEMBER).picks.map((p) => p.id);
    expect(ids[0]).toBe('hormones_f');
    expect(ids).not.toContain('hormones_m');
  });

  it('cambios en la regla: los andrógenos se juntan con la salud hormonal de la mujer, que ya los incluye', () => {
    const r = recommend({ concerns: ['period'] }, 'female', NON_MEMBER);
    expect(r.picks.map((p) => p.id)).toEqual(['hormones_f']);
    expect(r.picks[0].score).toBe(5);
  });

  it('digestión: las pruebas de aliento y la celiaquía, en el orden del catálogo', () => {
    const ids = recommend({ concerns: ['digestion'] }, undefined, NON_MEMBER).picks.map((p) => p.id);
    expect(ids).toEqual(['coeliac', 'sibo', 'lactose', 'fructose', 'hpylori']);
  });

  it('ánimo bajo y alergias se avisan aparte; las alergias llevan a la prueba ALEX', () => {
    const r = recommend({ concerns: ['low'], surroundings: ['allergy'] }, 'male', NON_MEMBER);
    expect(r.flags.sort()).toEqual(['allergy', 'mood']);
    expect(r.picks.map((p) => p.id)).toEqual(['allergy_alex']);
  });

  it('"Nada de esto" desmarca el resto y al revés; las preguntas de mujer no salen a hombres', () => {
    const step = FINDER_STEPS[1];
    expect(toggleOption(step, ['work', 'alcohol'], 'none')).toEqual(['none']);
    expect(toggleOption(step, ['none'], 'work')).toEqual(['work']);
    expect(visibleOptions(step, 'male').some((o) => o.id === 'pregnancy')).toBe(false);
    expect(visibleOptions(step, undefined).some((o) => o.id === 'pregnancy')).toBe(true);
  });
});

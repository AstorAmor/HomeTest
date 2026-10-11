import { describe, expect, it } from 'vitest';
import { FINDER_STEPS, recommend, toggleOption, visibleOptions } from '@/logic/testFinder';

// Precios del catálogo (solo cuentan los ids; el precio desempata)
const PRICES: Record<string, number> = {
  essential: 124.99, weight: 89, performance: 99.99, vitamin_d: 39.99, vitamin_b: 59.99, vitamins: 69.99, iron: 49,
  cycle_hormones: 139.99, cortisol: 49.99, stress: 79.99, fertility_f: 94.99, thyroid: 44.99, thyroid_adv: 124.99,
  amh: 74.99, testosterone: 54.99, cardio: 79.99, diabetes: 74.99, psa: 54.99, lpa: 69.99, coeliac: 69.99,
  digestive_pack: 153, sti_4: 89.99, sti_7: 119.99, sti_11: 149.99,
};

describe('Cuestionario: qué analítica pedir', () => {
  it('cansancio + poco sol: hierro y vitaminas primero, con sus motivos', () => {
    const r = recommend({ concerns: ['tired'], surroundings: ['less_sun'] }, 'female', PRICES);
    const ids = r.picks.map((p) => p.id);
    expect(ids.slice(0, 2).sort()).toEqual(['iron', 'vitamins']);
    // la vitamina D sola se junta con "Vitaminas esenciales" (que ya la incluye)
    expect(ids).not.toContain('vitamin_d');
    expect(r.picks.find((p) => p.id === 'vitamins')!.reasons).toEqual(['tiredness', 'little sun']);
  });

  it('sin nada concreto: chequeo general', () => {
    const r = recommend({ changes: ['none'], taking: ['none'] }, undefined, PRICES);
    expect(r.picks[0].id).toBe('essential');
    expect(r.picks[0].reasons).toEqual(['a general check-up']);
  });

  it('solo un test de ITS y nada exclusivo de mujer para un hombre', () => {
    const r = recommend({ concerns: ['libido'], changes: ['partner', 'pregnancy'] }, 'male', PRICES);
    const ids = r.picks.map((p) => p.id);
    expect(ids.filter((id) => id.startsWith('sti_'))).toEqual(['sti_7']);
    expect(ids).not.toContain('fertility_f');
    expect(ids).not.toContain('amh');
    expect(ids[0]).toBe('testosterone');
  });

  it('deseo sexual en una mujer: ciclo hormonal, no testosterona', () => {
    const ids = recommend({ concerns: ['libido'] }, 'female', PRICES).picks.map((p) => p.id);
    expect(ids[0]).toBe('cycle_hormones');
    expect(ids).not.toContain('testosterone');
  });

  it('ánimo bajo y alergias se avisan aparte', () => {
    const r = recommend({ concerns: ['low'], surroundings: ['allergy'] }, 'male', PRICES);
    expect(r.flags.sort()).toEqual(['allergy', 'mood']);
  });

  it('"Nada de esto" desmarca el resto y al revés; las preguntas de mujer no salen a hombres', () => {
    const step = FINDER_STEPS[1];
    expect(toggleOption(step, ['work', 'alcohol'], 'none')).toEqual(['none']);
    expect(toggleOption(step, ['none'], 'work')).toEqual(['work']);
    expect(visibleOptions(step, 'male').some((o) => o.id === 'pregnancy')).toBe(false);
    expect(visibleOptions(step, undefined).some((o) => o.id === 'pregnancy')).toBe(true);
  });
});

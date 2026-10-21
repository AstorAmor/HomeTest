import { describe, expect, it } from 'vitest';
import { bmi, bmiBand, compositionSlices } from '@/logic/weight';

describe('IMC', () => {
  it('kg / m² con un decimal, y sin altura o con datos raros no hay IMC', () => {
    expect(bmi(70, 175)).toBe(22.9);
    expect(bmi(70, undefined)).toBeNull();
    expect(bmi(70, 40)).toBeNull();
  });

  it('las franjas de la OMS', () => {
    expect(bmiBand(18.4)).toBe('under');
    expect(bmiBand(22)).toBe('normal');
    expect(bmiBand(24.9)).toBe('normal');
    expect(bmiBand(27)).toBe('over');
    expect(bmiBand(31)).toBe('obese');
  });
});

describe('Composición en el donut', () => {
  it('pasa la grasa a kg y lo que falta hasta el peso es el resto', () => {
    const s = compositionSlices(80, { body_fat: 25, muscle_mass: 50, bone_mass: 3 })!;
    expect(s).toEqual([
      { kind: 'fat', kg: 20 },
      { kind: 'muscle', kg: 50 },
      { kind: 'bone', kg: 3 },
      { kind: 'rest', kg: 7 },
    ]);
  });

  it('si la báscula suma más que el peso, reparte en proporción y no queda resto', () => {
    const s = compositionSlices(70, { body_fat: 20, muscle_mass: 60, bone_mass: 3 })!;
    expect(s.reduce((a, x) => a + x.kg, 0)).toBeCloseTo(70, 0);
    expect(s.find((x) => x.kind === 'rest')).toBeUndefined();
  });

  it('sin datos de composición no hay donut', () => {
    expect(compositionSlices(70, {})).toBeNull();
  });
});

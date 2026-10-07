import { describe, expect, it } from 'vitest';
import {
  axisPadding,
  HORIZON_MONTHS,
  getResponseProfile,
  projectionCurve,
  responseFraction,
} from '../projection';

describe('responseFraction', () => {
  const shapes = [
    { shape: 'linear', months: 0 },
    { shape: 'exponential', months: 1 },
    { shape: 'exponential', months: 4 },
    { shape: 'sigmoid', months: 2, steepness: 1.6 },
  ] as const;

  it.each(shapes)('va de 0 a 1 y nunca baja (%o)', (profile) => {
    expect(responseFraction(0, profile)).toBeCloseTo(0, 10);
    expect(responseFraction(HORIZON_MONTHS, profile)).toBeCloseTo(1, 10);
    let prev = -1;
    for (let m = 0; m <= HORIZON_MONTHS; m += 0.25) {
      const f = responseFraction(m, profile);
      expect(f).toBeGreaterThanOrEqual(prev);
      prev = f;
    }
  });

  it('la exponencial hace la mayor parte del cambio al principio', () => {
    const vitD = getResponseProfile('vitamin_d');
    expect(responseFraction(3, vitD)).toBeGreaterThan(0.9);
    // y es cóncava: el primer mes cambia más que el último
    const first = responseFraction(1, vitD) - responseFraction(0, vitD);
    const last = responseFraction(6, vitD) - responseFraction(5, vitD);
    expect(first).toBeGreaterThan(last * 10);
  });

  it('la S arranca despacio, acelera y se aplana', () => {
    const homa = getResponseProfile('homa_ir');
    const d = (a: number, b: number) => responseFraction(b, homa) - responseFraction(a, homa);
    expect(d(0, 1)).toBeLessThan(d(1, 2));
    expect(d(5, 6)).toBeLessThan(d(1, 2));
    expect(responseFraction(2, homa)).toBeCloseTo(0.5, 1);
  });

  it('se recorta fuera del horizonte', () => {
    const p = getResponseProfile('hba1c');
    expect(responseFraction(-1, p)).toBe(0);
    expect(responseFraction(12, p)).toBe(1);
  });
});

describe('projectionCurve', () => {
  const input = { markerId: 'vitamin_d', currentValue: 26, expectedValue: 38, rangeLow: 32, rangeHigh: 44 };

  it('empieza en el valor medido sin banda y acaba en el rango esperado', () => {
    const curve = projectionCurve(input);
    expect(curve[0]).toEqual({ month: 0, expected: 26, low: 26, high: 26 });
    const end = curve[curve.length - 1];
    expect(end.month).toBe(HORIZON_MONTHS);
    expect(end.expected).toBeCloseTo(38);
    expect(end.low).toBeCloseTo(32);
    expect(end.high).toBeCloseTo(44);
  });

  it('funciona también cuando el marcador tiene que bajar', () => {
    const curve = projectionCurve({ markerId: 'triglycerides', currentValue: 108, expectedValue: 90, rangeLow: 78, rangeHigh: 105 });
    for (const p of curve) {
      expect(p.low).toBeLessThanOrEqual(p.high);
      expect(p.expected).toBeLessThanOrEqual(108);
    }
  });

  it('un marcador sin perfil usa una exponencial suave por defecto', () => {
    expect(getResponseProfile('marcador_inventado').shape).toBe('exponential');
  });
});

describe('axisPadding', () => {
  it('se ajusta al cambio en marcadores de valores pequeños', () => {
    expect(axisPadding(5.0, 5.4)).toBeCloseTo(0.06);
    expect(axisPadding(1.4, 2.23)).toBeLessThan(0.2);
  });
  it('sin cambio, deja un margen razonable', () => {
    expect(axisPadding(100, 100)).toBe(5);
  });
});

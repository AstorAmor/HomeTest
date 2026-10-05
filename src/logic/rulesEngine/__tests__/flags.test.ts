import { describe, expect, it } from 'vitest';
import { buildBiomarkerResult, computeFlag } from '../flags';

describe('computeFlag', () => {
  it('marca en_rango cuando el valor cae dentro de min/max', () => {
    expect(computeFlag(90, 70, 100)).toBe('en_rango');
  });

  it('marca por_encima cuando el valor supera el máximo', () => {
    expect(computeFlag(110, 70, 100)).toBe('por_encima');
  });

  it('marca por_debajo cuando el valor está bajo el mínimo', () => {
    expect(computeFlag(50, 70, 100)).toBe('por_debajo');
  });

  it('marca sin_rango cuando falta min o max', () => {
    expect(computeFlag(90, null, 100)).toBe('sin_rango');
    expect(computeFlag(90, 70, null)).toBe('sin_rango');
  });
});

describe('buildBiomarkerResult', () => {
  it('usa el rango del laboratorio por defecto (sin ajuste por ciclo)', () => {
    const result = buildBiomarkerResult(
      { canonicalId: 'GLUCOSE', value: 95, unit: 'mg/dL', measuredAt: '2026-10-01T08:00:00.000Z', rangeMin: 70, rangeMax: 100 },
      null
    );
    expect(result.flag).toBe('en_rango');
    expect(result.referenceRange).toEqual({ min: 70, max: 100, unit: 'mg/dL', adjustedForCyclePhase: null });
    expect(result.previousValue).toBeNull();
  });

  it('incorpora el resultado anterior cuando existe', () => {
    const result = buildBiomarkerResult(
      { canonicalId: 'GLUCOSE', value: 95, unit: 'mg/dL', measuredAt: '2026-10-01T08:00:00.000Z', rangeMin: 70, rangeMax: 100 },
      { value: 88, measuredAt: '2026-04-01T08:00:00.000Z' }
    );
    expect(result.previousValue).toBe(88);
    expect(result.previousMeasuredAt).toBe('2026-04-01T08:00:00.000Z');
  });

  it('respeta un rango ya ajustado cuando se le pasa explícitamente', () => {
    const result = buildBiomarkerResult(
      { canonicalId: 'FSH', value: 12, unit: 'mIU/mL', measuredAt: '2026-10-01T08:00:00.000Z', rangeMin: 3, rangeMax: 20 },
      null,
      { min: 4.7, max: 21.5, cyclePhase: 'ovulation' }
    );
    expect(result.referenceRange).toEqual({ min: 4.7, max: 21.5, unit: 'mIU/mL', adjustedForCyclePhase: 'ovulation' });
  });
});

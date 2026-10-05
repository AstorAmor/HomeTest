import { describe, expect, it } from 'vitest';
import {
  computeAlbuminGlobulinRatio,
  computeBunCreatinineRatio,
  computeGlobulin,
  computeHomaIr,
  computeIronSaturation,
  computeLdlFriedewald,
  computeNonHdlCholesterol,
  computeTcHdlRatio,
  BiomarkerLookup,
  AvailableBiomarker,
} from '../ratios';

// Helper: construye un BiomarkerLookup a partir de un mapa fijo, para no
// repetir el boilerplate en cada test.
function lookupFrom(values: Record<string, AvailableBiomarker>): BiomarkerLookup {
  return (canonicalId: string) => values[canonicalId] ?? null;
}

describe('computeLdlFriedewald', () => {
  it('calcula LDL con un panel lipídico normal en mg/dL', () => {
    const lookup = lookupFrom({
      TOTAL_CHOLESTEROL: { value: 200, unit: 'mg/dL' },
      HDL_C: { value: 50, unit: 'mg/dL' },
      TRIGLYCERIDES: { value: 150, unit: 'mg/dL' },
    });
    const result = computeLdlFriedewald(lookup);
    expect(result.value).toBe(120);
    expect(result.unit).toBe('mg/dL');
    expect(result.unavailableReason).toBeNull();
  });

  it('convierte de mmol/L a mg/dL antes de calcular', () => {
    const lookup = lookupFrom({
      TOTAL_CHOLESTEROL: { value: 5.17, unit: 'mmol/L' }, // ~200 mg/dL
      HDL_C: { value: 50, unit: 'mg/dL' },
      TRIGLYCERIDES: { value: 150, unit: 'mg/dL' },
    });
    const result = computeLdlFriedewald(lookup);
    expect(result.value).not.toBeNull();
    expect(result.value!).toBeCloseTo(120, 0);
  });

  it('devuelve null con motivo cuando falta un input', () => {
    const lookup = lookupFrom({
      TOTAL_CHOLESTEROL: { value: 200, unit: 'mg/dL' },
      HDL_C: { value: 50, unit: 'mg/dL' },
    });
    const result = computeLdlFriedewald(lookup);
    expect(result.value).toBeNull();
    expect(result.unavailableReason).toContain('TRIGLYCERIDES');
  });

  it('rechaza el cálculo cuando los triglicéridos son >= 400 mg/dL (Friedewald inválido)', () => {
    const lookup = lookupFrom({
      TOTAL_CHOLESTEROL: { value: 220, unit: 'mg/dL' },
      HDL_C: { value: 45, unit: 'mg/dL' },
      TRIGLYCERIDES: { value: 420, unit: 'mg/dL' },
    });
    const result = computeLdlFriedewald(lookup);
    expect(result.value).toBeNull();
    expect(result.unavailableReason).toMatch(/Friedewald/);
  });
});

describe('computeNonHdlCholesterol y computeTcHdlRatio', () => {
  const lookup = lookupFrom({
    TOTAL_CHOLESTEROL: { value: 200, unit: 'mg/dL' },
    HDL_C: { value: 50, unit: 'mg/dL' },
  });

  it('Colesterol no-HDL = TC - HDL', () => {
    expect(computeNonHdlCholesterol(lookup).value).toBe(150);
  });

  it('Ratio TC/HDL', () => {
    expect(computeTcHdlRatio(lookup).value).toBe(4);
  });
});

describe('computeBunCreatinineRatio', () => {
  it('calcula el ratio en mg/dL', () => {
    const lookup = lookupFrom({
      BUN: { value: 14, unit: 'mg/dL' },
      CREATININE: { value: 1.0, unit: 'mg/dL' },
    });
    expect(computeBunCreatinineRatio(lookup).value).toBe(14);
  });

  it('convierte creatinina en µmol/L a mg/dL', () => {
    const lookup = lookupFrom({
      BUN: { value: 14, unit: 'mg/dL' },
      CREATININE: { value: 88.4, unit: 'µmol/L' }, // = 1.0 mg/dL
    });
    expect(computeBunCreatinineRatio(lookup).value).toBeCloseTo(14, 0);
  });

  it('no usa UREA como sustituto de BUN', () => {
    const lookup = lookupFrom({
      UREA: { value: 30, unit: 'mg/dL' },
      CREATININE: { value: 1.0, unit: 'mg/dL' },
    });
    const result = computeBunCreatinineRatio(lookup);
    expect(result.value).toBeNull();
    expect(result.unavailableReason).toContain('BUN');
  });
});

describe('computeGlobulin y computeAlbuminGlobulinRatio', () => {
  it('Globulina = Proteínas totales - Albúmina', () => {
    const lookup = lookupFrom({
      TOTAL_PROTEIN: { value: 7.0, unit: 'g/dL' },
      ALBUMIN: { value: 4.0, unit: 'g/dL' },
    });
    expect(computeGlobulin(lookup).value).toBeCloseTo(3.0, 2);
  });

  it('ratio Albúmina/Globulina', () => {
    const lookup = lookupFrom({
      TOTAL_PROTEIN: { value: 7.0, unit: 'g/dL' },
      ALBUMIN: { value: 4.0, unit: 'g/dL' },
    });
    expect(computeAlbuminGlobulinRatio(lookup).value).toBeCloseTo(1.33, 2);
  });

  it('convierte g/L a g/dL', () => {
    const lookup = lookupFrom({
      TOTAL_PROTEIN: { value: 70, unit: 'g/L' },
      ALBUMIN: { value: 40, unit: 'g/L' },
    });
    expect(computeGlobulin(lookup).value).toBeCloseTo(3.0, 2);
  });
});

describe('computeIronSaturation', () => {
  it('Hierro / TIBC * 100', () => {
    const lookup = lookupFrom({
      IRON: { value: 100, unit: 'µg/dL' },
      IRON_BINDING_CAPACITY: { value: 300, unit: 'µg/dL' },
    });
    expect(computeIronSaturation(lookup).value).toBeCloseTo(33.3, 1);
  });
});

describe('computeHomaIr', () => {
  it('(glucosa mg/dL * insulina µU/mL) / 405', () => {
    const lookup = lookupFrom({
      GLUCOSE: { value: 90, unit: 'mg/dL' },
      INSULIN: { value: 8, unit: 'µU/mL' },
    });
    expect(computeHomaIr(lookup).value).toBeCloseTo(1.78, 2);
  });

  it('acepta mIU/L como equivalente a µU/mL', () => {
    const lookup = lookupFrom({
      GLUCOSE: { value: 90, unit: 'mg/dL' },
      INSULIN: { value: 8, unit: 'mIU/L' },
    });
    expect(computeHomaIr(lookup).value).toBeCloseTo(1.78, 2);
  });

  it('convierte glucosa en mmol/L', () => {
    const lookup = lookupFrom({
      GLUCOSE: { value: 5.0, unit: 'mmol/L' }, // ~90 mg/dL
      INSULIN: { value: 8, unit: 'µU/mL' },
    });
    expect(computeHomaIr(lookup).value).toBeCloseTo(1.78, 1);
  });

  it('rechaza insulina en pmol/L en vez de asumir un factor no confirmado', () => {
    const lookup = lookupFrom({
      GLUCOSE: { value: 90, unit: 'mg/dL' },
      INSULIN: { value: 55, unit: 'pmol/L' },
    });
    const result = computeHomaIr(lookup);
    expect(result.value).toBeNull();
    expect(result.unavailableReason).toMatch(/pmol\/L/);
  });

  it('devuelve null con motivo cuando falta la insulina', () => {
    const lookup = lookupFrom({ GLUCOSE: { value: 90, unit: 'mg/dL' } });
    const result = computeHomaIr(lookup);
    expect(result.value).toBeNull();
    expect(result.unavailableReason).toContain('INSULIN');
  });
});

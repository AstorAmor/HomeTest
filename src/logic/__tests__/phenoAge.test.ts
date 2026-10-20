import { describe, expect, it } from 'vitest';
import { PhenoValues, phenoAge, phenoAgeDrivers, phenoAgeMargin, toPhenoUnits } from '@/logic/phenoAge';
import { PHENOAGE_INPUTS } from '@/logic/kuovaAge';
import baselineReport from '@/data/seed/hometest/hometest_report_baseline.json';
import currentReport from '@/data/seed/hometest/hometest_report_current.json';

// Los 9 valores del informe de ejemplo "actual" (src/data/seed/hometest/hometest_report_current.json),
// pasados a mano a las unidades del modelo
const current: PhenoValues = {
  albumin: 45, // 4,5 g/dL
  creatinine: 0.95 * 88.42, // mg/dL → µmol/L
  glucose: 92 / 18.016, // mg/dL → mmol/L
  hs_crp: 0.16, // 1,6 mg/L → mg/dL
  lymphocytes_pct: 33,
  mcv: 88,
  rdw: 12.8,
  alp: 74,
  wbc: 6.4,
};
const baseline: PhenoValues = {
  albumin: 44,
  creatinine: 1.02 * 88.42,
  glucose: 104 / 18.016,
  hs_crp: 0.48,
  lymphocytes_pct: 30,
  mcv: 87,
  rdw: 13.2,
  alp: 78,
  wbc: 7.2,
};

describe('PhenoAge (Levine 2018)', () => {
  it('calculado a mano: el ejemplo actual da 25,5 años y el inicial 31,3 (edad real 32)', () => {
    // xb actual = -19,90667 + 9,3649 (suma de los 9 términos y la edad) = -10,5418
    // PhenoAge = (ln(1,09071) + xb) / 0,090165 + 141,50225 = 25,55
    expect(phenoAge(current, 32)).toBeCloseTo(25.55, 1);
    expect(phenoAge(baseline, 32)).toBeCloseTo(31.32, 1);
  });

  it('la PCR en mg/L sin pasar a mg/dL sumaría unos 2,4 años', () => {
    const wrong = { ...current, hs_crp: 1.6 }; // 1,6 tomado como mg/dL
    expect(phenoAge(wrong, 32) - phenoAge(current, 32)).toBeCloseTo(0.09536762 * Math.log(10) / 0.090165, 2); // 2,44
    expect(toPhenoUnits('hs_crp', 1.6, 'mg/L')).toBeCloseTo(0.16, 5);
  });

  it('la PCR por debajo del límite de detección tiene un suelo (0,1 mg/L)', () => {
    expect(phenoAge({ ...current, hs_crp: 0 }, 32)).toBeCloseTo(phenoAge({ ...current, hs_crp: 0.01 }, 32), 6);
    expect(Number.isFinite(phenoAge({ ...current, hs_crp: 0 }, 32))).toBe(true);
  });

  it('convierte las unidades españolas y rechaza las que no sirven', () => {
    expect(toPhenoUnits('albumin', 4.5, 'g/dL')).toBe(45);
    expect(toPhenoUnits('albumin', 45, 'g/L')).toBe(45);
    expect(toPhenoUnits('creatinine', 0.95, 'mg/dL')).toBeCloseTo(84.0, 1);
    expect(toPhenoUnits('glucose', 92, 'mg/dL')).toBeCloseTo(5.107, 3);
    expect(toPhenoUnits('glucose', 5.1, 'mmol/L')).toBe(5.1);
    expect(toPhenoUnits('wbc', 6100, '/mm3')).toBe(6.1);
    expect(toPhenoUnits('wbc', 6.4, 'x10^9/L')).toBe(6.4);
    expect(toPhenoUnits('rdw', 42, 'fL')).toBeNull(); // ADE-SD
    expect(toPhenoUnits('hs_crp', 1.6, '')).toBeNull(); // sin unidad no se sabe si es mg/L o mg/dL
    expect(toPhenoUnits('lymphocytes_pct', 2.1, '10^3/µL')).toBeNull();
  });

  it('margen por variación biológica (EFLM): unos ±3 años, y el ADE es lo que más pesa', () => {
    const m = phenoAgeMargin(current);
    expect(m).toBeGreaterThan(2.5);
    expect(m).toBeLessThan(3.5);
    // Sin variación en el ADE el margen baja más que quitando cualquier otro valor
    expect(phenoAgeMargin({ ...current, rdw: 0 })).toBeLessThan(phenoAgeMargin({ ...current, glucose: 0 }));
  });

  it('qué suma o quita años frente a un adulto típico', () => {
    const d = phenoAgeDrivers(baseline);
    expect(d.map((x) => x.marker_id)).toEqual(expect.arrayContaining(['glucose', 'hs_crp']));
    expect(d.every((x) => x.direction === 'suma' && Math.abs(x.years) >= 0.5)).toBe(true);
  });
});

// Los informes de ejemplo tienen que cuadrar con sus propios valores: centro del intervalo = PhenoAge
// de sus 9 marcadores, y los "drivers" solo pueden ser valores de PhenoAge
describe('Informes de ejemplo coherentes con PhenoAge', () => {
  for (const [name, report] of [
    ['inicial', baselineReport],
    ['actual', currentReport],
  ] as const) {
    it(`informe ${name}`, () => {
      const ms = report.sections.flatMap((s: any) => s.markers ?? []);
      const values = {} as PhenoValues;
      for (const { id } of PHENOAGE_INPUTS) {
        const m = ms.find((x: any) => x.marker_id === id);
        values[id] = toPhenoUnits(id, m.value, m.unit)!;
      }
      const p = report.summary.phenoage;
      expect((p.low + p.high) / 2).toBeCloseTo(phenoAge(values, p.chronological_age), 0);
      expect((p.high - p.low) / 2).toBeCloseTo(phenoAgeMargin(values), 0);
      for (const d of p.drivers) expect(PHENOAGE_INPUTS.map((i) => i.id)).toContain(d.marker_id);
    });
  }
});

import { describe, expect, it } from 'vitest';
import { bpLevel } from '@/logic/bloodPressure';
import { kuovaAge, kuovaAgeFromUploads, phenoAgeCoverage, realChange } from '@/logic/kuovaAge';
import type { LabUpload } from '@/data/labUploads';

const upload = (id: string, testDate: string, parametros: { nombre: string; unidad: string; valor: number }[]): LabUpload => ({
  id,
  labName: 'Lab',
  testDate,
  createdAt: `${testDate}T10:00:00Z`,
  data: {
    paciente: { nombre: null, fecha_recepcion: null, fecha_validacion: null, numero_informe: null, laboratorio: null },
    secciones: [{ titulo: 'Bioquímica', parametros: parametros.map((p) => ({ ...p, rango_min: null, rango_max: null })) }],
  },
});

// Los 9 valores del informe de ejemplo "actual", como vendrían en una analítica española
const nine = (over: Record<string, number | string> = {}) =>
  [
    { nombre: 'Albúmina', unidad: 'g/dL', valor: 4.5 },
    { nombre: 'Creatinina', unidad: 'mg/dL', valor: 0.95 },
    { nombre: 'Glucosa', unidad: 'mg/dL', valor: 92 },
    { nombre: 'PCR ultrasensible', unidad: (over.crpUnit as string) ?? 'mg/L', valor: (over.crp as number) ?? 1.6 },
    { nombre: 'Linfocitos', unidad: '%', valor: 33 },
    { nombre: 'VCM', unidad: 'fL', valor: 88 },
    { nombre: 'ADE', unidad: '%', valor: 12.8 },
    { nombre: 'Fosfatasa alcalina', unidad: 'U/L', valor: 74 },
    { nombre: 'Leucocitos', unidad: 'x10^9/L', valor: 6.4 },
  ];

describe('Edad KUOVA', () => {
  it('del intervalo del ejemplo: el centro y su margen', () => {
    const k = kuovaAge({ low: 22.5, high: 28.5, chronological_age: 32 });
    expect(k).toEqual({ age: 25.5, diff: 6.5, margin: 3 });
  });

  it('solo hay cambio real si supera el margen combinado de las dos analíticas', () => {
    const before = kuovaAge({ low: 28.2, high: 34.4, chronological_age: 32 }); // 31,3 ± 3,1
    const now = kuovaAge({ low: 22.5, high: 28.5, chronological_age: 32 }); // 25,5 ± 3,0
    expect(realChange(now, before)).toBe(-5.8); // más que √(3² + 3,1²) = 4,3
    expect(realChange({ ...now, age: 28 }, before)).toBeNull(); // −3,3: dentro del margen
  });

  it('con una analítica completa y la fecha de nacimiento, la calcula (PCR en mg/L)', () => {
    // 32 años el día de la analítica: la misma cuenta que el ejemplo, 25,5 años
    const r = kuovaAgeFromUploads([upload('a', '2026-10-01', nine())], '1994-10-01');
    expect(r.status).toBe('ok');
    if (r.status !== 'ok') return;
    expect(r.k.age).toBeCloseTo(25.5, 0);
    expect(r.k.margin).toBeCloseTo(3, 0);
    expect(r.previous).toBeNull();
  });

  it('la PCR en mg/dL se usa tal cual (0,16 mg/dL = 1,6 mg/L: misma edad)', () => {
    const a = kuovaAgeFromUploads([upload('a', '2026-10-01', nine())], '1994-10-01');
    const b = kuovaAgeFromUploads([upload('a', '2026-10-01', nine({ crp: 0.16, crpUnit: 'mg/dL' }))], '1994-10-01');
    expect(a.status === 'ok' && b.status === 'ok' && a.k.age === b.k.age).toBe(true);
  });

  it('no la calcula con la PCR por encima de 10 mg/L, sin fecha de nacimiento, fuera de 20-84 años o sin unidad de PCR', () => {
    expect(kuovaAgeFromUploads([upload('a', '2026-10-01', nine({ crp: 14 }))], '1994-10-01').status).toBe('high_crp');
    expect(kuovaAgeFromUploads([upload('a', '2026-10-01', nine())], null).status).toBe('no_dob');
    expect(kuovaAgeFromUploads([upload('a', '2026-10-01', nine())], '2010-01-01').status).toBe('age_range');
    expect(kuovaAgeFromUploads([upload('a', '2026-10-01', nine())], '1940-01-01').status).toBe('age_range');
    const r = kuovaAgeFromUploads([upload('a', '2026-10-01', nine({ crpUnit: '' }))], '1994-10-01');
    expect(r.status === 'unit' && r.marker).toBe('hs_crp');
  });

  it('con dos analíticas completas, compara con la anterior', () => {
    const r = kuovaAgeFromUploads(
      [upload('antes', '2026-04-01', nine({ crp: 4.8 })), upload('ahora', '2026-10-01', nine())],
      '1994-10-01',
    );
    expect(r.status === 'ok' && r.previous != null && r.previous.age > r.k.age).toBe(true);
  });

  it('de las analíticas subidas, cuenta la más completa de los 9 valores', () => {
    const c = phenoAgeCoverage([
      upload('vieja', '2026-03-01', [{ nombre: 'Glucosa', unidad: 'mg/dL', valor: 90 }]),
      upload('nueva', '2026-10-01', [
        { nombre: 'Glucosa', unidad: 'mg/dL', valor: 92 },
        { nombre: 'Creatinina', unidad: 'mg/dL', valor: 0.9 },
        { nombre: 'Proteína C reactiva', unidad: 'mg/L', valor: 1.2 },
        { nombre: 'Linfocitos', unidad: '10^3/µL', valor: 2.1 }, // absolutos: no valen
        { nombre: 'Linfocitos', unidad: '%', valor: 31 },
        { nombre: 'VCM', unidad: 'fL', valor: 89 },
        { nombre: 'ADE', unidad: '%', valor: 12.8 },
      ]),
    ]);
    expect(c.have).toEqual(['creatinine', 'glucose', 'hs_crp', 'lymphocytes_pct', 'mcv', 'rdw']);
    expect(c.missing).toEqual(['albumin', 'alp', 'wbc']);
    expect(phenoAgeCoverage([]).have).toEqual([]);
  });
});

describe('Semáforo de la tensión', () => {
  it('verde, amarillo y rojo con los cortes europeos', () => {
    expect(bpLevel(120, 80)).toBe('ok');
    expect(bpLevel(134, 86)).toBe('watch');
    expect(bpLevel(85, 55)).toBe('watch');
    expect(bpLevel(142, 88)).toBe('high');
    expect(bpLevel(128, 92)).toBe('high');
  });
});

describe('VO2max (FRIEND 2015)', () => {
  it('banda según la edad y el sexo', async () => {
    const { vo2Band, vo2RowFor } = await import('@/logic/vo2max');
    expect(vo2RowFor(32, 'male').p[2]).toBe(42.4);
    expect(vo2Band(42.4, 32, 'male')).toBe('good');
    expect(vo2Band(30, 32, 'male')).toBe('low');
    expect(vo2Band(30, 32, 'female')).toBe('fair');
    expect(vo2Band(60, 25, 'male')).toBe('excellent');
    expect(vo2Band(40, 85, 'female')).toBe('superior'); // por encima de 79 usa 70-79
  });
});

import { describe, expect, it } from 'vitest';
import { getRangeStatus, rangeText } from '@/utils/rangeStatus';
import { labValuesFrom } from '@/logic/labUploadValues';
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

describe('rangos de un solo límite', () => {
  it('"< 200": por encima solo si lo supera', () => {
    expect(getRangeStatus(185, null, 200)).toBe('en_rango');
    expect(getRangeStatus(231, null, 200)).toBe('por_encima');
    expect(rangeText(null, 200)).toBe('< 200');
  });
  it('"> 40": por debajo solo si no llega', () => {
    expect(getRangeStatus(52, 40, null)).toBe('en_rango');
    expect(getRangeStatus(35, 40, null)).toBe('por_debajo');
    expect(rangeText(40, null)).toBe('> 40');
  });
  it('sin ningún límite no hay referencia', () => {
    expect(getRangeStatus(10, null, null)).toBe('sin_rango');
    expect(rangeText(null, null)).toBeNull();
  });
});

describe('valores de las analíticas subidas para Mis datos', () => {
  it('saca glucosa y colesterol total, y pasa mmol/L a mg/dL', () => {
    const uploads = [
      upload('a', '2026-10-10', [
        { nombre: 'Glucosa basal', unidad: 'mg/dL', valor: 92 },
        { nombre: 'Colesterol total', unidad: 'mmol/L', valor: 5 },
        { nombre: 'HDL Colesterol', unidad: 'mg/dL', valor: 55 },
      ]),
    ];
    expect(labValuesFrom(uploads, 'glucose')).toEqual([
      { id: 'lab:a:glucose', uploadId: 'a', fecha: '2026-10-10T12:00:00', valor: 92, unidad: 'mg/dL' },
    ]);
    expect(labValuesFrom(uploads, 'total_cholesterol')[0].valor).toBe(193.4);
    expect(labValuesFrom(uploads, 'cortisol_am')).toEqual([]);
  });
});

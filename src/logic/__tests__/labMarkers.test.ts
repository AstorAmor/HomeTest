import { describe, expect, it } from 'vitest';
import type { LabUpload } from '@/data/labUploads';
import type { PlanVersion } from '@/data/planVersions';
import { chartBand, chartPoints, DEFAULT_CHARTS, latestAnalysis, normalizeCharts, toggleChart, markerHistory, markerKey, markerSummaries, pointsFromUploads, sourceParam, stateCounts, type MarkerPoint } from '@/logic/labMarkers';
import { specialistPlans } from '@/logic/specialistPlan';
import { labGoalForMarker } from '@/logic/metas';

// Notas del fundador del 2026-11-06: «Analíticas» en Mis datos y la ficha de cada marcador con todos sus valores
const param = (nombre: string, valor: number | string, unidad: string, rango_min: number | null, rango_max: number | null) => ({ nombre, valor, unidad, rango_min, rango_max });
const upload = (id: string, testDate: string | null, labName: string, parametros: ReturnType<typeof param>[]): LabUpload =>
  ({ id, labName, testDate, createdAt: '2026-10-30T10:00:00.000Z', data: { secciones: [{ titulo: 'Bioquímica', parametros }] } }) as unknown as LabUpload;

const UPLOADS = [
  upload('u1', '2026-09-01', 'Lab A', [
    param('Glucosa', 110, 'mg/dL', 70, 100),
    param('Proteína Zeta', 'Negativo', '', null, null),
    param('Colesterol LDL', 90, 'mg/dL', 0, 130),
  ]),
  upload('u2', null, 'Lab B', [param('Glucosa', 5.2, 'mmol/L', 3.9, 5.6), param('GLUCOSA', 99, 'mg/dL', 70, 100), param('Colesterol HDL', 35, 'mg/dL', 40, null)]),
];

describe('Valores de las analíticas por marcador', () => {
  const points = pointsFromUploads(UPLOADS);

  it('la clave es la del catálogo si reconoce el nombre y, si no, el nombre sin tildes ni signos', () => {
    expect(markerKey('Glucosa')).toBe('glucose');
    expect(markerKey('Proteína  Zeta!')).toBe('n:proteina zeta');
    expect(markerKey('PROTEINA ZETA')).toBe(markerKey('Proteína Zeta'));
  });

  it('un valor por marcador y analítica, con la fecha de la analítica (o la de subida)', () => {
    expect(points.filter((p) => p.source.id === 'u2' && p.key === 'glucose')).toHaveLength(1);
    expect(points.find((p) => p.source.id === 'u2')?.date).toBe('2026-10-30');
    expect(points.find((p) => p.key === 'n:proteina zeta')).toMatchObject({ value: null, text: 'Negativo' });
    expect(sourceParam(points[0].source)).toBe('upload:u1');
  });

  it('el resumen va con el último valor: primero lo que está fuera del rango y al final lo que no tiene referencia', () => {
    const list = markerSummaries(points);
    expect(list.map((s) => [s.latest.name, s.state])).toEqual([
      ['Colesterol HDL', 'por_debajo'],
      ['Colesterol LDL', 'en_rango'],
      ['Glucosa', 'en_rango'],
      ['Proteína Zeta', 'sin_rango'],
    ]);
    expect(list.find((s) => s.key === 'glucose')).toMatchObject({ count: 2, latest: { value: 5.2 } });
    expect(stateCounts(list)).toEqual({ out: 1, in: 2, none: 1 });
  });

  it('el historial va del más antiguo al más reciente y la gráfica no mezcla unidades', () => {
    const h = markerHistory(points, 'glucose');
    expect(h.map((p) => p.value)).toEqual([110, 5.2]);
    const chart = chartPoints(h);
    expect(chart.points.map((p) => p.value)).toEqual([5.2]);
    expect(chart.otherUnits).toBe(1);
    expect(chartPoints(markerHistory(points, 'n:proteina zeta'))).toEqual({ points: [], otherUnits: 0 });
  });

  it('la franja del rango se recorta cerca de los valores y vale con un solo límite', () => {
    expect(chartBand([24, 34], 30, 400)).toEqual({ low: 30, high: 54 });
    expect(chartBand([165, 132], null, 130)).toEqual({ low: 132 - 2 * 41.25, high: 130 });
    expect(chartBand([90, 95], 70, 100)).toEqual({ low: 70, high: 100 });
    expect(chartBand([5], null, null)).toBeUndefined();
    expect(chartBand([10, 12], 500, 900)).toBeUndefined();
  });

  it('el mismo día, lo que has subido va antes que el informe de ejemplo', () => {
    const report = { ...points[0], source: { kind: 'report', id: 'current', lab: 'Ejemplo' }, date: '2026-10-30' } as MarkerPoint;
    expect(latestAnalysis([report, ...points])?.source.kind).toBe('upload');
  });
});

describe('Plan del especialista y objetivo de un marcador', () => {
  it('solo se enseñan los planes que manda un especialista, el último primero', () => {
    const v = (id: string, source: PlanVersion['source'], createdAt: string) => ({ id, source, basedOn: null, items: [], note: null, createdAt }) as PlanVersion;
    const plans = specialistPlans([v('a', 'upload', '2026-10-01'), v('b', 'professional', '2026-10-02'), v('c', 'report', '2026-10-03'), v('d', 'professional', '2026-10-04')]);
    expect(plans.map((p) => p.id)).toEqual(['d', 'b']);
  });

  it('un marcador fuera del rango lleva a su objetivo solo si hay uno que le toque', () => {
    expect(labGoalForMarker('ldl', 'high')).toBe('ldl');
    expect(labGoalForMarker('triglycerides', 'high')).toBe('tg');
    expect(labGoalForMarker('hba1c', 'high')).toBe('glucosa');
    expect(labGoalForMarker('hdl', 'low')).toBe('hdl');
    expect(labGoalForMarker('hdl', 'high')).toBeNull();
    expect(labGoalForMarker('ferritin', 'low')).toBeNull();
  });
});

describe('Gráficas elegidas en Analíticas', () => {
  it('sin elegir, azúcar, colesterol total y cortisol; lo guardado se limpia', () => {
    expect(normalizeCharts(undefined)).toEqual(DEFAULT_CHARTS);
    expect(normalizeCharts({ keys: 'x' })).toEqual(DEFAULT_CHARTS);
    expect(normalizeCharts({ keys: ['vitamin_d', 'vitamin_d', 3, ''] })).toEqual(['vitamin_d']);
    expect(normalizeCharts({ keys: [] })).toEqual([]);
  });

  it('el ojo pone la gráfica al final o la quita', () => {
    expect(toggleChart(DEFAULT_CHARTS, 'vitamin_d')).toEqual([...DEFAULT_CHARTS, 'vitamin_d']);
    expect(toggleChart(DEFAULT_CHARTS, 'cortisol_am')).toEqual(['glucose', 'total_cholesterol']);
  });
});

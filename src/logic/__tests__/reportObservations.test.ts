import { describe, expect, it } from 'vitest';
import { distanceToRange, reportObservations } from '../reportObservations';
import type { HomeTestReport, ReportMarker } from '@/types/report';
import current from '@/data/seed/hometest/hometest_report_current.json';

const marker = (id: string, value: number | string, prev: number | string | null, low: number | null, high: number | null, flag: ReportMarker['flag'], significant = true): ReportMarker => ({
  marker_id: id,
  display_name: id,
  value,
  value_text: String(value),
  unit: 'u',
  range: { low, high, source: 'laboratorio', adjustment: 'ninguno' },
  flag,
  tier: 'verde',
  trend: prev == null ? undefined : { previous_value: prev, previous_date: '2026-03-01', significant, direction: 'estable', delta_pct: 0 },
  preanalytic_flags: [],
});

const report = (markers: ReportMarker[], extra: Partial<HomeTestReport> = {}): HomeTestReport =>
  ({ sections: [{ category_id: 'x', title: 'X', expanded_by_default: true, markers }], retest: [], action_plan: [], ...extra }) as unknown as HomeTestReport;

describe('distanceToRange', () => {
  it('es 0 dentro del rango y crece al salir', () => {
    expect(distanceToRange(50, 30, 100)).toBe(0);
    expect(distanceToRange(20, 30, 100)).toBeCloseTo(1 / 3);
    expect(distanceToRange(110, 30, 100)).toBeCloseTo(0.1);
    expect(distanceToRange('n/a', 30, 100)).toBeNull();
  });
});

describe('reportObservations', () => {
  it('mejora = vuelve al rango o se acerca; empeora = sale o se aleja; dentro del rango no cuenta', () => {
    const o = reportObservations(
      report([
        marker('back', 50, 20, 30, 100, 'en_rango'),
        marker('closer', 25, 15, 30, 100, 'bajo'),
        marker('out', 120, 90, 30, 100, 'alto'),
        marker('further', 140, 110, 30, 100, 'alto'),
        marker('inside', 40, 80, 30, 100, 'en_rango'),
        marker('noise', 20, 15, 30, 100, 'bajo', false),
        marker('text', 'negativo', 'positivo', null, null, 'en_rango'),
      ]),
    );
    expect(o.backInRange.map((m) => m.marker_id)).toEqual(['back']);
    expect(o.closer.map((m) => m.marker_id)).toEqual(['closer']);
    expect(o.worse.map((m) => m.marker_id)).toEqual(['out', 'further']);
    expect(o.changedInRange.map((m) => m.marker_id)).toEqual(['inside']);
    expect(o.compared).toBe(true);
  });

  it('en qué fijarte: lo que sigue fuera, lo más lejos primero, con su repetición y su plan', () => {
    const o = reportObservations(
      report([marker('a', 105, null, 30, 100, 'alto'), marker('b', 10, null, 30, 100, 'bajo'), marker('c', 99, null, 30, 100, 'limite_alto')], {
        retest: [{ marker_id: 'b', months: 3, reason: 'confirmar' }],
        action_plan: [{ action_id: 'act.b', title: 'Plan B', linked_markers: ['b'] }] as unknown as HomeTestReport['action_plan'],
      }),
    );
    expect(o.focus.map((f) => [f.marker.marker_id, f.side])).toEqual([
      ['b', 'below'],
      ['a', 'above'],
    ]);
    expect(o.focus[0].retest).toEqual({ months: 3, reason: 'confirmar' });
    expect(o.focus[0].actions).toEqual([{ id: 'act.b', title: 'Plan B' }]);
    expect(o.nearLimit.map((m) => m.marker_id)).toEqual(['c']);
    expect(o.compared).toBe(false); // sin analítica anterior
  });

  it('con el informe de ejemplo: 14 vuelven a su rango, 3 se acercan, ninguno empeora y 29 cambian dentro', () => {
    const o = reportObservations(current as unknown as HomeTestReport);
    expect(o.backInRange).toHaveLength(14);
    expect(o.closer.map((m) => m.marker_id).sort()).toEqual(['homa_ir', 'ldl', 'vitamin_d']);
    expect(o.worse).toHaveLength(0);
    expect(o.changedInRange).toHaveLength(29);
    expect(o.focus.map((f) => f.marker.marker_id)).toEqual(['vitamin_d', 'homa_ir', 'ldl']);
  });
});

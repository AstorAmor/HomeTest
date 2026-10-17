import { describe, expect, it, vi } from 'vitest';

// planUpdate lee el informe de ejemplo y el modo de datos (módulos con React Native); aquí no hacen falta
vi.mock('@/data/dataMode', () => ({ showSamples: () => false }));
vi.mock('@/data/reportRepository', () => ({ currentReport: { action_plan: [] } }));
vi.mock('@/data/planVersions', () => ({}));

const { proposeUpdatedPlan } = await import('@/utils/planUpdate');

describe('actualizar el plan con una analítica', () => {
  it('en una primera analítica, lo que sale fuera de rango trae su acción concreta', () => {
    const proposal = proposeUpdatedPlan(
      [{ title: 'Walk 8,000 steps a day', why: '…', markers: [] }],
      {
        changes: [],
        firstTime: [
          { markerId: 'total_cholesterol', name: 'Colesterol total', value: 231, unit: 'mg/dL', status: 'high' },
          { markerId: 'glucose', name: 'Glucosa', value: 92, unit: 'mg/dL', status: 'in' },
        ],
        notCompared: [],
      },
    );
    const added = proposal.items.filter((i) => i.status === 'new');
    expect(added.map((i) => i.title)).toEqual(['Olive oil, nuts, and oily fish 2–3 times a week']);
    expect(added[0].markers).toEqual(['total_cholesterol']);
    expect(proposal.items[0].status).toBe('not_retested');
  });
});

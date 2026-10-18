import { describe, expect, it, vi } from 'vitest';

// planUpdate lee el informe de ejemplo y el modo de datos (módulos con React Native); aquí no hacen falta
vi.mock('@/data/dataMode', () => ({ showSamples: () => false }));
vi.mock('@/data/reportRepository', () => ({ currentReport: { action_plan: [] } }));
vi.mock('@/data/planVersions', () => ({}));

const { proposeUpdatedPlan, planRuleForMarkers, ruleWhyForItem } = await import('@/utils/planUpdate');

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

describe('qué hacer para el colesterol, según los marcadores', () => {
  it('con solo el colesterol total alto no habla del HDL', () => {
    const rule = planRuleForMarkers(['total_cholesterol']);
    expect(rule?.family).toBe('Cholesterol');
    expect(rule?.why).toMatch(/total cholesterol/);
    expect(rule?.why).not.toMatch(/HDL the most/);
  });

  it('con el HDL bajo dice que moverse es lo que más lo sube', () => {
    expect(planRuleForMarkers(['hdl'])?.why).toMatch(/raises HDL/);
  });

  it('con LDL y colesterol total juntos, la nota común sale una vez', () => {
    const why = planRuleForMarkers(['ldl', 'total_cholesterol'])?.why ?? '';
    expect(why.match(/Swapping/g)).toHaveLength(1);
  });

  it('un plan guardado con el texto antiguo lo enseña ya ajustado', () => {
    const old = 'Fibre every day (legumes, oats, fruit), processed meat and pastries only occasionally, and 30 minutes of movement a day, which raises HDL.';
    expect(ruleWhyForItem({ why: old, markers: ['total_cholesterol'] })).not.toMatch(/HDL/);
    expect(ruleWhyForItem({ why: 'Texto de un especialista', markers: ['total_cholesterol'] })).toBe('Texto de un especialista');
  });
});

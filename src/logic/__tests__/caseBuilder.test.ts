import { describe, expect, it } from 'vitest';
import { buildCase, CaseInput, simulatePersona } from '@/logic/nudges';

// Casos del constructor (Developer mode → Build a case): cada problema dispara su aviso, y los
// avisos de "semanas" piden ir al médico solo cuando el problema dura 4 semanas o más.
const START = new Date('2026-10-08T00:00:00');
const base: CaseInput = { sex: 'female', age: 52, problem: 'bp_high', severity: 'moderate', days: 56, logging: 'daily', daysAhead: 14 };

function sentUpToToday(input: Partial<CaseInput>) {
  const { days } = simulatePersona(buildCase({ ...base, ...input }), START);
  return days.filter((d) => d.day <= 0).flatMap((d) => d.decisions.filter((x) => x.status === 'send').map((x) => ({ day: d.day, ...x })));
}

describe('constructor de casos', () => {
  it('tensión alta 8 semanas: avisa pronto y, pasadas 4 semanas, pide ir al médico', () => {
    const sent = sentUpToToday({}).filter((x) => x.id === 'bp_high_weeks');
    expect(sent.length).toBeGreaterThanOrEqual(3);
    expect(sent[0].title).toBe('Your blood pressure is running high');
    expect(sent[sent.length - 1].title).toMatch(/^High blood pressure for \d+ weeks$/);
  });

  it('tensión alta solo 1 semana: avisa sin pedir médico todavía', () => {
    const sent = sentUpToToday({ days: 7 }).filter((x) => x.id === 'bp_high_weeks');
    expect(sent).toHaveLength(1);
    expect(sent[0].body).toMatch(/Measure twice/);
  });

  it('un pico de tensión hoy dispara el aviso urgente', () => {
    const sent = sentUpToToday({ problem: 'bp_spike', days: 14 });
    expect(sent.find((x) => x.id === 'bp_very_high')?.day).toBe(0);
  });

  it('glucosa alta 4 semanas, registrando una vez por semana', () => {
    const sent = sentUpToToday({ problem: 'glucose_high', severity: 'severe', days: 28, logging: 'weekly' });
    expect(sent.some((x) => x.id === 'glucose_high_weeks')).toBe(true);
  });

  it('energía baja 6 semanas: el aviso largo sustituye al de 3 días', () => {
    const sent = sentUpToToday({ problem: 'low_energy', days: 42 });
    expect(sent.some((x) => x.id === 'low_energy_weeks' && /6 weeks|5 weeks|4 weeks/.test(x.title ?? ''))).toBe(true);
    const lastShort = sent.filter((x) => x.id === 'low_energy_3d').pop();
    expect(lastShort?.day ?? -99).toBeLessThan(-28);
  });

  it('dormir poco 4 semanas (wearable)', () => {
    const sent = sentUpToToday({ problem: 'short_sleep', days: 28 });
    expect(sent.some((x) => x.id === 'short_sleep_weeks')).toBe(true);
  });

  it('deja de usar la app 10 días', () => {
    const sent = sentUpToToday({ problem: 'stops_logging', days: 10 });
    expect(sent.some((x) => x.id === 'inactive_7d')).toBe(true);
  });

  it('regla con 7 días de retraso', () => {
    const sent = sentUpToToday({ problem: 'period_late', days: 7 });
    expect(sent.some((x) => x.id === 'period_late')).toBe(true);
  });
});

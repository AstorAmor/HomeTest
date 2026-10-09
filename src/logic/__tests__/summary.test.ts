import { describe, expect, it, vi } from 'vitest';

// schedule.ts importa colores (React Native); aquí solo hace falta el tipo
vi.mock('@/data/schedule', () => ({}));

import { buildSummary } from '@/logic/summary';
import type { ScheduleEvent } from '@/data/schedule';

const now = new Date('2026-10-09T10:00:00');
const ev = (id: string, type: ScheduleEvent['type'], date: string, extra: Partial<ScheduleEvent> = {}): ScheduleEvent => ({
  id,
  type,
  date,
  title: `Blood Analysis: ${type}`,
  detail: '',
  ...extra,
});

describe('Your summary (Today)', () => {
  it('ordena: citas, logística y resultados', () => {
    const lines = buildSummary({
      events: [
        ev('up-1-results', 'results', '2026-10-16'),
        ev('up-1-delivery', 'delivery', '2026-10-10'),
        ev('lab-1', 'lab', '2026-10-14', { start: '09:30', title: 'Blood draw at Synlab Centro' }),
      ],
      appointments: [{ id: 'a1', startsAt: '2026-10-12T12:00:00', label: 'Video consultation with Marta', canJoin: false }],
      newResults: false,
      now,
    });
    expect(lines.map((l) => l.kind)).toEqual(['appointment', 'appointment', 'logistics', 'results']);
    expect(lines[0].id).toBe('a1'); // la más próxima primero
    expect(lines[2].text).toMatch(/Blood Analysis kit arrives/);
    expect(lines[2].target).toEqual({ pathname: '/upcoming-analysis', params: { id: 'up-1' } });
  });

  it('resultados nuevos sin abrir: destacados en lugar de los esperados', () => {
    const lines = buildSummary({ events: [ev('r', 'results', '2026-10-16')], appointments: [], newResults: true, now });
    expect(lines).toHaveLength(1);
    expect(lines[0].highlight).toBe(true);
    expect(lines[0].target.pathname).toBe('/report-intro');
  });

  it('ignora lo pasado y lo de dentro de más de 30 días', () => {
    const lines = buildSummary({
      events: [ev('old', 'delivery', '2026-10-01'), ev('far', 'results', '2026-12-20'), ev('m', 'membership', '2026-10-20')],
      appointments: [],
      newResults: false,
      now,
    });
    expect(lines).toEqual([]);
  });
});

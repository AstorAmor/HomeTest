import { createMetricRepository, definedOnly } from './metricRepository';
import { CycleEntry } from '@/types/cycle';

const STORAGE_KEY = 'hometest:cycle_entries';

export const cycleRepository = createMetricRepository<CycleEntry>(STORAGE_KEY, {
  table: 'cycle_starts',
  dateColumn: 'started_at',
  toRow: (e) => definedOnly({ id: e.id, started_at: e.fecha, ended_at: e.endFecha, created_at: e.createdAt }),
  fromRow: (r) => ({ id: r.id, fecha: r.started_at, endFecha: r.ended_at ?? null, createdAt: r.created_at }),
});

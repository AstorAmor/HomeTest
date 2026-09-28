import { createMetricRepository, definedOnly } from './metricRepository';
import { GlucoseEntry } from '@/types/glucose';

const STORAGE_KEY = 'hometest:glucose_entries';

export const glucoseRepository = createMetricRepository<GlucoseEntry>(STORAGE_KEY, {
  table: 'glucose_readings',
  dateColumn: 'measured_at',
  toRow: (e) =>
    definedOnly({
      id: e.id,
      value: e.valor,
      unit: e.unidad,
      meal_type: e.mealType,
      measured_at: e.fecha,
      created_at: e.createdAt,
    }),
  fromRow: (r) => ({
    id: r.id,
    valor: Number(r.value),
    unidad: r.unit,
    mealType: r.meal_type,
    fecha: r.measured_at,
    createdAt: r.created_at,
  }),
});

const repo = glucoseRepository;

export async function saveGlucoseEntry(entry: GlucoseEntry): Promise<void> {
  return repo.save(entry);
}

export async function getGlucoseEntries(): Promise<GlucoseEntry[]> {
  return repo.getAll();
}

export async function updateGlucoseEntry(
  id: string,
  updated: Partial<GlucoseEntry>
): Promise<void> {
  return repo.update(id, updated);
}

export async function deleteGlucoseEntry(id: string): Promise<void> {
  return repo.remove(id);
}

export async function getLatestGlucoseEntry(): Promise<GlucoseEntry | null> {
  return repo.getLatest();
}

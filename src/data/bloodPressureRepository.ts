import { createMetricRepository, definedOnly } from './metricRepository';
import { BloodPressureEntry } from '@/types/bloodPressure';

const STORAGE_KEY = 'hometest:blood_pressure_entries';

export const bloodPressureRepository = createMetricRepository<BloodPressureEntry>(STORAGE_KEY, {
  table: 'blood_pressure_readings',
  dateColumn: 'measured_at',
  toRow: (e) =>
    definedOnly({
      id: e.id,
      systolic: e.systolic,
      diastolic: e.diastolic,
      pulse: e.pulse,
      source: e.source,
      measured_at: e.fecha,
      created_at: e.createdAt,
    }),
  fromRow: (r) => ({
    id: r.id,
    systolic: r.systolic,
    diastolic: r.diastolic,
    pulse: r.pulse,
    source: r.source,
    fecha: r.measured_at,
    createdAt: r.created_at,
  }),
});

const repo = bloodPressureRepository;

export async function saveBloodPressureEntry(entry: BloodPressureEntry): Promise<void> {
  return repo.save(entry);
}

export async function getBloodPressureEntries(): Promise<BloodPressureEntry[]> {
  return repo.getAll();
}

export async function updateBloodPressureEntry(
  id: string,
  updated: Partial<BloodPressureEntry>
): Promise<void> {
  return repo.update(id, updated);
}

export async function deleteBloodPressureEntry(id: string): Promise<void> {
  return repo.remove(id);
}

export async function getLatestBloodPressureEntry(): Promise<BloodPressureEntry | null> {
  return repo.getLatest();
}

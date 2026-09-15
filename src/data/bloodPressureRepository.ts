import { createMetricRepository } from './metricRepository';
import { BloodPressureEntry } from '@/types/bloodPressure';

const STORAGE_KEY = 'hometest:blood_pressure_entries';

const repo = createMetricRepository<BloodPressureEntry>(STORAGE_KEY);

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

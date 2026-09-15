import { createMetricRepository } from './metricRepository';
import { GlucoseEntry } from '@/types/glucose';

const STORAGE_KEY = 'hometest:glucose_entries';

const repo = createMetricRepository<GlucoseEntry>(STORAGE_KEY);

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

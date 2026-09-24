import { createMetricRepository } from './metricRepository';
import { AiLogEntry } from '@/types/aiLog';

const STORAGE_KEY = 'hometest:ai_log_entries';

const repo = createMetricRepository<AiLogEntry>(STORAGE_KEY);

export async function saveAiLogEntry(entry: AiLogEntry): Promise<void> {
  return repo.save(entry);
}

export async function getAiLogEntries(): Promise<AiLogEntry[]> {
  return repo.getAll();
}

export async function updateAiLogEntry(id: string, updated: Partial<AiLogEntry>): Promise<void> {
  return repo.update(id, updated);
}

export async function deleteAiLogEntry(id: string): Promise<void> {
  return repo.remove(id);
}

export async function getLatestAiLogEntry(): Promise<AiLogEntry | null> {
  return repo.getLatest();
}

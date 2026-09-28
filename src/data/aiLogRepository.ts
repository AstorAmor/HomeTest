import { createMetricRepository, definedOnly } from './metricRepository';
import { AiLogEntry } from '@/types/aiLog';

const STORAGE_KEY = 'hometest:ai_log_entries';

export const aiLogRepository = createMetricRepository<AiLogEntry>(STORAGE_KEY, {
  table: 'ai_logs',
  dateColumn: 'logged_at',
  toRow: (e) =>
    definedOnly({
      id: e.id,
      quadrant: e.quadrant,
      intensity: e.intensity,
      note: e.note,
      has_audio: e.hasAudio,
      transcript: e.transcript,
      summary: e.summary,
      tags: e.tags,
      logged_at: e.fecha,
      created_at: e.createdAt,
    }),
  fromRow: (r) => ({
    id: r.id,
    quadrant: r.quadrant,
    intensity: r.intensity,
    note: r.note,
    hasAudio: r.has_audio,
    transcript: r.transcript,
    summary: r.summary,
    tags: r.tags ?? [],
    fecha: r.logged_at,
    createdAt: r.created_at,
  }),
});

const repo = aiLogRepository;

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

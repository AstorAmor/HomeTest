// Las etiquetas de cada check-in (lógica en src/logic/checkInTags.ts). Sin tabla nueva: en las cuentas,
// metric_readings con kind 'checkin_tag' (una fila por etiqueta, valor 1, la fecha del check-in); sin
// sesión, en el móvil. No salen en la vista del profesional (src/data/sharing.ts).
import { createMetricRepository } from './metricRepository';
import { simpleMetricRemote } from './simpleMetricRemote';
import type { SimpleMetricEntry } from '@/types/simpleMetric';
import { parseTagEntryId, tagChanges, type CheckInTagId } from '@/logic/checkInTags';

export const checkInTagRepository = createMetricRepository<SimpleMetricEntry>('hometest:checkin_tags', simpleMetricRemote('checkin_tag'));

const all = () => checkInTagRepository.getAll().catch(() => [] as SimpleMetricEntry[]);

// Las etiquetas marcadas en un check-in
export async function loadCheckInTags(checkInId: string): Promise<CheckInTagId[]> {
  return (await all()).map((e) => parseTagEntryId(e.id)).filter((k) => k?.checkInId === checkInId).map((k) => k!.tag);
}

// Deja en el check-in justo estas etiquetas (con su fecha: si se mueve de día, se mueven con él)
export async function saveCheckInTags(checkInId: string, fecha: string, tags: string[]): Promise<void> {
  const existing = await all();
  const { remove, add } = tagChanges(checkInId, existing.map((e) => e.id), tags);
  // Las que se quedan, con la fecha nueva
  const keep = existing.filter((e) => parseTagEntryId(e.id)?.checkInId === checkInId && !remove.includes(e.id) && e.fecha !== fecha);
  for (const id of remove) await checkInTagRepository.remove(id);
  const now = new Date().toISOString();
  const rows = [
    ...add.map((id) => ({ id, valor: 1, unidad: 'tag', fecha, createdAt: now })),
    ...keep.map((e) => ({ ...e, fecha })),
  ];
  if (rows.length) await checkInTagRepository.saveMany(rows);
}

// Al borrar el check-in, sus etiquetas
export async function removeCheckInTags(checkInId: string): Promise<void> {
  return saveCheckInTags(checkInId, '', []);
}

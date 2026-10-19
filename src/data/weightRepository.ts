import { createMetricRepository } from './metricRepository';
import { simpleMetricRemote } from './simpleMetricRemote';
import { profileRepository } from './profileRepository';
import { SimpleMetricEntry } from '@/types/simpleMetric';
import { BODY_COMP, BodyCompKind } from '@/logic/weight';

// Peso y composición corporal que se apuntan a mano. En las cuentas van a la tabla genérica
// metric_readings con kind 'weight', 'body_fat', 'body_water', 'muscle_mass' y 'bone_mass' (no hace falta
// migración). La composición de una pesada lleva la misma fecha y el id de la pesada + "-" + tipo.
export const weightRepository = createMetricRepository<SimpleMetricEntry>('hometest:weight_entries', simpleMetricRemote('weight'));

export const bodyCompRepositories: Record<BodyCompKind, ReturnType<typeof createMetricRepository<SimpleMetricEntry>>> = Object.fromEntries(
  BODY_COMP.map((b) => [b.kind, createMetricRepository<SimpleMetricEntry>(`hometest:${b.kind}_entries`, simpleMetricRemote(b.kind))]),
) as Record<BodyCompKind, ReturnType<typeof createMetricRepository<SimpleMetricEntry>>>;

export type BodyComp = Partial<Record<BodyCompKind, number>>;

// La composición apuntada con una pesada (mismo id base)
export async function bodyCompFor(weighId: string): Promise<BodyComp> {
  const out: BodyComp = {};
  for (const b of BODY_COMP) {
    const e = (await bodyCompRepositories[b.kind].getAll()).find((x) => x.id === `${weighId}-${b.kind}`);
    if (e) out[b.kind] = e.valor;
  }
  return out;
}

// La última composición apuntada (con su fecha)
export async function latestBodyComp(): Promise<{ fecha: string; values: BodyComp } | null> {
  let latest: string | null = null;
  const all: Partial<Record<BodyCompKind, SimpleMetricEntry[]>> = {};
  for (const b of BODY_COMP) {
    all[b.kind] = await bodyCompRepositories[b.kind].getAll();
    for (const e of all[b.kind]!) if (!latest || e.fecha > latest) latest = e.fecha;
  }
  if (!latest) return null;
  const values: BodyComp = {};
  for (const b of BODY_COMP) {
    const e = all[b.kind]!.find((x) => x.fecha === latest);
    if (e) values[b.kind] = e.valor;
  }
  return { fecha: latest, values };
}

// Guarda (o actualiza) una pesada con su composición. Si es la más reciente, también es el peso del perfil
// (lo usan el menú semanal y otros cálculos).
export async function saveWeighIn(p: { id?: string; kg: number; fecha: string; comp: BodyComp }) {
  const id = p.id ?? `${Date.now()}`;
  const now = new Date().toISOString();
  if (p.id) await weightRepository.update(id, { valor: p.kg, fecha: p.fecha });
  else await weightRepository.save({ id, valor: p.kg, unidad: 'kg', fecha: p.fecha, createdAt: now });
  for (const b of BODY_COMP) {
    const repo = bodyCompRepositories[b.kind];
    const cid = `${id}-${b.kind}`;
    const exists = (await repo.getAll()).some((x) => x.id === cid);
    const v = p.comp[b.kind];
    if (v === undefined) {
      if (exists) await repo.remove(cid);
    } else if (exists) await repo.update(cid, { valor: v, fecha: p.fecha });
    else await repo.save({ id: cid, valor: v, unidad: b.unit, fecha: p.fecha, createdAt: now });
  }
  const all = await weightRepository.getAll();
  const newest = [...all].sort((a, b) => b.fecha.localeCompare(a.fecha))[0];
  if (newest && newest.id === id) {
    const profile = await profileRepository.get().catch(() => null);
    if (profile && profile.weightKg !== p.kg) await profileRepository.save({ ...profile, weightKg: p.kg }).catch(() => undefined);
  }
  return id;
}

export async function removeWeighIn(id: string) {
  await weightRepository.remove(id);
  for (const b of BODY_COMP) {
    const cid = `${id}-${b.kind}`;
    if ((await bodyCompRepositories[b.kind].getAll()).some((x) => x.id === cid)) await bodyCompRepositories[b.kind].remove(cid);
  }
}

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
type BodyCompLists = Record<BodyCompKind, SimpleMetricEntry[]>;

// Las listas de composición de cada tipo, a la vez (salen en una sola petición: src/data/metricBatch.ts). Antes se
// pedían una detrás de otra (fundador, 2026-11-17: «las medidas tardan en cargar»)
async function loadBodyCompLists(): Promise<BodyCompLists> {
  const lists = await Promise.all(BODY_COMP.map((b) => bodyCompRepositories[b.kind].getAll()));
  return Object.fromEntries(BODY_COMP.map((b, i) => [b.kind, lists[i]])) as BodyCompLists;
}

// Lo último leído de cada tipo, sin esperar a la red (undefined si falta alguno): para pintar al momento
function peekBodyCompLists(): BodyCompLists | undefined {
  const lists = BODY_COMP.map((b) => bodyCompRepositories[b.kind].peek());
  if (lists.some((l) => !l)) return undefined;
  return Object.fromEntries(BODY_COMP.map((b, i) => [b.kind, lists[i]])) as BodyCompLists;
}

// La composición apuntada con una pesada (mismo id base)
export async function bodyCompFor(weighId: string): Promise<BodyComp> {
  const all = await loadBodyCompLists();
  const out: BodyComp = {};
  for (const b of BODY_COMP) {
    const e = all[b.kind].find((x) => x.id === `${weighId}-${b.kind}`);
    if (e) out[b.kind] = e.valor;
  }
  return out;
}

export type LatestBodyComp = { fecha: string; values: BodyComp } | null;

// La última composición apuntada (con su fecha), de las listas de cada tipo
export function latestBodyCompFrom(all: BodyCompLists): LatestBodyComp {
  let latest: string | null = null;
  for (const b of BODY_COMP) for (const e of all[b.kind]) if (!latest || e.fecha > latest) latest = e.fecha;
  if (!latest) return null;
  const values: BodyComp = {};
  for (const b of BODY_COMP) {
    const e = all[b.kind].find((x) => x.fecha === latest);
    if (e) values[b.kind] = e.valor;
  }
  return { fecha: latest, values };
}

// La última composición apuntada (con su fecha)
export async function latestBodyComp(): Promise<LatestBodyComp> {
  return latestBodyCompFrom(await loadBodyCompLists());
}

// Lo mismo con lo último leído (undefined si aún no se ha leído todo)
export function peekLatestBodyComp(): LatestBodyComp | undefined {
  const all = peekBodyCompLists();
  return all ? latestBodyCompFrom(all) : undefined;
}

export type LatestBodyFat = { fecha: string; pct: number } | null;

// La última grasa de una lista de grasas de la báscula
export function latestBodyFatFrom(all: SimpleMetricEntry[]): LatestBodyFat {
  const last = all.reduce<SimpleMetricEntry | null>((a, e) => (!a || e.fecha > a.fecha ? e : a), null);
  return last ? { fecha: last.fecha, pct: last.valor } : null;
}

// La última grasa apuntada de la báscula (con su fecha): una de las cifras entre las que elige la composición
// corporal de Peso, junto a las estimaciones de las medidas (pickBodyFat en src/logic/bodyComposition.ts)
export async function latestBodyFat(): Promise<LatestBodyFat> {
  return latestBodyFatFrom(await bodyCompRepositories.body_fat.getAll());
}

// Lo mismo con lo último leído (undefined si aún no se ha leído)
export function peekLatestBodyFat(): LatestBodyFat | undefined {
  const all = bodyCompRepositories.body_fat.peek();
  return all ? latestBodyFatFrom(all) : undefined;
}

// Guarda (o actualiza) una pesada con su composición. Si es la más reciente, también es el peso del perfil
// (lo usan el menú semanal y otros cálculos).
export async function saveWeighIn(p: { id?: string; kg: number; fecha: string; comp: BodyComp }) {
  const id = p.id ?? `${Date.now()}`;
  const now = new Date().toISOString();
  if (p.id) await weightRepository.update(id, { valor: p.kg, fecha: p.fecha });
  else await weightRepository.save({ id, valor: p.kg, unidad: 'kg', fecha: p.fecha, createdAt: now });
  // Qué composición había: las cuatro listas a la vez (una sola petición), no una detrás de otra
  const before = await loadBodyCompLists();
  for (const b of BODY_COMP) {
    const repo = bodyCompRepositories[b.kind];
    const cid = `${id}-${b.kind}`;
    const exists = before[b.kind].some((x) => x.id === cid);
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
  const before = await loadBodyCompLists();
  for (const b of BODY_COMP) {
    const cid = `${id}-${b.kind}`;
    if (before[b.kind].some((x) => x.id === cid)) await bodyCompRepositories[b.kind].remove(cid);
  }
}

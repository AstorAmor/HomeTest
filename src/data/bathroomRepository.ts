import { createMetricRepository, definedOnly } from './metricRepository';
import { BowelEntry, UrineEntry } from '@/types/bathroom';

// Registro digestivo y urinario: un apunte por día (se edita si ya existe el de ese día).
// Tablas bowel_logs y urine_logs (supabase/migrations/20261008110000_bowel_urine_logs.sql).

// Las horas de cada vez (bowel_logs.movements) y el registro de Digestión (gut_symptom_logs) van en
// la migración 20261018150000_gut_symptom_logs.sql, aplicada el 2026-10-19. Lo apuntado en Digestión
// antes se quedó en el móvil y se sube la primera vez (src/data/digestionRepository.ts).
export const REMOTE_HAS_GUT_LOGS = true;

export const bowelRepository = createMetricRepository<BowelEntry>('hometest:bowel_logs', {
  table: 'bowel_logs',
  dateColumn: 'logged_at',
  toRow: (e) =>
    definedOnly({
      id: e.id,
      count: e.count,
      color: e.color,
      consistency: e.consistency,
      note: e.note,
      explained_by: e.explainedBy,
      movements: REMOTE_HAS_GUT_LOGS ? e.movements : undefined,
      logged_at: e.fecha,
      created_at: e.createdAt,
    }),
  fromRow: (r) => ({
    id: r.id,
    count: r.count,
    movements: r.movements ?? undefined,
    color: r.color ?? undefined,
    consistency: r.consistency ?? undefined,
    note: r.note ?? undefined,
    explainedBy: r.explained_by ?? undefined,
    fecha: r.logged_at,
    createdAt: r.created_at,
  }),
});

// El volumen exacto (void_ml) va en la columna de la migración 20261012100000_urine_void_ml.sql
// (aplicada el 2026-10-12 con el OK del fundador). Si hiciera falta volver atrás, poner false.
const REMOTE_HAS_VOID_ML = true;
// Cada vez con su hora (urine_logs.visits): migración 20261021120000_urine_visits.sql (aplicada el
// 2026-10-21 con el OK del fundador). Con false, en una cuenta las veces sueltas no se suben (el total
// del día sí).
const REMOTE_HAS_URINE_VISITS = true;

export const urineRepository = createMetricRepository<UrineEntry>('hometest:urine_logs', {
  table: 'urine_logs',
  dateColumn: 'logged_at',
  toRow: (e) =>
    definedOnly({
      id: e.id,
      count: e.count,
      visits: REMOTE_HAS_URINE_VISITS ? e.visits : undefined,
      night_count: e.nightCount,
      color: e.color,
      burning: e.burning,
      void_volume: e.voidVolume,
      void_ml: REMOTE_HAS_VOID_ML ? e.voidMl : undefined,
      volume_usual: e.volumeUsual,
      daily_total_ml: e.dailyTotalMl,
      note: e.note,
      explained_by: e.explainedBy,
      logged_at: e.fecha,
      created_at: e.createdAt,
    }),
  fromRow: (r) => ({
    id: r.id,
    count: r.count ?? undefined,
    visits: r.visits ?? undefined,
    nightCount: r.night_count ?? undefined,
    color: r.color ?? undefined,
    burning: r.burning ?? undefined,
    voidVolume: r.void_volume ?? undefined,
    voidMl: r.void_ml ?? undefined,
    volumeUsual: r.volume_usual ?? undefined,
    dailyTotalMl: r.daily_total_ml ?? undefined,
    note: r.note ?? undefined,
    explainedBy: r.explained_by ?? undefined,
    fecha: r.logged_at,
    createdAt: r.created_at,
  }),
});

export const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// Fecha guardada para el apunte de un día: mediodía local (así no cambia de día con la zona horaria)
export const noonOf = (day: string) => new Date(`${day}T12:00:00`).toISOString();

export const entryForDay = <T extends { fecha: string }>(entries: T[], day: string) =>
  entries.find((e) => dayKey(new Date(e.fecha)) === day) ?? null;

// El «+» de las tarjetas de Hoy: una vez más hoy, con su hora y sin color ni forma (eso se añade
// entrando, en esa misma vez)
export async function addUrineVisit(): Promise<void> {
  const today = dayKey(new Date());
  const now = new Date().toISOString();
  const e = entryForDay(await urineRepository.getAll(), today);
  if (e) await urineRepository.update(e.id, { count: (e.count ?? 0) + 1, visits: [...(e.visits ?? []), { at: now }] });
  else await urineRepository.save({ id: `${Date.now()}`, fecha: noonOf(today), createdAt: now, count: 1, visits: [{ at: now }] });
}

export async function addBowelVisit(): Promise<void> {
  const today = dayKey(new Date());
  const now = new Date().toISOString();
  const e = entryForDay(await bowelRepository.getAll(), today);
  if (e) await bowelRepository.update(e.id, { count: e.count + 1, movements: [...(e.movements ?? []), { at: now }] });
  else await bowelRepository.save({ id: `${Date.now()}`, fecha: noonOf(today), createdAt: now, count: 1, movements: [{ at: now }] });
}

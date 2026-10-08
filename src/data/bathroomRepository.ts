import { createMetricRepository, definedOnly } from './metricRepository';
import { BowelEntry, UrineEntry } from '@/types/bathroom';

// Registro digestivo y urinario: un apunte por día (se edita si ya existe el de ese día).
// Tablas bowel_logs y urine_logs (supabase/migrations/20261008110000_bowel_urine_logs.sql).

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
      logged_at: e.fecha,
      created_at: e.createdAt,
    }),
  fromRow: (r) => ({
    id: r.id,
    count: r.count,
    color: r.color ?? undefined,
    consistency: r.consistency ?? undefined,
    note: r.note ?? undefined,
    explainedBy: r.explained_by ?? undefined,
    fecha: r.logged_at,
    createdAt: r.created_at,
  }),
});

export const urineRepository = createMetricRepository<UrineEntry>('hometest:urine_logs', {
  table: 'urine_logs',
  dateColumn: 'logged_at',
  toRow: (e) =>
    definedOnly({
      id: e.id,
      count: e.count,
      night_count: e.nightCount,
      color: e.color,
      burning: e.burning,
      void_volume: e.voidVolume,
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
    nightCount: r.night_count ?? undefined,
    color: r.color ?? undefined,
    burning: r.burning ?? undefined,
    voidVolume: r.void_volume ?? undefined,
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

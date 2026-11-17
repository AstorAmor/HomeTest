import { createMetricRepository } from './metricRepository';
import { simpleMetricRemote } from './simpleMetricRemote';
import { showSamples } from './dataMode';
import { SimpleMetricEntry } from '@/types/simpleMetric';
import { MEASURE_SITES, MeasureReadings } from '@/logic/bodyMeasures';

// Medidas del cuerpo (cinta métrica y pinza de pliegues) que se apuntan en Peso → Medidas. Como el peso y la
// composición corporal: en las cuentas van a la tabla genérica metric_readings, un `kind` por sitio
// ('tape_waist', 'skinfold_triceps'…; la columna es texto libre, sin migración); sin sesión, en el móvil.
// Las medidas de una misma vez llevan la misma fecha y el id `${sesión}-${kind}` (la clave es usuario + id).
type MeasureRepository = ReturnType<typeof createMetricRepository<SimpleMetricEntry>>;

export const measureRepositories: Record<string, MeasureRepository> = Object.fromEntries(
  MEASURE_SITES.map((s) => [s.kind, createMetricRepository<SimpleMetricEntry>(`hometest:${s.kind}_entries`, simpleMetricRemote(s.kind))]),
);

// Todo lo apuntado, por kind
export async function loadMeasureReadings(): Promise<MeasureReadings> {
  const lists = await Promise.all(MEASURE_SITES.map((s) => measureRepositories[s.kind].getAll().catch(() => [] as SimpleMetricEntry[])));
  return Object.fromEntries(MEASURE_SITES.map((s, i) => [s.kind, lists[i]]));
}

// Guarda las medidas de una vez (solo las que tienen valor). Devuelve el id de la sesión
export async function saveMeasureSession(p: { fecha: string; values: Partial<Record<string, number>> }): Promise<string> {
  const session = `m${Date.now()}`;
  const now = new Date().toISOString();
  for (const s of MEASURE_SITES) {
    const v = p.values[s.kind];
    if (v == null) continue;
    await measureRepositories[s.kind].save({ id: `${session}-${s.kind}`, valor: v, unidad: s.unit, fecha: p.fecha, createdAt: now });
  }
  return session;
}

// Medidas de ejemplo para la ficha del peso y su evolución cuando aún no hay ninguna propia (como el resto de
// mediciones en la demo y en las cuentas de prueba). Seis veces en unos tres meses, con un cambio suave, para que
// se vea cómo queda la evolución (fundador, 2026-11-16). Nunca se guardan.
const SAMPLE_WEEKS_AGO = [13, 11, 8, 6, 3, 1];
const SAMPLE: Record<string, number[]> = {
  tape_neck: [38.5, 38.5, 38, 38, 38, 37.5],
  tape_chest: [100, 99.5, 99, 99, 98.5, 98],
  tape_waist: [88, 87, 86.5, 86, 85, 84.5],
  tape_hip: [100.5, 100, 99.5, 99.5, 99, 98.5],
  tape_arm: [31, 31, 31.5, 31.5, 32, 32],
  tape_thigh: [56.5, 56.5, 56, 56, 55.5, 55.5],
  tape_calf: [37, 37, 37, 37.5, 37, 37],
  skinfold_chest: [13, 12.5, 12, 12, 11.5, 11],
  skinfold_triceps: [14, 13.5, 13, 13, 12.5, 12],
  skinfold_biceps: [7, 6.5, 6.5, 6, 6, 6],
  skinfold_subscapular: [15, 14.5, 14, 14, 13.5, 13],
  skinfold_suprailiac: [17.5, 17, 16, 15.5, 15, 14.5],
  skinfold_abdominal: [24, 23, 22, 21.5, 20.5, 20],
  skinfold_thigh: [16, 15.5, 15, 15, 14.5, 14],
};

export function sampleMeasureReadings(now = new Date()): MeasureReadings | null {
  if (!showSamples()) return null;
  const at = (weeksAgo: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() - weeksAgo * 7);
    d.setHours(8, 30, 0, 0);
    return d.toISOString();
  };
  const dates = SAMPLE_WEEKS_AGO.map(at);
  return Object.fromEntries(
    Object.entries(SAMPLE).map(([kind, values]) => [kind, values.map((valor, i) => ({ valor, fecha: dates[i], createdAt: dates[i] })).reverse()]),
  );
}

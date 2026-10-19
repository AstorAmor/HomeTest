// Peso: cada cuánto pesarse y cómo va la tendencia.
//
// El peso cambia 1-2 kg de un día a otro por la comida y la bebida, la sal, el líquido retenido, el ciclo
// menstrual o ir al baño, así que la app recomienda pesarse una vez por semana (mismo día, por la mañana,
// después de ir al baño, antes de desayunar y con poca ropa) y fijarse en la tendencia de varias semanas.
// La tendencia es la pendiente (mínimos cuadrados) de un valor por semana: el último de cada semana.
// SUPUESTO pendiente de revisión: umbral de "estable" ±0,2 kg/semana.

export const WEIGH_EVERY_DAYS = 7;
const DAY = 864e5;

export interface WeighIn {
  valor: number;
  fecha: string; // ISO
}

const byDate = <T extends WeighIn>(list: T[]) => [...list].sort((a, b) => a.fecha.localeCompare(b.fecha));

export interface WeighAdvice {
  last: WeighIn | null;
  daysSince: number | null;
  due: boolean; // ya toca (o nunca se ha pesado)
  next: Date | null; // cuándo toca la próxima
  inLastWeek: number; // pesadas en los últimos 7 días
  tooOften: boolean; // 3 o más en una semana: avisar (sin bloquear)
}

export function weighAdvice(entries: WeighIn[], now = new Date()): WeighAdvice {
  const sorted = byDate(entries);
  const last = sorted[sorted.length - 1] ?? null;
  if (!last) return { last: null, daysSince: null, due: true, next: null, inLastWeek: 0, tooOften: false };
  const lastAt = new Date(last.fecha);
  // Días de calendario (Math.round: los días del cambio de hora duran 23 o 25 h)
  const daysSince = Math.round((startOfDay(now).getTime() - startOfDay(lastAt).getTime()) / DAY);
  const inLastWeek = sorted.filter((e) => now.getTime() - new Date(e.fecha).getTime() < WEIGH_EVERY_DAYS * DAY).length;
  return {
    last,
    daysSince,
    due: daysSince >= WEIGH_EVERY_DAYS,
    next: new Date(lastAt.getFullYear(), lastAt.getMonth(), lastAt.getDate() + WEIGH_EVERY_DAYS),
    inLastWeek,
    tooOften: inLastWeek >= 3,
  };
}

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

// Lunes de la semana de una fecha (clave de semana)
const weekKey = (d: Date) => {
  const s = startOfDay(d);
  s.setDate(s.getDate() - ((s.getDay() + 6) % 7));
  return s.getTime();
};

export interface WeightTrend {
  perWeek: number | null; // kg por semana (negativo = bajando); null sin datos suficientes
  weeks: number; // semanas con al menos una pesada en el periodo
  kind: 'down' | 'up' | 'stable' | 'unknown';
}

// Tendencia de las últimas `span` semanas (8 por defecto); hacen falta al menos 3 semanas con pesada
export function weightTrend(entries: WeighIn[], now = new Date(), span = 8): WeightTrend {
  const from = weekKey(now) - (span - 1) * 7 * DAY;
  const perWeek = new Map<number, WeighIn>();
  for (const e of byDate(entries)) {
    const k = weekKey(new Date(e.fecha));
    if (k >= from && k <= weekKey(now)) perWeek.set(k, e); // el último de cada semana
  }
  const pts = [...perWeek.entries()].map(([k, e]) => ({ x: Math.round((k - from) / (7 * DAY)), y: e.valor }));
  if (pts.length < 3) return { perWeek: null, weeks: pts.length, kind: 'unknown' };
  const mx = pts.reduce((a, p) => a + p.x, 0) / pts.length;
  const my = pts.reduce((a, p) => a + p.y, 0) / pts.length;
  const num = pts.reduce((a, p) => a + (p.x - mx) * (p.y - my), 0);
  const den = pts.reduce((a, p) => a + (p.x - mx) ** 2, 0) || 1;
  const slope = Math.round((num / den) * 100) / 100;
  return { perWeek: slope, weeks: pts.length, kind: Math.abs(slope) < 0.2 ? 'stable' : slope < 0 ? 'down' : 'up' };
}

// Composición corporal que se apunta a mano (báscula de bioimpedancia): rangos aceptados
export const BODY_COMP = [
  { kind: 'body_fat', label: 'Body fat', unit: '%', min: 3, max: 70 },
  { kind: 'body_water', label: 'Body water', unit: '%', min: 30, max: 80 },
  { kind: 'muscle_mass', label: 'Muscle', unit: 'kg', min: 10, max: 120 },
  { kind: 'bone_mass', label: 'Bone', unit: 'kg', min: 1, max: 8 },
] as const;
export type BodyCompKind = (typeof BODY_COMP)[number]['kind'];

// Texto escrito ("23,5" o "23.5") → número dentro de su rango, o null
export function parseComp(kind: BodyCompKind, raw: string): number | null {
  const v = Number(raw.replace(',', '.').trim());
  const spec = BODY_COMP.find((b) => b.kind === kind)!;
  if (!raw.trim() || !Number.isFinite(v) || v < spec.min || v > spec.max) return null;
  return Math.round(v * 10) / 10;
}

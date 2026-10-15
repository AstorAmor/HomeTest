import { DailyWearableRecord, WearableMetric } from './types';
import { PHONE_SOURCE } from './sources';

// Lógica pura de las series diarias de wearables (sin React Native, con tests en __tests__).

export interface DailyPoint {
  date: string; // YYYY-MM-DD
  value: number;
}

export type DailySeries = Partial<Record<WearableMetric, DailyPoint[]>>;

const pad2 = (n: number) => String(n).padStart(2, '0');
export const localDayKey = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

// Valor de HOY (o null si el último dato es de otro día)
export const todayValue = (points?: DailyPoint[]) => {
  const last = points?.length ? points[points.length - 1] : null;
  return last && last.date === localDayKey(new Date()) ? last.value : null;
};

// Si un día tiene varias fuentes para la misma métrica, ¿cuál manda? El reloj antes que el teléfono;
// el pulso en reposo que da el reloj antes que el estimado; en lo que se acumula (pasos, calorías,
// distancia), la que más ha contado (la que llevabas encima).
const CUMULATIVE: WearableMetric[] = ['steps', 'active_energy', 'distance'];
const better = (a: DailyWearableRecord, b: DailyWearableRecord) => {
  const phone = (r: DailyWearableRecord) => Number(r.sourceName === PHONE_SOURCE);
  if (phone(a) !== phone(b)) return phone(a) < phone(b);
  const estimated = (r: DailyWearableRecord) => Number(r.rawTypeId.includes(':'));
  if (estimated(a) !== estimated(b)) return estimated(a) < estimated(b);
  return CUMULATIVE.includes(a.metric) ? a.value > b.value : false;
};

export function pickPerDay(records: DailyWearableRecord[]): DailyWearableRecord[] {
  const best = new Map<string, DailyWearableRecord>();
  for (const r of records) {
    const key = `${r.metric}|${r.date}`;
    const cur = best.get(key);
    if (!cur || better(r, cur)) best.set(key, r);
  }
  return [...best.values()];
}

// Agrupa los registros por métrica (una fuente por día, ver pickPerDay) y los ordena ascendente.
export function toDailySeries(records: DailyWearableRecord[]): DailySeries {
  const out: DailySeries = {};
  for (const r of pickPerDay(records)) (out[r.metric] ??= []).push({ date: r.date, value: r.value });
  for (const metric of Object.keys(out) as WearableMetric[]) {
    out[metric]!.sort((a, b) => a.date.localeCompare(b.date));
  }
  return out;
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / (xs.length || 1);
const clamp = (v: number) => Math.max(0, Math.min(100, v));

export type ReadinessPart = 'sleep' | 'hrv' | 'restingHr';

export interface Readiness {
  score: number;
  label: string;
  sleep: number | null;
  hrv: number | null;
  restingHr: number | null;
  // Lo que no ha llegado hoy y por tanto no cuenta (el resto se reparte su peso)
  missing: ReadinessPart[];
}

// Daily readiness (0-100), versión simple y explicable:
// sueño de anoche frente a 8 h, VFC y pulso en reposo de hoy frente a su media de los días
// anteriores (hasta 14). Pesos 40/35/25; si falta alguna parte, las demás se reparten su peso.
// Hace falta el sueño de anoche o el pulso en reposo de hoy. Pendiente de validar con el médico.
export function computeReadiness(series: DailySeries, now = new Date()): Readiness | null {
  const today = localDayKey(now);
  const todayOf = (pts?: DailyPoint[]) => pts?.find((p) => p.date === today)?.value ?? null;
  const baseOf = (pts?: DailyPoint[]) => {
    const prev = (pts ?? []).filter((p) => p.date < today).slice(-14);
    return prev.length >= 2 ? mean(prev.map((p) => p.value)) : null;
  };

  const lastSleep = todayOf(series.sleep_duration);
  const hrvToday = todayOf(series.hrv);
  const hrvBase = baseOf(series.hrv);
  const rhrToday = todayOf(series.resting_heart_rate);
  const rhrBase = baseOf(series.resting_heart_rate);

  const sleepScore = lastSleep != null ? clamp((lastSleep / 480) * 100) : null;
  const hrvScore = hrvToday != null && hrvBase ? clamp(70 + ((hrvToday - hrvBase) / hrvBase) * 200) : null;
  const rhrScore = rhrToday != null && rhrBase ? clamp(70 - ((rhrToday - rhrBase) / rhrBase) * 300) : null;
  if (sleepScore == null && rhrScore == null) return null;

  const parts: [ReadinessPart, number | null, number][] = [
    ['sleep', sleepScore, 0.4],
    ['hrv', hrvScore, 0.35],
    ['restingHr', rhrScore, 0.25],
  ];
  const used = parts.filter(([, v]) => v != null) as [ReadinessPart, number, number][];
  const weight = used.reduce((a, [, , w]) => a + w, 0);
  const score = Math.round(used.reduce((a, [, v, w]) => a + v * w, 0) / weight);

  const label = score >= 80 ? 'Ready to go' : score >= 60 ? 'Take it steady' : 'Prioritise recovery';
  return {
    score,
    label,
    sleep: sleepScore,
    hrv: hrvScore,
    restingHr: rhrScore,
    missing: parts.filter(([, v]) => v == null).map(([k]) => k),
  };
}


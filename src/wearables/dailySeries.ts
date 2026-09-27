import { useCallback } from 'react';
import { useDeepState, useReloadOnFocus } from '@/hooks/useReloadOnFocus';
import { DailyWearableRecord, WearableMetric } from './types';
import { wearableRepository } from './wearableRepository';
import { generateHuaweiDummy } from './providers/huaweiDummy';

export interface DailyPoint {
  date: string; // YYYY-MM-DD
  value: number;
}

export type DailySeries = Partial<Record<WearableMetric, DailyPoint[]>>;

// Agrupa los registros por métrica (una fuente por día: si hay varias, se queda
// con la primera) y los ordena ascendente para las gráficas.
export function toDailySeries(records: DailyWearableRecord[]): DailySeries {
  const out: DailySeries = {};
  const seen = new Set<string>();
  for (const r of records) {
    const key = `${r.metric}|${r.date}`;
    if (seen.has(key)) continue;
    seen.add(key);
    (out[r.metric] ??= []).push({ date: r.date, value: r.value });
  }
  for (const metric of Object.keys(out) as WearableMetric[]) {
    out[metric]!.sort((a, b) => a.date.localeCompare(b.date));
  }
  return out;
}

// Hook para Today y My Data: lee lo sincronizado y, si todavía no hay nada,
// usa el dummy de Huawei EN MEMORIA (sin guardarlo) para que la demo no salga vacía.
export function useDailyWearables() {
  const [series, setSeries] = useDeepState<DailySeries>({});
  const [isSample, setIsSample] = useDeepState(false);

  const load = useCallback(async () => {
    const stored = await wearableRepository.getRecords();
    if (stored.length > 0) {
      setSeries(toDailySeries(stored));
      setIsSample(false);
    } else {
      setSeries(toDailySeries(generateHuaweiDummy(14)));
      setIsSample(true);
    }
  }, [setSeries, setIsSample]);

  useReloadOnFocus(load);

  return { series, isSample };
}

export const latest = (points?: DailyPoint[]) => (points?.length ? points[points.length - 1].value : null);

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / (xs.length || 1);
const clamp = (v: number) => Math.max(0, Math.min(100, v));

export interface Readiness {
  score: number;
  label: string;
  sleep: number;
  hrv: number;
  restingHr: number;
}

// Daily readiness (0-100), versión simple y explicable:
// sueño de anoche frente a 8 h, VFC y pulso en reposo de hoy frente a su media
// de los días anteriores. Pesos 40/35/25. Pendiente de validar con el médico.
export function computeReadiness(series: DailySeries): Readiness | null {
  const sleep = series.sleep_duration;
  const hrv = series.hrv;
  const rhr = series.resting_heart_rate;
  if (!sleep?.length || !hrv?.length || !rhr?.length) return null;

  const lastSleep = sleep[sleep.length - 1].value;
  const hrvToday = hrv[hrv.length - 1].value;
  const hrvBase = mean(hrv.slice(0, -1).map((p) => p.value)) || hrvToday;
  const rhrToday = rhr[rhr.length - 1].value;
  const rhrBase = mean(rhr.slice(0, -1).map((p) => p.value)) || rhrToday;

  const sleepScore = clamp((lastSleep / 480) * 100);
  const hrvScore = clamp(70 + ((hrvToday - hrvBase) / hrvBase) * 200);
  const rhrScore = clamp(70 - ((rhrToday - rhrBase) / rhrBase) * 300);
  const score = Math.round(0.4 * sleepScore + 0.35 * hrvScore + 0.25 * rhrScore);

  const label = score >= 80 ? 'Ready to go' : score >= 60 ? 'Take it steady' : 'Prioritise recovery';
  return { score, label, sleep: sleepScore, hrv: hrvScore, restingHr: rhrScore };
}

export const formatSleep = (minutes: number) =>
  `${Math.floor(minutes / 60)}h ${String(Math.round(minutes % 60)).padStart(2, '0')}m`;

export const shortDate = (iso: string) => {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`);
  return `${d.getDate()}/${d.getMonth() + 1}`;
};

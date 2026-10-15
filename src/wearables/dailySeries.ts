import { useCallback } from 'react';
import { useDeepState, useReloadOnFocus } from '@/hooks/useReloadOnFocus';
import { DailyWearableRecord, WearableMetric } from './types';
import { wearableRepository } from './wearableRepository';
import { generateHuaweiDummy } from './providers/huaweiDummy';
import {
  grantedTypes,
  healthConnectSyncDue,
  isHealthConnectAvailable,
  markHealthConnectSynced,
  readHealthConnectDaily,
} from './providers/healthConnect';
import { PHONE_SOURCE } from './sources';
import { showSamples } from '@/data/dataMode';
import { DailyPoint, DailySeries, localDayKey, pickPerDay, toDailySeries } from './seriesLogic';

export * from './seriesLogic';

// Deja solo los últimos `days` días de cada métrica.
const lastDays = (series: DailySeries, days: number): DailySeries => {
  const out: DailySeries = {};
  for (const metric of Object.keys(series) as WearableMetric[]) out[metric] = series[metric]!.slice(-days);
  return out;
};

// Días de ejemplo generados cuando aún no hay datos: 6 meses, para las vistas 1M/6M.
const SAMPLE_DAYS = 183;

// De qué apps vienen los datos de los últimos días ("Fitbit", "This phone"…), el reloj primero
const recentSources = (records: DailyWearableRecord[]) => {
  const since = localDayKey(new Date(Date.now() - 7 * 86400000));
  const names = new Set<string>();
  for (const r of pickPerDay(records)) if (r.date >= since) r.sourceName.split(' + ').forEach((n) => names.add(n));
  return [...names].sort((a, b) => Number(a === PHONE_SOURCE) - Number(b === PHONE_SOURCE));
};

// Hook para Today, My Data y el detalle de métrica: lee lo sincronizado y, si todavía no hay nada,
// usa el dummy de Huawei EN MEMORIA (sin guardarlo) para que la demo no salga vacía; en una cuenta
// real, no (sale vacío). `days` recorta al periodo que enseña cada pantalla. Con `autoSync`, además,
// trae lo nuevo de Health Connect en segundo plano (como mucho cada 10 minutos) y repinta.
export function useDailyWearables(days = 14, opts?: { autoSync?: boolean }) {
  const [series, setSeries] = useDeepState<DailySeries>({});
  const [isSample, setIsSample] = useDeepState(false);
  const [sources, setSources] = useDeepState<string[]>([]);
  const [hasAny, setHasAny] = useDeepState(false);
  const autoSync = !!opts?.autoSync;

  const apply = useCallback(
    (stored: DailyWearableRecord[]) => {
      if (stored.length > 0) {
        setSeries(lastDays(toDailySeries(stored), days));
        setSources(recentSources(stored));
        setIsSample(false);
        setHasAny(true);
      } else if (showSamples()) {
        setSeries(lastDays(toDailySeries(generateHuaweiDummy(SAMPLE_DAYS)), days));
        setSources(['Huawei Health']);
        setIsSample(true);
        setHasAny(true);
      } else {
        setSeries({});
        setSources([]);
        setIsSample(false);
        setHasAny(false);
      }
    },
    [setSeries, setIsSample, setSources, setHasAny, days],
  );

  const load = useCallback(async () => {
    apply(await wearableRepository.getRecords().catch(() => []));
    if (autoSync) {
      syncHealthConnectIfDue()
        .then(async (changed) => {
          if (changed) apply(await wearableRepository.getRecords());
        })
        .catch((e) => console.warn('Health Connect sync failed', e));
    }
  }, [apply, autoSync]);

  useReloadOnFocus(load);

  return { series, isSample, sources, hasAny };
}

// Trae de Health Connect los últimos 30 días y sustituye lo guardado de ese rango. Solo si está
// conectado (algún permiso concedido) y han pasado 10 minutos desde la última vez.
export async function syncHealthConnectIfDue(force = false): Promise<boolean> {
  if (!force && !(await healthConnectSyncDue())) return false;
  if (!(await isHealthConnectAvailable())) return false;
  if (!(await grantedTypes()).length) return false;
  const read = await readHealthConnectDaily(30);
  await markHealthConnectSynced();
  if (!read.records.length) return false;
  await wearableRepository.replaceProviderFrom('health_connect', read.from, read.records);
  return true;
}


export const latest = (points?: DailyPoint[]) => (points?.length ? points[points.length - 1].value : null);

export const formatSleep = (minutes: number) =>
  `${Math.floor(minutes / 60)}h ${String(Math.round(minutes % 60)).padStart(2, '0')}m`;

export const shortDate = (iso: string) => {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`);
  return `${d.getDate()}/${d.getMonth() + 1}`;
};

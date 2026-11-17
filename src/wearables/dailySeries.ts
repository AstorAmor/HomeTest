import { useCallback, useRef, useState } from 'react';
import { Platform } from 'react-native';
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
import { appleHealthAsked, appleHealthSyncDue, isAppleHealthAvailable, markAppleHealthSynced, readAppleHealthDaily } from './providers/appleHealth';
import { PHONE_SOURCE } from './sources';
import { showSamples } from '@/data/dataMode';
import { userFlags } from '@/data/userFlags';
import { DailyPoint, DailySeries, localDayKey, pickPerDay, toDailySeries } from './seriesLogic';

export * from './seriesLogic';

// Deja solo los últimos `days` días de calendario de cada métrica (hoy incluido). Por fecha y no por
// número de registros: con huecos, «los últimos 7» podían ser de hace semanas.
const lastDays = (series: DailySeries, days: number): DailySeries => {
  const since = localDayKey(new Date(Date.now() - (days - 1) * 86400000));
  const out: DailySeries = {};
  for (const metric of Object.keys(series) as WearableMetric[]) out[metric] = series[metric]!.filter((p) => p.date >= since);
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

// Las series de unos registros. Hoy, sus metas, el plan y Mediciones reciben los mismos registros (la misma lectura,
// src/data/readCache.ts): se calculan una vez y se reutilizan mientras no lleguen otros (fundador, 2026-11-17: «las
// medidas tardan en cargar»). La lista es una copia por pantalla, pero los registros son los mismos objetos.
const seriesMemo = new WeakMap<object, { length: number; last: object; series: DailySeries }>();
function seriesOf(records: DailyWearableRecord[]): DailySeries {
  const first = records[0];
  const last = records[records.length - 1];
  const hit = first ? seriesMemo.get(first) : undefined;
  if (hit && hit.length === records.length && hit.last === last) return hit.series;
  const series = toDailySeries(records);
  if (first) seriesMemo.set(first, { length: records.length, last, series });
  return series;
}

// Los días de ejemplo, una vez al día (son siempre los mismos para el mismo día)
let sampleMemo: { day: string; series: DailySeries } | null = null;
function sampleSeries(): DailySeries {
  const day = localDayKey(new Date());
  if (sampleMemo?.day !== day) sampleMemo = { day, series: toDailySeries(generateHuaweiDummy(SAMPLE_DAYS)) };
  return sampleMemo.series;
}

interface WearableView {
  series: DailySeries;
  isSample: boolean;
  sources: string[];
  hasAny: boolean;
}

// Lo que enseña una pantalla con estos registros: los suyos; sin ninguno, los de ejemplo (demo y cuentas de prueba)
// o nada (cuenta real)
function viewOf(stored: DailyWearableRecord[], days: number): WearableView {
  if (stored.length > 0) return { series: lastDays(seriesOf(stored), days), sources: recentSources(stored), isSample: false, hasAny: true };
  if (showSamples()) return { series: lastDays(sampleSeries(), days), sources: ['Huawei Health'], isSample: true, hasAny: true };
  return { series: {}, sources: [], isSample: false, hasAny: false };
}

// Hook para Today, My Data y el detalle de métrica: lee lo sincronizado y, si todavía no hay nada,
// usa el dummy de Huawei EN MEMORIA (sin guardarlo) para que la demo no salga vacía; en una cuenta
// real, no (sale vacío). `days` recorta al periodo que enseña cada pantalla. Con `autoSync`, además,
// trae lo nuevo de Health Connect (Android) o de Apple Salud (iPhone) en segundo plano (como mucho
// cada 10 minutos) y repinta.
// Con cuenta, la pantalla nace con lo último leído (en memoria o guardado en el móvil) y lo refresca de la red
// detrás, en vez de empezar vacía (fundador, 2026-11-17).
export function useDailyWearables(days = 14, opts?: { autoSync?: boolean }) {
  const [initial] = useState<WearableView | null>(() => {
    const snap = wearableRepository.peekRecords();
    return snap ? viewOf(snap, days) : null;
  });
  const [series, setSeries] = useDeepState<DailySeries>(initial?.series ?? {});
  const [isSample, setIsSample] = useDeepState(initial?.isSample ?? false);
  const [sources, setSources] = useDeepState<string[]>(initial?.sources ?? []);
  const [hasAny, setHasAny] = useDeepState(initial?.hasAny ?? false);
  const autoSync = !!opts?.autoSync;
  const firstLoad = useRef(true);

  const apply = useCallback(
    (stored: DailyWearableRecord[]) => {
      const v = viewOf(stored, days);
      setSeries(v.series);
      setSources(v.sources);
      setIsSample(v.isSample);
      setHasAny(v.hasAny);
    },
    [setSeries, setIsSample, setSources, setHasAny, days],
  );

  const load = useCallback(async () => {
    // Al volver a la pantalla, lo último leído por cualquiera (p. ej. tras sincronizar en Hoy) se ve ya
    if (!firstLoad.current) {
      const snap = wearableRepository.peekRecords();
      if (snap) apply(snap);
    }
    firstLoad.current = false;
    // Sin red, se queda lo último leído (si lo hay) en vez de vaciar la pantalla
    apply(await wearableRepository.getRecords().catch(() => wearableRepository.peekRecords() ?? []));
    if (autoSync) {
      syncWearablesIfDue()
        .then(async (changed) => {
          if (changed) apply(await wearableRepository.getRecords());
        })
        .catch((e) => console.warn('Wearables sync failed', e));
    }
  }, [apply, autoSync]);

  useReloadOnFocus(load);

  return { series, isSample, sources, hasAny };
}

// Con un usuario simulado cargado (Test scenarios en una cuenta de prueba) no se mezcla el sueño y
// el pulso de este móvil con los del caso. Sincronizar a mano en Wearables sí trae los datos.
const scenarioLoaded = async () => {
  const sim = await userFlags.get('simulation').catch(() => undefined);
  return !!sim && typeof sim === 'object' && 'personaId' in sim;
};

// Trae de Health Connect los últimos 30 días y sustituye lo guardado de ese rango. Solo si está
// conectado (algún permiso concedido) y han pasado 10 minutos desde la última vez.
export async function syncHealthConnectIfDue(force = false): Promise<boolean> {
  if (!force && !(await healthConnectSyncDue())) return false;
  if (!force && (await scenarioLoaded())) return false;
  if (!(await isHealthConnectAvailable())) return false;
  if (!(await grantedTypes()).length) return false;
  const read = await readHealthConnectDaily(30);
  await markHealthConnectSynced();
  if (!read.records.length) return false;
  await wearableRepository.replaceProviderFrom('health_connect', read.from, read.records);
  return true;
}

// Lo mismo con Apple Salud en el iPhone. Salud no dice qué permisos de lectura se han dado, así que
// "conectado" = ya se ha enseñado la pantalla de permisos; si no se aceptó nada, simplemente no llega nada.
export async function syncAppleHealthIfDue(force = false): Promise<boolean> {
  if (!force && !(await appleHealthSyncDue())) return false;
  if (!force && (await scenarioLoaded())) return false;
  if (!(await isAppleHealthAvailable())) return false;
  if (!(await appleHealthAsked())) return false;
  const read = await readAppleHealthDaily(30);
  await markAppleHealthSynced();
  if (!read.records.length) return false;
  await wearableRepository.replaceProviderFrom('apple_health', read.from, read.records);
  return true;
}

// La del sistema de este móvil: Apple Salud en iPhone, Health Connect en Android (en la web, ninguna)
export const syncWearablesIfDue = (force = false) =>
  Platform.OS === 'ios' ? syncAppleHealthIfDue(force) : syncHealthConnectIfDue(force);


export const latest = (points?: DailyPoint[]) => (points?.length ? points[points.length - 1].value : null);

export const formatSleep = (minutes: number) =>
  `${Math.floor(minutes / 60)}h ${String(Math.round(minutes % 60)).padStart(2, '0')}m`;

export const shortDate = (iso: string) => {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`);
  return `${d.getDate()}/${d.getMonth() + 1}`;
};

import { useCallback } from 'react';
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

// Hook para Today, My Data y el detalle de métrica: lee lo sincronizado y, si todavía no hay nada,
// usa el dummy de Huawei EN MEMORIA (sin guardarlo) para que la demo no salga vacía; en una cuenta
// real, no (sale vacío). `days` recorta al periodo que enseña cada pantalla. Con `autoSync`, además,
// trae lo nuevo de Health Connect (Android) o de Apple Salud (iPhone) en segundo plano (como mucho
// cada 10 minutos) y repinta.
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

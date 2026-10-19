import { Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DailyWearableRecord, WearableMetric } from '../types';
import { appleSourceName, joinAppleSources } from '../sources';
import { appleSleepSessions, summarizeSleepSessions } from '../seriesLogic';
import type { AppleHealthRead } from './appleHealth';

export { APPLE_READ_TYPES, APPLE_TYPE_LABEL } from './appleHealth';
export type { AppleHealthRead };

// Adaptador de Apple Salud (HealthKit, iPhone). Traduce lo que hay en Salud al formato propio de
// Kuova (DailyWearableRecord), resumido por día EN HORA LOCAL, igual que el de Health Connect, y se
// guarda en la misma tabla (wearable_daily, provider 'apple_health'): así lo ve también la web.
//
// IMPORTANTE: HealthKit es código nativo. No funciona en Expo Go ni en una app de iPhone compilada
// sin la librería (@kingstinct/react-native-healthkit): ahí loadLib() devuelve null y la app sigue.
//
// Diferencias con Health Connect:
// - Salud no dice a las apps qué permisos de LECTURA les han dado (por privacidad). Solo sabemos si
//   ya se ha enseñado la pantalla de permisos; lo demás se ve por los datos que llegan.
// - La VFC de Apple es SDNN (Health Connect da RMSSD). Se guarda en la misma métrica 'hrv' porque se
//   compara contigo mismo, pero con raw_type_id 'HeartRateVariabilitySDNN' para distinguirla: no
//   mezclar sus cifras con umbrales pensados para RMSSD.
// - El sueño llega en tramos (no en sesiones): appleSleepSessions los junta por noche y fuente.

type HK = typeof import('@kingstinct/react-native-healthkit');

let cached: HK | null | undefined;
function loadLib(): HK | null {
  if (cached !== undefined) return cached;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cached = require('@kingstinct/react-native-healthkit') as HK;
  } catch {
    cached = null;
  }
  return cached;
}

const QT = {
  steps: 'HKQuantityTypeIdentifierStepCount',
  activeEnergy: 'HKQuantityTypeIdentifierActiveEnergyBurned',
  distance: 'HKQuantityTypeIdentifierDistanceWalkingRunning',
  heartRate: 'HKQuantityTypeIdentifierHeartRate',
  restingHeartRate: 'HKQuantityTypeIdentifierRestingHeartRate',
  hrv: 'HKQuantityTypeIdentifierHeartRateVariabilitySDNN',
} as const;
const SLEEP = 'HKCategoryTypeIdentifierSleepAnalysis' as const;

// Solo lo que leemos de verdad (App Review rechaza pedir de más). Añadir uno = pedirlo aquí y leerlo
// abajo; en iPhone no hace falta otra versión de la app, solo vuelve a salir la pantalla de permisos.
const TO_READ = [QT.steps, QT.activeEnergy, QT.distance, QT.heartRate, QT.restingHeartRate, QT.hrv, SLEEP];

export async function isAppleHealthAvailable(): Promise<boolean> {
  const lib = loadLib();
  if (!lib) return false;
  try {
    return await lib.isHealthDataAvailableAsync();
  } catch {
    return false;
  }
}

// ¿Ya se ha enseñado la pantalla de permisos con todo lo que leemos? (no dice qué se aceptó)
export async function appleHealthAsked(): Promise<boolean> {
  const lib = loadLib();
  if (!lib) return false;
  try {
    return (await lib.getRequestStatusForAuthorization({ toRead: TO_READ })) === lib.AuthorizationRequestStatus.unnecessary;
  } catch {
    return false;
  }
}

export async function connectAppleHealth(): Promise<boolean> {
  const lib = loadLib();
  if (!lib) throw new Error('Apple Health only works in the Kuova app for iPhone.');
  await lib.requestAuthorization({ toRead: TO_READ });
  return appleHealthAsked();
}

// Los permisos se cambian en Salud → tu foto → Apps → Kuova (o Ajustes → Salud); esto abre Salud
export function openAppleHealth() {
  Linking.openURL('x-apple-health://').catch(() => undefined);
}

const pad = (n: number) => String(n).padStart(2, '0');
const isoDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const rec = (date: string, metric: WearableMetric, value: number, sourceName: string, rawTypeId: string): DailyWearableRecord => ({
  date,
  metric,
  value: Math.round(value),
  sourceName,
  provider: 'apple_health',
  rawTypeId,
  rawTypeName: rawTypeId,
});

// Primer día que se lee: medianoche local de hace `days` días
const windowStart = (days: number) => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - (days - 1));
  return d;
};

export async function readAppleHealthDaily(days = 30): Promise<AppleHealthRead> {
  const lib = loadLib();
  if (!lib) throw new Error('Apple Health only works in the Kuova app for iPhone.');
  const start = windowStart(days);
  const end = new Date();
  const from = isoDay(start);
  const filter = { date: { startDate: start, endDate: end } };
  const out: DailyWearableRecord[] = [];
  const found: AppleHealthRead['found'] = {};
  const note = (type: string, rows: DailyWearableRecord[]) => {
    const kept = rows.filter((r) => r.date >= from);
    if (!kept.length) return;
    const srcs = new Set<string>();
    for (const r of kept) r.sourceName.split(' + ').forEach((s) => srcs.add(s));
    found[type] = { days: new Set(kept.map((r) => r.date)).size, sources: [...srcs] };
    out.push(...kept);
  };
  const warn = (what: string) => (e: unknown) => {
    console.warn(`Apple Health: could not read ${what}`, e);
    return [] as never[];
  };

  // Totales por día (Salud ya quita los duplicados entre el reloj y el teléfono, como Health Connect)
  const perDay = (identifier: (typeof QT)[keyof typeof QT], stat: 'cumulativeSum' | 'discreteAverage', unit: string) =>
    lib
      .queryStatisticsCollectionForQuantity(identifier, [stat], start, { day: 1 }, { filter, unit })
      .catch(warn(identifier));
  const valueOf = (s: { sumQuantity?: { quantity: number }; averageQuantity?: { quantity: number } }) =>
    s.sumQuantity?.quantity ?? s.averageQuantity?.quantity ?? 0;
  const daily = async (type: string, identifier: (typeof QT)[keyof typeof QT], stat: 'cumulativeSum' | 'discreteAverage', unit: string, metric: WearableMetric) =>
    note(
      type,
      (await perDay(identifier, stat, unit))
        .filter((s) => s.startDate && valueOf(s) > 0)
        .map((s) => rec(isoDay(new Date(s.startDate!)), metric, valueOf(s), joinAppleSources(s.sources ?? []), type)),
    );

  await daily('Steps', QT.steps, 'cumulativeSum', 'count', 'steps');
  await daily('ActiveCaloriesBurned', QT.activeEnergy, 'cumulativeSum', 'kcal', 'active_energy');
  await daily('Distance', QT.distance, 'cumulativeSum', 'm', 'distance');
  await daily('HeartRate', QT.heartRate, 'discreteAverage', 'count/min', 'heart_rate_avg');

  // Muestras sueltas con su fuente (el Apple Watch escribe un pulso en reposo al día y varias VFC)
  const samples = (identifier: (typeof QT)[keyof typeof QT], unit: string) =>
    lib.queryQuantitySamples(identifier, { limit: 0, filter, unit }).catch(warn(identifier));
  const meanPerDay = async (identifier: (typeof QT)[keyof typeof QT], unit: string) => {
    const acc = new Map<string, { sum: number; n: number }>();
    for (const s of await samples(identifier, unit)) {
      const key = `${isoDay(new Date(s.startDate))}|${appleSourceName(s.sourceRevision?.source, s.sourceRevision?.productType)}`;
      const cur = acc.get(key) ?? { sum: 0, n: 0 };
      cur.sum += s.quantity;
      cur.n++;
      acc.set(key, cur);
    }
    return [...acc.entries()].map(([k, v]) => ({ date: k.slice(0, 10), source: k.slice(11), value: v.sum / v.n }));
  };

  // Pulso en reposo: el del reloj; los días sin él, la media horaria más baja del pulso (estimado)
  const resting = (await meanPerDay(QT.restingHeartRate, 'count/min')).map((r) => rec(r.date, 'resting_heart_rate', r.value, r.source, 'RestingHeartRate'));
  const restingDays = new Set(resting.map((r) => r.date));
  const hours = await lib
    .queryStatisticsCollectionForQuantity(QT.heartRate, ['discreteAverage'], start, { hour: 1 }, { filter, unit: 'count/min' })
    .catch(warn('hourly heart rate'));
  const lowest = new Map<string, { bpm: number; sources: readonly { name?: string; bundleIdentifier?: string }[] }>();
  for (const h of hours) {
    const bpm = h.averageQuantity?.quantity ?? 0;
    if (!bpm || !h.startDate) continue;
    const d = isoDay(new Date(h.startDate));
    if (!lowest.has(d) || bpm < lowest.get(d)!.bpm) lowest.set(d, { bpm, sources: h.sources ?? [] });
  }
  for (const [d, v] of lowest) if (!restingDays.has(d)) resting.push(rec(d, 'resting_heart_rate', v.bpm, joinAppleSources(v.sources), 'HeartRate:lowest-hour'));
  note('RestingHeartRate', resting);

  // VFC (SDNN): media del día por fuente
  note('HeartRateVariabilitySDNN', (await meanPerDay(QT.hrv, 'ms')).map((r) => rec(r.date, 'hrv', r.value, r.source, 'HeartRateVariabilitySDNN')));

  // Sueño: desde 18 h antes del primer día, para que la primera noche llegue entera
  const sleepFrom = new Date(start.getTime() - 18 * 3600000);
  const sleepSamples = await lib
    .queryCategorySamples(SLEEP, { limit: 0, filter: { date: { startDate: sleepFrom, endDate: end } } })
    .catch(warn('sleep'));
  const nights = summarizeSleepSessions(
    appleSleepSessions(
      sleepSamples.map((s) => ({
        startTime: new Date(s.startDate).toISOString(),
        endTime: new Date(s.endDate).toISOString(),
        value: Number(s.value),
        source: appleSourceName(s.sourceRevision?.source, s.sourceRevision?.productType),
      })),
    ),
  );
  note(
    'SleepSession',
    nights
      .filter((n) => n.asleep >= 30)
      .flatMap((n) => {
        const night = (metric: WearableMetric, value: number) => rec(n.date, metric, value, n.source, 'SleepAnalysis');
        const rows = [night('sleep_duration', n.asleep), night('sleep_start', n.start), night('sleep_end', n.end)];
        if (n.stages) {
          const { deep, light, rem, awake } = n.stages;
          rows.push(night('sleep_deep', deep), night('sleep_light', light), night('sleep_rem', rem), night('sleep_awake', awake));
        }
        return rows;
      }),
  );

  return { records: out, from, found };
}

// Sincronización al abrir Today: como mucho cada 10 minutos
const LAST_SYNC_KEY = 'wearables.apple_health.lastSync';
export async function lastAppleHealthSync(): Promise<string | null> {
  return AsyncStorage.getItem(LAST_SYNC_KEY).catch(() => null);
}
export async function markAppleHealthSynced() {
  await AsyncStorage.setItem(LAST_SYNC_KEY, new Date().toISOString()).catch(() => undefined);
}
export async function appleHealthSyncDue(minutes = 10): Promise<boolean> {
  if (!loadLib()) return false;
  const last = await lastAppleHealthSync();
  return !last || Date.now() - new Date(last).getTime() > minutes * 60000;
}

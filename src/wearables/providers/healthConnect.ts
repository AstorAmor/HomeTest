import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { requireOptionalNativeModule } from 'expo';
import { DailyWearableRecord, WearableMetric } from '../types';

// Adaptador de Health Connect (Android). Traduce los registros de Health Connect
// al formato propio de Kuova (DailyWearableRecord), resumidos por día EN HORA LOCAL.
//
// IMPORTANTE: Health Connect es código nativo y NO funciona en Expo Go ni en la web.
// En la APK sí. isHealthConnectAvailable() devuelve false donde no está.
//
// Cómo se resume cada cosa:
// - Pasos: el agregado diario de Health Connect, que ya quita duplicados entre fuentes
//   (si el reloj y el teléfono cuentan los mismos pasos, no se suman dos veces).
// - Pulso en reposo: el que escribe el reloj (RestingHeartRate); si no lo escribe, se estima
//   con la media horaria más baja del día a partir del pulso (HeartRate).
// - Pulso medio, VFC (RMSSD) y sueño (tiempo dormido sin los ratos despierto; cuenta para el
//   día en que te despiertas).

import { joinSources, originName, PHONE_SOURCE } from '../sources';

export { originName, PHONE_SOURCE };

// Carga perezosa: si el módulo nativo no existe (Expo Go, iOS, web), devolvemos null.
function loadLib(): any | null {
  if (Platform.OS !== 'android') return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('react-native-health-connect');
  } catch {
    return null;
  }
}

export async function isHealthConnectAvailable(): Promise<boolean> {
  const lib = loadLib();
  if (!lib) return false;
  try {
    const status = await lib.getSdkStatus();
    return status === lib.SdkAvailabilityStatus.SDK_AVAILABLE;
  } catch {
    return false;
  }
}

// Permisos declarados en la APK de septiembre (app.json). Pedir uno que la APK no declara no
// sirve, así que los nuevos solo se piden con la APK nueva (octubre de 2026), que se reconoce
// porque trae expo-print (la de septiembre y la del 6 de octubre no lo tienen). Esa APK declara
// además entrenos, peso, oxígeno, temperatura, VO2max, tensión, glucosa y respiración: para
// leerlos basta con añadirlos aquí (y leerlos abajo) en una actualización, sin otra APK.
const BASE_TYPES = ['Steps', 'HeartRate', 'RestingHeartRate', 'HeartRateVariabilityRmssd', 'SleepSession'] as const;
const NEW_APK_TYPES = ['ActiveCaloriesBurned', 'Distance'] as const;
const hasNewApk = () => !!requireOptionalNativeModule('ExpoPrint');
export const readTypes = (): string[] => [...BASE_TYPES, ...(hasNewApk() ? NEW_APK_TYPES : [])];

// Qué se ve en pantalla de cada tipo
export const TYPE_LABEL: Record<string, string> = {
  Steps: 'Steps',
  HeartRate: 'Heart rate',
  RestingHeartRate: 'Resting heart rate',
  HeartRateVariabilityRmssd: 'HRV',
  SleepSession: 'Sleep',
  ActiveCaloriesBurned: 'Active energy',
  Distance: 'Distance',
};

export async function connectHealthConnect(): Promise<string[]> {
  const lib = loadLib();
  if (!lib) throw new Error('Health Connect is not available on this device.');
  await lib.initialize();
  await lib.requestPermission(readTypes().map((recordType) => ({ accessType: 'read', recordType })));
  return grantedTypes();
}

// Tipos con permiso de lectura concedido (vacío = no conectado)
export async function grantedTypes(): Promise<string[]> {
  const lib = loadLib();
  if (!lib) return [];
  try {
    await lib.initialize();
    const granted = (await lib.getGrantedPermissions()) as { accessType: string; recordType: string }[];
    return [...new Set(granted.filter((p) => p.accessType === 'read').map((p) => p.recordType))];
  } catch {
    return [];
  }
}

export function openHealthConnectSettings() {
  try {
    loadLib()?.openHealthConnectSettings();
  } catch {
    // sin Health Connect no hay ajustes que abrir
  }
}

const pad = (n: number) => String(n).padStart(2, '0');
const localDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
// Los instantes (con Z u offset) se pasan a la hora del teléfono; las horas locales ("2026-10-14T00:00",
// lo que devuelve el agregado por días) ya son del día que dicen.
const dayOf = (s: string) => (/Z$|[+-]\d\d:?\d\d$/.test(s) ? localDay(new Date(s)) : s.slice(0, 10));

const rec = (date: string, metric: WearableMetric, value: number, sourceName: string, rawTypeId: string): DailyWearableRecord => ({
  date,
  metric,
  value: Math.round(value),
  sourceName,
  provider: 'health_connect',
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

export interface HealthConnectRead {
  records: DailyWearableRecord[];
  from: string; // primer día leído (YYYY-MM-DD)
  granted: string[];
  // Por tipo: cuántos días traen datos y de qué apps (para explicar qué llega y qué no)
  found: Record<string, { days: number; sources: string[] }>;
}

// Lee los últimos `days` días (Health Connect deja leer hasta 30 días antes del permiso).
export async function readHealthConnectDaily(days = 30): Promise<HealthConnectRead> {
  const lib = loadLib();
  if (!lib) throw new Error('Health Connect is not available on this device.');
  await lib.initialize();
  const granted = await grantedTypes();
  const start = windowStart(days);
  const timeRangeFilter = { operator: 'between', startTime: start.toISOString(), endTime: new Date().toISOString() };
  const out: DailyWearableRecord[] = [];
  const found: HealthConnectRead['found'] = {};
  const note = (type: string, rows: DailyWearableRecord[]) => {
    if (!rows.length) return;
    const srcs = new Set<string>();
    for (const r of rows) r.sourceName.split(' + ').forEach((s) => srcs.add(s));
    found[type] = { days: new Set(rows.map((r) => r.date)).size, sources: [...srcs] };
    out.push(...rows);
  };

  // Registros sueltos, con paginación (un mes de pasos del teléfono puede pasar de mil)
  const readAll = async (type: string): Promise<any[]> => {
    if (!granted.includes(type)) return [];
    const all: any[] = [];
    let pageToken: string | undefined;
    try {
      for (let page = 0; page < 30; page++) {
        const res = await lib.readRecords(type, { timeRangeFilter, pageSize: 1000, ...(pageToken ? { pageToken } : {}) });
        all.push(...((res?.records ?? res ?? []) as any[]));
        pageToken = res?.pageToken || undefined;
        if (!pageToken) break;
      }
    } catch (e) {
      console.warn(`Health Connect: could not read ${type}`, e);
    }
    return all;
  };
  const byDay = async (type: string) => {
    if (!granted.includes(type)) return [];
    try {
      return (await lib.aggregateGroupByPeriod({ recordType: type, timeRangeFilter, timeRangeSlicer: { period: 'DAYS', length: 1 } })) as any[];
    } catch (e) {
      console.warn(`Health Connect: could not aggregate ${type}`, e);
      return [];
    }
  };

  // Pasos (sin duplicar entre fuentes)
  note(
    'Steps',
    (await byDay('Steps'))
      .filter((g) => (g.result?.COUNT_TOTAL ?? 0) > 0)
      .map((g) => rec(dayOf(g.startTime), 'steps', g.result.COUNT_TOTAL, joinSources(g.result.dataOrigins ?? []), 'Steps')),
  );

  // Calorías activas y distancia (solo con la APK nueva)
  note(
    'ActiveCaloriesBurned',
    (await byDay('ActiveCaloriesBurned'))
      .filter((g) => (g.result?.ACTIVE_CALORIES_TOTAL?.inKilocalories ?? 0) > 0)
      .map((g) => rec(dayOf(g.startTime), 'active_energy', g.result.ACTIVE_CALORIES_TOTAL.inKilocalories, joinSources(g.result.dataOrigins ?? []), 'ActiveCaloriesBurned')),
  );
  note(
    'Distance',
    (await byDay('Distance'))
      .filter((g) => (g.result?.DISTANCE?.inMeters ?? 0) > 0)
      .map((g) => rec(dayOf(g.startTime), 'distance', g.result.DISTANCE.inMeters, joinSources(g.result.dataOrigins ?? []), 'Distance')),
  );

  // Pulso medio del día y estimación del pulso en reposo (media horaria más baja)
  const hrDays = (await byDay('HeartRate')).filter((g) => (g.result?.BPM_AVG ?? 0) > 0);
  note('HeartRate', hrDays.map((g) => rec(dayOf(g.startTime), 'heart_rate_avg', g.result.BPM_AVG, joinSources(g.result.dataOrigins ?? []), 'HeartRate')));

  const restingByDay = new Map<string, { sum: number; n: number; src: Set<string> }>();
  for (const r of await readAll('RestingHeartRate')) {
    const d = dayOf(r.time);
    const cur = restingByDay.get(d) ?? { sum: 0, n: 0, src: new Set<string>() };
    cur.sum += r.beatsPerMinute;
    cur.n++;
    cur.src.add(r.metadata?.dataOrigin);
    restingByDay.set(d, cur);
  }
  const resting = [...restingByDay.entries()].map(([d, v]) => rec(d, 'resting_heart_rate', v.sum / v.n, joinSources([...v.src]), 'RestingHeartRate'));
  if (hrDays.length) {
    try {
      const hours = (await lib.aggregateGroupByDuration({
        recordType: 'HeartRate',
        timeRangeFilter,
        timeRangeSlicer: { duration: 'HOURS', length: 1 },
      })) as any[];
      const lowest = new Map<string, { bpm: number; src: string[] }>();
      for (const h of hours) {
        const bpm = h.result?.BPM_AVG ?? 0;
        if (!bpm) continue;
        const d = dayOf(h.startTime);
        if (!lowest.has(d) || bpm < lowest.get(d)!.bpm) lowest.set(d, { bpm, src: h.result.dataOrigins ?? [] });
      }
      for (const [d, v] of lowest)
        if (!restingByDay.has(d)) resting.push(rec(d, 'resting_heart_rate', v.bpm, joinSources(v.src), 'HeartRate:lowest-hour'));
    } catch (e) {
      console.warn('Health Connect: could not estimate resting heart rate', e);
    }
  }
  note('RestingHeartRate', resting);

  // VFC: media del día por fuente
  const hrv = new Map<string, { sum: number; n: number }>();
  for (const r of await readAll('HeartRateVariabilityRmssd')) {
    const key = `${dayOf(r.time)}|${originName(r.metadata?.dataOrigin)}`;
    const cur = hrv.get(key) ?? { sum: 0, n: 0 };
    cur.sum += r.heartRateVariabilityMillis;
    cur.n++;
    hrv.set(key, cur);
  }
  note('HeartRateVariabilityRmssd', [...hrv.entries()].map(([k, v]) => rec(k.split('|')[0], 'hrv', v.sum / v.n, k.split('|')[1], 'HeartRateVariabilityRmssd')));

  // Sueño: tiempo dormido (sin despierto ni fuera de la cama), al día en que te despiertas
  const sleep = new Map<string, number>();
  for (const r of await readAll('SleepSession')) {
    const stages = (r.stages ?? []) as { startTime: string; endTime: string; stage: number }[];
    const ms = (a: string, b: string) => new Date(b).getTime() - new Date(a).getTime();
    const asleep = stages.length
      ? stages.filter((s) => s.stage !== 1 && s.stage !== 3).reduce((a, s) => a + ms(s.startTime, s.endTime), 0)
      : ms(r.startTime, r.endTime);
    const key = `${dayOf(r.endTime)}|${originName(r.metadata?.dataOrigin)}`;
    sleep.set(key, (sleep.get(key) ?? 0) + asleep / 60000);
  }
  note('SleepSession', [...sleep.entries()].filter(([, m]) => m >= 30).map(([k, m]) => rec(k.split('|')[0], 'sleep_duration', m, k.split('|')[1], 'SleepSession')));

  return { records: out, from: localDay(start), granted, found };
}

// Sincronización en segundo plano al abrir Today: como mucho cada 10 minutos y solo si
// Health Connect está conectado. Devuelve true si ha guardado algo nuevo.
const LAST_SYNC_KEY = 'wearables.health_connect.lastSync';
export async function lastHealthConnectSync(): Promise<string | null> {
  return AsyncStorage.getItem(LAST_SYNC_KEY).catch(() => null);
}
export async function markHealthConnectSynced() {
  await AsyncStorage.setItem(LAST_SYNC_KEY, new Date().toISOString()).catch(() => undefined);
}
export async function healthConnectSyncDue(minutes = 10): Promise<boolean> {
  if (!loadLib()) return false;
  const last = await lastHealthConnectSync();
  return !last || Date.now() - new Date(last).getTime() > minutes * 60000;
}

import { Platform } from 'react-native';
import { ConnectedSource, DailyWearableRecord, WearableMetric } from '../types';

// Adaptador de Health Connect (Android). Traduce los registros de Health Connect
// al formato propio de HomeTest (DailyWearableRecord), resumidos por día.
//
// IMPORTANTE: Health Connect es código nativo y NO funciona en Expo Go.
// Necesita un development build (eas build --profile development). En Expo Go,
// isHealthConnectAvailable() devuelve false y la pantalla lo explica.

// Paquete (dataOrigin) → nombre visible de la marca.
const ORIGIN_NAMES: Record<string, string> = {
  'com.mi.health': 'Xiaomi (Mi Fitness)',
  'com.xiaomi.wearable': 'Xiaomi (Mi Fitness)',
  'com.garmin.android.apps.connectmobile': 'Garmin Connect',
  'com.ouraring.oura': 'Oura',
  'com.sec.android.app.shealth': 'Samsung Health',
  'com.google.android.apps.fitness': 'Google Fit',
  'com.fitbit.FitbitMobile': 'Fitbit',
  'com.google.android.apps.healthdata': 'Health Connect',
};
const originName = (pkg?: string) => (pkg ? ORIGIN_NAMES[pkg] ?? pkg : 'Desconocido');

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

const READ_TYPES = ['Steps', 'RestingHeartRate', 'HeartRateVariabilityRmssd', 'SleepSession'] as const;

export async function connectHealthConnect(): Promise<boolean> {
  const lib = loadLib();
  if (!lib) throw new Error('Health Connect no está disponible (¿Expo Go? Necesitas un development build).');
  await lib.initialize();
  const granted = await lib.requestPermission(
    READ_TYPES.map((recordType) => ({ accessType: 'read', recordType }))
  );
  return Array.isArray(granted) && granted.length > 0;
}

type Acc = Map<string, { metric: WearableMetric; sum: number; n: number; source: string; typeName: string }>;

function add(acc: Acc, date: string, metric: WearableMetric, source: string, typeName: string, value: number, mode: 'sum' | 'avg') {
  const key = `${date}|${metric}|${source}`;
  const cur = acc.get(key) ?? { metric, sum: 0, n: 0, source, typeName };
  cur.sum += value;
  cur.n += mode === 'avg' ? 1 : 0;
  acc.set(key, cur);
}

// Lee los últimos `days` días y los resume por día, métrica y marca de origen.
export async function readHealthConnectDaily(days = 7): Promise<DailyWearableRecord[]> {
  const lib = loadLib();
  if (!lib) throw new Error('Health Connect no está disponible en este dispositivo o build.');
  await lib.initialize();
  const end = new Date();
  const start = new Date(end.getTime() - days * 24 * 3600 * 1000);
  const timeRangeFilter = { operator: 'between', startTime: start.toISOString(), endTime: end.toISOString() };
  const day = (iso: string) => iso.slice(0, 10);
  const acc: Acc = new Map();

  const read = async (type: string) => {
    try {
      const res = await lib.readRecords(type, { timeRangeFilter });
      return (res?.records ?? res ?? []) as any[];
    } catch {
      return []; // permiso denegado o tipo no disponible: seguimos con el resto
    }
  };

  for (const r of await read('Steps'))
    add(acc, day(r.startTime), 'steps', originName(r.metadata?.dataOrigin), 'Steps', r.count ?? 0, 'sum');
  for (const r of await read('RestingHeartRate'))
    add(acc, day(r.time), 'resting_heart_rate', originName(r.metadata?.dataOrigin), 'RestingHeartRate', r.beatsPerMinute, 'avg');
  for (const r of await read('HeartRateVariabilityRmssd'))
    add(acc, day(r.time), 'hrv', originName(r.metadata?.dataOrigin), 'HeartRateVariabilityRmssd', r.heartRateVariabilityMillis, 'avg');
  for (const r of await read('SleepSession')) {
    const minutes = (new Date(r.endTime).getTime() - new Date(r.startTime).getTime()) / 60000;
    // El sueño se asigna al día en que te despiertas.
    add(acc, day(r.endTime), 'sleep_duration', originName(r.metadata?.dataOrigin), 'SleepSession', minutes, 'sum');
  }

  return [...acc.entries()].map(([key, v]) => ({
    date: key.split('|')[0],
    metric: v.metric,
    value: Math.round(v.n > 0 ? v.sum / v.n : v.sum),
    sourceName: v.source,
    provider: 'health_connect' as const,
    rawTypeId: v.typeName,
    rawTypeName: v.typeName,
  }));
}

// Marcas que han escrito datos recientemente (a partir de lo leído).
export function sourcesFromRecords(records: DailyWearableRecord[]): ConnectedSource[] {
  const names = [...new Set(records.filter((r) => r.provider === 'health_connect').map((r) => r.sourceName))];
  return names.map((sourceName) => ({ sourceName, connectedAt: null }));
}

import { DailyWearableRecord } from '../types';

// Apple Salud solo existe en la app de iPhone: el código de verdad está en appleHealth.ios.ts, que Metro
// usa solo al compilar para iOS. Este archivo es lo que ven Android y la web, así que sus bundles no
// llevan la librería de HealthKit (y la APK publicada, que no la tiene, no se rompe con una
// actualización). Las dos versiones exportan lo mismo.

export interface AppleHealthRead {
  records: DailyWearableRecord[];
  from: string; // primer día leído (YYYY-MM-DD)
  // Por tipo: cuántos días traen datos y de qué apps (para explicar qué llega y qué no)
  found: Record<string, { days: number; sources: string[] }>;
}

// Tipos que se leen, en el orden en que se enseñan, y su métrica de Kuova
export const APPLE_READ_TYPES = ['Steps', 'SleepSession', 'RestingHeartRate', 'HeartRate', 'HeartRateVariabilitySDNN', 'ActiveCaloriesBurned', 'Distance'] as const;
export const APPLE_TYPE_LABEL: Record<string, string> = {
  Steps: 'Steps',
  SleepSession: 'Sleep',
  RestingHeartRate: 'Resting heart rate',
  HeartRate: 'Heart rate',
  HeartRateVariabilitySDNN: 'HRV',
  ActiveCaloriesBurned: 'Active energy',
  Distance: 'Distance',
};

export async function isAppleHealthAvailable(): Promise<boolean> {
  return false;
}
export async function appleHealthAsked(): Promise<boolean> {
  return false;
}
export async function connectAppleHealth(): Promise<boolean> {
  throw new Error('Apple Health only works in the Kuova app for iPhone.');
}
export async function readAppleHealthDaily(_days = 30): Promise<AppleHealthRead> {
  throw new Error('Apple Health only works in the Kuova app for iPhone.');
}
export function openAppleHealth() {}
export async function lastAppleHealthSync(): Promise<string | null> {
  return null;
}
export async function markAppleHealthSynced() {}
export async function appleHealthSyncDue(_minutes = 10): Promise<boolean> {
  return false;
}

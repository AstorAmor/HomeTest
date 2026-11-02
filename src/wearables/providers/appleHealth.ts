import type { AppleHealthRead } from './appleHealthShared';

// Apple Salud solo existe en la app de iPhone: el código de verdad está en appleHealth.ios.ts, que Metro
// usa solo al compilar para iOS. Este archivo es lo que ven Android y la web, así que sus bundles no
// llevan la librería de HealthKit (y la APK publicada, que no la tiene, no se rompe con una
// actualización). Las dos versiones exportan lo mismo; lo común está en appleHealthShared.ts.

export { APPLE_READ_TYPES, APPLE_TYPE_LABEL } from './appleHealthShared';
export type { AppleHealthRead };

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

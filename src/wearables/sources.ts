// Nombres visibles de las apps que escriben en Health Connect (sin dependencias de React Native,
// para poder testearlo). Los nombres son texto fuente en inglés: t() los traduce al enseñarlos.

// Paquete (dataOrigin) → nombre visible. Los nombres son texto fuente en inglés (t() los traduce).
const ORIGIN_NAMES: Record<string, string> = {
  'com.mi.health': 'Xiaomi (Mi Fitness)',
  'com.xiaomi.wearable': 'Xiaomi (Mi Fitness)',
  'com.xiaomi.hm.health': 'Zepp Life',
  'com.huami.watch.hmwatchmanager': 'Zepp',
  'com.garmin.android.apps.connectmobile': 'Garmin Connect',
  'com.ouraring.oura': 'Oura',
  'com.sec.android.app.shealth': 'Samsung Health',
  'com.google.android.apps.fitness': 'Google Fit',
  'com.fitbit.FitbitMobile': 'Fitbit',
  'com.google.android.apps.fitbit': 'Fitbit',
  'com.huawei.health': 'Huawei Health',
  'com.withings.wiscale2': 'Withings',
  'fi.polar.polarflow': 'Polar Flow',
  'com.whoop.android': 'WHOOP',
  'com.strava': 'Strava',
  'com.suunto.android': 'Suunto',
  'com.coros.coros': 'COROS',
  'com.google.android.apps.healthdata': 'Health Connect',
};

export const PHONE_SOURCE = 'This phone';

// Health Connect cuenta los pasos con el propio teléfono (Android 14+) y los firma con un
// paquete del sistema tipo "com.android.healthconnect.phone.<hash>".
export function originName(pkg?: string): string {
  if (!pkg) return 'Unknown app';
  if (ORIGIN_NAMES[pkg]) return ORIGIN_NAMES[pkg];
  if (/^com\.android\.healthconnect|^android$|^com\.google\.android\.healthconnect/.test(pkg)) return PHONE_SOURCE;
  // Desconocida: un nombre corto a partir del paquete ("com.acme.band" → "Acme"), nunca el paquete entero
  const parts = pkg.split('.').filter((p) => !['com', 'org', 'net', 'android', 'app', 'apps', 'mobile'].includes(p));
  const name = parts[0] ?? pkg;
  return name.charAt(0).toUpperCase() + name.slice(1, 24);
}

// Varias fuentes en un mismo valor (p. ej. pasos del reloj + teléfono): "Fitbit + This phone"
export const joinSources = (pkgs: string[]) => {
  const names = [...new Set(pkgs.map(originName))];
  // El reloj primero: el teléfono suele ser el respaldo
  names.sort((a, b) => Number(a === PHONE_SOURCE) - Number(b === PHONE_SOURCE));
  return names.join(' + ') || 'Health Connect';
};

// --- Apple Salud (iPhone) ---

// Apps que escriben en Apple Salud, por su identificador de iOS. Las que no están aquí usan el nombre
// de la app que da Salud, que para las apps es su nombre comercial ("Oura", "WHOOP"...).
const APPLE_BUNDLES: Record<string, string> = {
  'com.ouraring.oura': 'Oura',
  'com.garmin.connect.mobile': 'Garmin Connect',
  'com.huawei.iossporthealth': 'Huawei Health',
  'com.fitbit.FitbitMobile': 'Fitbit',
  'com.withings.wiscale2': 'Withings',
  'fi.polar.polarflow': 'Polar Flow',
  'com.strava.stravaride': 'Strava',
};

// El iPhone y el Apple Watch firman con "com.apple.health.<id>" y con el nombre que les puso su dueño
// ("Apple Watch de …"), que no guardamos: se distinguen por el modelo (productType "Watch7,1" o
// "iPhone16,2") o, si no viene (resúmenes por día), por si el nombre dice "Watch".
export function appleSourceName(source?: { name?: string; bundleIdentifier?: string }, productType?: string): string {
  const id = source?.bundleIdentifier ?? '';
  if (id.startsWith('com.apple.health')) {
    const watch = productType ? productType.startsWith('Watch') : /watch/i.test(source?.name ?? '');
    return watch ? 'Apple Watch' : PHONE_SOURCE;
  }
  if (APPLE_BUNDLES[id]) return APPLE_BUNDLES[id];
  const name = (source?.name ?? '').trim();
  return name ? name.slice(0, 24) : 'Apple Health';
}

// Igual que joinSources, para las fuentes de un resumen de Apple Salud
export const joinAppleSources = (sources: readonly { name?: string; bundleIdentifier?: string }[]) => {
  const names = [...new Set(sources.map((s) => appleSourceName(s)))];
  names.sort((a, b) => Number(a === PHONE_SOURCE) - Number(b === PHONE_SOURCE));
  return names.join(' + ') || 'Apple Health';
};

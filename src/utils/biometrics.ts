import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';
import { biometricKind, type BiometricKind } from '@/logic/appLock';

// Face ID / huella del móvil (expo-local-authentication). El módulo nativo solo está en los APK y apps de iPhone
// hechos desde el 2026-11-11: en los anteriores llega este JavaScript por OTA sin el módulo, así que se mira antes
// de cargarlo (si no, la librería falla al importarla) y, sin él, el bloqueo no aparece. En la web no hay.

type LocalAuth = typeof import('expo-local-authentication');

let mod: LocalAuth | null | undefined;
const localAuth = (): LocalAuth | null => {
  if (mod !== undefined) return mod;
  mod = null;
  if (Platform.OS === 'web' || !requireOptionalNativeModule('ExpoLocalAuthentication')) return mod;
  try {
    mod = require('expo-local-authentication') as LocalAuth;
  } catch {
    mod = null;
  }
  return mod;
};

export const biometricsInstalled = () => localAuth() !== null;

// 'missing': app sin el módulo (o web) · 'no_hardware': el móvil no tiene · 'not_enrolled': tiene, sin configurar
export type BiometricStatus = { state: 'ready'; kind: BiometricKind } | { state: 'missing' | 'no_hardware' | 'not_enrolled'; kind: BiometricKind };

export async function biometricStatus(): Promise<BiometricStatus> {
  const m = localAuth();
  const fallback: BiometricKind = Platform.OS === 'ios' ? 'face_id' : 'fingerprint_or_face';
  if (!m) return { state: 'missing', kind: fallback };
  try {
    const [hardware, enrolled, types] = await Promise.all([m.hasHardwareAsync(), m.isEnrolledAsync(), m.supportedAuthenticationTypesAsync()]);
    const kind = types.length ? biometricKind(Platform.OS, types as number[]) : fallback;
    if (!hardware) return { state: 'no_hardware', kind };
    if (!enrolled) return { state: 'not_enrolled', kind };
    return { state: 'ready', kind };
  } catch {
    return { state: 'missing', kind: fallback };
  }
}

// Mientras el sistema enseña la huella o la cara (o el código del móvil), la app pasa a «inactiva» (iPhone) o a
// segundo plano (Android, con el patrón o el PIN): el bloqueo no debe tomarlo como «se ha ido de la app».
let busy = false;
export const authenticating = () => busy;

export async function authenticate(promptMessage: string, cancelLabel: string): Promise<{ ok: boolean; error?: string }> {
  const m = localAuth();
  if (!m) return { ok: false, error: 'not_available' };
  if (busy) return { ok: false, error: 'app_cancel' };
  busy = true;
  try {
    // disableDeviceFallback: false → si la cara o el dedo fallan, el código, PIN o patrón del móvil
    const r = await m.authenticateAsync({ promptMessage, cancelLabel, disableDeviceFallback: false });
    return r.success ? { ok: true } : { ok: false, error: r.error };
  } catch {
    return { ok: false, error: 'unknown' };
  } finally {
    // Android avisa de «vuelta a la app» justo después: se deja pasar ese aviso
    setTimeout(() => {
      busy = false;
    }, 800);
  }
}

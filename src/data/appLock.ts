import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_LOCK_AFTER, parseLockPrefs, type AppLockPrefs, type LockAfter } from '@/logic/appLock';

// Preferencia del bloqueo con Face ID / huella, guardada en el móvil (no en la cuenta: es de este móvil). Se
// lee al arrancar, antes de saber si hay sesión, para que al abrir en frío no se vea nada antes de bloquear.
// Lógica y reglas en src/logic/appLock.ts.

const KEY = 'app_lock.v1';

type State = { loaded: boolean; prefs: AppLockPrefs | null };
let state: State = { loaded: false, prefs: null };
const listeners = new Set<() => void>();
const set = (next: State) => {
  state = next;
  listeners.forEach((l) => l());
};

const loading = AsyncStorage.getItem(KEY)
  .then((raw) => set({ loaded: true, prefs: parseLockPrefs(raw) }))
  .catch(() => set({ loaded: true, prefs: null }));

export const appLockReady = () => loading;

export function useAppLockPrefs(): State {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state
  );
}

export async function enableAppLock(userId: string, afterMs: LockAfter = DEFAULT_LOCK_AFTER) {
  const prefs = { userId, afterMs };
  set({ loaded: true, prefs });
  await AsyncStorage.setItem(KEY, JSON.stringify(prefs)).catch(() => undefined);
}

export async function setLockAfter(afterMs: LockAfter) {
  if (!state.prefs) return;
  await enableAppLock(state.prefs.userId, afterMs);
}

export async function disableAppLock() {
  set({ loaded: true, prefs: null });
  await AsyncStorage.removeItem(KEY).catch(() => undefined);
}

// Android 13+: miniatura en blanco en «apps recientes» mientras el bloqueo está activo (módulo local
// modules/kuova-privacy, solo en los APK desde el 2026-11-11; sin él no hace nada).
type PrivacyModule = { setHideInRecents(hide: boolean): boolean };
export function hideInRecents(hide: boolean) {
  if (Platform.OS !== 'android') return;
  try {
    requireOptionalNativeModule<PrivacyModule>('KuovaPrivacy')?.setHideInRecents(hide);
  } catch {
    // sin módulo o sin actividad: queda la capa de la marca
  }
}

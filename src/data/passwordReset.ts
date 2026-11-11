import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// «¿Has olvidado tu contraseña?» (2026-11-11). Con el código del correo, Supabase abre la sesión; desde ese
// momento, y hasta guardar la contraseña nueva, la app solo enseña «Elige una contraseña nueva»
// (MfaGuard, después del doble factor si la cuenta lo tiene: sin él, Supabase no deja cambiarla).
// Se guarda en el móvil para que, si la app se cierra antes de terminar, al volver siga ahí.

const KEY = 'passwordReset.pending';
export const RESET_PENDING_MS = 24 * 3600_000; // pasado un día, se olvida (la sesión sigue siendo válida)

// Lógica pura, con tests: ¿sigue pendiente un cambio pedido en `startedAt`?
export function isResetPending(startedAt: string | null | undefined, now: number, maxAgeMs = RESET_PENDING_MS): boolean {
  if (!startedAt) return false;
  const t = Date.parse(startedAt);
  return Number.isFinite(t) && now - t >= 0 && now - t < maxAgeMs;
}

let pending = false;
let loaded = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

async function load() {
  if (loaded) return;
  loaded = true;
  const v = await AsyncStorage.getItem(KEY).catch(() => null);
  if (isResetPending(v, Date.now())) {
    pending = true;
    emit();
  } else if (v) {
    await AsyncStorage.removeItem(KEY).catch(() => undefined);
  }
}

export async function markPasswordResetPending() {
  loaded = true;
  pending = true;
  emit();
  await AsyncStorage.setItem(KEY, new Date().toISOString()).catch(() => undefined);
}

// Contraseña nueva guardada: se olvida en el móvil (si la app se cierra ya no vuelve a pedirla), pero la
// pantalla sigue hasta pulsar «Continuar», para que se vea que ha ido bien
export async function markPasswordResetSaved() {
  await AsyncStorage.removeItem(KEY).catch(() => undefined);
}

export async function clearPasswordResetPending() {
  loaded = true;
  if (pending) {
    pending = false;
    emit();
  }
  await AsyncStorage.removeItem(KEY).catch(() => undefined);
}

export function usePasswordResetPending(): boolean {
  const [value, setValue] = useState(pending);
  useEffect(() => {
    const update = () => setValue(pending);
    listeners.add(update);
    update();
    load();
    return () => {
      listeners.delete(update);
    };
  }, []);
  return value;
}

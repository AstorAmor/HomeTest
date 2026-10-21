import { isPublicDemo, isRemoteActive, supabase } from '@/lib/supabase';
import { userFlags } from './userFlags';

// Cuenta real o cuenta de prueba.
//
// Hasta ahora la app rellenaba los huecos con ejemplos (analítica ficticia, wearables de Huawei de
// mentira, lecturas de tensión de muestra…) para que la demo nunca saliera vacía. En una CUENTA REAL
// no se simula nada: lo que no has medido sale vacío y te dice cómo conseguirlo.
//
// - Desde el 2026-10-21 (el fundador): toda cuenta es real. Solo los probadores (los admins y los
//   «+alias» del email de un admin: is_tester() en Supabase, migración 20261021100000_testers.sql)
//   pueden tener cuentas de prueba (con ejemplos, el selector «developer» y los casos de prueba).
// - Un probador elige con user_flags `real_account` (true = real), en Ajustes → "Cuenta real"; sin
//   marca, su cuenta es de prueba, como antes.
// - Sin Supabase (demo en el móvil / web de demo) siempre hay ejemplos.
//
// Se lee al iniciar sesión (AuthContext), antes de pintar ninguna pantalla, así que las pantallas
// pueden preguntar de forma síncrona con showSamples().

export const REAL_ACCOUNT_FLAG = 'real_account';

let real = false;

// Solo en desarrollo: EXPO_PUBLIC_FORCE_REAL_ACCOUNT=1 enseña la app como cuenta real sin iniciar
// sesión (para revisar los estados vacíos en la demo local). Nunca en una build publicada.
const FORCE_REAL = __DEV__ && process.env.EXPO_PUBLIC_FORCE_REAL_ACCOUNT === '1';

export const isRealAccount = () => FORCE_REAL || (real && isRemoteActive() && !isPublicDemo);
// ¿Se pueden enseñar datos de ejemplo cuando faltan los de verdad?
export const showSamples = () => !isRealAccount();

// ¿Puede esta cuenta ser de prueba? Sin la función en Supabase todavía, solo los admins.
export async function amITester(isAdmin: boolean): Promise<boolean> {
  if (!isRemoteActive() || !supabase) return false;
  const { data, error } = await supabase.rpc('is_tester');
  if (error) return isAdmin;
  return data === true;
}

export async function loadDataMode(tester: boolean): Promise<boolean> {
  if (!isRemoteActive()) {
    real = false;
    return real;
  }
  if (!tester) {
    real = true;
    return real;
  }
  try {
    real = (await userFlags.get(REAL_ACCOUNT_FLAG)) === true;
  } catch {
    // Probador sin conexión: mejor sin datos de ejemplo que mezclarlos con los suyos
    real = true;
  }
  return real;
}

export function resetDataMode() {
  real = false;
}

export async function setRealAccount(value: boolean): Promise<void> {
  await userFlags.set(REAL_ACCOUNT_FLAG, value);
  real = value;
}

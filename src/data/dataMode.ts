import { isPublicDemo, isRemoteActive } from '@/lib/supabase';
import { userFlags } from './userFlags';

// Cuenta real o cuenta de prueba.
//
// Hasta ahora la app rellenaba los huecos con ejemplos (analítica ficticia, wearables de Huawei de
// mentira, lecturas de tensión de muestra…) para que la demo nunca saliera vacía. En una CUENTA REAL
// no se simula nada: lo que no has medido sale vacío y te dice cómo conseguirlo.
//
// - Se marca por cuenta en user_flags, clave `real_account` (true = real). Vale en todos sus
//   dispositivos. Se cambia en Ajustes → "Cuenta real".
// - Sin marca, las cuentas siguen como cuentas de prueba (con ejemplos), igual que antes.
//   ANTES DEL LANZAMIENTO: invertir el valor por defecto (cuenta nueva = real).
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

export async function loadDataMode(): Promise<boolean> {
  try {
    real = isRemoteActive() && (await userFlags.get(REAL_ACCOUNT_FLAG)) === true;
  } catch {
    real = false;
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

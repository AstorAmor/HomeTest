import AsyncStorage from '@react-native-async-storage/async-storage';
import { getCurrentUserId } from '@/lib/supabase';
import type { SetRow, Step } from '@/logic/workoutLog';
import type { WorkoutExercise, WorkoutSession } from './types';

// El entreno en curso, copiado en el móvil a cada cambio (series marcadas, pesos escritos, el descanso
// en marcha…). Con la pantalla bloqueada Android puede cerrar la app para liberar memoria y, al volver,
// arrancaba de cero: se perdía lo marcado (le pasó al fundador el 2026-10-26, entre series). Ahora la
// app lo abre sola al arrancar (src/app/index.tsx), la sesión sigue donde estaba y Entrenamientos lo
// ofrece. Se borra al guardar o al descartar. Solo en este dispositivo: aún no es un entreno guardado.

export interface ActiveWorkout {
  v: 1;
  owner: string; // de quién es: con cuenta, su id; sin cuenta, 'local'
  programId: string;
  session: Pick<WorkoutSession, 'id' | 'title'>; // para el aviso de Entrenamientos
  mode: 'run' | 'done'; // 'done' = en el resumen, sin guardar aún
  view: 'list' | 'guided';
  startedAt: number;
  finishedAt: number;
  updatedAt: number;
  items: WorkoutExercise[]; // los ejercicios de hoy (con los añadidos y el descanso cambiado)
  rows: SetRow[][];
  at: Step;
  phase: 'work' | 'rest';
  endsAt: number; // final de la cuenta atrás en marcha (hora del reloj): sigue contando aunque la app muera
  restTotal: number;
  timerOn: boolean;
  timerAt: Step | null;
  intensity: 'easy' | 'moderate' | 'hard';
}

const KEY = 'workouts.active.v1';
// Al arrancar se vuelve sola a la sesión si se tocó hace menos de esto; si es más vieja, solo el aviso
const FRESH_MS = 6 * 3600e3;

const owner = () => getCurrentUserId() ?? 'local';

export const isFreshWorkout = (w: Pick<ActiveWorkout, 'updatedAt'>, now = Date.now()) => now - w.updatedAt < FRESH_MS;

// Lo guardado, si es de quien está ahora y tiene buena pinta (una versión vieja o rota no se abre)
export function readActiveWorkout(raw: string | null, who: string): ActiveWorkout | null {
  if (!raw) return null;
  try {
    const w = JSON.parse(raw) as ActiveWorkout;
    const ok = w?.v === 1 && w.owner === who && typeof w.programId === 'string' && !!w.session?.id && Array.isArray(w.items) && Array.isArray(w.rows);
    return ok ? w : null;
  } catch {
    return null;
  }
}

export async function loadActiveWorkout(): Promise<ActiveWorkout | null> {
  return readActiveWorkout(await AsyncStorage.getItem(KEY).catch(() => null), owner());
}

export const saveActiveWorkout = (w: Omit<ActiveWorkout, 'v' | 'owner'>) =>
  AsyncStorage.setItem(KEY, JSON.stringify({ v: 1, owner: owner(), ...w })).catch(() => undefined);

export const clearActiveWorkout = () => AsyncStorage.removeItem(KEY).catch(() => undefined);

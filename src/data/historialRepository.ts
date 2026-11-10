// Tu historial (alergias, grupo sanguíneo, vacunas, cirugías, historia clínica y los datos de la
// tarjeta de emergencia) en user_flags 'historial.v1': sin migración, con copia local y en la nube
// (data/userFlags). Una sola fuente de verdad: la tarjeta de emergencia lee de aquí.
import { userFlags } from './userFlags';
import { showSamples } from './dataMode';
import { getCurrentUserId } from '@/lib/supabase';
import { demoHistorial, emptyHistorial, Historial, normalizeHistorial } from '@/logic/historial';

export const HISTORIAL_FLAG = 'historial.v1';

// Lo último leído, por usuario: las pantallas se pintan al momento y se refrescan detrás
let cache: { user: string | null; h: Historial } | null = null;
export const cachedHistorial = (): Historial | null => (cache && cache.user === getCurrentUserId() ? cache.h : null);
const remember = (h: Historial) => {
  cache = { user: getCurrentUserId(), h };
  return h;
};

// Sin nada guardado: vacío en una cuenta real; la persona de ejemplo en la demo y en las de prueba
export async function loadHistorial(): Promise<Historial> {
  const raw = await userFlags.get(HISTORIAL_FLAG);
  if (raw == null || typeof raw !== 'object') return remember(showSamples() ? demoHistorial() : emptyHistorial());
  return remember(normalizeHistorial(raw));
}

export function saveHistorial(h: Historial): Promise<void> {
  remember(h);
  return userFlags.set(HISTORIAL_FLAG, h as unknown as Record<string, unknown>);
}

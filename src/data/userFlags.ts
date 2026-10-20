import AsyncStorage from '@react-native-async-storage/async-storage';
import { getCurrentUserId, isRemoteActive, supabase } from '@/lib/supabase';
import { emitDataChange } from './dataEvents';

// Lo que el usuario ya ha hecho o visto en la app ("report_seen:<id>", "tip_dismissed:x"…),
// para que la app actúe en coherencia (p. ej. no volver a enseñar "Your report is here!").
//
// Dónde vive:
// - Con cuenta (Supabase): tabla `user_flags`, así se respeta en todos sus dispositivos.
// - Siempre, además, una copia local (AsyncStorage) por usuario: respuesta instantánea y
//   funciona sin conexión. Al leer, si la nube dice otra cosa, gana la nube.

type FlagValue = boolean | string | number | Record<string, unknown>;

const localKey = () => `userFlags.v1:${getCurrentUserId() ?? 'demo'}`;

async function readLocal(): Promise<Record<string, FlagValue>> {
  try {
    const raw = await AsyncStorage.getItem(localKey());
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

async function writeLocal(flags: Record<string, FlagValue>) {
  try {
    await AsyncStorage.setItem(localKey(), JSON.stringify(flags));
  } catch {
    // sin almacenamiento local: la nube sigue siendo la fuente de verdad
  }
}

// Lo que se acaba de cambiar y aún está subiendo a la nube: al leer, gana esto (si no, volver
// atrás justo después de abrir algo leía el valor antiguo de la nube y el aviso reaparecía).
const pending = new Map<string, FlagValue>();

export const userFlags = {
  async getAll(): Promise<Record<string, FlagValue>> {
    const local = await readLocal();
    if (!isRemoteActive() || !supabase) return local;
    const { data, error } = await supabase.from('user_flags').select('key, value').eq('user_id', getCurrentUserId());
    if (error || !data) return local;
    const merged = { ...local };
    for (const row of data) merged[row.key] = row.value as FlagValue;
    for (const [k, v] of pending) merged[k] = v;
    await writeLocal(merged);
    return merged;
  },

  async get(key: string): Promise<FlagValue | undefined> {
    return (await this.getAll())[key];
  },

  async set(key: string, value: FlagValue = true): Promise<void> {
    pending.set(key, value);
    try {
      const local = await readLocal();
      await writeLocal({ ...local, [key]: value });
      emitDataChange(`flag:${key}`); // mientras sube, leer ya devuelve lo nuevo (pending)
      if (isRemoteActive() && supabase) {
        await supabase
          .from('user_flags')
          .upsert({ user_id: getCurrentUserId(), key, value, updated_at: new Date().toISOString() });
      }
    } finally {
      if (pending.get(key) === value) pending.delete(key);
    }
  },
};

export const reportSeenKey = (reportId: string) => `report_seen:${reportId}`;

import AsyncStorage from '@react-native-async-storage/async-storage';
import { getCurrentUserId, isRemoteActive, supabase } from '@/lib/supabase';

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

export const userFlags = {
  async getAll(): Promise<Record<string, FlagValue>> {
    const local = await readLocal();
    if (!isRemoteActive() || !supabase) return local;
    const { data, error } = await supabase.from('user_flags').select('key, value').eq('user_id', getCurrentUserId());
    if (error || !data) return local;
    const merged = { ...local };
    for (const row of data) merged[row.key] = row.value as FlagValue;
    await writeLocal(merged);
    return merged;
  },

  async get(key: string): Promise<FlagValue | undefined> {
    return (await this.getAll())[key];
  },

  async set(key: string, value: FlagValue = true): Promise<void> {
    const local = await readLocal();
    await writeLocal({ ...local, [key]: value });
    if (isRemoteActive() && supabase) {
      await supabase
        .from('user_flags')
        .upsert({ user_id: getCurrentUserId(), key, value, updated_at: new Date().toISOString() });
    }
  },
};

export const reportSeenKey = (reportId: string) => `report_seen:${reportId}`;

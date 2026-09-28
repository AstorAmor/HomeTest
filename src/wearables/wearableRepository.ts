import AsyncStorage from '@react-native-async-storage/async-storage';
import { getCurrentUserId, isRemoteActive, supabase } from '@/lib/supabase';
import { DailyWearableRecord, WearableProviderId } from './types';

// Registros diarios en el formato PROPIO de HomeTest. Con sesión de Supabase se
// guardan en la tabla wearable_daily; sin ella (modo demo), en AsyncStorage.
// Los tokens de proveedor son del dispositivo y se quedan siempre en local.
const RECORDS_KEY = 'wearables.dailyRecords.v1';
const userTokenKey = (provider: WearableProviderId) => `wearables.${provider}.userToken`;

const toRow = (r: DailyWearableRecord) => ({
  user_id: getCurrentUserId()!,
  date: r.date,
  metric: r.metric,
  value: r.value,
  source_name: r.sourceName,
  provider: r.provider,
  raw_type_id: r.rawTypeId,
  raw_type_name: r.rawTypeName,
});

const fromRow = (r: any): DailyWearableRecord => ({
  date: r.date,
  metric: r.metric,
  value: Number(r.value),
  sourceName: r.source_name,
  provider: r.provider,
  rawTypeId: r.raw_type_id,
  rawTypeName: r.raw_type_name,
});

const fail = (error: { message: string } | null) => {
  if (error) throw new Error(error.message);
};

async function getLocalRecords(): Promise<DailyWearableRecord[]> {
  const raw = await AsyncStorage.getItem(RECORDS_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as DailyWearableRecord[];
  } catch {
    return [];
  }
}

export const wearableRepository = {
  async getUserToken(provider: WearableProviderId): Promise<string | null> {
    return AsyncStorage.getItem(userTokenKey(provider));
  },
  async setUserToken(provider: WearableProviderId, token: string): Promise<void> {
    await AsyncStorage.setItem(userTokenKey(provider), token);
  },
  async clearUserToken(provider: WearableProviderId): Promise<void> {
    await AsyncStorage.removeItem(userTokenKey(provider));
  },

  async getRecords(): Promise<DailyWearableRecord[]> {
    if (isRemoteActive()) {
      const { data, error } = await supabase!
        .from('wearable_daily')
        .select('*')
        .eq('user_id', getCurrentUserId()!)
        .order('date', { ascending: false });
      fail(error);
      return (data ?? []).map(fromRow);
    }
    return getLocalRecords();
  },

  // Fusiona sin duplicar: la clave es fecha + métrica + fuente + tipo del proveedor.
  async upsertRecords(incoming: DailyWearableRecord[]): Promise<DailyWearableRecord[]> {
    if (isRemoteActive()) {
      if (incoming.length) {
        const { error } = await supabase!.from('wearable_daily').upsert(incoming.map(toRow), {
          onConflict: 'user_id,date,metric,source_name,provider,raw_type_id',
        });
        fail(error);
      }
      return this.getRecords();
    }
    const current = await getLocalRecords();
    const key = (r: DailyWearableRecord) =>
      `${r.date}|${r.metric}|${r.sourceName}|${r.provider}|${r.rawTypeId}`;
    const map = new Map(current.map((r) => [key(r), r]));
    for (const r of incoming) map.set(key(r), r);
    const merged = [...map.values()].sort((a, b) => b.date.localeCompare(a.date));
    await AsyncStorage.setItem(RECORDS_KEY, JSON.stringify(merged));
    return merged;
  },

  async clearRecords(): Promise<void> {
    if (isRemoteActive()) {
      const { error } = await supabase!.from('wearable_daily').delete().eq('user_id', getCurrentUserId()!);
      fail(error);
      return;
    }
    await AsyncStorage.removeItem(RECORDS_KEY);
  },

  // Sube a la cuenta los registros guardados en el móvil. Devuelve cuántos.
  async importLocalToRemote(): Promise<number> {
    if (!isRemoteActive()) return 0;
    const local = await getLocalRecords();
    if (local.length) await this.upsertRecords(local);
    return local.length;
  },
};

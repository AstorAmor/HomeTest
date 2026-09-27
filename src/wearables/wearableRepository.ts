import AsyncStorage from '@react-native-async-storage/async-storage';
import { DailyWearableRecord, WearableProviderId } from './types';

// Almacenamiento local (AsyncStorage) en el formato PROPIO de HomeTest.
// Igual que metricRepository: cuando exista Supabase, se cambia aquí y la UI no se entera.
const RECORDS_KEY = 'wearables.dailyRecords.v1';
const userTokenKey = (provider: WearableProviderId) => `wearables.${provider}.userToken`;

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
    const raw = await AsyncStorage.getItem(RECORDS_KEY);
    if (!raw) return [];
    try {
      return JSON.parse(raw) as DailyWearableRecord[];
    } catch {
      return [];
    }
  },

  // Fusiona sin duplicar: la clave es fecha + métrica + fuente + tipo del proveedor.
  async upsertRecords(incoming: DailyWearableRecord[]): Promise<DailyWearableRecord[]> {
    const current = await this.getRecords();
    const key = (r: DailyWearableRecord) =>
      `${r.date}|${r.metric}|${r.sourceName}|${r.provider}|${r.rawTypeId}`;
    const map = new Map(current.map((r) => [key(r), r]));
    for (const r of incoming) map.set(key(r), r);
    const merged = [...map.values()].sort((a, b) => b.date.localeCompare(a.date));
    await AsyncStorage.setItem(RECORDS_KEY, JSON.stringify(merged));
    return merged;
  },

  async clearRecords(): Promise<void> {
    await AsyncStorage.removeItem(RECORDS_KEY);
  },
};

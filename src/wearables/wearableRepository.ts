import AsyncStorage from '@react-native-async-storage/async-storage';
import { getCurrentUserId, isRemoteActive, supabase } from '@/lib/supabase';
import { readCache } from '@/data/readCache';
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

// Con cuenta, lo leído pasa por la caché (src/data/readCache.ts): Hoy, sus metas, los avisos y el plan piden lo del
// reloj a la vez y sale UNA petición; lo último leído se guarda también en el móvil para pintar al momento. Solo las
// columnas que se usan (sin user_id ni created_at).
const CACHE_KEY = 'wearable_daily';
const COLUMNS = 'date, metric, value, source_name, provider, raw_type_id, raw_type_name';

async function fetchRemoteRecords(): Promise<DailyWearableRecord[]> {
  const { data, error } = await supabase!
    .from('wearable_daily')
    .select(COLUMNS)
    .eq('user_id', getCurrentUserId()!)
    .order('date', { ascending: false });
  fail(error);
  return (data ?? []).map(fromRow);
}

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
    if (isRemoteActive()) return (await readCache.load(CACHE_KEY, fetchRemoteRecords, { persist: true })).slice();
    return getLocalRecords();
  },

  // Lo último leído de la cuenta, sin esperar a la red (undefined si aún no hay nada o en la demo): para pintar al
  // momento mientras getRecords trae lo de ahora
  peekRecords(): DailyWearableRecord[] | undefined {
    return isRemoteActive() ? readCache.peek<DailyWearableRecord[]>(CACHE_KEY)?.slice() : undefined;
  },

  // Fusiona sin duplicar: la clave es fecha + métrica + fuente + tipo del proveedor.
  async upsertRecords(incoming: DailyWearableRecord[]): Promise<DailyWearableRecord[]> {
    if (isRemoteActive()) {
      if (incoming.length) {
        const { error } = await supabase!.from('wearable_daily').upsert(incoming.map(toRow), {
          onConflict: 'user_id,date,metric,source_name,provider,raw_type_id',
        });
        fail(error);
        readCache.invalidate(CACHE_KEY);
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

  // Sustituye lo de un proveedor desde `fromDate` por lo recién leído. Así un día que el proveedor ha
  // corregido (o una fuente que ya no aparece) no se queda duplicado con el valor antiguo.
  async replaceProviderFrom(
    provider: WearableProviderId,
    fromDate: string,
    incoming: DailyWearableRecord[],
  ): Promise<DailyWearableRecord[]> {
    if (isRemoteActive()) {
      const { error } = await supabase!
        .from('wearable_daily')
        .delete()
        .eq('user_id', getCurrentUserId()!)
        .eq('provider', provider)
        .gte('date', fromDate);
      fail(error);
      readCache.invalidate(CACHE_KEY);
      return this.upsertRecords(incoming);
    }
    const kept = (await getLocalRecords()).filter((r) => !(r.provider === provider && r.date >= fromDate));
    await AsyncStorage.setItem(RECORDS_KEY, JSON.stringify(kept));
    return this.upsertRecords(incoming);
  },

  // Con keepManual, solo lo de los relojes y apps (lo apuntado a mano se queda: al borrar los datos del reloj)
  async clearRecords(opts: { keepManual?: boolean } = {}): Promise<void> {
    if (isRemoteActive()) {
      let q = supabase!.from('wearable_daily').delete().eq('user_id', getCurrentUserId()!);
      if (opts.keepManual) q = q.neq('provider', 'manual');
      const { error } = await q;
      fail(error);
      if (opts.keepManual) readCache.invalidate(CACHE_KEY);
      else readCache.invalidate<DailyWearableRecord[]>(CACHE_KEY, () => []);
      return;
    }
    if (opts.keepManual) {
      const kept = (await getLocalRecords()).filter((r) => r.provider === 'manual');
      await AsyncStorage.setItem(RECORDS_KEY, JSON.stringify(kept));
      return;
    }
    await AsyncStorage.removeItem(RECORDS_KEY);
  },

  // Borra un registro concreto (lo apuntado a mano de un día)
  async removeRecord(r: DailyWearableRecord): Promise<void> {
    if (isRemoteActive()) {
      const { error } = await supabase!
        .from('wearable_daily')
        .delete()
        .eq('user_id', getCurrentUserId()!)
        .eq('date', r.date)
        .eq('metric', r.metric)
        .eq('source_name', r.sourceName)
        .eq('provider', r.provider)
        .eq('raw_type_id', r.rawTypeId);
      fail(error);
      readCache.invalidate(CACHE_KEY);
      return;
    }
    const same = (x: DailyWearableRecord) =>
      x.date === r.date && x.metric === r.metric && x.sourceName === r.sourceName && x.provider === r.provider && x.rawTypeId === r.rawTypeId;
    const kept = (await getLocalRecords()).filter((x) => !same(x));
    await AsyncStorage.setItem(RECORDS_KEY, JSON.stringify(kept));
  },

  // Sube a la cuenta los registros guardados en el móvil. Devuelve cuántos.
  async importLocalToRemote(): Promise<number> {
    if (!isRemoteActive()) return 0;
    const local = await getLocalRecords();
    if (local.length) await this.upsertRecords(local);
    return local.length;
  },
};

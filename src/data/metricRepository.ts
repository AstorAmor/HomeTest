import AsyncStorage from '@react-native-async-storage/async-storage';
import { getCurrentUserId, isRemoteActive, supabase } from '@/lib/supabase';
import { emitDataChange } from './dataEvents';
import { readCache } from './readCache';
import { loadMetricKind } from './metricBatch';

export interface BaseMetricEntry {
  id: string;
  fecha: string;
  createdAt: string;
}

// Cómo se guarda un tipo de entrada en su tabla de Supabase.
export interface RemoteTable<T> {
  table: string;
  dateColumn: string; // columna de fecha para ordenar (más reciente primero)
  match?: Record<string, string>; // filtro fijo, p. ej. { kind: 'cortisol' } en metric_readings
  toRow: (entry: Partial<T>) => Record<string, unknown>;
  fromRow: (row: any) => T;
  // Guardar en el móvil lo último leído, para pintarlo al abrir la app sin esperar a la red (src/data/readCache.ts).
  // Solo las mediciones; lo demás queda en memoria.
  persist?: boolean;
}

// Quita los undefined para que un update parcial no pise columnas con null.
export const definedOnly = (o: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));

function localRepository<T extends BaseMetricEntry>(storageKey: string) {
  return {
    async getAll(): Promise<T[]> {
      const raw = await AsyncStorage.getItem(storageKey);
      if (!raw) return [];
      try {
        return JSON.parse(raw) as T[];
      } catch {
        return [];
      }
    },
    async save(entry: T): Promise<void> {
      const entries = await this.getAll();
      entries.unshift(entry);
      await AsyncStorage.setItem(storageKey, JSON.stringify(entries));
    },
    async update(id: string, updated: Partial<T>): Promise<void> {
      const entries = await this.getAll();
      const next = entries.map((e) => (e.id === id ? { ...e, ...updated } : e));
      await AsyncStorage.setItem(storageKey, JSON.stringify(next));
    },
    async remove(id: string): Promise<void> {
      const entries = await this.getAll();
      const next = entries.filter((e) => e.id !== id);
      await AsyncStorage.setItem(storageKey, JSON.stringify(next));
    },
    async saveMany(entries: T[]): Promise<void> {
      const byId = new Map((await this.getAll()).map((e) => [e.id, e]));
      for (const e of entries) byId.set(e.id, e);
      await AsyncStorage.setItem(storageKey, JSON.stringify([...byId.values()]));
    },
    async clearAll(): Promise<void> {
      await AsyncStorage.removeItem(storageKey);
    },
  };
}

function remoteRepository<T extends BaseMetricEntry>(remote: RemoteTable<T>) {
  // Siempre filtrado por el propio usuario: con permisos de profesional, RLS
  // también deja leer filas compartidas por otros pacientes.
  const own = () => ({ user_id: getCurrentUserId()!, ...(remote.match ?? {}) });
  const fail = (error: { message: string } | null) => {
    if (error) throw new Error(error.message);
  };

  // metric_readings con un solo `kind`: se pide junto con los demás kinds que se pidan a la vez (src/data/metricBatch.ts)
  const kind = remote.table === 'metric_readings' && remote.match && Object.keys(remote.match).length === 1 ? remote.match.kind : undefined;

  return {
    async getAll(): Promise<T[]> {
      if (kind) return (await loadMetricKind(kind)).map(remote.fromRow);
      const { data, error } = await supabase!
        .from(remote.table)
        .select('*')
        .match(own())
        .order(remote.dateColumn, { ascending: false });
      fail(error);
      return (data ?? []).map(remote.fromRow);
    },
    async save(entry: T): Promise<void> {
      const { error } = await supabase!.from(remote.table).insert({ ...remote.toRow(entry), ...own() });
      fail(error);
    },
    async update(id: string, updated: Partial<T>): Promise<void> {
      const { error } = await supabase!
        .from(remote.table)
        .update(remote.toRow(updated))
        .match({ ...own(), id });
      fail(error);
    },
    async remove(id: string): Promise<void> {
      const { error } = await supabase!.from(remote.table).delete().match({ ...own(), id });
      fail(error);
    },
    // Sube entradas guardadas en el móvil (sin duplicar si ya estaban). Por tandas, para no
    // mandar miles de filas en una sola petición.
    async upsertMany(entries: T[]): Promise<void> {
      for (let i = 0; i < entries.length; i += 500) {
        const rows = entries.slice(i, i + 500).map((e) => ({ ...remote.toRow(e), ...own() }));
        const { error } = await supabase!.from(remote.table).upsert(rows, { onConflict: 'user_id,id' });
        fail(error);
      }
    },
    // Borra TODAS las filas de este usuario en la tabla (con `match`, solo las de su tipo).
    // Solo para vaciar una cuenta de prueba (src/data/simulation.ts).
    async clearAll(): Promise<void> {
      if (!getCurrentUserId()) throw new Error('Not signed in');
      const { error } = await supabase!.from(remote.table).delete().match(own());
      fail(error);
    },
  };
}

// Repositorio de entradas con fecha (glucosa, tensión, ciclo, check-ins...).
// Con sesión de Supabase lee/escribe en su tabla; sin ella (modo demo), en
// AsyncStorage. La UI no sabe cuál de los dos se está usando.
export function createMetricRepository<T extends BaseMetricEntry>(storageKey: string, remote?: RemoteTable<T>) {
  const local = localRepository<T>(storageKey);
  const cloud = remote ? remoteRepository<T>(remote) : null;
  const onCloud = () => !!cloud && isRemoteActive();
  // Con cuenta, la lectura pasa por la caché (src/data/readCache.ts): si la misma tabla ya va en camino se comparte,
  // y lo último leído queda para pintar al momento. Cada quien recibe su copia de la lista.
  const readCloud = () => readCache.load(storageKey, () => cloud!.getAll(), { persist: !!remote?.persist }).then((xs) => xs.slice());
  const getAll = (): Promise<T[]> => (onCloud() ? readCloud() : local.getAll());
  // Tras guardar se avisa (src/data/dataEvents.ts): p. ej. los recordatorios del móvil se reprograman. Con cuenta,
  // lo último leído se corrige ya (`patch`) y la siguiente lectura vuelve a la red.
  const changed = (p: Promise<void>, patch?: (prev: T[]) => T[]) =>
    p.then(() => {
      if (onCloud()) readCache.invalidate<T[]>(storageKey, patch);
      emitDataChange(storageKey);
    });

  return {
    getAll,
    // Lo último leído de la cuenta, sin esperar a la red (undefined si aún no se ha leído nada o en la demo). Para
    // pintar al momento; lo de verdad llega con getAll.
    peek: (): T[] | undefined => (onCloud() ? readCache.peek<T[]>(storageKey)?.slice() : undefined),
    save: (entry: T): Promise<void> => changed(onCloud() ? cloud!.save(entry) : local.save(entry), (prev) => [entry, ...prev.filter((e) => e.id !== entry.id)]),
    update: (id: string, updated: Partial<T>): Promise<void> =>
      changed(onCloud() ? cloud!.update(id, updated) : local.update(id, updated), (prev) => prev.map((e) => (e.id === id ? { ...e, ...updated } : e))),
    remove: (id: string): Promise<void> => changed(onCloud() ? cloud!.remove(id) : local.remove(id), (prev) => prev.filter((e) => e.id !== id)),
    // Varias entradas de golpe (upsert por id). Para cargar un usuario simulado.
    saveMany: (entries: T[]): Promise<void> => changed(onCloud() ? cloud!.upsertMany(entries) : local.saveMany(entries)),
    // Vacía la tabla del usuario (o, sin sesión, lo guardado en el móvil). Solo cuentas de prueba.
    clearAll: (): Promise<void> => changed(onCloud() ? cloud!.clearAll() : local.clearAll(), () => []),
    async getLatest(): Promise<T | null> {
      const entries = await getAll();
      if (!entries.length) return null;
      return entries.reduce((latest, e) =>
        new Date(e.fecha).getTime() > new Date(latest.fecha).getTime() ? e : latest
      );
    },
    // Copia lo que hay en el móvil a la cuenta de Supabase. Devuelve cuántas entradas subió.
    async importLocalToRemote(): Promise<number> {
      if (!cloud || !isRemoteActive()) return 0;
      const entries = await local.getAll();
      await cloud.upsertMany(entries);
      readCache.invalidate(storageKey);
      return entries.length;
    },
  };
}

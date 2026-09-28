import AsyncStorage from '@react-native-async-storage/async-storage';
import { getCurrentUserId, isRemoteActive, supabase } from '@/lib/supabase';

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
  };
}

function remoteRepository<T extends BaseMetricEntry>(remote: RemoteTable<T>) {
  // Siempre filtrado por el propio usuario: con permisos de profesional, RLS
  // también deja leer filas compartidas por otros pacientes.
  const own = () => ({ user_id: getCurrentUserId()!, ...(remote.match ?? {}) });
  const fail = (error: { message: string } | null) => {
    if (error) throw new Error(error.message);
  };

  return {
    async getAll(): Promise<T[]> {
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
    // Sube entradas guardadas en el móvil (sin duplicar si ya estaban).
    async upsertMany(entries: T[]): Promise<void> {
      if (!entries.length) return;
      const rows = entries.map((e) => ({ ...remote.toRow(e), ...own() }));
      const { error } = await supabase!.from(remote.table).upsert(rows, { onConflict: 'user_id,id' });
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
  const backend = () => (cloud && isRemoteActive() ? cloud : local);

  return {
    getAll: (): Promise<T[]> => backend().getAll(),
    save: (entry: T): Promise<void> => backend().save(entry),
    update: (id: string, updated: Partial<T>): Promise<void> => backend().update(id, updated),
    remove: (id: string): Promise<void> => backend().remove(id),
    async getLatest(): Promise<T | null> {
      const entries = await backend().getAll();
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
      return entries.length;
    },
  };
}

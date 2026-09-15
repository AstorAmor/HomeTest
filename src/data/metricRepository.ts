import AsyncStorage from '@react-native-async-storage/async-storage';

export interface BaseMetricEntry {
  id: string;
  fecha: string;
  createdAt: string;
}

// Fábrica de repositorios simples clave-valor sobre AsyncStorage, reutilizada
// por glucosa, colesterol y cortisol (un valor numérico + fecha por entrada).
// Detrás de esta interfaz es donde se cambiaría la implementación si algún
// día se migra a Supabase; la UI no debería enterarse.
export function createMetricRepository<T extends BaseMetricEntry>(storageKey: string) {
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
    async getLatest(): Promise<T | null> {
      const entries = await this.getAll();
      if (!entries.length) return null;
      return entries.reduce((latest, e) =>
        new Date(e.fecha).getTime() > new Date(latest.fecha).getTime() ? e : latest
      );
    },
  };
}

import AsyncStorage from '@react-native-async-storage/async-storage';
import { GlucoseEntry } from '@/types/glucose';

const STORAGE_KEY = 'hometest:glucose_entries';

// Capa de acceso a datos aislada: hoy usa AsyncStorage (local, en el
// dispositivo), pero la UI solo conoce estas funciones. Migrar a Supabase
// más adelante es cambiar la implementación aquí dentro, no en las pantallas.

export async function saveGlucoseEntry(entry: GlucoseEntry): Promise<void> {
  const entries = await getGlucoseEntries();
  entries.unshift(entry);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

export async function getGlucoseEntries(): Promise<GlucoseEntry[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as GlucoseEntry[];
  } catch {
    return [];
  }
}

export async function deleteGlucoseEntry(id: string): Promise<void> {
  const entries = await getGlucoseEntries();
  const filtered = entries.filter((e) => e.id !== id);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
}

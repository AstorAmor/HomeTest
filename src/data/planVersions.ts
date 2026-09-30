import AsyncStorage from '@react-native-async-storage/async-storage';
import { getCurrentUserId, isRemoteActive, supabase } from '@/lib/supabase';

// Versiones del plan de acción del usuario (tabla `action_plans`). Cada actualización
// crea una versión nueva; la más reciente es el plan vigente.

export type PlanItemStatus = 'reached' | 'on_track' | 'needs_attention' | 'not_retested' | 'new';

export interface PlanVersionItem {
  title: string;
  why: string;
  markers: string[];
  status: PlanItemStatus;
  note?: string; // por qué tiene ese estado (p. ej. "LDL 132 → 118 mg/dL")
}

export interface PlanVersion {
  id: string;
  source: 'report' | 'upload' | 'professional';
  basedOn: string | null;
  items: PlanVersionItem[];
  note: string | null;
  createdAt: string;
  professionalName?: string | null;
}

const KEY = 'planVersions.v1';

async function localAll(): Promise<PlanVersion[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export const planVersionRepository = {
  async getAll(): Promise<PlanVersion[]> {
    if (isRemoteActive() && supabase) {
      const { data, error } = await supabase
        .from('action_plans')
        .select('id, source, based_on, items, note, created_at')
        .eq('patient_id', getCurrentUserId())
        .order('created_at', { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []).map((r) => ({
        id: r.id,
        source: r.source,
        basedOn: r.based_on,
        items: r.items,
        note: r.note,
        createdAt: r.created_at,
      }));
    }
    return (await localAll()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async latest(): Promise<PlanVersion | null> {
    return (await this.getAll())[0] ?? null;
  },

  async save(v: Omit<PlanVersion, 'id' | 'createdAt'>): Promise<PlanVersion> {
    if (isRemoteActive() && supabase) {
      const { data, error } = await supabase
        .from('action_plans')
        .insert({ patient_id: getCurrentUserId(), source: v.source, based_on: v.basedOn, items: v.items, note: v.note })
        .select('id, created_at')
        .single();
      if (error || !data) throw new Error(error?.message ?? 'Could not save plan');
      return { ...v, id: data.id, createdAt: data.created_at };
    }
    const saved: PlanVersion = { ...v, id: `plan-${Date.now()}`, createdAt: new Date().toISOString() };
    await AsyncStorage.setItem(KEY, JSON.stringify([saved, ...(await localAll())]));
    return saved;
  },
};

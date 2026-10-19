import AsyncStorage from '@react-native-async-storage/async-storage';
import { getCurrentUserId, isRemoteActive, supabase } from '@/lib/supabase';
import { DEFAULT_DIET_PREFS } from '@/logic/dietPlanner';
import type { DietPlan } from './types';

// Menús semanales del usuario: los que se hace con el cuestionario y los que le manda su dietista.
//
// Dónde viven: con cuenta, tabla `diet_plans` (migración 20261019130000_diet_plans.sql, aplicada el
// 2026-10-19); sin cuenta (demo), en este dispositivo. Lo que se guardó en el móvil antes de tener la
// tabla se sube la primera vez.
export const REMOTE_HAS_DIET_PLANS = true;

const KEY = 'diet.plans.v1';
const remote = () => REMOTE_HAS_DIET_PLANS && isRemoteActive();

async function readLocal(): Promise<DietPlan[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as DietPlan[]) : [];
  } catch {
    return [];
  }
}
const writeLocal = (list: DietPlan[]) => AsyncStorage.setItem(KEY, JSON.stringify(list)).catch(() => undefined);

type Row = {
  id: string;
  patient_id: string;
  professional_id: string | null;
  professional_name: string | null;
  title: string;
  prefs: DietPlan['prefs'];
  targets: DietPlan['targets'];
  reasons: DietPlan['reasons'];
  days: DietPlan['days'];
  note: string;
  active: boolean;
  created_at: string;
};

export const dietFromRow = (r: Row): DietPlan => ({
  id: r.id,
  title: r.title,
  createdAt: r.created_at,
  source: r.professional_id ? 'professional' : 'self',
  professionalId: r.professional_id,
  professionalName: r.professional_name,
  patientId: r.patient_id,
  prefs: { ...DEFAULT_DIET_PREFS, ...(r.prefs ?? {}) },
  targets: r.targets,
  reasons: r.reasons ?? [],
  days: r.days ?? [],
  note: r.note || undefined,
  active: r.active,
});

export const dietToRow = (p: DietPlan) => ({
  id: p.id,
  title: p.title.slice(0, 120) || 'Menu',
  prefs: p.prefs,
  targets: p.targets,
  reasons: p.reasons,
  days: p.days,
  note: p.note ?? '',
  active: p.active,
});

// Sube una vez lo que se guardó en el móvil antes de tener la tabla
async function uploadLocalOnce(): Promise<void> {
  const local = (await readLocal()).filter((p) => p.source === 'self');
  if (!local.length) return;
  const { error } = await supabase!.from('diet_plans').upsert(
    local.map((p) => ({ ...dietToRow(p), patient_id: getCurrentUserId() })),
    { onConflict: 'patient_id,id' },
  );
  if (!error) await writeLocal((await readLocal()).filter((p) => p.source !== 'self'));
}

export const dietRepository = {
  async list(): Promise<DietPlan[]> {
    let list: DietPlan[];
    if (remote()) {
      await uploadLocalOnce();
      const { data, error } = await supabase!.from('diet_plans').select('*').eq('patient_id', getCurrentUserId()).order('created_at', { ascending: false });
      list = error ? await readLocal() : (data as Row[]).map(dietFromRow);
    } else list = await readLocal();
    return list.sort((a, b) => Number(b.active) - Number(a.active) || b.createdAt.localeCompare(a.createdAt));
  },

  async active(): Promise<DietPlan | null> {
    return (await this.list()).find((p) => p.active) ?? null;
  },

  async get(id: string): Promise<DietPlan | null> {
    return (await this.list()).find((p) => p.id === id) ?? null;
  },

  // Solo puede haber uno activo
  async save(plan: DietPlan): Promise<void> {
    if (remote()) {
      const { error } = await supabase!.from('diet_plans').upsert({ ...dietToRow(plan), patient_id: getCurrentUserId() }, { onConflict: 'patient_id,id' });
      if (error) throw new Error(error.message);
      if (plan.active) await supabase!.from('diet_plans').update({ active: false }).eq('patient_id', getCurrentUserId()).neq('id', plan.id).eq('active', true);
      return;
    }
    const list = await readLocal();
    await writeLocal([plan, ...list.filter((p) => p.id !== plan.id).map((p) => (plan.active ? { ...p, active: false } : p))]);
  },

  async remove(id: string): Promise<void> {
    if (remote()) {
      const { error } = await supabase!.from('diet_plans').delete().eq('patient_id', getCurrentUserId()).eq('id', id);
      if (error) throw new Error(error.message);
      return;
    }
    await writeLocal((await readLocal()).filter((p) => p.id !== id));
  },
};

// Lista de la compra marcada (en el móvil, por menú)
const shopKey = (planId: string) => `diet.shopping.${planId}`;
export const shoppingChecks = {
  async get(planId: string): Promise<string[]> {
    try {
      return JSON.parse((await AsyncStorage.getItem(shopKey(planId))) ?? '[]');
    } catch {
      return [];
    }
  },
  set: (planId: string, ids: string[]) => AsyncStorage.setItem(shopKey(planId), JSON.stringify(ids)).catch(() => undefined),
};

import { useCallback, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getCurrentUserId, isRemoteActive, supabase } from '@/lib/supabase';
import { useReloadOnFocus } from '@/hooks/useReloadOnFocus';
import { getLang, t } from '@/i18n';

// Qué incluye cada nivel (gratis, Basic, Premium) y quién tiene acceso a qué.
// - Las filas de "Comparar suscripciones" las edita un admin desde la app (Más → Suscripciones
//   (admin)) y se guardan en app_config 'plan_features'. Sin nada guardado, valen las de aquí.
// - Algunas filas además las aplica la app (`gate`): 'scan_reports' (escanear informes) y 'diet_menu' (menú semanal).
// - Nivel efectivo (my_access() en Supabase): admin > suscripción pagada > acceso por invitación
//   (código o dado por el admin) > gratis. Migración 20261017100000_plan_access.sql.
// Mientras esa migración no esté aplicada, la app no bloquea nada (como antes).

export type Tier = 'free' | 'membership' | 'premium';
export const TIERS: Tier[] = ['free', 'membership', 'premium'];

export type LocalText = { en: string; es: string };
// true/false = incluido o no; texto = incluido, con detalle ("2 al año")
export type FeatureValue = boolean | LocalText;

export interface PlanFeatureRow {
  id: string;
  label: LocalText;
  values: Record<Tier, FeatureValue>;
}

// Funciones que la app bloquea según el nivel (el resto de filas solo se enseñan)
export const GATED_FEATURES: Record<string, LocalText> = {
  scan_reports: { en: 'Scan your lab reports', es: 'Escanear tus informes' },
  diet_menu: { en: 'Personalised weekly menu', es: 'Menú semanal personalizado' },
};

export const DEFAULT_PLAN_FEATURES: PlanFeatureRow[] = [
  {
    id: 'tracking',
    label: { en: 'Daily tracking: check-ins, wearables, medication…', es: 'Seguimiento diario: check-in, wearables, medicación…' },
    values: { free: true, membership: true, premium: true },
  },
  {
    id: 'plan',
    label: { en: 'Personalised plan, trends and reminders', es: 'Plan personalizado, tendencias y recordatorios' },
    values: { free: true, membership: true, premium: true },
  },
  {
    id: 'scan_reports',
    label: { en: 'Scan your lab reports and see them explained', es: 'Escanea tus informes de análisis y entiéndelos' },
    values: { free: false, membership: true, premium: true },
  },
  {
    id: 'diet_menu',
    label: { en: 'Personalised weekly menu with recipes and shopping list', es: 'Menú semanal personalizado, con recetas y lista de la compra' },
    values: { free: false, membership: true, premium: true },
  },
  {
    id: 'blood_tests',
    label: { en: 'Blood tests included a year', es: 'Analíticas incluidas al año' },
    values: {
      free: false,
      membership: { en: '2 (full panel + follow-up at 6 months)', es: '2 (panel completo + seguimiento a los 6 meses)' },
      premium: { en: '4 (full panel + a follow-up every 3 months)', es: '4 (panel completo + un seguimiento cada 3 meses)' },
    },
  },
  {
    id: 'more_panels',
    label: { en: 'More panels and tests', es: 'Más paneles y pruebas' },
    values: { free: false, membership: false, premium: true },
  },
];

const CONFIG_KEY = 'plan_features';
// Último nivel conocido de cada cuenta (para cuando no hay conexión)
const accessCache = () => `access.v1:${getCurrentUserId() ?? ''}`;

export const localText = (x: LocalText) => (getLang() === 'es' ? x.es || x.en : x.en || x.es);
export const tierName = (tier: Tier) => (tier === 'free' ? t('Free') : tier === 'premium' ? 'Premium' : 'Basic');

// Sin la migración aplicada: función o tabla que no existe todavía
const missing = (error: { code?: string } | null) =>
  !!error && ['PGRST202', 'PGRST205', '42883', '42P01'].includes(error.code ?? '');

const fail = (error: { message: string } | null) => {
  if (error) throw new Error(error.message);
};

export async function loadPlanFeatures(): Promise<{ rows: PlanFeatureRow[]; saved: boolean; available: boolean }> {
  if (!isRemoteActive() || !supabase) return { rows: DEFAULT_PLAN_FEATURES, saved: false, available: false };
  const { data, error } = await supabase.from('app_config').select('value').eq('key', CONFIG_KEY).maybeSingle();
  if (error) return { rows: DEFAULT_PLAN_FEATURES, saved: false, available: !missing(error) };
  const rows = (data?.value as { rows?: PlanFeatureRow[] } | null)?.rows;
  return Array.isArray(rows) && rows.length ? { rows, saved: true, available: true } : { rows: DEFAULT_PLAN_FEATURES, saved: false, available: true };
}

export async function savePlanFeatures(rows: PlanFeatureRow[]): Promise<void> {
  const { error } = await supabase!
    .from('app_config')
    .upsert({ key: CONFIG_KEY, value: { rows }, updated_at: new Date().toISOString(), updated_by: getCurrentUserId() });
  fail(error);
}

// ---------------------------------------------------------------------------
// Nivel de quien usa la app
// ---------------------------------------------------------------------------

export interface Access {
  tier: Tier;
  // legacy = la migración aún no está en Supabase (no se bloquea nada); demo = sin cuenta
  source: 'admin' | 'subscription' | 'code' | 'admin_grant' | 'none' | 'demo' | 'legacy';
  expiresAt: string | null;
}

export async function getMyAccess(): Promise<Access> {
  if (!isRemoteActive() || !supabase) return { tier: 'premium', source: 'demo', expiresAt: null };
  const { data, error } = await supabase.rpc('my_access');
  if (missing(error)) return { tier: 'premium', source: 'legacy', expiresAt: null };
  if (error || !data?.[0]) {
    // Sin conexión: lo último que se supo
    const cached = await AsyncStorage.getItem(accessCache()).catch(() => null);
    return cached ? (JSON.parse(cached) as Access) : { tier: 'free', source: 'none', expiresAt: null };
  }
  const row = data[0] as { tier: Tier; source: string; expires_at: string | null };
  // source: 'admin' (administrador), 'subscription', 'code:<CÓDIGO>', 'admin_grant' o 'none'
  const access: Access = {
    tier: row.tier,
    source: row.source.startsWith('code:') ? 'code' : (row.source as Access['source']),
    expiresAt: row.expires_at,
  };
  AsyncStorage.setItem(accessCache(), JSON.stringify(access)).catch(() => undefined);
  return access;
}

export function featureValue(rows: PlanFeatureRow[], feature: string, tier: Tier): FeatureValue {
  const row = rows.find((r) => r.id === feature);
  return row ? row.values[tier] : tier !== 'free';
}

export const isIncluded = (v: FeatureValue) => v === true || typeof v === 'object';

export async function canUse(feature: string): Promise<boolean> {
  const access = await getMyAccess();
  if (access.source === 'demo' || access.source === 'legacy' || access.source === 'admin') return true;
  const { rows } = await loadPlanFeatures();
  return isIncluded(featureValue(rows, feature, access.tier));
}

// Para pantallas: null mientras carga
export function useFeature(feature: string) {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  useReloadOnFocus(
    useCallback(async () => {
      setAllowed(await canUse(feature).catch(() => true));
    }, [feature]),
  );
  return allowed;
}

// ---------------------------------------------------------------------------
// Códigos de invitación
// ---------------------------------------------------------------------------

export async function redeemAccessCode(code: string): Promise<{ tier: Tier; expiresAt: string | null }> {
  if (!isRemoteActive() || !supabase) throw new Error(t('Sign in to use a code.'));
  const { data, error } = await supabase.rpc('redeem_access_code', { p_code: code });
  if (error) {
    if (missing(error)) throw new Error(t('Codes are not available yet.'));
    if (error.message.includes('invalid_code')) throw new Error(t('That code is not valid or has expired.'));
    if (error.message.includes('code_used_up')) throw new Error(t('That code has already been used up.'));
    throw new Error(error.message);
  }
  const row = (data as { tier: Tier; expires_at: string | null }[])[0];
  await AsyncStorage.removeItem(accessCache()).catch(() => undefined);
  return { tier: row.tier, expiresAt: row.expires_at };
}

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

export interface AccessCode {
  code: string;
  tier: Exclude<Tier, 'free'>;
  days: number | null;
  maxUses: number | null;
  uses: number;
  expiresAt: string | null;
  active: boolean;
  note: string | null;
  createdAt: string;
}

export interface AccessGrant {
  id: string;
  email: string;
  tier: Exclude<Tier, 'free'>;
  source: string;
  note: string | null;
  expiresAt: string | null;
  createdAt: string;
}

// Código fácil de dictar: sin 0/O ni 1/I
export function randomCode(prefix = 'KUOVA') {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 6; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return `${prefix}-${out}`;
}

export async function adminListCodes(): Promise<AccessCode[]> {
  const { data, error } = await supabase!.from('access_codes').select('*').order('created_at', { ascending: false });
  fail(error);
  return (data ?? []).map((r: any) => ({
    code: r.code,
    tier: r.tier,
    days: r.days,
    maxUses: r.max_uses,
    uses: r.uses,
    expiresAt: r.expires_at,
    active: r.active,
    note: r.note,
    createdAt: r.created_at,
  }));
}

export async function adminCreateCode(c: { code: string; tier: Exclude<Tier, 'free'>; days: number | null; maxUses: number | null; note?: string }) {
  const { error } = await supabase!.from('access_codes').insert({
    code: c.code.trim().toUpperCase(),
    tier: c.tier,
    days: c.days,
    max_uses: c.maxUses,
    note: c.note?.trim() || null,
  });
  fail(error);
}

export async function adminSetCodeActive(code: string, active: boolean) {
  const { error } = await supabase!.from('access_codes').update({ active }).eq('code', code);
  fail(error);
}

export async function adminListGrants(): Promise<AccessGrant[]> {
  const { data, error } = await supabase!.rpc('admin_list_access_grants');
  fail(error);
  return (data ?? []).map((r: any) => ({
    id: r.id,
    email: r.email,
    tier: r.tier,
    source: r.source,
    note: r.note,
    expiresAt: r.expires_at,
    createdAt: r.created_at,
  }));
}

export async function adminGrantAccess(email: string, tier: Exclude<Tier, 'free'>, days: number | null, note?: string) {
  const { error } = await supabase!.rpc('admin_grant_access', { p_email: email, p_tier: tier, p_days: days, p_note: note ?? null });
  if (error?.message.includes('no_account')) throw new Error(t('There is no Kuova account with that email.'));
  fail(error);
}

export async function adminRevokeGrant(id: string) {
  const { error } = await supabase!.from('access_grants').delete().eq('id', id);
  fail(error);
}

// Doble factor con app de autenticación (TOTP) en Supabase: alta, código al entrar, quitarlo y el
// arreglo de un admin cuando alguien pierde el móvil. Qué pantalla toca: logic/mfa.ts.
import { isSupabaseConfigured, supabase, supabasePublishableKey, supabaseUrl } from '@/lib/supabase';
import { type MfaGate, cleanTotpCode, mfaGate } from '@/logic/mfa';

export interface TotpFactor {
  id: string;
  name: string;
  createdAt: string;
}

export interface TotpEnrollment {
  factorId: string;
  qrCode: string; // data:image/svg+xml…
  secret: string;
  uri: string; // otpauth://… (abre la app de autenticación en el mismo móvil)
}

const ISSUER = 'Kuova Health';

const fail = (error: { message: string } | null) => {
  if (error) throw new Error(error.message);
};

// ¿Esta cuenta tiene que usar doble factor? (admins, profesionales y soporte). Si la base aún no tiene la
// función (migración sin aplicar), no se obliga: la app vieja y la nueva conviven sin dejar a nadie fuera.
export async function isMfaRequired(): Promise<boolean> {
  if (!supabase) return false;
  const { data, error } = await supabase.rpc('mfa_required');
  if (error) return false;
  return data === true;
}

export async function currentMfaGate(): Promise<MfaGate> {
  if (!supabase) return null;
  const [{ data: aal }, required] = await Promise.all([supabase.auth.mfa.getAuthenticatorAssuranceLevel(), isMfaRequired()]);
  return mfaGate({ required, currentLevel: aal?.currentLevel ?? null, nextLevel: aal?.nextLevel ?? null });
}

export async function listTotpFactors(): Promise<TotpFactor[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.auth.mfa.listFactors();
  fail(error);
  return (data?.totp ?? [])
    .filter((f) => f.status === 'verified')
    .map((f) => ({ id: f.id, name: f.friendly_name ?? '', createdAt: f.created_at }));
}

// Alta de una app de autenticación. Antes se quitan las altas a medias (sin verificar): si no, Supabase
// se queja de que ya existe un factor con ese nombre.
export async function startTotpEnrollment(label?: string): Promise<TotpEnrollment> {
  if (!supabase) throw new Error('Sin conexión con la cuenta');
  const { data: list } = await supabase.auth.mfa.listFactors();
  for (const f of list?.all ?? []) {
    if (f.factor_type === 'totp' && f.status !== 'verified') await supabase.auth.mfa.unenroll({ factorId: f.id });
  }
  const friendlyName = `${label ?? 'App de autenticación'} · ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`;
  const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName, issuer: ISSUER });
  fail(error);
  return { factorId: data!.id, qrCode: data!.totp.qr_code, secret: data!.totp.secret, uri: data!.totp.uri };
}

// Comprueba el código: con el alta recién hecha la deja verificada; en ambos casos la sesión pasa a aal2
export async function verifyTotp(factorId: string, code: string): Promise<void> {
  if (!supabase) throw new Error('Sin conexión con la cuenta');
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: cleanTotpCode(code) });
  fail(error);
}

// Al entrar: el primer factor verificado (si tiene dos, cualquiera de las dos apps da un código válido
// para el suyo; se prueba con todos)
export async function verifyLoginCode(code: string): Promise<void> {
  const factors = await listTotpFactors();
  if (!factors.length) throw new Error('No tienes ninguna app de autenticación dada de alta.');
  let last: unknown = null;
  for (const f of factors) {
    try {
      await verifyTotp(f.id, code);
      return;
    } catch (e) {
      last = e;
    }
  }
  throw last instanceof Error ? last : new Error('Código no válido');
}

export async function removeTotpFactor(factorId: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.auth.mfa.unenroll({ factorId });
  fail(error);
  // El token aún dice aal2 hasta que se renueva: se renueva ya para que la app y la base lo vean igual
  await supabase.auth.refreshSession().catch(() => undefined);
}

// Admin (con su doble factor): quita el doble factor de una cuenta que ha perdido el móvil. Queda
// registrado en mfa_resets con el motivo (Edge Function admin-mfa-reset).
export async function adminResetMfa(userId: string, reason: string): Promise<number> {
  if (!supabase || !isSupabaseConfigured) throw new Error('Sin conexión con la cuenta');
  const { data: session } = await supabase.auth.getSession();
  const res = await fetch(`${supabaseUrl}/functions/v1/admin-mfa-reset`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: supabasePublishableKey,
      Authorization: `Bearer ${session.session?.access_token ?? ''}`,
    },
    body: JSON.stringify({ userId, reason }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error ?? `Error ${res.status}`);
  return Number(body?.removed ?? 0);
}

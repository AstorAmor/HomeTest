// Quitar el doble factor de una cuenta que ha perdido el móvil (2026-11-09).
// Solo un admin con su propio segundo factor (is_admin() exige aal2) y con un motivo. Antes, soporte
// comprueba la identidad de quien lo pide (ver docs/doble-factor.md). Cada vez queda en public.mfa_resets
// (solo añadir). Después, la persona entra con su contraseña y la app le pide dar de alta la app de
// autenticación otra vez.
//
// Al admin (Astor) no le hace falta: si pierde su móvil, lo quita desde el panel de Supabase
// (Authentication → Users → la cuenta → Multi-factor), que tiene su propio doble factor.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { json, serve } from '../_shared/http.ts';
import { adminClient } from '../_shared/payments.ts';

function publishableKey(): string {
  const legacy = Deno.env.get('SUPABASE_ANON_KEY');
  if (legacy) return legacy;
  try {
    const keys = JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS') ?? '{}');
    return (Object.values(keys)[0] as string) ?? '';
  } catch {
    return '';
  }
}

serve(async (body, adminId, req) => {
  // ¿Quien llama es admin con aal2? Se pregunta a la base con su propia sesión
  const asCaller = createClient(Deno.env.get('SUPABASE_URL') ?? '', publishableKey(), {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });
  const { data: isAdmin, error: adminError } = await asCaller.rpc('is_admin');
  if (adminError || isAdmin !== true) {
    return json({ error: 'Solo un admin con el doble factor activo puede hacerlo.' }, 403);
  }

  const userId = String(body?.userId ?? '');
  const reason = String(body?.reason ?? '').trim();
  if (!/^[0-9a-f-]{36}$/i.test(userId)) return json({ error: 'Cuenta no válida.' }, 400);
  if (reason.length < 10) return json({ error: 'Escribe el motivo (al menos 10 caracteres).' }, 400);

  const db = adminClient();
  const { data: target, error: userError } = await db.auth.admin.getUserById(userId);
  if (userError || !target.user) return json({ error: 'No existe esa cuenta.' }, 404);

  const { data: factors, error: listError } = await db.auth.admin.mfa.listFactors({ userId });
  if (listError) return json({ error: listError.message }, 500);

  let removed = 0;
  for (const f of factors?.factors ?? []) {
    const { error } = await db.auth.admin.mfa.deleteFactor({ id: f.id, userId });
    if (error) return json({ error: error.message, removed }, 500);
    removed++;
  }

  const { error: logError } = await db.from('mfa_resets').insert({
    admin_id: adminId,
    target_id: userId,
    target_email: target.user.email ?? null,
    reason,
    factors_removed: removed,
  });
  if (logError) return json({ error: `Quitado, pero no se pudo registrar: ${logError.message}`, removed }, 500);
  return json({ removed });
});

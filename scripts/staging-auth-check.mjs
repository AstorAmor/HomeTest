// Prueba de punta a punta de cuentas y doble factor contra la base de PRUEBAS («Kuova pruebas»), con
// sesiones reales de Supabase Auth (los tests de supabase/tests/database simulan el `aal`; esto no).
//
//   node scripts/staging-auth-check.mjs
//
// Crea cuentas inventadas (@example.com, contraseñas al azar que no se guardan), comprueba y las borra al
// final. Las claves se piden a Supabase en el momento (CLI con sesión iniciada) y no se escriben en ningún
// sitio. Se niega a correr contra otra base que no sea la de pruebas.
import { createHmac, randomBytes } from 'node:crypto';
import { execSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
import { PROD_REF, STAGING_REF } from './supabase-target.mjs';

if (STAGING_REF === PROD_REF) throw new Error('STAGING_REF apunta a producción');
const URL = `https://${STAGING_REF}.supabase.co`;

// --reveal: sin él, la clave secreta llega enmascarada
const raw = execSync(`npx supabase projects api-keys --project-ref ${STAGING_REF} --reveal -o json`, {
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'ignore'],
});
const keys = JSON.parse(raw.slice(raw.indexOf('[')));
const PUBLISHABLE = keys.find((k) => k.type === 'publishable')?.api_key;
const SECRET = keys.find((k) => k.type === 'secret')?.api_key;
if (!PUBLISHABLE || !SECRET) throw new Error('No se han podido leer las claves de la base de pruebas');

const opts = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
const admin = createClient(URL, SECRET, opts);
const client = () => createClient(URL, PUBLISHABLE, opts);

let failed = 0;
const check = (ok, label, extra = '') => {
  if (!ok) failed++;
  console.log(`${ok ? 'ok    ' : 'FALLA '} ${label}${extra ? ` (${extra})` : ''}`);
};

// TOTP (RFC 6238) para hacer de «app de autenticación»
function totp(secretB32, at = Date.now()) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const ch of secretB32.replace(/=+$/, '').toUpperCase()) bits += alphabet.indexOf(ch).toString(2).padStart(5, '0');
  const key = Buffer.from(bits.match(/.{8}/g).map((b) => parseInt(b, 2)));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(at / 1000 / 30)));
  const h = createHmac('sha1', key).update(counter).digest();
  const o = h[h.length - 1] & 0xf;
  const n = ((h[o] & 0x7f) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(n % 1_000_000).padStart(6, '0');
}

const tag = randomBytes(3).toString('hex');
const password = () => `${randomBytes(9).toString('base64url')}a1`;
const created = [];
async function makeUser(name, confirmed = true) {
  const email = `e2e.${name}.${tag}@example.com`;
  const pw = password();
  const { data, error } = await admin.auth.admin.createUser({ email, password: pw, email_confirm: confirmed });
  if (error) throw new Error(`crear ${name}: ${error.message}`);
  created.push(data.user.id);
  return { id: data.user.id, email, pw };
}
async function signIn(u) {
  const c = client();
  const { error } = await c.auth.signInWithPassword({ email: u.email, password: u.pw });
  if (error) throw new Error(`entrar ${u.email}: ${error.message}`);
  return c;
}
async function enrollTotp(c) {
  const { data, error } = await c.auth.mfa.enroll({ factorType: 'totp', friendlyName: `e2e ${tag}`, issuer: 'Kuova Health' });
  if (error) throw new Error(`alta TOTP: ${error.message}`);
  const v = await c.auth.mfa.challengeAndVerify({ factorId: data.id, code: totp(data.totp.secret) });
  if (v.error) throw new Error(`verificar TOTP: ${v.error.message}`);
  return { factorId: data.id, secret: data.totp.secret };
}
const aal = async (c) => (await c.auth.mfa.getAuthenticatorAssuranceLevel()).data;

try {
  // 1. Contraseñas
  {
    const c = client();
    for (const [pw, why] of [['abcdefg', 'corta y sin números'], ['abcdefgh', 'sin números'], ['abc1234', '7 caracteres']]) {
      const { error } = await c.auth.signUp({ email: `e2e.debil.${tag}@example.com`, password: pw });
      check(error?.code === 'weak_password', `contraseña rechazada: ${why}`, error?.code ?? 'sin error');
    }
  }

  // 2. Cuenta sin confirmar el email: no entra
  {
    const u = await makeUser('sinconfirmar', false);
    const { error } = await client().auth.signInWithPassword({ email: u.email, password: u.pw });
    check(error?.code === 'email_not_confirmed', 'sin confirmar el email no se puede entrar', error?.code ?? 'entró');
  }

  // 3. Paciente que comparte su glucosa con una profesional verificada; y un admin
  const patient = await makeUser('paciente');
  const doctor = await makeUser('medica');
  const boss = await makeUser('admin');
  await admin.from('professionals').insert({ id: doctor.id, display_name: 'Dra. E2E', role: 'doctor', verified_at: new Date().toISOString() }).throwOnError();
  await admin.from('admins').insert({ user_id: boss.id }).throwOnError();
  {
    const p = await signIn(patient);
    check((await aal(p)).currentLevel === 'aal1', 'el paciente entra con solo la contraseña');
    check((await p.rpc('mfa_required')).data === false, 'al paciente no se le exige doble factor');
    await p.from('glucose_readings').insert({ id: `e2e-${tag}`, value: 92, unit: 'mg/dL', measured_at: new Date().toISOString() }).throwOnError();
    await p.from('data_shares').insert({ professional_id: doctor.id, scopes: ['glucose'] }).throwOnError();
    const { count } = await p.from('glucose_readings').select('*', { count: 'exact', head: true });
    check(count === 1, 'el paciente ve lo suyo', `ve ${count}`);
  }

  // 4. Profesional: sin el código no ve nada; con el código, lo compartido
  let doctorFactor;
  {
    const d = await signIn(doctor);
    check((await d.rpc('mfa_required')).data === true, 'a la profesional se le exige doble factor');
    const before = await d.from('glucose_readings').select('*', { count: 'exact', head: true });
    check(before.count === 0, 'profesional con solo la contraseña: no ve la glucosa compartida', `ve ${before.count}`);
    const shares = await d.from('data_shares').select('*', { count: 'exact', head: true });
    check(shares.count === 0, 'profesional con solo la contraseña: no ve ni los permisos', `ve ${shares.count}`);
    doctorFactor = await enrollTotp(d);
    check((await aal(d)).currentLevel === 'aal2', 'tras el código la sesión es aal2');
    const after = await d.from('glucose_readings').select('*', { count: 'exact', head: true });
    check(after.count === 1, 'profesional con el código: ve la glucosa compartida', `ve ${after.count}`);
  }
  {
    // Entrar otra vez: la contraseña sola deja la sesión en aal1 y la app debe pedir el código
    const d = await signIn(doctor);
    const lv = await aal(d);
    check(lv.currentLevel === 'aal1' && lv.nextLevel === 'aal2', 'al volver a entrar pide el código', JSON.stringify(lv));
    const { count } = await d.from('glucose_readings').select('*', { count: 'exact', head: true });
    check(count === 0, 'y hasta escribirlo no ve nada', `ve ${count}`);
    const bad = await d.auth.mfa.challengeAndVerify({ factorId: doctorFactor.factorId, code: '000000' });
    check(!!bad.error, 'un código equivocado no vale');
    const good = await d.auth.mfa.challengeAndVerify({ factorId: doctorFactor.factorId, code: totp(doctorFactor.secret) });
    check(!good.error && (await aal(d)).currentLevel === 'aal2', 'el código bueno sí');
  }

  // 5. Admin: is_admin() solo con aal2; y quita el doble factor de quien pierde el móvil
  {
    const a = await signIn(boss);
    check((await a.rpc('is_admin')).data === false, 'admin con solo la contraseña: is_admin() es falso');
    const early = await fetch(`${URL}/functions/v1/admin-mfa-reset`, {
      method: 'POST',
      headers: { apikey: PUBLISHABLE, Authorization: `Bearer ${(await a.auth.getSession()).data.session.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: doctor.id, reason: 'Prueba automática: no debería dejar' }),
    });
    check(early.status === 403, 'sin el código, el admin no puede quitar el doble factor a nadie', `HTTP ${early.status}`);
    await enrollTotp(a);
    check((await a.rpc('is_admin')).data === true, 'admin con el código: is_admin() es verdadero');
    const res = await fetch(`${URL}/functions/v1/admin-mfa-reset`, {
      method: 'POST',
      headers: { apikey: PUBLISHABLE, Authorization: `Bearer ${(await a.auth.getSession()).data.session.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: doctor.id, reason: 'Prueba automática: móvil perdido (e2e)' }),
    });
    const body = await res.json().catch(() => ({}));
    check(res.ok && body.removed === 1, 'el admin quita el doble factor de la profesional', `HTTP ${res.status} ${JSON.stringify(body)}`);
    const log = await a.from('mfa_resets').select('*', { count: 'exact', head: true }).eq('target_id', doctor.id);
    check(log.count === 1, 'queda en el registro mfa_resets', `filas ${log.count}`);
  }
  {
    const d = await signIn(doctor);
    const lv = await aal(d);
    check(lv.nextLevel === 'aal1' && (await d.rpc('mfa_required')).data === true, 'tras quitarlo, al entrar le toca dar de alta una app nueva', JSON.stringify(lv));
    const { count } = await d.from('glucose_readings').select('*', { count: 'exact', head: true });
    check(count === 0, 'y mientras tanto no ve nada', `ve ${count}`);
  }
} catch (e) {
  failed++;
  console.log('FALLA ', e.message);
} finally {
  for (const id of created) {
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) console.log(`(no se ha podido borrar la cuenta de prueba ${id}: ${error.message})`);
  }
  await admin.from('professionals').delete().in('id', created);
}

console.log(failed ? `\n${failed} comprobaciones fallan` : '\nTodo bien');
process.exit(failed ? 1 : 0);

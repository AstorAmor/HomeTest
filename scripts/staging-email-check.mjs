// Prueba el correo de verdad en la base de PRUEBAS: se da de alta como lo hace la app (signUp con
// «Confirm email» activado), así Supabase envía «Confirma tu cuenta de Kuova» por el SMTP de Brevo. Si el
// SMTP falla, Supabase devuelve el error al momento. Después borra la cuenta (el correo ya ha salido).
// Uso: node scripts/staging-email-check.mjs <email>   (un buzón que puedas mirar; nunca de un usuario real)
import { execSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { STAGING_REF } from './supabase-target.mjs';

const email = process.argv[2];
if (!email || !email.includes('@')) {
  console.error('Uso: node scripts/staging-email-check.mjs <email>');
  process.exit(2);
}

const URL = `https://${STAGING_REF}.supabase.co`;
const raw = execSync(`npx supabase projects api-keys --project-ref ${STAGING_REF} --reveal -o json`, {
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'ignore'],
});
const keys = JSON.parse(raw.slice(raw.indexOf('[')));
const PUBLISHABLE = keys.find((k) => k.type === 'publishable')?.api_key;
const SECRET = keys.find((k) => k.type === 'secret')?.api_key;
if (!PUBLISHABLE || !SECRET) throw new Error('No encuentro las claves de la base de pruebas');

const opts = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
const admin = createClient(URL, SECRET, opts);
const c = createClient(URL, PUBLISHABLE, opts);

const started = Date.now();
const { data, error } = await c.auth.signUp({
  email,
  password: `${randomBytes(9).toString('base64url')}a1`,
  options: { data: { display_name: 'Prueba de correo' } },
});
const ms = Date.now() - started;
if (error) {
  console.log(`Correo: FALLA en ${ms} ms (${error.status ?? ''} ${error.message})`);
  process.exitCode = 1;
} else {
  console.log(`Correo: enviado por Supabase en ${ms} ms (sin sesión hasta confirmar: ${data.session === null})`);
}
if (data?.user?.id) {
  await admin.auth.admin.deleteUser(data.user.id);
  console.log('Cuenta de prueba borrada.');
}

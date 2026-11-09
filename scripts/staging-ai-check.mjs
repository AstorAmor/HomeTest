// Comprueba que la IA (Gemini) responde en la base de PRUEBAS: crea un usuario inventado, entra, llama a
// la función extract-ai-log con un texto corto y borra el usuario. No imprime claves ni la respuesta entera.
// Uso: node scripts/staging-ai-check.mjs
import { execSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { STAGING_REF } from './supabase-target.mjs';

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
const email = `e2e.ia.${randomBytes(3).toString('hex')}@example.com`;
const password = `${randomBytes(9).toString('base64url')}a1`;

const { data: made, error: makeErr } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
if (makeErr) throw makeErr;
try {
  const c = createClient(URL, PUBLISHABLE, opts);
  const { error: signErr } = await c.auth.signInWithPassword({ email, password });
  if (signErr) throw signErr;
  const { data, error } = await c.functions.invoke('extract-ai-log', {
    body: { quadrant: 'calm', intensity: 3, text: 'Día tranquilo, he dormido bien y he paseado un rato.' },
  });
  if (error) {
    const detail = await error.context?.text?.().catch(() => '');
    console.log(`IA en pruebas: FALLA (${error.message}) ${String(detail).slice(0, 200)}`);
    process.exitCode = 1;
  } else {
    const fields = data && typeof data === 'object' ? Object.keys(data).join(', ') : typeof data;
    console.log(`IA en pruebas: OK (respuesta con: ${fields})`);
  }
} finally {
  await admin.auth.admin.deleteUser(made.user.id);
}

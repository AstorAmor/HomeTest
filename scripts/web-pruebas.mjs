// La web de la app en este ordenador contra la base de PRUEBAS («Kuova pruebas»), para probar cambios
// de base de datos o de Auth sin tocar producción:  node scripts/web-pruebas.mjs [puerto]
// (en Claude Code: preview «expo-web-pruebas» de .claude/launch.json). La clave pública se pide a
// Supabase al arrancar y va solo en el entorno del proceso: no se escribe en .env.local.
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { STAGING_REF, stagingPublishableKey } from './supabase-target.mjs';

const port = process.argv[2] || '8091';
let key = null;
try {
  key = stagingPublishableKey();
} catch {}
if (!key) {
  console.error('No se ha podido leer la clave pública de la base de pruebas. ¿Has hecho `npx supabase login`?');
  process.exit(1);
}

const env = {
  ...process.env,
  EXPO_PUBLIC_SUPABASE_URL: `https://${STAGING_REF}.supabase.co`,
  EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: key,
  WEB_OUTPUT: 'single',
  NODE_OPTIONS: '--max-old-space-size=6144',
};
// --clear: las EXPO_PUBLIC_* se incrustan al empaquetar; sin limpiar, Metro podría servir la base de antes
const cwd = fileURLToPath(new URL('..', import.meta.url)); // la carpeta de la app, se lance desde donde se lance
const child = spawn('npx', ['expo', 'start', '--web', '--clear', '--port', port], { cwd, env, stdio: 'inherit', shell: true });
child.on('exit', (code) => process.exit(code ?? 0));

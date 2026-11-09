// Publica una actualización (OTA) para «Kuova Pruebas», la app conectada a la base de pruebas:
//   npm run release:staging -- "qué cambia"            → Android
//   npm run release:staging -- "qué cambia" --all      → Android e iPhone (cuando exista la app de iPhone)
//
// - Canal `staging` y entorno `development` de EAS (ahí están las variables de la base de pruebas).
// - APP_VARIANT=staging, para que la configuración de la actualización sea la de «Kuova Pruebas».
// - Se niega si el entorno development apunta a producción: los móviles de «Kuova Pruebas» nunca deben
//   escribir en la base real.
// - Puede publicar cambios sin commit (es para probar antes de juntar); el mensaje lo dice.
// Nunca toca los canales `preview` (todos) ni `pruebas` (beta de amigos). Ver docs/entorno-de-pruebas.md.
import { execSync } from 'node:child_process';
import { PROD_REF, easSupabaseRef } from './supabase-target.mjs';

const args = process.argv.slice(2);
const all = args.includes('--all');
const message = args.find((a) => !a.startsWith('--'));

const sh = (cmd) => execSync(cmd, { encoding: 'utf8' }).trim();
const fail = (msg) => {
  console.error(`\n✗ ${msg}\n`);
  process.exit(1);
};

if (!message) fail('Falta el mensaje: npm run release:staging -- "Qué cambia"');

const ref = easSupabaseRef('development');
if (!ref) fail('El entorno development de EAS no tiene EXPO_PUBLIC_SUPABASE_URL (la base de pruebas).');
if (ref === PROD_REF) fail(`El entorno development de EAS apunta a PRODUCCIÓN (${PROD_REF}). No publico «Kuova Pruebas» así.`);

const dirty = sh('git status --porcelain') ? '+cambios sin commit' : '';
const label = `${sh('git rev-parse --abbrev-ref HEAD')}@${sh('git rev-parse --short HEAD')}${dirty}`;
console.log(`\nPublicando «Kuova Pruebas» (canal staging, base ${ref}) desde ${label}: ${message}\n`);

execSync(
  `npx eas-cli update --channel staging --environment development ${all ? '' : '--platform android '}` +
    `--message ${JSON.stringify(`[pruebas] ${message} (${label})`)} --non-interactive`,
  { stdio: 'inherit', env: { ...process.env, APP_VARIANT: 'staging' } }
);
console.log('\n✓ Publicado en «Kuova Pruebas». Cierra y abre la app dos veces para recibirlo.');

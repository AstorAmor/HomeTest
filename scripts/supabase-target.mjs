// A qué base de Supabase apunta cada publicación. Lo usan release.mjs (producción) y release-staging.mjs
// («Kuova Pruebas») para negarse a publicar contra la base equivocada.
//
// - Producción: proyecto HomeTest00 (ref jpqtposdxexdvdfeorzh). La URL no es secreta: va dentro de la app.
// - Pruebas: proyecto «Kuova pruebas». Sus variables están en el entorno `development` de EAS (los entornos
//   con nombre propio son de pago en Expo). Ver docs/entorno-de-pruebas.md.
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

export const PROD_REF = 'jpqtposdxexdvdfeorzh';

const refOf = (url) => url?.match(/https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1] ?? null;

// URL que usará una actualización de EAS publicada con --environment <env>
export function easSupabaseRef(environment) {
  const out = execSync(
    `npx eas-cli env:get ${environment} --variable-name EXPO_PUBLIC_SUPABASE_URL --non-interactive`,
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }
  );
  return refOf(out);
}

// URL que usará `expo export` en este ordenador (la web): el entorno del proceso manda sobre .env.local,
// como hace Expo al cargar los .env
export function localSupabaseRef() {
  if (process.env.EXPO_PUBLIC_SUPABASE_URL) return refOf(process.env.EXPO_PUBLIC_SUPABASE_URL);
  for (const file of ['.env.local', '.env']) {
    if (!existsSync(file)) continue;
    const line = readFileSync(file, 'utf8')
      .split(/\r?\n/)
      .find((l) => l.startsWith('EXPO_PUBLIC_SUPABASE_URL='));
    if (line) return refOf(line.slice('EXPO_PUBLIC_SUPABASE_URL='.length).trim().replace(/^["']|["']$/g, ''));
  }
  return null;
}

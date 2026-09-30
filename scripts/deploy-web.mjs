// Publica la versión web de la app en Vercel.
//   node scripts/deploy-web.mjs        → https://hometest-app.vercel.app (cuentas reales de Supabase)
//   node scripts/deploy-web.mjs demo   → https://hometest-demo.vercel.app (solo paciente, datos de ejemplo,
//                                        login simulado; para enseñar la app, p. ej. a gente con iPhone)
// 1. Exporta la web como SPA estática (WEB_OUTPUT=single, ver app.config.js).
// 2. Renombra assets/node_modules → assets/nm: Vercel descarta al subir cualquier carpeta
//    llamada node_modules, y ahí Expo deja las fuentes de iconos (salían cuadrados).
// 3. Añade la regla para que cualquier ruta cargue index.html y publica en producción.
import { execSync } from 'node:child_process';
import { cpSync, existsSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const DEMO = process.argv[2] === 'demo';
const OUT = 'dist-web';
const DEPLOY = join('deploy', DEMO ? 'hometest-demo' : 'hometest-app');

const run = (cmd, env = {}, cwd) => execSync(cmd, { stdio: 'inherit', cwd, env: { ...process.env, ...env } });

rmSync(OUT, { recursive: true, force: true });
// --clear: las variables EXPO_PUBLIC_* se incrustan al compilar y la caché mezclaría las dos versiones
run(`npx expo export -p web --clear --output-dir ${OUT}`, { WEB_OUTPUT: 'single', EXPO_PUBLIC_PUBLIC_DEMO: DEMO ? '1' : '0' });

// Carpeta de publicación: se vacía salvo el enlace al proyecto de Vercel (.vercel)
if (existsSync(DEPLOY)) {
  for (const f of readdirSync(DEPLOY)) if (f !== '.vercel') rmSync(join(DEPLOY, f), { recursive: true, force: true });
}
cpSync(OUT, DEPLOY, { recursive: true });

const nm = join(DEPLOY, 'assets', 'node_modules');
if (existsSync(nm)) renameSync(nm, join(DEPLOY, 'assets', 'nm'));

const walk = (dir) =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
let patched = 0;
for (const file of walk(DEPLOY)) {
  if (!/\.(js|html|json|css)$/.test(file)) continue;
  const text = readFileSync(file, 'utf8');
  if (text.includes('/assets/node_modules/')) {
    writeFileSync(file, text.split('/assets/node_modules/').join('/assets/nm/'));
    patched++;
  }
}
console.log(`Patched asset paths in ${patched} file(s)`);

writeFileSync(join(DEPLOY, 'vercel.json'), JSON.stringify({ rewrites: [{ source: '/(.*)', destination: '/index.html' }] }, null, 2));
run('npx -y vercel@latest deploy --prod --yes', {}, DEPLOY);

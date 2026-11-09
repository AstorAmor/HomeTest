// Publica la app entera con un solo comando:
//   npm run release -- "mensaje de la versión"
// 1. Comprueba que todo está commiteado y subido a GitHub (lo publicado = lo que hay en git).
// 2. Actualización de la app (EAS Update, canal preview: APK y Expo Go la reciben al reabrir).
// 3. Web de la app (https://hometest-app.vercel.app) y web de demo (https://hometest-demo.vercel.app).
// Opciones: --skip-app, --skip-web (por si solo quieres publicar una parte).
import { execSync } from "node:child_process";
import { PROD_REF, easSupabaseRef, localSupabaseRef } from "./supabase-target.mjs";

const args = process.argv.slice(2);
const skipApp = args.includes("--skip-app");
const skipWeb = args.includes("--skip-web");
const message = args.find((a) => !a.startsWith("--"));

const sh = (cmd) => execSync(cmd, { encoding: "utf8" }).trim();
const run = (cmd) => execSync(cmd, { stdio: "inherit" });
const fail = (msg) => {
  console.error(`\n✗ ${msg}\n`);
  process.exit(1);
};

if (!message) fail('Falta el mensaje: npm run release -- "Qué cambia en esta versión"');
if (sh("git status --porcelain")) fail("Hay cambios sin commitear. Haz commit (y push) antes de publicar.");
const branch = sh("git rev-parse --abbrev-ref HEAD");
if (branch !== "master") fail(`Estás en la rama "${branch}". Publica desde master.`);
sh("git fetch -q origin");
if (sh("git rev-parse HEAD") !== sh("git rev-parse origin/master"))
  fail("master no coincide con GitHub. Haz git push (o git pull) antes de publicar.");

// Nunca con la base de pruebas: una OTA lleva dentro la base a la que apunta y cambiaría de base a todos
// los móviles del canal (ver docs/entorno-de-pruebas.md)
if (process.env.APP_VARIANT)
  fail(`APP_VARIANT=${process.env.APP_VARIANT} está puesto: esto publica «Kuova» (producción). Para «Kuova Pruebas»: npm run release:staging`);
if (!skipApp) {
  const ref = easSupabaseRef("preview");
  if (ref !== PROD_REF)
    fail(`El entorno preview de EAS apunta a ${ref ?? "ninguna base"} y no a producción (${PROD_REF}). No publico.`);
}
if (!skipWeb) {
  const ref = localSupabaseRef();
  if (ref !== PROD_REF)
    fail(`EXPO_PUBLIC_SUPABASE_URL (.env.local o el entorno) apunta a ${ref ?? "ninguna base"} y no a producción (${PROD_REF}). No publico la web.`);
}

const commit = sh("git rev-parse --short HEAD");
console.log(`\nPublicando ${commit}: ${message}\n`);

if (!skipApp) {
  console.log("→ Actualización de la app (EAS Update, canal preview)");
  run(`npx eas-cli update --channel preview --environment preview --message ${JSON.stringify(`${message} (${commit})`)} --non-interactive`);
}
if (!skipWeb) {
  console.log("\n→ Web de la app (hometest-app.vercel.app)");
  run("node scripts/deploy-web.mjs");
  console.log("\n→ Web de demo (hometest-demo.vercel.app)");
  run("node scripts/deploy-web.mjs demo");
}
console.log(`\n✓ Publicado ${commit}`);

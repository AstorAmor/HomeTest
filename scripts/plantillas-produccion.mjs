// Correos de «¿Has olvidado tu contraseña?» en PRODUCCIÓN (HomeTest00), sin tocar nada más de Auth.
//
//   node scripts/plantillas-produccion.mjs           → solo enseña qué cambiaría (no toca nada)
//   node scripts/plantillas-produccion.mjs --subir   → lo sube (SOLO con el OK de Astor en el chat)
//
// Sube tres cosas y nada más: el código de los correos con 6 cifras (producción venía con 8), la plantilla
// «Tu código para cambiar la contraseña de Kuova» y el aviso «Tu contraseña de Kuova ha cambiado».
// No usa supabase/config.toml (subirlo entero cambiaría site_url, contraseñas, confirmación del email…):
// escribe uno mínimo en una carpeta temporal. `config push` solo toca lo que declara el archivo.
// Antes, el SMTP de Brevo tiene que estar puesto en producción: sin él Supabase no deja cambiar las
// plantillas y solo manda correos a los miembros del equipo.
import { execSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PROD_REF = 'jpqtposdxexdvdfeorzh';
const subir = process.argv.includes('--subir');
const app = fileURLToPath(new URL('..', import.meta.url));

const dir = mkdtempSync(join(tmpdir(), 'kuova-plantillas-'));
try {
  mkdirSync(join(dir, 'supabase', 'templates'), { recursive: true });
  for (const f of ['recuperar-contrasena.html', 'contrasena-cambiada.html']) {
    copyFileSync(join(app, 'supabase', 'templates', f), join(dir, 'supabase', 'templates', f));
  }
  writeFileSync(
    join(dir, 'supabase', 'config.toml'),
    `project_id = "HomeTest"

[auth.email]
otp_length = 6

[auth.email.template.recovery]
subject = "Tu código para cambiar la contraseña de Kuova"
content_path = "./supabase/templates/recuperar-contrasena.html"

[auth.email.notification.password_changed]
enabled = true
subject = "Tu contraseña de Kuova ha cambiado"
content_path = "./supabase/templates/contrasena-cambiada.html"
`
  );
  const cmd = subir
    ? `npx supabase config push --remote=${PROD_REF} --workdir "${dir}" --yes`
    : `npx supabase config diff --remote=${PROD_REF} --workdir "${dir}"`;
  console.log(subir ? '→ Subiendo a PRODUCCIÓN (HomeTest00)…' : '→ Qué cambiaría en PRODUCCIÓN (no se toca nada):');
  execSync(cmd, { cwd: app, stdio: 'inherit' });
} finally {
  rmSync(dir, { recursive: true, force: true });
}

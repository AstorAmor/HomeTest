# Doble factor (app de autenticación) y cuentas

Desde el 2026-11-09 (rama `entorno-pruebas`). Primero en la base de pruebas; en producción, con el OK de Astor.

## Qué pide Kuova

| Cuenta | Contraseña | Confirmar email | Doble factor |
|---|---|---|---|
| Paciente | 8+ con letras y números | Sí (código de 6 cifras o botón del correo) | Opcional (Ajustes → Verificación en dos pasos) |
| Profesional (también sin verificar) | Igual | Sí | **Obligatorio** |
| Admin y soporte | Igual | Sí | **Obligatorio** |

- La contraseña la exige Supabase (`minimum_password_length = 8`, `password_requirements = "letters_digits"`);
  la app avisa antes con las mismas reglas (`src/logic/password.ts`). Las contraseñas antiguas de 6 siguen
  valiendo para entrar: la regla es al crearla o cambiarla.
- La protección contra contraseñas filtradas (HaveIBeenPwned) solo existe en Supabase Pro: no está activada.

## Cómo se obliga: la base de datos, no la pantalla

Migración `supabase/migrations/20261109180000_mfa_aal2.sql`:

- `mfa_ok()`: la sesión vale si es `aal2` (se escribió el código) o si la cuenta no necesita doble factor y no
  lo tiene activado. Política **restrictiva** en todas las tablas con RLS y en Storage: sin `mfa_ok()` no se
  lee ni se escribe nada.
- Las funciones `security definer` (se saltan RLS) lo exigen por dentro: `is_admin()`, `is_support_agent()`,
  `has_share()`, `has_share_folder()`, `is_my_patient()`, `my_shared_patients()`, `pro_patients()`.
- `mfa_required()` se puede preguntar con aal1: la app la usa para pedir el alta o el código.
- Tests: `supabase/tests/database/mfa_aal2.test.sql` (30), que además comprueba que **ninguna tabla con RLS se
  queda sin la política restrictiva**: una tabla nueva tiene que crearla (copiar el bloque del final de la
  migración). Los tests antiguos usan sesiones `aal2`. Con sesiones reales de Supabase Auth (no simuladas):
  `node scripts/staging-auth-check.mjs`, solo contra la base de pruebas (23 comprobaciones, 2026-11-09).
- El alta pasa `issuer: 'Kuova Health'`: sin él Supabase lo saca del dominio de `site_url`, y con
  `kuovapruebas://` no hay dominio y el alta falla («Error generating QR Code»).

En la app: `MfaGuard` (en `src/app/_layout.tsx`) pone `MfaScreen` delante de todo mientras falte el alta o el
código; `SecurityScreen` (`/security`) para ver, añadir o quitar apps; `src/data/mfa.ts` y `src/logic/mfa.ts`.

## Si alguien pierde el móvil

Supabase no da códigos de recuperación (hay una versión experimental que no está activada). Por eso (decidido por Astor el 2026-11-09):

1. **Dos apps a la vez** (recomendado al dar de alta): por ejemplo el móvil y 1Password. Si se pierde una, la
   otra vale.
2. **Un admin lo quita**, después de comprobar la identidad (por ejemplo videollamada con DNI y número de
   colegiado; el correo tiene que llegar desde el email de la cuenta):
   Más → Professionals review → la tarjeta → escribir el motivo en la nota → «Lost phone: remove 2-step».
   Lo hace la Edge Function `admin-mfa-reset` (comprueba que quien llama es admin con aal2) y queda en
   `public.mfa_resets` (quién, a quién, cuándo, por qué; no se puede editar ni borrar). La próxima vez que esa
   persona entra con su contraseña, la app le pide dar de alta una app nueva.
3. **Astor (único admin)**: desde el panel de Supabase → Authentication → Users → su cuenta → quitar el
   factor. El panel tiene su propio doble factor. Anotarlo a mano (como los accesos del panel).

## ¿Has olvidado tu contraseña? (2026-11-11)

1. Entrar → «¿Has olvidado tu contraseña?» (solo con cuentas reales, no en la demo) → email → «Enviarme el
   código». Supabase no dice si la cuenta existe: la app pasa al código igual y el texto empieza por «Si
   hay una cuenta de Kuova con…».
2. Correo «Tu código para cambiar la contraseña de Kuova» (`supabase/templates/recuperar-contrasena.html`):
   solo el código de 6 cifras, sin botón. Caduca en una hora y vale una vez.
3. Con el código se abre la sesión y `MfaGuard` enseña solo «Elige una contraseña nueva»
   (`NewPasswordScreen`). Si la cuenta tiene doble factor, antes pide su código: sin él Supabase no deja
   cambiar la contraseña (`insufficient_aal`). Si la app se cierra a medias, al volver sigue ahí (marca en
   el móvil, `src/data/passwordReset.ts`, se olvida al día, al cerrar sesión o al entrar con contraseña).
4. Al guardar llega el aviso «Tu contraseña de Kuova ha cambiado» (`contrasena-cambiada.html`, Supabase →
   Security notifications → Password changed).

Probado en la web contra la base de pruebas el 2026-11-11 con cuentas inventadas (con y sin doble factor):
la contraseña vieja deja de valer y la nueva entra.

## Orden en producción

Para «¿Has olvidado tu contraseña?»: primero las dos plantillas (`config push` con el SMTP de Brevo ya puesto
en producción; sin plantilla propia, el correo por defecto de Supabase trae un enlace y no el código) y
después la app. Las dos cosas, con el OK de Astor.

Para el doble factor:

1. La app que sabe pedir el código (OTA con `npm run release`).
2. Después, la migración `20261109180000_mfa_aal2` y la función `admin-mfa-reset`.
Al revés, un admin o un profesional con la app vieja dejaría de ver datos sin saber por qué.

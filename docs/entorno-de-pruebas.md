# Entorno de pruebas («Kuova Pruebas»)

Desde el 2026-11-09. Todo cambio de base de datos, Edge Function o ajuste de Auth se aplica **primero aquí**;
Astor lo prueba en la app «Kuova Pruebas» y, **con su OK**, pasa a producción.

## Qué app va con qué base

| App en el móvil | Canal de EAS | Base de Supabase | Quién la usa |
|---|---|---|---|
| **Kuova** (APK `preview` y la web) | `preview` | `HomeTest00` (producción, `jpqtposdxexdvdfeorzh`) | Todos |
| **Kuova** (APK de pruebas b3972691, TestFlight «Probadores») | `pruebas` | `HomeTest00` (producción) | Beta de amigos |
| **Kuova Pruebas** (icono naranja, «PRUEBAS») | `staging` | «Kuova pruebas» (solo datos inventados) | Astor, las sesiones de código y, desde el 2026-11-17, gente a la que Astor la comparte para ver el diseño nuevo (con datos inventados) |

- Ojo con los nombres: el canal `pruebas` es la **beta de amigos y va a producción**. La base de pruebas es
  la del canal `staging`.
- **Nunca** cambiar a qué base apuntan `preview` ni `pruebas`: las variables `EXPO_PUBLIC_SUPABASE_*` van
  dentro de cada OTA, y una OTA con la base de pruebas cambiaría de base a todos los móviles del canal.

## Base de pruebas «Kuova pruebas»

- Proyecto de Supabase en Frankfurt (`eu-central-1`), en la organización gratuita «Kuova pruebas» (aparte de
  la de `HomeTest00`: si esa pasa a Pro, esta sigue costando 0 €). Ref **`bujbvrozmtcnnmhvkupj`**
  (`STAGING_REF` en `scripts/supabase-target.mjs`). Creado el 2026-11-09 con las 36 migraciones y las 9
  funciones.
- Plan gratuito: **se pausa tras 7 días sin uso**. Se reactiva en el panel (Restore project), 1-2 minutos.
- Solo datos inventados. Cuentas de prueba: alias `+algo` del email del admin de pruebas (así son
  «probadores» y pueden cargar Ajustes → Casos de prueba). Nada de datos reales de nadie.
- Secretos de Edge Functions: `GEMINI_API_KEY` (la misma clave, copiada sin enseñarla; **pendiente del OK de
  Astor**: sin ella, leer analíticas con IA responde «sin configurar»); Revolut, en sandbox cuando toque;
  Daily, sin poner (la videoconsulta responde «sin configurar»).
- Correo: hasta que esté el SMTP de Brevo, Supabase solo envía a los miembros de la organización (2 por
  hora) y **no deja cambiar la plantilla** del correo de confirmación (plan gratuito). Por eso
  `config push` falla hasta entonces (ver abajo).

### Aplicar cambios a la base de pruebas

Desde una carpeta de trabajo **enlazada a la base de pruebas** (`npx supabase link --project-ref <ref de
pruebas>`; el enlace vive en `supabase/.temp/project-ref`, que no se sube a git). Antes de nada:

```bash
cat supabase/.temp/project-ref      # tiene que ser la ref de PRUEBAS, nunca jpqtposdxexdvdfeorzh
```

Con la CLI 3 los comandos van contra la base **local** si no se dice otra cosa: siempre `--linked` o
`--remote=<ref>`. Sin consola interactiva (Claude Code) los que cambian algo piden además `--yes`.

- Migraciones: `npx supabase db push --linked` (antes, `--dry-run` para ver la lista).
- Funciones: `npx supabase functions deploy --use-api --remote=bujbvrozmtcnnmhvkupj`
- Ajustes de Auth (contraseña, confirmar email, plantilla, doble factor, URLs) desde `supabase/config.toml`:
  `KUOVA_SITE_URL=kuovapruebas:// npx supabase config diff --remote=<ref>` para ver qué cambia y luego
  `config push --remote=<ref>`. Solo toca lo que declara el archivo: el SMTP (que no está en el archivo,
  porque la clave no va en archivos) se queda como esté. El pooler y Storage vector no se declaran a
  propósito (pisarían los del panel). Mientras no haya SMTP propio, la plantilla del correo hace fallar el
  push entero («Email template modification is not available for free tier»): el 2026-11-09 se subió todo
  menos la plantilla con una copia del archivo sin `[auth.email.template.confirmation]`; la plantilla se
  sube después del paso de Brevo.
- `site_url` = `kuovapruebas://`: el botón del correo abre «Kuova Pruebas» en el móvil. Con un `site_url`
  sin dominio, Supabase no sabe poner el «emisor» del QR del doble factor: la app lo manda siempre
  («Kuova Health», `src/data/mfa.ts`).
- Tests de base de datos (sin Docker): cada archivo de `supabase/tests/database/` es una transacción que se
  deshace al final. `npx supabase test db` necesita Docker; sin él, `npx supabase db query --linked --yes -f
  <archivo>`. Ojo: solo devuelve el último resultado, así que para saber si pasaron todos hay que cambiar el
  `select * from finish();` final por `select extensions._get('plan') as planned, extensions._get('curr_test')
  as ran, extensions.num_failed() as failed;` (en una copia) y mirar `failed = 0` y `ran = planned`.
  2026-11-09: 109/109 (rls_sharing 28, specialist_portal 20, support_access 24, pro_templates 7, mfa_aal2 30).
- Prueba de punta a punta con sesiones reales (contraseñas, email sin confirmar, doble factor de
  profesional y admin, reseteo por el admin): `node scripts/staging-auth-check.mjs`. Crea cuentas
  inventadas y las borra al final (en `mfa_resets` queda una fila por pasada: es un registro y no se
  borra). 2026-11-09: 23/23.
- La web de la app contra esta base, en este ordenador: `node scripts/web-pruebas.mjs` (puerto 8091) o el
  preview «expo-web-pruebas» de Claude Code. La clave pública se pide a Supabase al arrancar; nada en
  `.env.local`.

## App «Kuova Pruebas»

- `APP_VARIANT=staging` (`app.config.js`): nombre «Kuova Pruebas», identificador `com.kuovahealth.app.pruebas`
  (Android e iPhone), esquema `kuovapruebas://`, iconos de `assets/images/pruebas/`
  (`python scripts/make-icons.py pruebas`). En la pantalla de entrar sale «ENTORNO DE PRUEBAS».
- Variables: el entorno **`development`** de EAS lleva las de la base de pruebas (los entornos con nombre
  propio son de pago en Expo). Lo usan los perfiles `staging` y `staging-ios`, `npm run release:staging` y
  las compilaciones de desarrollo. **Cuidado:** hasta el 2026-11-09, `EXPO_PUBLIC_SUPABASE_URL` y
  `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` eran **una sola variable para development, preview y production**:
  cambiar su valor habría pasado a pruebas a todo el mundo. **Separadas el 2026-11-09 (OK de Astor):** las
  de producción quedan solo en preview y production, con el mismo valor; `development` tiene dos variables
  propias con la base de pruebas. Antes de tocar una variable, mira en qué entornos está
  (`npx eas-cli env:list <entorno>`) y nunca `eas env:set` sobre una que esté en más de uno.
- Secretos de la base de pruebas: `GEMINI_API_KEY` (la misma clave que producción, copiada el 2026-11-09 con
  el OK de Astor) para leer analíticas con IA. Comprobar que responde: `node scripts/staging-ai-check.mjs`.
- Correo: SMTP de Brevo puesto por Astor en el panel (2026-11-10; remitente `support@kuovahealth.com`, puerto
  587) y plantilla «Confirma tu cuenta de Kuova» subida con `KUOVA_SITE_URL=kuovapruebas:// npx supabase config push
  --remote=bujbvrozmtcnnmhvkupj --workdir . --yes`. Probar un correo de verdad: `node scripts/staging-email-check.mjs
  <email>` (se da de alta como la app y borra la cuenta después).
- Plantillas de «¿Has olvidado tu contraseña?» (código de 6 cifras) y del aviso «Tu contraseña de Kuova ha
  cambiado», subidas igual el 2026-11-11 (ver docs/doble-factor.md).
- APK: `npx eas-cli build --platform android --profile staging` (una vez; con cambios nativos, otra). El
  primero, el 2026-11-09 (build `16edc92f`, versionCode 1, llave de firma creada por EAS en la nube).
  Ojo al juntar con `metas-fase1`: si el código juntado usa un módulo nativo que este APK no tiene (por
  ejemplo `modules/kuova-wallpaper`), hace falta otro APK antes de mandar esa actualización a `staging`.
- Actualizaciones: `npm run release:staging -- "qué cambia"` (Android e iPhone desde el 2026-11-17; `--android` para solo
  Android). Para la OTA hace falta memoria: para antes el preview web de la app si está abierto. Se
  niega si el entorno `development` apunta a producción. Puede publicar cambios sin commit (para probar antes
  de juntar) y lo dice en el mensaje.
- iPhone (2026-11-17): segunda app en App Store Connect («Kuova Pruebas», `com.kuovahealth.app.pruebas`). Compilar y
  subir a TestFlight: `npx eas-cli build --platform ios --profile staging-ios --auto-submit` (la primera vez, en una
  terminal; el perfil de envío `staging-ios` de eas.json lleva el `ascAppId` de «Kuova Pruebas», 6836277823, nunca
  el de la app real). Desde el 2026-11-18 el inicio de sesión de EAS con Apple falla (fallo de Apple, eas-cli 27.10.0):
  se compila y se sube con una clave de la API de App Store Connect (variables `EXPO_ASC_API_KEY_PATH`,
  `EXPO_ASC_KEY_ID`, `EXPO_ASC_ISSUER_ID`, `EXPO_APPLE_TEAM_ID`, `EXPO_APPLE_TEAM_TYPE=INDIVIDUAL`); el archivo `.p8`
  lo guarda Astor fuera del repositorio y de OneDrive. Para subirlo (`eas submit`), EAS pide además la clave en el
  perfil de envío: añadir en local, SIN commit, `ascApiKeyPath`, `ascApiKeyId`, `ascApiKeyIssuerId` y `appleTeamId` a
  `submit.staging-ios.ios`, lanzar `eas submit --platform ios --profile staging-ios --id <build> --non-interactive` y
  quitarlos. Primer build: 1.1.0 (6), d0bf7a9a, subido a TestFlight el 2026-11-18. Para compartirla: grupo de TestFlight externo con enlace público (la
  primera versión pasa la revisión de Apple; Apple pide una cuenta de prueba, que crea Astor).

## Compartir «Kuova Pruebas» (desde el 2026-11-17)

- Decisión de Astor: se puede compartir con gente para que vea el diseño nuevo, **siempre con datos inventados**
  (la base de pruebas no es para datos reales de nadie). Va apuntado en el vault de Curro, en
  `Strategy/Kuova/Entorno de pruebas y seguridad de cuentas - encargo.md`.
- Android: el APK de `staging` (build 030ee462, 12/11). Lleva todo lo nativo del código actual; al abrirlo por
  primera vez, cerrar y abrir dos veces para recibir la última actualización. Si se añade un módulo nativo, hace
  falta otro APK y otro build de iPhone.
- iPhone: TestFlight de la app «Kuova Pruebas» (no el grupo «Probadores», que es de la app real).
- La base va en el plan gratuito: se pausa tras 7 días sin uso y se puede rehacer; lo apuntado puede perderse.

## Guardas para no publicar con la base equivocada

- `npm run release` (producción) se niega si `APP_VARIANT` está puesto, si el entorno `preview` de EAS no
  apunta a producción o si la web se exportaría con otra base (`scripts/supabase-target.mjs`).
- `npm run release:staging` se niega si el entorno `development` no apunta a la base de pruebas
  (`STAGING_REF`).

## Flujo de un cambio

1. Se hace en una rama o carpeta de trabajo.
2. Migración, funciones y ajustes de Auth → base de pruebas. Tests de base de datos contra pruebas.
3. `npm run release:staging` → Astor lo prueba en «Kuova Pruebas».
4. Con el OK de Astor en el chat: lo mismo en producción (migración, funciones, ajustes del panel) y
   `npm run release` desde master.

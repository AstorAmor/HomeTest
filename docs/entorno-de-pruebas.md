# Entorno de pruebas («Kuova Pruebas»)

Desde el 2026-11-09. Todo cambio de base de datos, Edge Function o ajuste de Auth se aplica **primero aquí**;
Astor lo prueba en la app «Kuova Pruebas» y, **con su OK**, pasa a producción.

## Qué app va con qué base

| App en el móvil | Canal de EAS | Base de Supabase | Quién la usa |
|---|---|---|---|
| **Kuova** (APK `preview` y la web) | `preview` | `HomeTest00` (producción, `jpqtposdxexdvdfeorzh`) | Todos |
| **Kuova** (APK de pruebas b3972691, TestFlight «Probadores») | `pruebas` | `HomeTest00` (producción) | Beta de amigos |
| **Kuova Pruebas** (icono naranja, «PRUEBAS») | `staging` | «Kuova pruebas» (solo datos inventados) | Astor y las sesiones de código |

- Ojo con los nombres: el canal `pruebas` es la **beta de amigos y va a producción**. La base de pruebas es
  la del canal `staging`.
- **Nunca** cambiar a qué base apuntan `preview` ni `pruebas`: las variables `EXPO_PUBLIC_SUPABASE_*` van
  dentro de cada OTA, y una OTA con la base de pruebas cambiaría de base a todos los móviles del canal.

## Base de pruebas «Kuova pruebas»

- Proyecto de Supabase en Frankfurt (`eu-central-1`), en la organización gratuita «Kuova pruebas» (aparte de
  la de `HomeTest00`: si esa pasa a Pro, esta sigue costando 0 €). Ref: ver la nota del vault
  `Strategy/Kuova/Entorno de pruebas y seguridad de cuentas - encargo.md` o `npx supabase projects list`.
- Plan gratuito: **se pausa tras 7 días sin uso**. Se reactiva en el panel (Restore project), 1-2 minutos.
- Solo datos inventados. Cuentas de prueba: alias `+algo` del email del admin de pruebas (así son
  «probadores» y pueden cargar Ajustes → Casos de prueba). Nada de datos reales de nadie.
- Secretos de Edge Functions: `GEMINI_API_KEY` (la misma clave, copiada sin enseñarla); Revolut, en sandbox
  cuando toque; Daily, sin poner (la videoconsulta responde «sin configurar»).

### Aplicar cambios a la base de pruebas

Desde una carpeta de trabajo **enlazada a la base de pruebas** (`npx supabase link --project-ref <ref de
pruebas>`; el enlace vive en `supabase/.temp/project-ref`, que no se sube a git). Antes de nada:

```bash
cat supabase/.temp/project-ref      # tiene que ser la ref de PRUEBAS, nunca jpqtposdxexdvdfeorzh
```

- Migraciones: `npx supabase db push`
- Funciones: `npx supabase functions deploy --use-api`
- Ajustes de Auth (contraseña, confirmar email, plantilla, doble factor, URLs) desde `supabase/config.toml`:
  `KUOVA_SITE_URL=kuovapruebas:// npx supabase config push`. **Ojo:** `config.toml` no lleva el SMTP (la clave
  no va en archivos) y `config push` enseña un diff antes de aplicar: si sale que desactiva el SMTP, cancelar
  y cambiar ese ajuste a mano en el panel.
- Tests de base de datos (sin Docker): cada archivo de `supabase/tests/database/` es una transacción que se
  deshace al final. `npx supabase test db --linked` necesita Docker; sin él, `npx supabase db query --linked
  -f supabase/tests/database/<archivo>.test.sql` y mirar que no haya ningún `not ok`.

## App «Kuova Pruebas»

- `APP_VARIANT=staging` (`app.config.js`): nombre «Kuova Pruebas», identificador `com.kuovahealth.app.pruebas`
  (Android e iPhone), esquema `kuovapruebas://`, iconos de `assets/images/pruebas/`
  (`python scripts/make-icons.py pruebas`). En la pantalla de entrar sale «ENTORNO DE PRUEBAS».
- Variables: el entorno **`development`** de EAS lleva las de la base de pruebas (los entornos con nombre
  propio son de pago en Expo). Lo usan los perfiles `staging` y `staging-ios` y `npm run release:staging`.
- APK: `npx eas-cli build --platform android --profile staging` (una vez; con cambios nativos, otra).
- Actualizaciones: `npm run release:staging -- "qué cambia"` (Android; `--all` para Android e iPhone). Se
  niega si el entorno `development` apunta a producción. Puede publicar cambios sin commit (para probar antes
  de juntar) y lo dice en el mensaje.
- iPhone: segunda app en App Store Connect (`com.kuovahealth.app.pruebas`) cuando haga falta; perfil
  `staging-ios`.

## Guardas para no publicar con la base equivocada

- `npm run release` (producción) se niega si `APP_VARIANT` está puesto, si el entorno `preview` de EAS no
  apunta a producción o si la web se exportaría con otra base (`scripts/supabase-target.mjs`).
- `npm run release:staging` se niega si el entorno `development` apunta a producción.

## Flujo de un cambio

1. Se hace en una rama o carpeta de trabajo.
2. Migración, funciones y ajustes de Auth → base de pruebas. Tests de base de datos contra pruebas.
3. `npm run release:staging` → Astor lo prueba en «Kuova Pruebas».
4. Con el OK de Astor en el chat: lo mismo en producción (migración, funciones, ajustes del panel) y
   `npm run release` desde master.

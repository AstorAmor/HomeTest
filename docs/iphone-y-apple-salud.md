# Kuova en iPhone y Apple Salud: qué está hecho y qué falta

Actualizado: 2026-10-23

La mayoría de los usuarios tendrán iPhone, así que la app tiene que leer **Apple Salud** igual que en Android lee Health Connect. Apple Salud solo se puede leer desde una **app de iPhone instalada**: ni la web ni Expo Go pueden. Lo que lea el iPhone se guarda en la misma tabla de Supabase (`wearable_daily`, proveedor `apple_health`), así que la web de la app (hometest-app.vercel.app) lo enseña sin hacer nada más.

## 1. Lo que ya está hecho en el código

| Qué | Dónde |
|---|---|
| Lectura de Apple Salud: pasos, energía activa, distancia, pulso medio, pulso en reposo (o estimado), VFC y sueño con fases y horas | `src/wearables/providers/appleHealth.ios.ts` |
| Versión vacía para Android y web (sus bundles no llevan HealthKit, la APK publicada no se rompe) | `src/wearables/providers/appleHealth.ts` |
| Sincroniza sola al abrir Hoy (cada 10 min como mucho), igual que Health Connect | `syncWearablesIfDue` en `src/wearables/dailySeries.ts` |
| Pantalla Wearables: en iPhone, tarjeta «Apple Salud» (conectar, sincronizar, abrir Salud, qué llega de cada tipo) | `src/screens/WearablesScreen.tsx` |
| Nombres de las fuentes: «Apple Watch», «Este móvil», Oura, Garmin Connect, WHOOP, Huawei Health… nunca el nombre que el usuario puso a su reloj | `appleSourceName` en `src/wearables/sources.ts` |
| Configuración de iPhone: identificador `com.kuovahealth.app`, permiso de Salud, textos de permisos en inglés y español | `app.json`, `assets/locales/es.json` |
| Perfil de compilación `testflight` (canal `preview`: recibe los mismos `npm run release` que la APK) | `eas.json` |
| Tests de la lógica nueva | `src/wearables/__tests__/seriesLogic.test.ts` |
| (21/10) Fecha y hora en los registros de tensión, glucosa, peso y métricas sueltas: en iPhone la rueda va en una hoja con «Hecho» (antes se habría quedado abierta sin forma de cerrarla) | `src/components/DateTimeSheet.tsx` |
| (21/10) Permiso para guardar en Fotos (`NSPhotoLibraryAddUsageDescription`): sin él, «Guardar imagen» al compartir una insignia cierra la app de golpe | `app.json`, `assets/locales/es.json` |
| (21/10) Texto del permiso de Salud ampliado a peso, entrenos, tensión, glucosa, oxígeno, temperatura y respiración, para poder leerlos más adelante sin otra compilación | `app.json`, `assets/locales/es.json` |
| (24/10) Texto de «escribir en Salud» (`NSHealthUpdateUsageDescription`) aunque Kuova solo lee: sin él Apple rechaza la compilación al subirla (ITMS-90683, le pasó a la compilación 2), porque la librería contiene el código de escritura. El texto dice que Kuova no guarda nada en Salud; nunca se le enseña al usuario porque la app no pide ese permiso | `app.json`, `assets/locales/es.json` |
| (21/10) Sin audio en segundo plano (ninguna pantalla lo usa): se quita el modo `audio` de iPhone y el servicio de Android, que Apple y Google piden justificar | `app.json` (`enableBackgroundPlayback: false`) |
| (21/10) Ajustes → Permisos y la tarjeta de Huawei hablan de Apple Salud en iPhone (Huawei Health sí escribe en Salud) | `SettingsScreen.tsx`, `WearablesScreen.tsx` |

Librería: `@kingstinct/react-native-healthkit` 16.2 + `react-native-nitro-modules` 0.37.

**No está probado en un iPhone real**: no se puede hasta tener la primera compilación (punto 3). Desde Windows no se puede generar el proyecto de Xcode (`expo prebuild` para iOS solo funciona en Mac o Linux); el 21/10 se comprobó con `npx expo config --type introspect` el Info.plist resultante: identificador, permisos en los dos idiomas, entitlement de HealthKit, avisos (`aps-environment`) y sin modos en segundo plano. La comprobación de verdad es la primera compilación en EAS.

## 2. Lo que tienes que hacer tú (cuentas y decisiones)

Apple no tiene un formulario para pedir acceso a Salud (como el de Huawei Health Kit): HealthKit es una capacidad del identificador de la app y EAS la activa sola en la primera compilación (punto 3). Lo que hay que conseguir es la cuenta de desarrollador y, al final, pasar la revisión de la App Store.

1. **Cuenta de Apple** (si no tienes una que sirva). Se crea en account.apple.com desde el PC, sin aparato de Apple. Mejor con `astor@kuovahealth.com` (facilita pasarla luego a Pulse Health), país **España** y nombre y apellidos como en el DNI. Verificación en dos pasos con tu número de móvil: los códigos llegan por SMS.
2. **Cuenta de Apple Developer** (99 € al año): developer.apple.com/programs/enroll → «Start your enrollment», **por la web** (la app Apple Developer solo existe en iPhone, iPad y Mac).
   - **Como particular** («Individual / Sole Proprietor») se puede hoy: nombre legal (sin alias ni nombre de empresa), dirección real (no vale apartado de correos), teléfono, pago y aceptar el acuerdo. Apple verifica la identidad: de horas a días. En el foro de Apple hay casos de España atascados semanas, casi siempre porque el país de la cuenta no coincide con el del documento; si pasa, se escribe a soporte.
   - **Como organización** (Pulse Health, S.L.) necesita el número D-U-N-S, y para eso la sociedad tiene que estar constituida. Pide además un correo y una web del dominio de la empresa (kuovahealth.com sirve). En la App Store saldría «Pulse Health, S.L.» como vendedor.
   - **La cuenta de particular solo sirve para TestFlight.** La norma 5.1.1(ix) dice que las apps de servicios regulados, como la salud, o que piden datos sensibles «should be submitted by a legal entity that provides the services, and not by an individual developer». Kuova tendrá que publicarse desde la cuenta de Pulse Health.
   - Para pasar de particular a organización se pide a soporte de Apple (Contact Us → Membership and Account) con el D-U-N-S, la dirección legal y un teléfono. Guías de terceros dicen que no cuesta nada, pero Apple no lo confirma en su web.
   - Recomendación: particular ahora para TestFlight; pedir el D-U-N-S en cuanto Pulse Health tenga CIF; organización antes de publicar en la App Store.
3. **Confirmar el identificador** `com.kuovahealth.app`. No se puede cambiar una vez creada la app en App Store Connect. Si prefieres otro, se cambia en `app.json` antes de la primera compilación.
4. **No hace falta crear la app a mano en App Store Connect**: `eas submit` la crea si no existe (punto 3).

## 3. Primera compilación y TestFlight (unos 30-40 minutos, casi todo esperando)

Desde la carpeta `hometest-app`, en una terminal:

```bash
npx eas-cli@latest build --platform ios --profile testflight
```

- La primera vez pide entrar con tu Apple ID. EAS crea los certificados y activa sola la capacidad HealthKit en el identificador (sale del permiso que ya hay en `app.json`). No hace falta un Mac.
- La compilación se hace en los servidores de Expo (unos 20 minutos).

Cuando acabe:

```bash
npx eas-cli@latest submit --platform ios --latest
```

- Si la app no existe en App Store Connect, la crea (lo hace `ensureAppExistsAsync` en el código de eas-cli): nombre `expo.name` de `app.json` («Kuova»). Si el nombre ya está cogido, añade un sufijo al azar, por ejemplo «Kuova (a1b2c3)», y se cambia después en App Store Connect. Si existe una app con ese nombre que hayas creado tú, la reutiliza.
- El idioma principal sería **inglés (en-US)** si no se dice otro; por eso `submit.production` de `eas.json` lleva `"ios": { "language": "es-ES" }` (desde el 23/10).
- Sube la compilación a App Store Connect. A los 10-30 minutos sale en TestFlight. No pregunta por el cifrado: `ITSAppUsesNonExemptEncryption: false` ya está en `app.json`.
- En App Store Connect → TestFlight: añade el Apple ID de quien vaya a probar como **probador interno** y que instale la app **TestFlight** en el iPhone. Los probadores internos (hasta 100) tienen que ser usuarios de tu equipo en App Store Connect (Usuarios y acceso → invitar) y no necesitan revisión de Apple. Como tú no tienes iPhone, es la vía más rápida con un amigo. Los **externos** (amigos con un enlace) pasan una revisión beta la primera vez; no está confirmado si Apple pone pegas a una app de salud que llega desde una cuenta de particular (norma 5.1.1(ix)).

Prueba en el iPhone: Más → Wearables → **Conectar Apple Salud** → acepta todo → mira «Qué llega (últimos 30 días)» → abre Hoy y Mis datos. Si un tipo sale «Sin datos», revisa Salud → tu foto → Apps → Kuova.

Después, cada `npm run release` llega también al iPhone (mismo canal `preview`). Solo hace falta otra compilación de iPhone si se añade código nativo, igual que con la APK.

## 4. Antes de publicar en la App Store (bloquean la revisión)

1. **Publicar desde la cuenta de Pulse Health** (norma 5.1.1(ix), ver punto 2): sociedad constituida, D-U-N-S y la cuenta pasada a organización.
2. **Estado de comerciante (DSA)**: para publicar en la UE, App Store Connect pide declarar si eres comerciante (Digital Services Act, artículos 30 y 31). Si lo eres, Apple publica en la ficha de la app un correo, un teléfono y una dirección verificados. Un particular tiene que dar su dirección o un apartado de correos; una organización no, porque se enseña la dirección del D-U-N-S. Otra razón para publicar como Pulse Health. TestFlight no enseña nada de esto en público.
3. **Borrar la cuenta desde la app** (norma 5.1.1(v): si la app permite crear cuenta, tiene que permitir borrarla dentro de la app). **Hoy no existe**: hay que hacerlo (pantalla en Ajustes + función en Supabase que borre el usuario y sus datos). También lo pide Google Play.
4. **Uso de los datos de Salud** (norma 5.1.3): no usarlos para publicidad ni cederlos a terceros, no guardarlos en iCloud, no escribir datos falsos en Salud. Kuova cumple (solo lee y guarda en Supabase, UE). La política de privacidad debe decir qué datos de Salud se leen y para qué: añádelo al revisarla con el abogado.
5. **Etiqueta de privacidad** en App Store Connect: declarar «Salud y forma física», «Información de salud», email, fotos, etc., vinculados a la identidad, sin seguimiento publicitario.
6. **Pagos**: los análisis en laboratorio son un servicio que se consume fuera de la app, así que se pueden cobrar con tarjeta (norma 3.1.3(e)). Pero si una suscripción desbloquea funciones **dentro** de la app (por ejemplo, leer informes), Apple puede exigir compra dentro de la app. Lo más seguro para la primera versión: en iPhone no vender nada dentro de la app (se compra en la web y en la app solo se entra con la cuenta). Esto es decisión de negocio: llévala a Curro.
7. ~~**Audio en segundo plano**~~: hecho el 21/10 (`enableBackgroundPlayback: false`; ni iPhone ni Android lo usaban). La próxima APK tampoco declara el servicio en primer plano de audio.
8. **Capturas** de iPhone de 6,9" (1320 × 2868) y textos de la ficha en español.
9. **Si un día se añade inicio de sesión con Google**, Apple obliga a ofrecer también «Iniciar sesión con Apple» (norma 4.8). Hoy solo hay email: no hace falta.

## 5. Cosas que conviene saber de Apple Salud

- **Permisos invisibles**: por privacidad, Salud no le dice a la app qué tipos le has dejado leer. La app solo sabe que ya se enseñó la pantalla de permisos; lo que no llega sale «Sin datos» con una pista para revisarlo.
- **La VFC de Apple es SDNN**, no RMSSD como en Health Connect, Oura, Garmin o WHOOP. Se guarda en la misma métrica (`hrv`) porque cada persona se compara consigo misma, pero con `raw_type_id = 'HeartRateVariabilitySDNN'`. Cualquier umbral absoluto de VFC debe mirar ese campo.
- **Relojes y anillos que no son de Apple** (Oura, Garmin, WHOOP, Huawei, Fitbit, Withings, Polar…) escriben en Salud desde su app si el usuario lo activa. Kuova los lee a través de Salud, sin conexión directa con cada marca.
- **Huawei en iPhone**: Huawei Health escribe en Salud pasos, pulso, entrenos, peso y sueño, pero según la documentación de terceros el sueño llega como duración total, sin fases. Para el fundador (reloj Huawei), con iPhone se tendría sueño y pulso sin esperar a Huawei. Hay que comprobarlo en un iPhone real.
- **Sincronización en segundo plano** (que lleguen datos sin abrir la app): HealthKit lo permite («background delivery»), pero pide otro permiso y código nativo. Queda para después: hoy sincroniza al abrir Hoy.
- **Historias clínicas de Salud** (análisis de hospitales en FHIR): solo existen en EE. UU., Reino Unido y Canadá. En España no sirven para importar analíticas.

## 6. Probar sin iPhone

- **Simulador de iPhone en el navegador (Appetize.io)**: EAS compila una versión para el simulador de iPhone con el perfil `simulator` de `eas.json` (desde el 23/10; canal `preview`, así que también recibe los `npm run release`). Esa compilación no va firmada, así que **no necesita la cuenta de Apple Developer**. El `.tar.gz` que sale (lleva dentro el `.app`) se sube tal cual a Appetize.io, que lo abre en el navegador en un simulador que corre en sus Mac. Plan gratis: 30 minutos al mes, en sesiones de 3 minutos; el de pago más barato, 59 $ al mes.

  ```bash
  npx eas-cli@latest build --platform ios --profile simulator
  ```

  Solo hace falta otra compilación de simulador si cambia el código nativo, igual que con la APK.
  - Sirve para: pantallas en iPhone (DateTimeSheet, teclado, márgenes), la hoja de permisos de Salud y leer datos metidos a mano en la app Salud del simulador. No está comprobado que la hoja de permisos funcione dentro de Appetize: es lo primero que hay que mirar.
  - No sirve para: datos de un Apple Watch o de un reloj Huawei, fases de sueño reales, TestFlight ni ver cómo va en un móvil de verdad.
- **Mac en la nube** (alquiler por horas): Xcode y el simulador completos, más cómodo que Appetize para sesiones largas. Es de pago y algunos proveedores cobran un mínimo de 24 horas.
- **Máquina virtual de macOS en el PC**: no. La licencia de macOS solo permite virtualizarlo en ordenadores de Apple y en Windows funciona mal.
- **Expo Go**: no lee Salud (ver arriba).
- **Un iPhone de segunda mano**: es la única prueba completa, sobre todo para ver qué escribe en Salud el reloj Huawei.

## 7. Siguiente paso técnico recomendado

1. Compilación de TestFlight y prueba en tu iPhone (punto 3).
2. «Borrar mi cuenta» en la app (punto 4.3), que vale para iPhone y para Google Play.
3. Leer también peso, VO2 máx., tensión y glucosa de Salud (la APK de Android ya declara esos permisos; en iPhone basta con añadirlos a `TO_READ` en `appleHealth.ios.ts` y leerlos, sin compilar otra vez).

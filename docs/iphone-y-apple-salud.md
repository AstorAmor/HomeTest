# Kuova en iPhone y Apple Salud: qué está hecho y qué falta

Actualizado: 2026-10-19

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

Librería: `@kingstinct/react-native-healthkit` 16.2 + `react-native-nitro-modules` 0.37.

**No está probado en un iPhone real**: no se puede hasta tener la primera compilación (punto 3).

## 2. Lo que tienes que hacer tú (cuentas y decisiones)

1. **Cuenta de Apple Developer** (99 € al año): developer.apple.com/programs/enroll, con tu Apple ID con verificación en dos pasos.
   - **Como organización** (Pulse Health, S.L.) necesita el número D-U-N-S, y para eso la sociedad tiene que estar constituida. En la App Store saldría «Pulse Health, S.L.» como vendedor.
   - **Como particular** se puede hoy, pero en la App Store aparecería tu nombre como vendedor. Sirve para TestFlight (pruebas con amigos) sin publicar nada. Más adelante se puede pasar la cuenta a organización (con el D-U-N-S) o transferir la app a la cuenta de la empresa.
   - Recomendación: particular ahora para TestFlight; organización antes de publicar en la App Store.
2. **Confirmar el identificador** `com.kuovahealth.app`. No se puede cambiar una vez creada la app en App Store Connect. Si prefieres otro, se cambia en `app.json` antes de la primera compilación.
3. **Crear la app en App Store Connect** (Apps → + → Nueva app): nombre «Kuova», idioma principal español, el identificador de arriba.

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

- Sube la compilación a App Store Connect. A los 10-30 minutos sale en TestFlight.
- En App Store Connect → TestFlight: añade tu Apple ID como **probador interno** y instala la app **TestFlight** en el iPhone. Los probadores internos (hasta 100, de tu equipo en App Store Connect) no necesitan revisión de Apple; los **externos** (amigos con un enlace) sí, una revisión ligera la primera vez.

Prueba en el iPhone: Más → Wearables → **Conectar Apple Salud** → acepta todo → mira «Qué llega (últimos 30 días)» → abre Hoy y Mis datos. Si un tipo sale «Sin datos», revisa Salud → tu foto → Apps → Kuova.

Después, cada `npm run release` llega también al iPhone (mismo canal `preview`). Solo hace falta otra compilación de iPhone si se añade código nativo, igual que con la APK.

## 4. Antes de publicar en la App Store (bloquean la revisión)

1. **Borrar la cuenta desde la app** (norma 5.1.1(v): si la app permite crear cuenta, tiene que permitir borrarla dentro de la app). **Hoy no existe**: hay que hacerlo (pantalla en Ajustes + función en Supabase que borre el usuario y sus datos). También lo pide Google Play.
2. **Uso de los datos de Salud** (norma 5.1.3): no usarlos para publicidad ni cederlos a terceros, no guardarlos en iCloud, no escribir datos falsos en Salud. Kuova cumple (solo lee y guarda en Supabase, UE). La política de privacidad debe decir qué datos de Salud se leen y para qué: añádelo al revisarla con el abogado.
3. **Etiqueta de privacidad** en App Store Connect: declarar «Salud y forma física», «Información de salud», email, fotos, etc., vinculados a la identidad, sin seguimiento publicitario.
4. **Pagos**: los análisis en laboratorio son un servicio que se consume fuera de la app, así que se pueden cobrar con tarjeta (norma 3.1.3(e)). Pero si una suscripción desbloquea funciones **dentro** de la app (por ejemplo, leer informes), Apple puede exigir compra dentro de la app. Lo más seguro para la primera versión: en iPhone no vender nada dentro de la app (se compra en la web y en la app solo se entra con la cuenta). Esto es decisión de negocio: llévala a Curro.
5. **Audio en segundo plano**: `expo-audio` declara reproducción en segundo plano. Si la app no la necesita en iPhone, Apple puede preguntar o rechazar; se quita con `enableBackgroundPlayback: false` en el plugin (comprobar que Android no lo necesita antes).
6. **Capturas** de iPhone de 6,9" (1320 × 2868) y textos de la ficha en español.
7. **Si un día se añade inicio de sesión con Google**, Apple obliga a ofrecer también «Iniciar sesión con Apple» (norma 4.8). Hoy solo hay email: no hace falta.

## 5. Cosas que conviene saber de Apple Salud

- **Permisos invisibles**: por privacidad, Salud no le dice a la app qué tipos le has dejado leer. La app solo sabe que ya se enseñó la pantalla de permisos; lo que no llega sale «Sin datos» con una pista para revisarlo.
- **La VFC de Apple es SDNN**, no RMSSD como en Health Connect, Oura, Garmin o WHOOP. Se guarda en la misma métrica (`hrv`) porque cada persona se compara consigo misma, pero con `raw_type_id = 'HeartRateVariabilitySDNN'`. Cualquier umbral absoluto de VFC debe mirar ese campo.
- **Relojes y anillos que no son de Apple** (Oura, Garmin, WHOOP, Huawei, Fitbit, Withings, Polar…) escriben en Salud desde su app si el usuario lo activa. Kuova los lee a través de Salud, sin conexión directa con cada marca.
- **Huawei en iPhone**: Huawei Health escribe en Salud pasos, pulso, entrenos, peso y sueño, pero según la documentación de terceros el sueño llega como duración total, sin fases. Para el fundador (reloj Huawei), con iPhone se tendría sueño y pulso sin esperar a Huawei. Hay que comprobarlo en un iPhone real.
- **Sincronización en segundo plano** (que lleguen datos sin abrir la app): HealthKit lo permite («background delivery»), pero pide otro permiso y código nativo. Queda para después: hoy sincroniza al abrir Hoy.
- **Historias clínicas de Salud** (análisis de hospitales en FHIR): solo existen en EE. UU., Reino Unido y Canadá. En España no sirven para importar analíticas.

## 6. Siguiente paso técnico recomendado

1. Compilación de TestFlight y prueba en tu iPhone (punto 3).
2. «Borrar mi cuenta» en la app (punto 4.1), que vale para iPhone y para Google Play.
3. Leer también peso, VO2 máx., tensión y glucosa de Salud (la APK de Android ya declara esos permisos; en iPhone basta con añadirlos a `TO_READ` en `appleHealth.ios.ts` y leerlos, sin compilar otra vez).

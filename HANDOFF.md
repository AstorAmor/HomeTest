# HomeTest — Estado del proyecto (traspaso de contexto)

Documento de continuidad para retomar el trabajo en una conversación nueva.
Última actualización: 2026-09-22.

## Qué es esto

App móvil de tests médicos a domicilio (Expo + React Native + TypeScript,
Expo Router). Repo: `C:\Users\Astor\proyectos\HomeTest`, en GitHub en
`https://github.com/AstorAmor/HomeTest` (rama `master`).

Documento de spec original (visión de producto, fases, stack): busca
`MVP_spec_claude_code.md` en el proyecto de Claude "APP e idea de negocio".
Ese documento define las fases 0/1/2 y el stack decidido; este HANDOFF
documenta el estado *real* de la implementación, que ha avanzado bastante
más rápido que el plan de fases original.

## Cómo arrancar para seguir trabajando

**Nota para la IA que retome esto**: si el usuario pide continuar con
la app, arranca el servidor tú mismo en segundo plano nada más
empezar, sin esperar a que te lo pida — es el primer paso obligatorio
de cualquier sesión de trabajo aquí:

```powershell
cd C:\Users\Astor\proyectos\HomeTest
npx expo start
```

Si da error de puerto ocupado, mata procesos node
(`taskkill /F /IM node.exe`) y reintenta. Una vez arrancado, el único
paso que le queda al usuario es abrir Expo Go en su móvil y escanear
el QR (o reabrir la app si ya la tenía conectada) — eso no se puede
automatizar desde aquí.

## Arquitectura actual — importante entenderlo bien

- **La mayoría de datos viven en AsyncStorage, local al dispositivo.**
  NO hay Supabase ni backend compartido todavía. Cada entrada (glucosa,
  tensión, colesterol, cortisol, ciclo) se guarda vía un repositorio
  genérico (`src/data/metricRepository.ts`) — mismo patrón para todos,
  fácil de migrar a Supabase después sin tocar la UI.
- **Hay un backend real montado, pero solo para IA/cómputo, no para
  datos**: rutas API de Expo Router (`src/app/api/*+api.ts`) que
  corren en Node y llaman a servicios externos, manteniendo las claves
  fuera del móvil:
  - `extract+api.ts` — Gemini, extrae datos de analíticas (PDF/foto)
  - `extract-bp+api.ts` — Gemini, lee pantallas de tensiómetro
  - `predict-cycle+api.ts` — llama a un script Python en **Windmill**
- **Windmill está funcionando pero NO está "cerrado" ni garantizado
  activo.** Depende de que Docker Desktop esté corriendo en esta
  máquina. Ver sección dedicada abajo antes de asumir que funciona.

## ⚠️ Windmill — estado real, léelo antes de dar nada por hecho

- Ya existía un `docker-compose.yml` de Windmill en `C:\Users\Astor\`
  (de una sesión anterior), gestionado con Docker Desktop.
- En esta sesión: arrancó Docker Desktop, los contenedores de Windmill
  ya estaban definidos y se levantaron. Se creó un workspace nuevo
  `hometest`, un token de API, y se subió un script
  (`windmill/u/admin/predict_cycle.py` en este repo) a la ruta
  `u/admin/predict_cycle` en Windmill.
- Se probó con `curl` contra
  `http://localhost/api/w/hometest/jobs/run_wait_result/p/u/admin/predict_cycle`
  y respondió correctamente.
- **Antes de continuar en la próxima sesión**: comprobar que Docker
  Desktop sigue corriendo (`docker ps` debería listar contenedores
  `astor-windmill_*`). Si no están, el usuario tiene que abrir Docker
  Desktop manualmente (no se puede lanzar de forma fiable desde este
  entorno de terminal). Windmill web UI: `http://localhost`.
- Las credenciales de conexión (URL, workspace, token) están en
  `.env.local` (no versionado) como `WINDMILL_URL`, `WINDMILL_WORKSPACE`,
  `WINDMILL_TOKEN`. El CLI (`windmill-cli` via npx) ya tiene el
  workspace `hometest` registrado localmente.
- **No hay ninguna garantía de que Docker/Windmill arranquen solos** al
  reiniciar el ordenador — si el usuario reinicia, hay que volver a
  abrir Docker Desktop a mano.

## Funcionalidades construidas (todas probadas en el móvil)

### Navegación principal
4 tabs con pager nativo (deslizar funciona, no solo tocar):
**Today · My Data · Lab · More**. Dark theme en toda la app.

### Login
Mock — cualquier email/contraseña funciona. Sin backend de auth real
todavía.

### Lab — analíticas de sangre por IA
- Subir PDF/foto(s) de una analítica → Gemini extrae los datos
  estructurados (secciones, parámetros, valores, rangos)
- Soporta informes multi-página (fotos múltiples, procesadas por lotes
  para no saturar la API)
- Tabla de resultados: conversión de unidades (glucosa, colesterol,
  creatinina...), estado de rango (en rango/por encima/por debajo),
  exponentes en superíndice real, edición inline por parámetro (lápiz),
  info expandible (dummy, pendiente de contenido médico real)
- Reintentos automáticos si Gemini da 429 (límite de peticiones)

### Tensiómetro (Blood Pressure)
- 4 formas de entrada: foto, galería, archivo, manual
- Si es foto: Gemini lee la pantalla LCD y rellena sistólica/diastólica/
  pulso automáticamente (editable antes de guardar)
- Histórico editable, gráfica con banda sistólica/diastólica + pulso,
  selector de rango D/M/3M/6M

### Métricas simples (Glucosa, Colesterol, Cortisol)
Mismo patrón genérico (`SimpleMetricDetailScreen` /
`LogSimpleMetricScreen`, parametrizados): registro manual con fecha/
hora editable, histórico editable, gráfica de línea simple.
Glucosa además tiene teclado numérico tipo calculadora y selector de
"Meal Time" (Breakfast/Lunch/Dinner/Unspecified).

### Ciclo menstrual
- Registro de fecha de inicio de periodo, histórico editable
- Predicción vía **Windmill (Python)**: mediana de los últimos 6
  ciclos + ventana de incertidumbre (desv. estándar, acotada 2-7 días),
  aviso de "N días de retraso", nivel de confianza según nº de ciclos
  registrados
- **Pendiente de decidir**: el usuario dijo que le gusta pero no quiere
  que viva dentro de "My Data" — falta decidir dónde (¿tab propia?,
  ¿dentro de More?, ¿otra cosa?). No se ha movido todavía.
- Está pensado desde el principio para poder migrar a un modelo de ML
  poblacional (tipo Flo) más adelante — ver sección siguiente.

### Today / My Data — datos reales vs. mock
`src/utils/liveBiomarkers.ts` sustituye los biomarcadores mock por la
última medición real guardada (Sugar, Blood Pressure, Total
Cholesterol, Cortisol), con fallback a mock si el usuario no ha
registrado nada todavía. Los mini-gráficos de "Blood tests" en My Data
también usan datos reales cuando existen.

### Carga de datos de prueba (dev)
Botón "Load dummy data (dev)" en My Data. Lee JSON editables a mano en
`src/data/seed/*.json` (glucosa, tensión, colesterol, cortisol, ciclo)
y los vuelca en AsyncStorage vía los repositorios reales — sirve para
probar la UI sin registrar todo manualmente.

### Idioma
Todo el texto de interfaz está en inglés (se hizo una pasada completa
de traducción). El contenido *extraído* de documentos reales (secciones
de analíticas) se deja en el idioma del documento original a propósito
— no se traduce.

### AI Diary log (pantalla Today) — añadido 2026-09-22/24
- Componente `src/components/AiLogModule.tsx`, título "AI Diary log" fuera de la tarjeta en `TodayScreen.tsx`.
- Rueda de 4 cuadrantes (Anxious/Happy/Sad/Calm = energía alta/baja × ánimo negativo/positivo) + barra vertical de energía 0-100 (icono run arriba, sleep abajo). Tipos en `src/types/aiLog.ts`.
- Nota opcional por texto (lápiz) o audio (micro, `expo-audio`, funciona en Expo Go). Botón Log → `POST /api/extract-ai-log` (Gemini, acepta audio inline) → devuelve `{transcript, summary, tags}` → se guarda en AsyncStorage (`aiLogRepository`).
- Layout final calibrado a mano por el usuario: rueda 212px, barra desplazada (-33, 5); fila inferior con Log a la izquierda y lápiz+micro a la derecha. Todo el texto en inglés.
- Pendiente: la sección "Daily readiness" (sueño/calorías/pasos con anillos, estilo Google) del mockup NO está hecha; iría con Health Connect (requiere dev client, se decidió posponerlo y usar datos dummy primero).

### Lab Report Wow Prototype — añadido 2026-09-26 (rama `feature/lab-report-wow-prototype`)

Prototipo visual de la pantalla de informe de laboratorio + plan personalizado,
construido siguiendo `PROMPT_CLAUDE_CODE_lab_report_wow.md` (research prompt
previo, esquema `HomeTestReport` ya decidido). Sobre datos dummy fijos, sin
backend ni lógica real de negocio — es UI de alto impacto visual, no el motor
de reglas real (eso vive aparte, en la rama `feature/recommendation-engine-skeleton`,
todavía no mezclada con esta).

- **Datos**: los 4 JSON dummy en `src/data/seed/hometest/` (informe baseline,
  informe actual, perfil de usuario, serie temporal de wearable), cargados
  como imports estáticos en `src/data/reportRepository.ts` — sin AsyncStorage,
  es solo para este prototipo.
- **Flujo de pantallas**: `/report-intro` (landing "Your report is here!") →
  `/report-summary` (donuts de resumen + PhenoAge + lista de marcadores a
  revisar) → `/report-marker-detail?markerId=...` (detalle tappable) →
  `/report-plan` (hábitos antes/después + tendencia 6 meses + action plan con
  proyección) → `/talk-to-specialist` (UI sin backend). Entrada desde Today
  vía una tarjeta nueva ("Your report is here!").
- **Componentes nuevos**: `DonutChart.tsx` y `ProjectionChart.tsx` (SVG puro,
  sin librería de gráficos nueva, mismo patrón que `SimpleMetricChart.tsx`/
  `Sparkline.tsx` ya existentes).
- **Importante — capa de traducción**: los JSON dummy tienen el contenido de
  texto (títulos, why/how del plan, explicación de PhenoAge, nombres de
  marcador) en español a propósito, como placeholders. Todo lo que ve el
  usuario debe estar en inglés, así que **no se renderizan esos campos
  directamente** — hay una capa de traducción manual en
  `src/data/reportContentEn.ts` (y `src/data/markerExplanations.ts` para las
  explicaciones de marcador) que Claude Code generó como copy final. Si se
  reemplazan los JSON dummy por datos reales/generados por LLM, revisar si
  esa capa de traducción sigue haciendo falta o si el contenido ya viene en
  inglés.
- **Bug real encontrado y arreglado**: con `app.json` → `web.output: "server"`,
  `Dimensions.get('window').width` evaluado a nivel de módulo (patrón que ya
  tenía `SimpleMetricChart.tsx`) devuelve `0` durante el render en servidor,
  lo que producía un ancho de SVG negativo y rompía el gráfico (y el scroll
  de la pantalla) en la primera carga. Arreglado en `SimpleMetricChart.tsx` y
  en el nuevo `ProjectionChart.tsx` usando `useWindowDimensions()` (reactivo)
  en vez del `Dimensions.get()` estático. Si aparecen más gráficos SVG en el
  futuro, usar `useWindowDimensions()` desde el principio.
- **Decisiones de implementación tomadas sin preguntar** (per instrucciones
  del prompt): no existía la sección "More → Goals" que el prompt daba por
  hecha — se lee `primary_goal` directamente del fixture de perfil en vez de
  rehacer onboarding. El donut por categoría solo se muestra para las
  categorías con algún marcador fuera de "en_rango" (5 de 19), no las 19.
  El indicador "N marcadores mejoraron" cuenta `trend.significant && flag
  === 'en_rango'` como proxy de mejora — no hay (todavía) una tabla de qué
  dirección es clínicamente buena por marcador para algo más preciso.
- **Pendiente / no implementado a propósito**: sin tests (el prompt pedía UI,
  no lógica); `.expo/types/router.d.ts` se regenera solo al arrancar
  `npx expo start` (está en `.gitignore`, no hace falta tocarlo a mano salvo
  para verificar tipos sin arrancar el server).

## Decisión pendiente y con implicaciones de arquitectura: "aprendizaje" tipo Flo

El usuario preguntó si se puede montar la plataforma para que aprenda
de los datos de todas las usuarias (como Flo) para mejorar las
predicciones de ciclo. Conclusiones ya habladas, no implementadas:

1. Requiere backend centralizado real (Supabase), no AsyncStorage local.
2. Requiere **consentimiento explícito opt-in** por usuaria para ese uso
   secundario de datos de salud (categoría especial RGPD) — añadir un
   campo tipo `consiente_uso_agregado: boolean` en el perfil de usuaria
   **desde ya**, aunque no se use todavía, para no tener que rehacer
   histórico de consentimiento después.
3. El esquema de base de datos en sí no necesita nada especial (tablas
   relacionales normales bastan); Windmill (Python) es el sitio natural
   para correr el entrenamiento/inferencia más adelante.
4. Con pocas usuarias no hay nada que aprender de forma fiable — esto
   es features para cuando haya escala, no para el MVP.

## Otras decisiones/contexto relevante

- **Dominio web**: no hace falta pagarlo para desarrollar. Se puede
  construir local y desplegar gratis (Vercel/Netlify/Cloudflare Pages)
  antes de comprar un dominio propio.
- **Coste Supabase/Windmill**: ambos tienen capa gratuita real para
  arrancar (Supabase: $0, pausa tras 1 semana inactivo, sin backups;
  Windmill self-hosted: gratis, solo se paga la VPS si se despliega
  fuera de local).
- **Web futura compartiendo datos con la app**: tendría que esperar a
  que exista Supabase (Fase 1) — ahora mismo no hay nada que compartir
  porque todo es local al dispositivo.
- **API keys usadas**: Gemini (`GEMINI_API_KEY`, elegido por precio) —
  todas en `.env.local`, nunca commiteadas (`.gitignore` ya las cubre
  con el patrón `.env*.local`).

## Limpieza pendiente (menor)

- `src/app/explore.tsx` — sobra del scaffold original de Expo, no se usa
  en ningún sitio, se puede borrar cuando se quiera.
- Las imágenes `assets/images/daily-walk.jpg` y `sleep-well.jpg` ya no
  se usan (se quitó la sección "Health Recommendations" de Today a
  petición del usuario) — se pueden borrar.

## Cómo continuar en una conversación nueva

1. Abrir el proyecto en `C:\Users\Astor\proyectos\HomeTest`
2. Leer este archivo primero
3. Comprobar `git log --oneline -10` para ver los últimos commits reales
4. Comprobar si Docker/Windmill siguen corriendo antes de asumir que
   la funcionalidad de ciclo menstrual funciona
5. Primera decisión pendiente del usuario: dónde vive la sección de
   ciclo menstrual si no es en "My Data"

## Wearables — añadido 2026-09-26 (rama `feature/wearables`, sin commit)

Decisión: sin agregador de pago. Huawei por conexión directa (cuenta de desarrollador
individual solicitada; pulso y sueño están reservados a empresas, se pedirán cuando exista
la SL) y Health Connect para Xiaomi, Garmin, Oura, Samsung y Google. Apple HealthKit, más adelante.
Contexto completo: documento de diseño, sección 5, en el proyecto de Claude (`Diseno_inteligencia_informe.md`).

- **Capa anti-dependencia de proveedor**: `src/wearables/types.ts` (formato propio,
  `DailyWearableRecord`) y `src/wearables/wearableRepository.ts` (AsyncStorage). Ninguna
  pantalla lee formatos de proveedor; cada proveedor es un adaptador en `src/wearables/providers/`.
- `providers/huaweiDummy.ts`: 14 días deterministas de pasos, pulso en reposo, VFC y sueño;
  los 3 últimos días simulan una mala racha para probar las reglas sangre × wearable.
- `providers/healthConnect.ts`: lee Steps, RestingHeartRate, HeartRateVariabilityRmssd y
  SleepSession, resume por día y marca de origen (dataOrigin → nombre).
- Pantalla `/wearables` (More → Wearables).
- `app.json`: plugins `react-native-health-connect` y `expo-build-properties` (SDK 36, min 26)
  y permisos `android.permission.health.READ_*`. `package.json`: añadidos
  `react-native-health-connect`, `expo-dev-client`, `expo-build-properties`.
- **Pendiente**: `npm install` en Windows; Health Connect NO funciona en Expo Go, requiere
  `eas build --profile development --platform android` e instalar ese APK. El adaptador real de
  Huawei Health Kit (OAuth en la nube) cuando la cuenta de desarrollador esté aprobada.

## Prototipo v2 (notas del 26/09) — añadido 2026-09-27 (misma rama `feature/wearables`, sin commit)

Implementa las notas manuscritas del 26/09 (`Fase0/20260927_transcripcion_prototipo.docx`). Todo el
texto de UI en inglés; datos de ejemplo marcados como "sample" cuando no hay datos reales.

- **Selector "developer" tras el login** (`DevModeSelectScreen`, `demoMode` en `AuthContext`):
  nuevo usuario → `/onboarding`; usuario con resultados → `/results-ready` (rayo + GREAT JOB!! + confeti
  → informe); habitual → Today. Settings (logout) vuelve al selector.
- **Onboarding** (`OnboardingScreen`): fecha de nacimiento, altura y peso con rueda tipo candado
  (`components/WheelPicker.tsx`), sexo, hábitos y objetivos; "Skip" en cualquier momento. Al terminar,
  insignia "Plan builder" + confeti. Se guarda en `data/profileRepository.ts` (AsyncStorage).
- **Login**: fondo de nubes cósmicas discreto (`components/CosmicBackground.tsx`).
- **Today**: check-in (`/check-in`: primero el momento del día, luego preguntas adaptadas, nota
  opcional y sugerencias SIEMPRE opcionales; `data/checkInRepository.ts`); gráfico diario de energía y
  ánimo; barra de fase del ciclo solo si el perfil es mujer (`utils/cyclePhase.ts`); daily readiness
  (anillo grande + pasos/calorías/sueño, `wearables/dailySeries.ts`, fórmula simple pendiente de validar
  con el médico); biomarcadores Sugar, BP, Resting HR, HRV, Temperature; "Your plan" dummy editable en
  `data/planRepository.ts` (`CURRENT_PLAN`) con registro de entreno (`/log-workout`) y foto de comida
  gamificada (`/log-meal`, puntos + racha; las fotos quedan guardadas para un futuro dataset).
  `AiLogModule` ya no se usa en Today (se conserva el fichero).
- **My Data**: gráficas nuevas (`components/TrendChart.tsx`) para wearables (HR, HRV, sueño, pasos,
  calorías), tensión con 2 líneas, temperatura y análisis; "Your tests"; sin botones "Log…" (se registra
  entrando en cada indicador; BP detail tiene ahora su botón); botón de ciclo en rosa claro.
- **Lab**: "Upcoming analysis" abre detalle con marcadores, preparación y "Reschedule or cancel";
  "Lab results" abre el informe (el actual → report-summary; el anterior → `/lab-report`).
- **More**: My Profile (`/profile`), Professionals con catálogo y reserva dummy (`/professionals`,
  `data/servicesMock.ts`), Track your tests con transportista y línea de tiempo (`/track-tests`).
- **Wearables**: añadidas métricas `body_temperature` y calorías activas al dummy de Huawei.
- **Transiciones**: `_layout.tsx` usa `ios_from_right` para todas las pantallas (atrás = espejo de
  adelante) y `slide_from_bottom` para los modales; `contentStyle` oscuro evita destellos. Esto también
  elimina los 3 errores de tsc por `animationEnabled`.
- **Pendiente (decisión del usuario)**: que la app funcione sin el ordenador encendido. Propuesta:
  APK `eas build --profile preview` + rutas API en EAS Hosting (`eas deploy`) con la clave de Gemini
  como variable de entorno; Windmill seguiría siendo local.
- Nota: con `expo-dev-client` instalado, `npx expo start` abre por defecto el development build; para
  Expo Go usar `npx expo start --go` (o pulsar `s` en la terminal de Expo).

## Probar en el móvil sin el ordenador (EAS Update + Expo Go) — 2026-09-27

- `runtimeVersion` usa la política `sdkVersion` (`exposdk:57.0.0`) para que Expo Go acepte las
  actualizaciones. Publicar tras cada cambio:
  `npx eas-cli update --channel preview --environment preview --message "..." --non-interactive`
- Abrir en Expo Go (QR): https://qr.expo.dev/eas-update?projectId=e88f66c2-4fae-44aa-a3b6-1812c06dcd15&runtimeVersion=exposdk:57.0.0&channel=preview
  (enlace directo: `exp://u.expo.dev/e88f66c2-4fae-44aa-a3b6-1812c06dcd15?runtime-version=exposdk%3A57.0.0&channel-name=preview`).
- Limitación: las rutas API (Gemini: leer analíticas y tensiómetro; Windmill: predicción del ciclo)
  NO funcionan así, porque no hay servidor. Para eso hace falta desplegarlas (EAS Hosting) y apuntar
  `getApiBaseUrl()` a esa URL. Pendiente de decisión del usuario.
- Transiciones "atrás": las pantallas recargan datos al recuperar el foco solo cuando termina la
  animación (`hooks/useReloadOnFocus.ts`) y no re-renderizan si los datos no cambian.
- **APK (2026-09-27)**: `npx eas-cli build --platform android --profile preview` → build
  c2ac2e70 (canal `preview`, nombre visible "HomeTest"). La APK recibe las `eas update --channel preview`
  sin reinstalar. Health Connect funciona en la APK (no en Expo Go). Las rutas API siguen sin servidor.

## Supabase (backend real) — 2026-09-28, rama `feature/supabase`

Proyecto `HomeTest00` (ref `jpqtposdxexdvdfeorzh`, eu-central-1, plan gratuito). CLI vinculada
(`npx supabase link`). Sin Docker: las migraciones y funciones se aplican directamente al remoto.

- **Esquema** (`supabase/migrations/`): tablas por dominio (profiles, glucose_readings,
  blood_pressure_readings, metric_readings, cycle_starts, check_ins, ai_logs, workouts, meals,
  wearable_daily, lab_reports) con RLS "cada usuario solo lo suyo". `profiles.consent_aggregate_use`
  (opt-in uso agregado) existe desde el día 1. Buckets privados `meal-photos` (≤1 MB, jpeg) y
  `lab-files` (≤10 MB), carpeta por usuario.
- **Compartir con profesionales** (requisito crítico del usuario): `professionals` (verificados solo
  por HomeTest; `verified_at` no escribible desde la app) y `data_shares` (paciente → profesional,
  `scopes` por categoría, caducidad, revocable, nunca se borra = registro de consentimiento). RLS de
  solo lectura para el profesional vía `has_share()`. `my_shared_patients()` da al profesional su lista.
  Pendiente: pantallas en la app para gestionar permisos y vista del profesional.
- **Tests de seguridad**: `supabase/tests/database/rls_sharing.test.sql` (20 comprobaciones, todas OK
  el 2026-09-28). Sin Docker se ejecutan con `db query --linked` envolviendo el resultado en un
  error final (rollback garantizado); con Docker: `npx supabase test db --linked`.
- **Edge Functions** (`supabase/functions/`): extract, extract-bp, extract-ai-log, predict-cycle.
  Exigen sesión (401 sin ella). Prompts, cliente Gemini y predicción del ciclo en `_shared/`, usados
  también por las rutas API locales (modo demo). Windmill ya no hace falta.
  Desplegar: `npx supabase functions deploy --use-api`. Secreto necesario: `GEMINI_API_KEY`
  (`npx supabase secrets set GEMINI_API_KEY=...`, lo pone el usuario).
- **App**: `src/lib/supabase.ts`. Con `EXPO_PUBLIC_SUPABASE_URL` + `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
  (en `.env.local` y como variables de EAS en development/preview/production) usa login real y guarda
  en la nube; sin ellas, modo demo (login simulado + AsyncStorage). Los repositorios deciden solos
  (`createMetricRepository(storageKey, remoteTable)`) y filtran siempre por el propio `user_id`.
  IA vía `postAi()` en `utils/apiBaseUrl.ts`. Botón dev en My Data para subir datos locales a la cuenta.
- Fotos de comida comprimidas a 1080 px / JPEG 55 % (`compressPhoto`) antes de guardarlas.
- Límites del plan gratuito: 500 MB BD, 1 GB storage, pausa tras 7 días sin uso, sin backups. Antes
  de datos reales de pacientes: plan de pago + contrato de encargado de tratamiento (RGPD).

### Profesionales, admin e interoperabilidad — 2026-09-28 (tarde)

- **LOINC/UCUM**: `knowledge/mapping/standard-codes.json` (107 de 118 biomarcadores + métricas de la app,
  cada código validado contra tx.fhir.org con su nombre oficial; 11 pendientes documentados con el motivo,
  p. ej. omega-3 depende del método del laboratorio). Acceso: `src/knowledge/standardCodes.ts`. Se ven en
  More → Biomarker Catalog. Siguiente: exportación HL7 FHIR (Patient/Observation/DiagnosticReport).
- **Cuentas de profesional**: registro con "I'm a healthcare professional"; ficha en `/pro-profile` (foto
  comprimida a 512 px en bucket público `professional-photos`, nº colegiado, colegio, ciudad, idiomas,
  modalidades, años, bio, tarifa PROPUESTA). Migración `..._professional_profiles_admin.sql`: privilegios
  por columna (pacientes no ven tarifa propuesta ni notas), trigger que devuelve la tarifa a revisión.
- **Admin**: tabla `admins` (sin acceso desde la app; alta por SQL), RPCs `is_admin`,
  `admin_list_professionals`, `admin_review_professional`. Pantalla `/admin` (More → Professionals review,
  solo visible para admins): verificar profesionales y aprobar/rechazar tarifas.
- **Compartir**: `/sharing` (More → Sharing & privacy) y `/share-new`; el profesional entra en `/pro`
  (lista de pacientes) y `/pro-patient` (datos compartidos, solo lectura). Interfaz de profesional completa
  (calendario sincronizable Outlook/Google/Yahoo) = siguiente fase.
- Tests RLS: 28/28 OK. El catálogo mock `/professionals` (servicesMock) convive con el directorio real:
  unificar cuando haya profesionales reales.
- **2026-09-28**: el usuario ya tiene **cuenta de desarrollador de Huawei** (antes: solicitada). Siguiente paso
  del adaptador real de Huawei Health Kit: app en AppGallery Connect (paquete `com.astoramor.apptestsmedicos`),
  activar Health Kit, pedir los permisos de datos (pulso/sueño pueden exigir cuenta de empresa), huella SHA-256
  del keystore de EAS y OAuth de Huawei ID; los tokens, en el servidor (Edge Function), no en el móvil.
  Supabase: "Confirm email" desactivado y secreto GEMINI_API_KEY configurado.

## Lote de 18 puntos de la app — 2026-09-28 (commits 31950fe y a00f7fe, rama `feature/supabase`)

- **Saludo con el nombre real** (`UserAvatar.tsx` → `useFirstName()`); avatar con iniciales en modo Supabase.
- **Sexo**: si no es mujer, no hay registro de ciclo ni fase (My Data, Today, ámbito "cycle" al compartir).
- **Ciclo**: `/log-cycle` = "Log period" con calendario (toca inicio y fin); `cycle_starts.ended_at`.
- **Onboarding**: nuevo paso de salud (medicación y enfermedades previas; SOP solo mujer), insignia solo la
  primera vez, y al terminar va a `/plan-intro` (tarjetas a pantalla completa con foto difuminada, why/how).
- **Plan** (`planRepository.buildPlan`): fuerza, pasos, azúcar, sueño y calma según objetivos; fotos por sexo
  (`planImages.ts`). **Las fotos son placeholders**: prompts y medidas en `assets/images/IMAGE_PROMPTS.md`;
  sustituir los JPG en `assets/images/plan/` y `assets/images/specialists/` con el mismo nombre.
- **Insignias** con niveles Bronce→Platino (`achievements.ts`, `BadgesSection.tsx`) bajo "Your plan"; quitadas del perfil.
- **Carrusel "Talk to a specialist"** (`SpecialistCarousel.tsx`): centro grande, lados pequeños y difuminados.
- **Ejercicios guiados** `/exercise?id=` (9, círculo que crece/encoge con la respiración; guarda sesión de calma).
- **Tienda** `/store` (30 pruebas del business case + membresía 365 €, ETS discretas; sin pago) desde Lab.
- **Agenda** `/schedule` (vista mensual + añadir a Google/Outlook/Yahoo por enlace). Sync bidireccional: fase profesional.
- **Gráficas interactivas** (`TrendChart interactive`) y detalle de métrica `/metric?kind=`.
- **Catálogo de biomarcadores en inglés**: 118 con ficha (qué es, por qué importa, qué lo altera, limitaciones) y
  referencia comprobada (MedlinePlus/NIH/DOI). Marcadas `CLINICAL_REVIEW_REQUIRED`: **un médico debe revisarlas**.
- Médico de prueba: cuenta AstorMedico (astor.redes@gmail.com) verificada; el paciente comparte en More → Sharing & privacy.
- Probar sin tocar cuentas reales: servidor `expo-web-demo` (puerto 8082, Supabase vacío → modo demo).

## Pagos (Stripe) y ajustes de tienda — 2026-09-29

- **Tienda**: plan Premium Health (700 €/año: todo lo de la membresía + analítica cada 3 meses + 5 videoconsultas).
  Iconos por test (MaterialCommunityIcons): hormonas hexágono, ♀ solo tests exclusivamente femeninos, corazón en
  cardiovascular/Lp(a), manzana en digestivo y celiaquía.
- **Pago** `/checkout?id=`: la app solo envía el id; el importe lo pone el servidor
  (`supabase/functions/_shared/products.ts`). `npm run check:prices` compara con `src/data/testCatalog.ts`:
  **si cambias un precio, cámbialo en los dos sitios**.
  - Edge Functions: `create-checkout` (crea sesión de Stripe Checkout + pedido `pending`), `checkout-return`
    (redirige a la app; solo esquemas de la app/localhost) y `stripe-webhook` (verifica firma; único que marca `paid`,
    comprueba importe; renovaciones anuales con `invoice.paid`, bajas con `customer.subscription.deleted`).
  - Tabla `orders` (RLS: el usuario solo lee lo suyo; nadie escribe desde la app).
  - **Sin `STRIPE_SECRET_KEY` la app muestra un pago SIMULADO** (no cobra ni crea pedido). Para activarlo:
    1. Cuenta Stripe (modo test primero). 2. `npx supabase secrets set STRIPE_SECRET_KEY=sk_test_...`
    3. En Stripe → Developers → Webhooks: endpoint
       `https://jpqtposdxexdvdfeorzh.supabase.co/functions/v1/stripe-webhook`, eventos `checkout.session.completed`,
       `checkout.session.async_payment_succeeded`, `checkout.session.expired`, `invoice.paid`,
       `customer.subscription.deleted`. 4. `npx supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...`
  - Pendiente antes de cobrar de verdad: sociedad constituida (Stripe va a nombre de la empresa), IVA/facturas
    (servicios sanitarios pueden estar exentos: revisar con la gestoría), condiciones de venta y desistimiento.
- **Especialistas**: el carrusel abre `/professionals?role=` con el filtro; nuevo rol `midwife` (también en BD).
- **Métricas**: 7D / 14D / 1M / 6M (6M en medias semanales). Datos de ejemplo: 6 meses.
- Check-in en una sola pantalla; "Occasionally" en tabaco; fotos del plan sin icono encima.

## Citas en laboratorio — 2026-09-29

- Lab → **Book an appointment** (`/book-lab`): mapa + lista de los 8 centros propios de Eurofins Megalab en Madrid
  (`src/data/labCenters.ts`, datos y horarios de extracciones del buscador oficial, consultado 29/09/2026), día,
  hueco de 15 min, confirmación con "Add to calendar" y "Get directions". Las citas salen en la agenda (tipo `lab`).
- **Prototipo**: la cita se guarda en el móvil (`labAppointments.ts`) y NO llega a Eurofins. Falta acuerdo/API con el lab.
- Mapa `TileMap.tsx` sin módulos nativos (funciona en el APK actual): teselas Esri World Dark Gray sin clave.
  CARTO ahora exige clave y OpenStreetMap bloquea apps. Para producción: cuenta ArcGIS Location Platform (gratis
  con límites) u otro proveedor con clave, o react-native-maps en un APK nuevo.

## Tema claro "Terracota" — 2026-09-29

- Perfil → Appearance: Automatic (sigue al móvil) / Light / Dark. Al cambiar, la app se recarga.
- Cómo funciona: `src/constants/colors.ts` tiene las paletas DARK y LIGHT; `Colors` es mutable y
  `applyTheme()` la rellena. **El punto de entrada es ahora `index.js`** (package.json "main"): aplica el tema
  y DESPUÉS carga expo-router, porque los `StyleSheet.create` de cada pantalla se evalúan al cargar el módulo.
- Colores fijos: usar siempre `Colors.x` o `withAlpha(Colors.x, a)`; nunca hex/rgba sueltos.
  Pantallas inmersivas sobre foto/fondo oscuro (plan-intro, exercise) usan `OnDark` en ambos temas.
- El mapa usa las teselas grises claras u oscuras de Esri según el tema.

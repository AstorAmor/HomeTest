# HomeTest — Estado del proyecto (traspaso de contexto)

Documento de continuidad para retomar el trabajo en una conversación nueva.
Última actualización: 2026-09-22.

## Qué es esto

App móvil de tests médicos a domicilio (Expo + React Native + TypeScript,
Expo Router). Repo: `C:\Users\Astor\proyectos\hometest-app` (carpeta llamada `HomeTest` hasta el 2026-10-05), en GitHub en
`https://github.com/AstorAmor/HomeTest` (rama `master`).

Documento de spec original (visión de producto, fases, stack): busca
`MVP_spec_claude_code.md` en el proyecto de Claude "APP e idea de negocio"
(copias en OneDrive: `2. Entrepreneurship\04 App\MVP_spec_claude_code (versión Fase0|HomeTest).md`).
Ese documento define las fases 0/1/2 y el stack decidido; este HANDOFF
documenta el estado *real* de la implementación, que ha avanzado bastante
más rápido que el plan de fases original.

## Ramas y cómo publicar (desde 2026-10-05)

- **Se trabaja directamente en `master`** (las ramas `feature/*` se juntaron y se borraron). Abrir una rama
  solo para cambios grandes o arriesgados, y juntarla al terminar.
- **Publicar la app**: `npm run release -- "qué cambia"`. Hace EAS Update (canal preview) y publica la web de
  la app y la demo en Vercel. Se niega a publicar si hay cambios sin commitear, si no estás en `master` o si
  `master` no coincide con GitHub: lo publicado siempre es lo que hay en git. `--skip-app` / `--skip-web`
  para publicar solo una parte.
- **Web pública** (`../HomeTest-web`): se publica sola en Vercel con cada `git push` a `master` (conectado el
  2026-10-05; cada rama tiene además su enlace de prueba).

## Cómo arrancar para seguir trabajando

**Nota para la IA que retome esto**: si el usuario pide continuar con
la app, arranca el servidor tú mismo en segundo plano nada más
empezar, sin esperar a que te lo pida — es el primer paso obligatorio
de cualquier sesión de trabajo aquí:

```powershell
cd C:\Users\Astor\proyectos\hometest-app
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

## Motor de recomendaciones (esqueleto) — añadido 2026-09-25

Primer paso del diseño del "cerebro" de la app: qué le dice a la usuaria
sobre sus resultados y qué le recomienda. Construido siguiendo un prompt de
investigación lanzado en paralelo a Claude/ChatGPT/Gemini (research sobre
arquitectura, fórmula de edad biológica, lógica de recomendaciones, ajuste
por ciclo e integración de wearables — comparando cómo lo hacen Function
Health, Lucis, Axon Longevity y Holo.hq). Esta sesión construyó solo lo que
NO depende de esa investigación:

- `src/types/recommendation.ts` — tipos del motor completo (BiomarkerResult,
  RecommendationInput/Output, evidencia trazable por afirmación).
- `src/types/wearable.ts` — interfaz `WearableDataProvider`, sin ninguna
  integración real (Terra API vs HealthKit nativo vs Health Connect: por
  decidir).
- `src/types/cycle.ts` — se le añadió `CyclePhase` ('menstrual' |
  'follicular' | 'ovulation' | 'luteal' | 'none').
- `src/logic/rulesEngine/` — motor determinista, **testeado con Vitest**
  (`npm test`, 25 tests, añadido este mismo día — el repo no tenía ningún
  test runner hasta ahora):
  - `flags.ts` — flag de cada resultado, reutiliza `rangeStatus.ts`.
  - `ratios.ts` — 8 ratios calculados (LDL Friedewald, no-HDL, TC/HDL,
    BUN/Creatinina, Globulina, A/G, % saturación de hierro, HOMA-IR) con
    conversión de unidades propia. **HOMA-IR no tiene canonical_id en el
    catálogo todavía** — hay que añadirlo a `metabolico.json` antes de
    usarlo en producción (ver `TODO_ADD_TO_CATALOG` en el archivo). eGFR,
    testosterona libre, % PSA libre y los ratios de Omega quedan sin
    implementar (fórmulas más complejas, con más riesgo de error).
  - `biologicalAge.ts` — **stub que lanza error a propósito**
    (`BiologicalAgeNotImplementedError`). Candidata más probable: PhenoAge
    (sus 9 inputs ya existen en el catálogo), pendiente de fórmula exacta.
  - `cycleAdjustment.ts` — identifica biomarcadores cycle-sensitive (FSH,
    LH, Estradiol, Prolactina) pero **no ajusta números todavía** — falta
    literatura con cutoffs por fase, y además HomeTest no tiene rangos de
    referencia propios (los rangos hoy vienen del PDF del laboratorio, no
    de `knowledge/`) — ver limitación explicada en el README del módulo.
  - `README.md` — explica todo lo de arriba con más detalle.
- `prompts/` (nueva carpeta en la raíz del repo, no dentro de `src/`) —
  4 plantillas de prompt versionadas en markdown (system prompt, síntesis
  por biomarcador, plan de acción multi-marcador, guardarraíles de
  seguridad), todas con secciones "QUÉ FALTA" explícitas señalando qué
  depende de la investigación externa. Ver `prompts/README.md`.

**Decisión importante de validación médica** (contexto para quien retome
esto): el médico colegiado que se va a contratar validará por
responsabilidad legal y casos de riesgo, **no** hace revisión sistemática
de evidencia científica marcador a marcador — eso lo hace el fundador
directamente (formación en bioingeniería). El diseño de todo esto tiene que
tenerlo en cuenta, no asumir un equipo médico grande revisando cada
`knowledge_card`.

**Próximo paso**: cuando vuelvan las respuestas de la investigación externa,
traerlas a una sesión de Claude Code para (1) decidir y programar la
fórmula de `biologicalAge.ts`, (2) rellenar los 4 prompts de `prompts/` con
contenido real, (3) diseñar el árbol de decisión de
`multi-marker-plan.md` como código (probablemente otro módulo determinista
en `src/logic/rulesEngine/`, no solo texto en el prompt).

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

1. Abrir el proyecto en `C:\Users\Astor\proyectos\hometest-app`
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
Contexto completo: documento de diseño, sección 5, en el proyecto de Claude (`Diseno_inteligencia_informe.md`;
copia en OneDrive: `2. Entrepreneurship\04 App\Diseno_inteligencia_informe (versión HomeTest).md`).

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

Implementa las notas manuscritas del 26/09 (`OneDrive/2. Entrepreneurship/04 App/Prototipo/20260927_transcripcion_prototipo.docx`). Todo el
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

## Pagos (Revolut) y ajustes de tienda — 2026-09-29

- **Tienda**: plan Premium Health (700 €/año: todo lo de la membresía + analítica cada 3 meses + 5 videoconsultas).
  Iconos por test (MaterialCommunityIcons): hormonas hexágono, ♀ solo tests exclusivamente femeninos, corazón en
  cardiovascular/Lp(a), manzana en digestivo y celiaquía.
- **Pago** `/checkout?id=` con **Revolut Merchant API** (antes Stripe; cambiado a petición del fundador). La app solo
  envía el id; el importe lo pone el servidor (`supabase/functions/_shared/products.ts`). `npm run check:prices`
  compara con `src/data/testCatalog.ts`: **si cambias un precio, cámbialo en los dos sitios**.
  - Edge Functions: `create-checkout` (pedido `pending` en `orders` + pedido en Revolut → `checkout_url`),
    `checkout-return` (redirige a la app; solo esquemas de la app/localhost) y `revolut-webhook` (verifica la firma
    HMAC `v1.{timestamp}.{cuerpo}`, vuelve a consultar el pedido en Revolut y comprueba importe; único que marca `paid`).
  - Tabla `orders` (RLS: el usuario solo lee lo suyo; nadie escribe desde la app). Columnas `provider`, `provider_order_id`.
  - Planes anuales: de momento pago único con `current_period_end` = +1 año (sin renovación automática). Para
    renovar solos: Subscriptions API de Revolut.
  - **Sin `REVOLUT_SECRET_KEY` la app muestra un pago SIMULADO** (no cobra ni crea pedido). Para activarlo:
    1. Revolut Business + cuenta de comercio (Merchant). Empezar en **sandbox**.
    2. `npx supabase secrets set REVOLUT_SECRET_KEY=sk_... REVOLUT_ENV=sandbox`
    3. Registrar el webhook (Merchant API `POST /api/webhooks`, url
       `https://jpqtposdxexdvdfeorzh.supabase.co/functions/v1/revolut-webhook`, eventos `ORDER_COMPLETED`,
       `ORDER_CANCELLED`, `ORDER_PAYMENT_FAILED`) y guardar el `signing_secret`:
       `npx supabase secrets set REVOLUT_WEBHOOK_SECRET=wsk_...`
    4. Revisar `API_VERSION` en `_shared/payments.ts` con la documentación vigente. Producción: `REVOLUT_ENV=production`.
  - Pendiente antes de cobrar de verdad: sociedad constituida, IVA/facturas (servicios sanitarios pueden estar
    exentos: revisar con la gestoría), condiciones de venta y desistimiento.
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

## Ajustes 2026-09-29 (tarde)

- **My subscription** (`SubscriptionCard.tsx`) en el perfil y en Lab: plan activo (de `orders` pagados; en demo,
  membresía de ejemplo), renovación, próxima analítica, "Upgrade to Premium" y "Compare plans".
- **Tema**: selector Auto/Light/Dark también en More (arriba). Al cambiar se recarga la app **sin cerrar sesión**:
  el modo demo elegido y el usuario demo se guardan en AsyncStorage (`AuthContext`), y tras recargar se vuelve a
  la misma pantalla (`appearance.returnTo`, `?tab=` en las pestañas).
- **Colores de marcadores**: tokens `Colors.ok` (en rango) y `Colors.attention` (a revisar). En claro: verde oliva y
  naranja, para no confundirse con el terracota del acento.
- **"See full plan"** en Today → `/plans`: plan actual (abre `/report-plan`) y planes anteriores con la evolución
  de sus marcadores (el de marzo es dummy: `src/data/planHistory.ts`).
- `ScreenHeader`: "atrás" sin historial vuelve al inicio (antes daba GO_BACK sin manejar).
- **Full view** (Today → Your plan) abre `/action-plan`: el "Your action plan" del último informe (componente
  `ActionPlanList`, compartido con `/report-plan`), con porqué, cómo, avisos y proyección de cada marcador.

## 2026-09-30 — Coherencia de uso, analíticas subidas, comunicación y portal del especialista

### App del paciente
- **Lo ya visto se recuerda** (`src/data/userFlags.ts`, tabla `user_flags`): nube si hay cuenta (todos sus
  dispositivos) + copia local (instantáneo/offline). Ej.: "Your report is here!" desaparece tras abrirlo.
- **Subir analítica → "See my progress" / "Update plan"**: `labUploads.ts` (tabla `lab_uploads`), comparación en
  `utils/progress.ts` (solo marcadores re-medidos, reconocidos por el catálogo canónico y con la misma unidad o
  equivalente; cambios <5% = ruido) y propuesta de plan en `utils/planUpdate.ts` (acciones: reached / on_track /
  needs_attention / not_retested / new). Al aplicar se guarda una versión en `action_plans` (historial en Your plans
  y arriba en Full view). Las subidas salen en Lab con "User upload · <lab>".
- "Subscription" para lo que se paga (Basic 365 € / Premium 700 €); "plan" = lo que hay que hacer.
- My Data: sección **Period** (mujeres) encima de wearables; Lab: laboratorio junto a la fecha.
- Especialista (ficha): **Book a video consultation** (huecos libres según su disponibilidad, `pro_busy_slots`),
  **Send a request** y **Chat** (solo si el especialista lo habilita). Especialistas de ejemplo → en el móvil.

### Portal del especialista (`src/screens/pro/*`, `src/components/pro/*`, datos en `specialistPortal.ts`)
- Rutas: `/pro` Agenda (semana/mes + lista del día; Confirm / Start consultation / View history),
  `/pro-patients` (tarjetas con ⚠ = solicitudes o valores alterados, 📞 = consulta hoy), `/pro-patient?id`
  (acciones: llamar, vídeo, mensaje, email, vídeo explicativo, generar plan; pestañas resultados · notas SOAP ·
  mensajes/solicitudes), `/pro-inbox`, `/pro-settings` (contacto profesional y privado, canales, agenda:
  disponibilidad semanal, duración, margen, Google/Outlook), `/pro-plan?patient`, `/pro-room`.
- **Web vs app**: `useIsWide()` (web ≥ 900 px) → barra lateral y SplitScreenConsultation; móvil → pestañas abajo y
  MobileVideoConsultation (vídeo a pantalla completa + panel inferior deslizable con resultados y notas en directo).
- **Vídeo: PROTOTIPO sin proveedor** (`VideoPane.tsx`). Integrar Daily / Whereby / LiveKit (DPA + servidores UE);
  en el móvil requiere APK nuevo (módulo nativo).
- **Chat**: propio sobre Supabase (tablas `conversations`/`messages` + Realtime, RLS).
- **Demo**: selector de desarrollo → "Specialist portal" (pacientes, citas, solicitudes y notas de ejemplo, en el
  móvil). Con una cuenta de especialista verificada, todo va contra Supabase.
- Esquema: migración `20260930110000_specialist_portal.sql` (+ `pro_busy_slots`, `pro_opens_chat`). Citas sin
  solapes (exclusion constraint), el paciente solo puede cancelar, notas clínicas privadas del autor,
  `is_my_patient()` y `pro_patients()`. **Tests: `supabase/tests/database/specialist_portal.test.sql` (20/20 OK)**.

## Web de la app en Vercel — 2026-09-30
- **https://hometest-app.vercel.app** (misma app, cuentas reales de Supabase). El portal del especialista se ve en
  versión escritorio con la ventana ancha. Proyecto Vercel `hometest-app` (cuenta astorgarciaamor), publicado con CLI.
- Republicar tras cambios:
  `WEB_OUTPUT=single npx expo export -p web` → copiar `dist/` a `deploy/hometest-app/` (con su `vercel.json` de
  rewrites a index.html) → `cd deploy/hometest-app && npx vercel deploy --prod --yes`.
  `app.config.js` cambia la salida web a SPA solo para esta exportación; el desarrollo local sigue en modo "server".
- En la web no hay modo demo de IA local: la extracción usa las Edge Functions (requiere sesión).
- Vídeo con Daily: decidido, se deja para más adelante (requiere APK nuevo).

## 2026-09-30 (tarde) — Vídeo real, búsqueda de especialistas, notas de voz, Keep learning
- **Videoconsulta real con Daily** (dominio hometest.daily.co; secreto `DAILY_API_KEY` en Supabase). Edge Function
  `video-room`: solo paciente o especialista de la cita; sala privada con pase personal (el médico es owner), caduca
  2 h tras la cita, sin chat de Daily. Web: sala integrada (iframe) en la sala de consulta / pantalla `/video`.
  Móvil: se abre en el navegador integrado seguro (Chrome Custom Tabs) — funciona con el APK actual.
  **Siguiente**: SDK nativo `@daily-co/react-native-daily-js` (APK nuevo; su plugin de Expo pide SDK 55, probar).
  **Antes de pacientes reales**: la cuenta Daily tiene `hipaa: false` → contratar el plan con BAA/DPA y revisar región UE.
- Paciente: Today muestra "Your next consultation" con **Join**; el médico: Start consultation (o vídeo sin cita
  desde la ficha: crea una cita "ahora").
- Professionals: búsqueda + filtros (idioma, especialidad, videoconsulta) y especialistas reales ("On HomeTest").
- Send a request: **nota de voz** (expo-audio; bucket privado `request-audio`, solo paciente y especialista
  destinatario) y **compartir datos** con ese especialista (misma lógica que Sharing & privacy).
- Today → **Keep learning** (8 temas, `src/data/learning.ts`, pantalla `/learn`). Fotos provisionales en
  `assets/images/learning/` (prompts en IMAGE_PROMPTS.md).
- Portal: selector de tema (Profile), **Requests** en la agenda (FIFO, Approve/Decline), "Add to calendar"
  (Google/Outlook por enlace; la sincronización automática necesita registrar apps OAuth en Google y Microsoft).
- Chat: respaldo si cae el tiempo real (relectura cada 20 s y al volver a la app).
- Web: publicar con `npm run deploy:web` (scripts/deploy-web.mjs). Arregla los iconos: Vercel descartaba la carpeta
  `node_modules` de assets, donde van las fuentes de iconos.
- Web: login y selector con ancho máximo (440/520 px); en Profile del portal el tema va al final.

## Próximos pasos propuestos (a 2026-10-01)
1. **Eventos en directo en "Keep learning"** (idea del fundador): sesiones de expertos (webinar/Q&A) con entradas.
   Encaja con lo ya montado: tabla `events` (experto, fecha, plazas, precio), inscripción = pedido en `orders`
   (Revolut, simulado hasta tener claves), sala en directo con Daily (modo "live streaming"/interactive para
   muchos asistentes), recordatorio en la agenda y grabación para quien se lo pierda. Pago al experto: liquidación
   mensual (Revolut Business payouts) con comisión de HomeTest; contrato y facturación con cada experto.
2. Vídeo nativo dentro de la app (SDK de Daily) + APK nuevo; plan de Daily con BAA/DPA y región UE.
3. Notificaciones push (mensajes, citas confirmadas, respuesta a solicitudes).
4. Sincronización real con Google/Outlook (registrar apps OAuth).
5. Fotos definitivas de Keep learning.

## 2026-10-01 — Web de demo para enseñar (solo paciente)
- **https://hometest-demo.vercel.app**: vista de paciente sin portal del especialista, login simulado (cualquier
  email/contraseña) y datos de ejemplo guardados en el navegador; no toca Supabase. Pensada para enseñar la app
  (p. ej. a gente con iPhone: Safari → Compartir → "Añadir a pantalla de inicio"). La IA (leer analíticas) no
  funciona aquí. Flag `EXPO_PUBLIC_PUBLIC_DEMO=1` (`isPublicDemo` en `lib/supabase.ts`). Publicar: `npm run deploy:demo`
  (proyecto Vercel `hometest-demo`, carpeta `deploy/hometest-demo`). La web real sigue con `npm run deploy:web`.
- My Data: quitado el botón "Log period"; se registra entrando en el ciclo (Cycle detail → Log period).

## Huawei Health Service Kit — 2026-10-02
- Cuenta de desarrollador **individual verificada**; proyecto HomeTest en AppGallery Connect (App ID / OAuth client 119155453,
  datos en Alemania, SHA-256 registrada; Callback URL de OAuth aún vacía).
- Solicitud de Health Kit: **solo lectura de pasos, calorías y distancia + histórico de 1 mes** (pulso/sueño = empresa; pedir
  con la SL, probablemente con una cuenta nueva de empresa porque el tipo de cuenta no se puede cambiar).
- Material de la solicitud: `docs/huawei/build_material.py` → `HomeTest_HealthServiceKit_Application_Material.pdf`.
  Privacidad (hometest-web) ya dice que de Huawei solo se leen esos 3 datos y 1 mes.

## Documentos de negocio en OneDrive — reorganizados el 2026-10-05
`OneDrive\2. Entrepreneurship` está ordenado por funciones (`00 Empresa y legal`, `01 Estrategia y finanzas`,
`02 Mercado`, `03 Partners`, `04 App`, `05 Marca`); la tabla de rutas antigua → nueva está en
`2. Entrepreneurship\_Reorganización 2026-10-06.md`. Ni la app, ni la web, ni Vercel/EAS ni el APK leen nada de
OneDrive. Los scripts que generan documentos de negocio (en `01 Estrategia y finanzas\_scripts_business_case`)
ya guardan en las carpetas nuevas.

## 2026-10-07 — Plan más limpio, PDF, "¿para qué quieres Kuova?" y curvas
- **Plan personalizado** (`/report-plan`): solo acciones y qué se espera que mejore. La comparativa de hábitos
  (sueño, HRV, pasos… + tendencia de 6 meses) se movió a **`/habits`** (`HabitsProgressScreen`), enlazada desde el
  resumen del informe ("How your habits changed") y desde el plan completo (`/action-plan`).
- **Compartir / imprimir el plan**: botón "Share or print" (`SharePlanButton`) en `/report-plan` y `/action-plan`.
  Contenido en `utils/planPdf.ts` (HTML A4 con logo, acciones y curvas en SVG; también versión texto).
  Móvil (`utils/sharePlan.ts`): PDF con `expo-print` → menú de compartir del sistema (`expo-sharing`: WhatsApp,
  correo, el médico…) e imprimir. Web (`sharePlan.web.ts`): diálogo de impresión → "Guardar como PDF". Tercera
  opción: dar acceso a un profesional de Kuova (`/share-new`).
  ⚠ `expo-print`/`expo-sharing` son **módulos nativos nuevos**: la APK actual no los tiene y, con
  `runtimeVersion: sdkVersion`, recibe igualmente las EAS Update. Se cargan bajo demanda: sin ellos, "Send as PDF"
  comparte el plan como texto y "Print" no aparece. **Para el PDF en Android hace falta una APK nueva**
  (`eas build --profile preview`). En Expo Go funcionan ya.
- **Para qué quiere la app** (`data/appPrefs.ts`, guardado en `user_flags` clave `app_prefs`, sin migración):
  primer paso del onboarding con 3 opciones — *Keep my health records* (solo historial: oculta plan, check-in,
  readiness, wearables, insignias, especialistas y learning; se salta hábitos y objetivos y no "construye" plan),
  *Understand and follow my health* (oculta plan e insignias; sin objetivos) e *Improve my health* (todo, como antes).
  Sin respuesta se ve todo. Ajuste fino en **More → Customise your app** (`/app-sections`, un interruptor por
  sección) y resumen en My Profile. Las pantallas usan `useSections()`; secciones: plan, checkin, readiness,
  wearables, cycle, badges, specialists, learning.
- **Proyecciones curvas** (`logic/projection.ts`, tests en `logic/__tests__/projection.test.ts`): cada marcador
  sigue su forma de respuesta en vez de una recta — exponencial que se aplana (vitamina D y triglicéridos rápido,
  HbA1c ~3 meses, ferritina lento) o en S (HOMA-IR: el hábito tarda unas semanas en notarse). Una línea por marcador
  explica cuándo se espera el cambio. **Plazos orientativos, pendientes de validación clínica.**
- Servidor de pruebas sin cuentas: `.claude/launch.json` → `expo-web-demo` (puerto 8082, `EXPO_PUBLIC_PUBLIC_DEMO=1`).

## 2026-10-08/09 — Avisos, simulador, intestino/vejiga, medicación, ciclo y "Know your roots"
(Antes vivía en `WIP-2026-10-08.md`; se pasó aquí al publicar.)
- **Motor de avisos** (`src/logic/nudges`, umbrales en `MEASURE_LIMITS`, pendientes de revisión médica) y bandeja
  `/notifications` (silenciar 7d/1m/3m/siempre). Avisos por duración: tensión alta semanas (ESH ≥135/85; ≥4 semanas →
  médico), tensión muy alta (≥180/110), glucosa alta semanas (≥180 mg/dL), energía baja y sueño corto ≥2 semanas.
  Si falta una tabla de Supabase, esa fuente se salta con un aviso en consola.
- **Usuarios simulados**: `simulation/personas/*.json` (13), `npm run simulate` → `simulation/output/report.md`;
  Developer mode → Simulated users, y **Build a case** (`/case-builder`; CLI `npm run simulate -- --case bp_high --days 56`).
- **Gut / Bladder** (`/digestive`, `/log-bowel`, `/log-urine`, regla de hidratación), **ciclo** (encuesta de la
  primera vez `/cycle-goal`, consejo de fertilidad ASRM/NICE con tono suave, temperatura basal `/log-temperature` y
  lecturas de termómetro aparte), **medicación y suplementos** (`/medications`, `/medication-setup`: texto libre,
  varios a la vez, pauta habitual de lo común, "+ Other time" con ruedas, tratamientos cortos con 3/5/7/10/14 días o
  **"+ Other" (rueda de 1 a 90 días)**, Taken/Skip en Today, aviso de cambio de zona horaria). **Iconos propios** para
  lo conocido (`KNOWN_MEDS[].icon`, MaterialCommunityIcons: sol vitamina D, pez omega-3, mancuerna creatina, mariposa
  levotiroxina…); el resto hoja (suplemento) o cápsula (medicamento) — componente `MedIcon`.
- **Evidencia**: `src/data/evidence.ts` + `/evidence` + iconos (i) `InfoButton`. **Configure my experience**, guía de
  funciones con vista previa, plan de partida personalizado (`src/logic/plan.ts`). Tabla BORRADOR objetivo→secciones en
  `src/data/goalEffects.ts`, **pendiente de decisión del fundador**.
- **Your genetic profile** (`/genetic-profile`, entrada en My Data debajo de la edad biológica, icono ADN):
  "Your genetic results" = hueco "Coming later" (no se inventan resultados) y **Know your roots**
  (`/know-your-roots`, `KnowYourRootsScreen`): embudo de asesor genético en 3 bloques con tiempo estimado (4–6 min),
  barra de 3 tramos fija y **guardado en cada respuesta** (`user_flags` claves `family_history_draft` y
  `family_history`, sin migración) para retomar en la misma pregunta.
  - Bloque 1: 10 sí/no (mama, ovario, colon/útero, páncreas/próstata, variante conocida, asquenazí, cáncer propio,
    corazón precoz, colesterol familiar, muerte súbita). Todo negativo → termina ("Population risk").
  - Bloque 2: quién (por rama, con contador para tías/primos…), qué cáncer, edad por tramos, bilateral.
  - Motor puro `src/logic/genetics.ts` (tests en `logic/__tests__/genetics.test.ts`), tablas con su fuente en
    `src/data/genetics/scoring.ts`: **PAT** (≥8 en una rama), **Ontario FHAT** (≥10), **Manchester** (15 ≈ 10 %;
    20 para no afectados, criterio NHS), patrones **Amsterdam II / Bethesda** para Lynch. Comprobado contra la revisión
    de la USPSTF (Apéndice C1, NBK545866), NHS GeNotes y Umar 2004. Supuestos marcados "SUPUESTO" (hijos = fila de
    hermanos en FHAT; "premenopáusica" ≈ diagnóstico <50; Amsterdam sin verificar parentesco exacto ni anatomía
    patológica). Corazón (AHA/ACC 2018: familiar de 1.er grado con ECV precoz, H <55 / M <65 → Lp(a)) en tarjeta aparte.
  - Moderado/alto → texto para el médico con puntos clave dinámicos, "Find a genetic counsellor" (`/professionals`
    rol geneticist) y "Share with my doctor". Referencias visibles al final. **Todo pendiente de revisión del asesor
    médico**; ojo con MDR (es orientación, no diagnóstico).
- **Modo Señalar** (solo web, `DevInspector.web.tsx`, `?inspect=1` en las webs publicadas): barra "🎯 Señalar ·
  💬 Notas · –". Señalar elige UN elemento y la app vuelve a funcionar; la tarjeta de comentar no bloquea la app y
  cerrarla con ✕ guarda lo escrito; la lista de notas se abre/cierra cuando quieras (editar, borrar una, copiar todas).
- Pendiente: notificaciones push reales (expo-notifications + APK nueva, preguntar al usuario); SEO/GEO de la web
  pública (segunda capa de preguntas con fuentes) en HomeTest-web, que sigue sin publicar.

## 2026-10-09 (noche) — Portal del médico: Señalar en escritorio, sin recetas, biblioteca de plantillas
- **Modo Señalar en el portal**: en `/pro*` (y el chat con `side=pro`) las notas van a su propia lista
  (`kuova.inspector.notes.portal`, "Notas · portal del médico"); en escritorio la barra va abajo a la derecha de la
  barra lateral y se recoloca al cambiar de pantalla o de ancho; "Descargar .md" para mandar las notas (p. ej. al
  asesor médico).
- **Kuova no receta** (decisión del fundador): fuera "Prescriptions" del plan de acción del especialista
  (`ProPlanScreen`, `portal.createActionPlan` ya no lo manda; la columna `action_plans.prescriptions` queda en `[]`)
  y las consultas del catálogo ya no prometen receta. Si un médico necesita recetar, lo hace fuera (plataforma de
  receta privada de su colegio —SREP: REMPe, Docline…— o papel).
- **Biblioteca de plantillas (sin IA)**: sección **Templates** del portal (`/pro-templates`, `ProTemplatesScreen`):
  lista + editor (nombre, tema, palabras clave, texto), importar .txt/.md/.docx en la web
  (`utils/importTextFile.web.ts`, lee el .docx sin librerías; PDF → copiar y pegar), duplicar, borrar.
  Temas: ciclo, analíticas, hormonas/tiroides, energía/hierro/vitaminas, colesterol/corazón, glucosa, otros.
  Al contestar (Inbox, ficha del paciente y chat del especialista) salen hasta 3 **sugeridas** por la pregunta
  (inglés y español, `suggestTemplates` en `src/data/proTemplates.ts`, tests en `src/data/__tests__/`) y
  "Browse all"; insertar rellena `[name]` y `[doctor]`, y **no se puede enviar mientras quede un hueco [ ]**.
  Las respuestas enviadas se pueden guardar como plantilla (el nombre del paciente vuelve a `[name]`).
  Demo: 7 plantillas de ejemplo y 2 dudas nuevas (Elena: ciclo; Laura: cansancio). Cuenta real: tabla
  `pro_templates` — migración `20261009120000_pro_templates.sql` aplicada el 2026-10-09 (RLS comprobada; el test
  `pro_templates.test.sql` necesita Docker Desktop abierto); sin la tabla se guardarían en el dispositivo.
- Decidido: la "respuesta asistida por IA" se deja para más adelante (coste ~1–2 céntimos por borrador, pero exige
  Gemini de pago + DPA y no hay volumen aún); se montaría encima de esta biblioteca.
- Pendiente del portal: simular X pacientes con lo que comparte cada uno (ficha con categorías compartidas / 🔒) y
  checklist de privacidad prueba → lanzamiento (Supabase de staging, plan de pago + DPA, registro de accesos del
  profesional, MFA, EIPD, BAA de Daily).

## 2026-10-10 — Plantillas: temas editables
- El médico gestiona sus temas: **"Editar temas"** en la lista (✕ en cada tema, "+ Nuevo tema", "Recuperar N temas de
  ejemplo borrados") y en el editor (✕ en cada chip y "+ Nuevo tema", que además se lo pone a la plantilla). Los de
  ejemplo (Ciclo menstrual, Glucosa…) también se pueden borrar. Borrar un tema no borra plantillas: pasan a "Otro"
  (que no se puede borrar). Recuperar un tema de ejemplo no devuelve sus plantillas (siguen en "Otro").
- Lista de temas por médico: `topicSettings` en `src/data/proTemplates.ts` → `user_flags` clave `pro_template_topics`
  (`{ hidden, custom }`, sin migración); en la demo, en el dispositivo. Un tema propio en una plantilla va en
  `customTopic` / columna `custom_topic` (topic = 'other'); migración `20261010090000_pro_templates_custom_topic.sql`
  aplicada el 2026-10-10 (si faltara, el código guarda la plantilla sin el tema propio).
- "Guardar esta respuesta como plantilla" usa los temas del médico.

## 2026-10-10 (tarde) — Notas del fundador: edad biológica, profesionales, medicación, carruseles
- **Tu edad biológica** (My Data) abre `/biological-age` (`BiologicalAgeScreen`): cómo se calcula (PhenoAge,
  Levine 2018 / Liu 2018), los 9 valores que usa, por qué es un rango, qué la mueve y qué no es; los valores de la
  analítica se ven en Laboratorio (botón). Sigue siendo **ejemplo**: el cálculo real está pendiente
  (`logic/rulesEngine/biologicalAge.ts`).
- **Profesionales**: añadidos Dra. Gema Martínez Tamés (Endocrinología, 4,9), Dr. Alejandro Alonso Cabrero
  (Hematología), Dra. Covadonga Carrera (Dermatología) y Dra. Andrea Otero Gonzalez (asesora genética) en
  `servicesMock.ts`. Sin valoraciones (`rating: 0`) se ve "Nuevo en Kuova" / "Aún sin valoraciones" en vez de
  inventarlas. Bios, tarifas y huecos provisionales: confirmar con cada uno antes de enseñarlo fuera.
- **Today → Medicación y suplementos**: la flechita enseña u oculta TODAS las tomas de hoy (con o sin
  recordatorio); se recuerda en el dispositivo (`today.medOpen.v1`). El resto de la tarjeta abre /medications.
- **Alta de medicación**: barra fija en todos los pasos con lo que se está configurando, "1 de 2" y "Después: …";
  textos y opciones traducidos. Arreglado el parser: un número pegado al nombre es parte de él ("Omega-3",
  "Vitamina B12"), antes quedaba "Omega".
- **Carruseles (Habla con un especialista / Sigue aprendiendo)** en la web de escritorio: centrados en su
  columna (`calc(50% - 84px)` en web; antes se calculaba con el ancho de la ventana y quedaban a la derecha).
- Portal: fuera "Editar temas" del panel izquierdo de Plantillas (se editan en el editor, a la derecha;
  "Recuperar temas de ejemplo" también está allí).

## 2026-10-11 — Portal: simular X pacientes y checklist de privacidad
- **Pacientes → "Pacientes de ejemplo: 4 · 12 · 40"** (solo en el portal de demostración): a los 4 fijos se suman
  pacientes generados siempre igual (`src/data/demoPatients.ts`, tests en `src/data/__tests__/demoPatients.test.ts`),
  cada uno compartiendo cosas distintas: todo, solo analítica, tensión y glucosa, wearables, nada todavía, permiso
  caducado o retirado (el ciclo solo en mujeres). Uno de cada tres trae una duda abierta (en la Bandeja). Sin permiso
  de analíticas la demo no enseña analítica (como la RLS real). Tarjetas con 🔒 y el motivo.
- **Ficha del paciente → pestaña "Qué comparte · n/11"** (`SharedDataGrid`): las 11 categorías, las compartidas con
  un resumen de un vistazo (demo) y las demás con candado; aviso si el permiso caducó o se retiró. Con cuentas reales
  muestra compartido / no compartido (los resúmenes reales, más adelante). `portal.sharedOverview()`.
- **`docs/privacidad-prueba-a-lanzamiento.md`**: qué protege ya la app y qué falta antes del primer paciente real
  (Supabase Pro + DPA, staging separado, confirmar email (hoy desactivado) y doble factor para profesionales,
  registro de accesos, DPA y región UE de Daily/Gemini…, EIPD, DPD, descargar/borrar cuenta, contrato con
  profesionales, plan de brechas).

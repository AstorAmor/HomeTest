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

## 2026-10-15 — Cuenta real, Health Connect de verdad y notas del fundador

- **Cuenta real** (`src/data/dataMode.ts`): `user_flags.real_account = true` → la app no rellena NADA con ejemplos
  (analítica ficticia, wearables de Huawei de mentira, lecturas de muestra, semana de ejemplo de digestión/orina,
  edad KUOVA, envíos de ejemplo, plan del informe ficticio, botones "dummy data"). Lo no medido sale vacío y dice
  cómo conseguirlo. Sin selector "developer": entra directo a Hoy. Se cambia en Ajustes → Cuenta → Cuenta real
  (recarga). Sin marca, las cuentas siguen siendo de prueba (con ejemplos). **Antes del lanzamiento: invertir el
  valor por defecto** (cuenta nueva = real). Las pantallas preguntan con `showSamples()`; el informe de ejemplo se
  pide con `labReports()` (no `LAB_REPORTS`). En desarrollo, `EXPO_PUBLIC_FORCE_REAL_ACCOUNT=1` enseña la demo
  local como cuenta real (`.claude/launch.json` → `expo-web-real-check`, puerto 8084).
- **Health Connect** (`src/wearables/providers/healthConnect.ts`): pasos con el agregado diario (sin duplicar reloj
  + móvil), pulso medio, pulso en reposo (el del reloj o, si no lo da, la media horaria más baja del día, marcado
  "estimado"), VFC y sueño (sin ratos despierto, al día en que te despiertas). Días en hora LOCAL (antes UTC),
  paginación, 30 días. Nombres legibles de la fuente (`src/wearables/sources.ts`: el paquete
  `com.android.healthconnect.phone.<hash>` = "este móvil"). Se sincroniza solo al abrir Hoy (cada 10 min como
  mucho) y sustituye lo guardado del rango (`replaceProviderFrom`). Pantalla Wearables: conectar = permisos +
  sincronizar, "Qué llega (últimos 30 días)" por tipo con días y app, aviso si solo llega el móvil.
  Calorías activas y distancia: declarados en app.json, **solo se piden con una APK nueva** (se reconoce porque
  trae expo-print). Lógica pura con tests en `src/wearables/seriesLogic.ts` + `__tests__`.
- **Tu estado de hoy**: se calcula con lo que llegue HOY (sueño y/o pulso en reposo; la VFC si está) y dice qué
  falta; si solo hay pasos, lo explica en vez de "conecta un wearable". Fuente real ("De Fitbit y este móvil").
- **Tus últimos días** (`/your-days`, `DaysScreen`): tocar la tendencia de 7 días del check-in → cada día con
  check-ins y notas, sueño/pasos/pulso, medicación, digestión, orina, entrenos, comidas, tensión y glucosa; los días
  que se salen de lo tuyo van marcados (ánimo/energía bajos, <6 h de sueño, pulso ≥ tu media + 5, toma saltada).
- **Informe de evolución** (`/habits`): marcadores "De vuelta en su rango", "Ha mejorado" y "Ha empeorado"
  (`classifyChange` en `utils/progress.ts`, ruido <5 %) con aviso de que dos analíticas no son tendencia. En cuenta
  real: hábitos de los últimos 14 días frente a los 14 anteriores y marcadores de sus dos últimas analíticas subidas.
- **Orina y heces sobre la marcha**: "Añadir medición (ahora)" (`?quick=1`: suma una vez a hoy, color/forma
  opcionales, sin el aviso de "pocas veces") y debajo "Añadir un día completo".
- Teclado: `components/KeyboardAwareScrollView.tsx` en check-in, heces, orina, comidas, medicación, consulta y
  onboarding (Android de borde a borde ya no encoge la ventana).
- "Tu informe está aquí" y el aviso de nuevos resultados ya no vuelven al dar atrás (replace + `userFlags` da
  prioridad a lo recién cambiado mientras sube a la nube).
- Español: estados de marcadores (Bajo, Límite alto…), "X para revisar", categorías, horario de extracciones.
- Pendiente: cuentas de prueba con casuísticas cargadas en la nube (hoy los usuarios simulados solo van en la demo);
  ciclo de una mujer con cuenta real sin registros (sigue saliendo el ejemplo); APK nueva para calorías/distancia.

## 2026-10-17 — Fases y horas del sueño desde Health Connect (rama `sleep-stages`, unida y publicada el 18/10 como 904334b)

- Health Connect ya da las fases de cada noche en `SleepSessionRecord.stages` (profundo, ligero, REM, despierto,
  fuera de la cama) y la hora de inicio y fin. `summarizeSleepSessions` (`src/wearables/seriesLogic.ts`, con tests)
  las resume por día en que te despiertas y por fuente: minutos de cada fase y hora de dormirte/despertarte del
  bloque con más sueño (una siesta no las cambia; dos sesiones con menos de 1 h entre medias son la misma noche).
  "Despierto en la cama" (fase 7) ya no cuenta como dormido.
- Se guardan en `wearable_daily` como métricas nuevas del mismo día y fuente que `sleep_duration`: `sleep_deep`,
  `sleep_light`, `sleep_rem`, `sleep_awake`, `sleep_out_of_bed` (minutos; solo si la fuente da fases) y
  `sleep_start` / `sleep_end` (minutos desde la medianoche del día en que te despiertas; negativo = la víspera,
  -45 = 23:15). La columna `metric` no tiene CHECK: **no hace falta migración**. `pickPerDay` coge las fases y
  horas de la misma fuente que la duración elegida (nunca mezcla apps).
- Solo JS: el permiso READ_SLEEP ya está en las APK de septiembre/octubre. Lo ya guardado se completa en la próxima
  sincronización (sustituye los últimos 30 días).
- Detalle del sueño (`/metric?kind=sleep_duration`, `components/SleepNightsCard.tsx`): en 7D/14D/1M una barra por
  noche con sus fases (tocarla la elige); de la noche elegida, minutos por fase, "Te dormiste"/"Te despertaste" y
  media de esas horas en el periodo. En 6M, sin barras (última noche y medias). Una noche sin fases enseña solo
  duración y horas. La lista de valores diarios añade la hora de dormirte y despertarte. En Wearables → "Tus
  últimos días" las fases no salen (solo la duración). Los datos de ejemplo (Huawei dummy) traen fases y horas.
- El "Daily Readiness" de Fitbit es propio de Fitbit y no pasa por Health Connect; Kuova usa su "Tu estado de hoy".

## 2026-10-15 (tarde) — Casos de prueba en cuentas de Supabase (rama `test-account-scenarios`)

- **Ajustes → Cuenta → Casos de prueba** (`/simulation`), solo en cuentas de prueba (sin `real_account`): los
  mismos usuarios simulados de `simulation/personas` y "Build a case", pero "Load X into this account" escribe el
  caso en las tablas de verdad de esa cuenta (check_ins, workouts, meals, cycle_starts, bowel_logs, urine_logs,
  medications, medication_doses, blood_pressure_readings, glucose_readings, metric_readings, wearable_daily) a
  través de los repositorios, más perfil (sexo, edad, condiciones), objetivo del ciclo, silencios, historial de
  avisos y secciones opcionales. Así se ve el caso en el móvil (APK) entrando con esa cuenta. Antes de escribir se
  vacía lo registrado; "Clear this test account" vacía sin cargar nada. Se quedan analíticas, archivos, pedidos,
  permisos a profesionales, chats y el perfil. Pide confirmación con el email de la cuenta.
- **Guardia** (`src/logic/scenarioAccount.ts`, tests en `logic/__tests__/scenarioAccount.test.ts`): antes de
  escribir o borrar se vuelve a leer `user_flags.real_account` directamente de Supabase; si es real, si no se
  puede leer o si la cuenta fue real alguna vez (fila `real_account` = false sin `scenario_account` = true), se
  niega y no toca nada. La primera carga marca la cuenta con `scenario_account`. En una cuenta real la fila de
  Ajustes no sale y `/simulation` solo enseña el motivo.
- Los borrados van siempre filtrados por `user_id` (y RLS solo deja borrar lo propio): `clearAll()` y
  `saveMany()` nuevos en `createMetricRepository`.
- Con un caso cargado, Health Connect no se sincroniza solo (no mezcla el sueño/pulso del móvil con el del caso);
  "Sincronizar" a mano en Wearables sí. Al vaciar la cuenta vuelve a sincronizar solo.
- El modo demo sigue igual (Developer mode → Simulated users → "Open the app as…").
- Cómo probar: crear en la app una cuenta por caso (p. ej. tensión alta, energía baja, medicación), entrar,
  Ajustes → Casos de prueba → elegir el caso → Load. La app recarga en Today con el caso y su bandeja de avisos.

## 2026-10-17 — Notas del fundador: plan, check-in, suscripciones, códigos de invitación, foto y alias

- **Tarjetas del plan personalizado** (`PlanIntroScreen`): el degradado ocupa toda la pantalla (antes cortaba el
  "Cómo" a media altura), icono arriba y texto en su propio scroll vertical (en móviles bajos se desplaza).
  Botones "Siguiente" / "¡Empezamos!" y "¡Vamos a por ello!" (`ReportPlanScreen`) en español. `BlobArt` acepta
  ir sin icono.
- **Ejercicios guiados** (`ExerciseScreen` + `data/exercises.ts`): títulos, intros, pasos, fases de respiración y
  botones pasan por `t()`; traducciones nuevas en es.ts.
- **Wearables**: botones con el texto centrado aunque ocupe dos líneas; solo llevan `flex: 1` dentro de una fila.
  Ojo: el texto "Sincronizar los últimos 7 días" que vio el fundador ya no existe desde 6b0b78e.
- **Día de cada check-in** (`logic/checkInDay.ts`, tests): antes de las 4:00, lo que no es "me acabo de levantar"
  cuenta para el día anterior. De madrugada se sugiere "mi día está acabando". El check-in pregunta "¿Para qué
  día cuenta?" (hoy y los dos anteriores); `?id=` edita (mover de día o momento, borrar) y `?date=&moment=`
  apunta uno pasado. La fecha guardada es la real si cae en ese día; si no, la hora típica del momento
  (8/14/22 h), nunca futura. `dailyCheckInSeries` y "Tus últimos días" agrupan con `checkInDayKey`.
- **Tus últimos días**: en vez de los emojis sueltos, tres círculos por día (mañana, mediodía, noche): el ánimo
  si hay check-in, hueco discontinuo si no; tocar abre ese check-in o apunta uno nuevo. Cada línea de check-in
  también abre la edición.
- **Plan en Today**: bloque "Tu plan personalizado" (→ /action-plan) encima de las acciones, en lugar del enlace
  "Plan completo"; la tarjeta del plan sale de Lab.
- **Suscripciones sin médico ni videoconsultas** (testCatalog, testCatalogEs, SubscriptionCard, PanelMarkers).
- **Qué incluye cada nivel, editable por el admin** (`data/access.ts`, `/admin-plans`, Más → Suscripciones
  (admin)): filas {id, label es/en, valores gratis/Basic/Premium: sí/no/texto} en `app_config`
  'plan_features'. "Comparar suscripciones" las lee (con columna Gratis). Las filas con candado además las aplica
  la app: hoy solo `scan_reports`.
- **Códigos de invitación y accesos**: el admin crea códigos (nivel, días de acceso, usos máx., nota) y da o quita
  acceso a un email. Quien canjea en `/redeem-code` ("¿Tienes un código de invitación?") recibe ese nivel.
  Nivel efectivo con `my_access()`: admin > suscripción pagada > invitación > gratis.
- **Escanear informes, solo con acceso**: `/upload-test` sin acceso enseña "Escanear tus informes viene con la
  suscripción" + ver suscripciones + código. La Edge Function `extract` lo comprueba también con
  `has_feature('scan_reports')` (`userHasFeature` en `_shared/http.ts`) — **sin desplegar**.
- **Foto de perfil** (Mi perfil): tocar la foto → galería, se reduce a 400 px y va al bucket privado `avatars`
  (ruta en user_flags `avatar_path`, URL firmada de 7 días cacheada, `data/avatar.ts`).
- **Tu nombre (alias)**, para cualquier cuenta: pantalla propia `/your-name` desde Mi perfil (lápiz), Ajustes →
  Cuenta → Tu nombre y, si aún no hay alias (saluda con la parte del email), un enlace bajo el saludo de Today.
  Se guarda en `user_metadata.display_name` y `profiles.display_name` (`updateDisplayName` en AuthContext).
- **Heces y orina en español**: `ColorSwatches` traduce los nombres de color; causas de color de heces y orina y
  "{n} horas" de la medicación, traducidas.
- **Migración `20261017100000_plan_access.sql`** (aplicada el 2026-10-17 tras publicar 80dd028, EAS bc0bcab8): app_config, access_codes, access_grants,
  my_access(), has_feature(), redeem_access_code(), admin_grant_access(), admin_list_access_grants() y el bucket
  avatars. Mientras no esté aplicada, la app no bloquea nada (fuente 'legacy'), el panel de admin lo avisa y la
  foto da "aún no disponible". Al aplicarla, las cuentas gratis dejan de poder escanear (salvo admin o código).
- Pendiente de decidir: precios editables desde el admin (hoy en `testCatalog.ts` y `_shared/products.ts`);
  el business case aún menciona la revisión médica en la suscripción.

## 2026-10-17 (tarde) — Segunda tanda de notas del fundador

- **Subir informe**: el error "UnknownHostException … supabase.co" era el móvil sin poder resolver el nombre (sin
  red o DNS); el servidor responde bien. `postAi` reintenta dos veces los fallos de red (`isNetworkError` en
  `utils/apiBaseUrl.ts`) y `/upload-test` explica en español qué pasa y conserva las fotos.
- **Resumen semanal general**: el aviso `bathroom_weekly` (mismo id para no perder silencios) es ahora "Tu semana
  en Kuova": cuenta check-ins, entrenos, noches de sueño, comidas y notas de digestión/hidratación, menciona si
  hay algo que mirar y abre `/your-days`. Categoría "Recordatorios", ya no depende de las secciones de baño.
- **Cómo funciona KUOVA**: las 18 fichas (`data/evidence.ts`) se traducen en pantalla con `t()`.
- **Check-in en Hoy desplegado por defecto** (clave `today_week_open.v2`); "Qué pasó cada día" → "Detalle por día".
- **Tus planes**: sin planes de análisis ni versiones, sale "Tu plan personalizado" como plan actual.
- **Test "¿qué análisis pedir?"**: "Mi peso ha cambiado" se divide en "Estoy ganando peso" (tiroides, control de
  peso, azúcar; en mujeres hormonas del ciclo) y "Estoy perdiendo peso sin buscarlo" (tiroides, azúcar,
  perfil general, celiaquía + aviso de comentarlo con un médico). Pesos pendientes de revisión clínica.
- **Heces: "Marrón oscuro"** entre marrón y muy oscuro/negro; los marrones van de claro a oscuro con saltos de
  luminosidad parecidos. Migración `20261017120000_stool_dark_brown.sql` (amplía el CHECK de `bowel_logs.color`),
  aplicada el 2026-10-17 con el OK del fundador.
- **Ficha de la cita en laboratorio** (`/lab-appointment?id=`, `LabAppointmentScreen`): mapa del centro, Llamar
  (tel:), Cómo llegar, Calendario, "Cambiar día u hora" (`/book-lab?center=&reschedule=` mueve la misma cita) y
  Cancelar. Se abre desde Hoy (resumen), Lab (próximos análisis), Agenda y "Pedir cita". "8 laboratorios a tu
  alcance"; notas de los centros en español.
- **Kegel**: ejercicio guiado `kegel` (3 min, 8 contracciones de 5 s + rápidas) enlazado desde Salud
  reproductiva (lección "Tu suelo pélvico", fuentes NHS y NICE NG210). Pendiente de revisión clínica.
- **Avisos de bienvenida** (`components/WelcomePrompts.tsx`, en Hoy y en el resumen web): perfil genético y, a
  mujeres con la sección de ciclo, el cuestionario de la regla (`/cycle-goal`). Empezar · Más tarde (3 días) ·
  Saltar · Silenciar estas sugerencias; estado en user_flags `welcome_prompt:<id>` y `welcome_prompts_muted`.
- **Insignias a pantalla completa** (`components/badges/`): niveles bronce → plata → oro → platino → diamante
  (quinto umbral nuevo en cada logro), medalla SVG con confeti (Animated) y "Compartir" como imagen 1080×1350
  (`utils/shareBadge.ts`: toDataURL de react-native-svg + expo-sharing; sin expo-sharing en la APK, texto;
  `shareBadge.web.ts`: canvas → Web Share con archivo o descarga).
- **Conoce tus raíces, quién cuenta como familia**: las preguntas de sí/no sobre cáncer en la familia llevan un
  recuadro "Quién cuenta" (familia de sangre de los dos lados hasta primos hermanos y sobrinos; ni pareja ni
  familia política; "después te preguntamos quién fue y a qué edad"). Los mismos parentescos que se eligen en
  "¿Quién tuvo cáncer?" (PAT, FHAT y Manchester piden parentesco y lado, que ya se preguntaba). Colesterol y
  muerte súbita dicen quién cuenta; muerte súbita, "antes de los 50" (antecedente de la AHA). Sin cambios en
  la puntuación.

## 2026-10-17 (noche) — Informes subidos, Mis datos, planes e insignias con logo

- **Rangos de un solo límite** (`utils/rangeStatus.ts`): "< 200" o "> 40" ya deciden en rango / por encima /
  por debajo (antes salía "Sin referencia"); `rangeText` los escribe así. El prompt de extracción
  (`_shared/prompts.ts`) lo pide explícitamente — **hay que desplegar la Edge Function `extract`** para que el
  escáner del móvil use el prompt nuevo. En el progreso, si la analítica nueva trae rango, solo se usa ese.
- **Informe escaneado en español**: tarjetas de cada valor (estado, "Rango", edición), datos del paciente,
  "N páginas añadidas", permisos. **Tu progreso** traducido (veredictos, "Antes", motivos de no comparar).
- **Analítica subida** (`/progress?upload=`): pestañas **Resultados** (cada marcador con su estado y el
  recuento en rango / para revisar / sin referencia; se abre así desde Lab) y **Progreso** (`?view=progress`,
  así se abre tras escanear).
- **Mis datos y Hoy con la analítica**: glucosa, colesterol total y cortisol de las analíticas subidas se suman a
  lo apuntado a mano (`logic/labUploadValues.ts`, sin copiar filas; mmol/L y nmol/L convertidos). En las fichas
  salen como "Analítica" y abren la analítica. Más alias de nombres españoles ("Glucosa basal", "HDL Colesterol",
  "Cortisol basal"…) en `knowledge/mapping/extracted-name-aliases.json`.
- **Tus planes**: "Borrar este plan" en cada versión (`planVersionRepository.remove`). En Supabase necesita la
  migración `20261017140000_action_plans_delete.sql` (permiso de borrar al paciente). La casita "Ir a Hoy" se
  quitó después a petición del fundador.
- **Insignias**: la medalla lleva el icono de la insignia (contornos sacados de Ionicons con
  `scripts/badge-icons.py` → `components/badges/badgeIconPaths.ts`) y abajo el logotipo KUOVA (trazos de
  `KuovaLogo.tsx`), también en la imagen que se comparte.
- **Para revisar** (`components/OutOfRangeSummary.tsx`, pestaña Resultados de la analítica subida): los valores
  fuera de rango arriba; al tocar uno, qué es, para qué se mide, qué puede moverlo (fichas de
  `knowledge/biomarcadores`, en español con `i18n/catalogEs.ts` vía `getParameterCard`) y qué ayuda (la acción
  del plan, `planRuleForMarker`), con enlaces al plan completo y a un médico.
- **Actualizar el plan cierra el recorrido**: tras "Aplicar a mi plan" se cierran subir → progreso → actualizar
  (`router.dismissAll()`) y queda "Tus planes" encima de la pestaña de origen.
- **Plan completo, "Cómo podrían cambiar tus marcadores"** (`logic/markerProjection.ts`): con la última analítica
  subida, cada marcador fuera de rango que el plan trabaja tiene su gráfica a 6 meses (`ProjectionChart`, forma
  de `logic/projection.ts`). Efectos típicos de los cambios de estilo de vida (LDL −12 %, triglicéridos −25 %,
  HDL +3 mg/dL…), nunca más allá de volver al rango: SUPUESTO pendiente de revisión clínica. En cuentas de
  prueba solo si la analítica es más reciente que el informe de ejemplo.
- **Actualizar el plan en una cuenta real** partía del action plan del informe de EJEMPLO cuando no había versión
  guardada (salían "Mantén tu horario de sueño", "Añade 2 sesiones de fuerza"… con "no se midió"). Ahora
  `basePlanItems(latest, buildPlan(profile))` parte del plan personalizado (hábitos sin marcadores) y lo que la
  analítica saca fuera de rango, también lo medido por primera vez (`progress.firstTime` lleva `markerId`), llega
  como acción nueva. Las versiones guardadas antes siguen como estaban: borrarlas y volver a actualizar.
- **Acciones concretas** (lo que hay que hacer, con cifras): reglas de `planUpdate.ts` ("Aceite de oliva, frutos
  secos y pescado azul 2-3 veces por semana"…), nutrición del plan personalizado ("Sal: menos de 5 g al día") y
  títulos del informe de ejemplo ("Haz 2 sesiones de fuerza a la semana"). "Tu plan de hoy" y "Tus planes" ya
  no enseñan "No se volvió a medir" ni su nota; la gráfica de "Cómo podrían cambiar" dice qué hacer.


## 2026-10-18 — Qué hacer para el colesterol según tus valores, franja del objetivo en las gráficas, ficha del laboratorio al reservar

- Publicado antes 904334b (EAS 7287110d, las dos webs a la primera): fases del sueño (rama `sleep-stages` unida) y
  acceso de soporte (d463339).
- **Colesterol** (`utils/planUpdate.ts`): la regla de lípidos decía a todos "y 30 minutos de movimiento al día, que
  sube el HDL", también a quien solo tenía alto el colesterol total. Ahora cada regla tiene `family` ("Colesterol")
  y `notes` por marcador, y `planRuleForMarkers(ids)` junta el texto común con las notas de los marcadores que hay
  que trabajar (LDL/total: grasa saturada y fibra; triglicéridos: azúcar, harinas, alcohol, ejercicio; HDL: moverse;
  Lp(a): genética, al médico). Palancas de la tabla de estilo de vida de la guía ESC/EAS 2019. Las acciones nuevas
  de un plan se guardan ya con el texto ajustado; los planes guardados con el texto antiguo lo enseñan ajustado en
  "Tus planes" (`ruleWhyForItem`, solo si el texto es exactamente el antiguo: lo que edite un especialista no se toca).
- **"Cómo podrían cambiar tus marcadores"** (plan completo): una tarjeta por familia ("Colesterol", qué hacer y una
  gráfica por valor). `ProjectionChart` acepta `targetLow`/`targetHigh`: franja verde con raya discontinua en el
  límite y etiqueta "OBJETIVO < 200" (como la banda de la web, pero se llama objetivo porque es el rango del
  laboratorio, no un rango óptimo). El eje incluye el límite y medio tramo más allá para que la franja se vea.
  El informe de ejemplo (`ActionPlanList`) también la pasa, con el rango del marcador.
- **Laboratorio** (`components/LabCenterInfo.tsx`): dirección, horario, llamar, cómo llegar, teléfono y cómo ir
  preparado, en la ficha de la cita y en "Pedir cita" en cuanto eliges centro.
- Comprobado en web local (claro/oscuro, castellano) con una analítica de prueba en el almacenamiento local.
- **Medallón de Tu edad KUOVA con las «capas» de la marca** (7888e88, de la sesión de opciones visuales): láminas
  apiladas con bordes de ruido fractal, sin línea dorada en las láminas; verde o verde con centro ámbar en oscuro,
  arena o terracota suave en claro. Imágenes en `assets/images/kuova-age/`, generadas con `scripts/kuova-age-art.py`.
  `KuovaAgeBadge.tsx` no cambia.
- **Publicado 7888e88 el 18/10** (con el OK del fundador, «publica todo»), junto con c9b2097: EAS Update grupo
  28c7f07e y las dos webs a la primera. `npm run release` volvió a quedarse sin memoria al exportar; se hizo a mano:
  `expo export` de Android, luego Android + iOS (solo pasó con `--max-workers 1`), `eas-cli update --skip-bundler
  --input-dir dist` con `EAS_SKIP_AUTO_FINGERPRINT=1` y `node scripts/deploy-web.mjs` (y `demo`).

## 2026-10-18 (noche) — Digestión separada de "Tus nutrientes": la comida se pregunta después de la molestia

Sin commit todavía. Nota del fundador: «lo de los nutrientes lo separaría; en Digestión, preguntas sobre la comida
al rellenar el cuestionario, no antes de ningún síntoma sino tras registrarlo».

- **Tus nutrientes no cambia** y Digestión ya no lee sus comidas. Fuera `MealGroupsScreen`, la ruta `/meal-groups`
  y `mealGroupsStore` (las correcciones guardadas en `user_flags.meal_food_groups` se quedan sin uso).
- **Cuestionario en dos pasos** (`LogDigestionScreen`): 1) molestias como antes; al pulsar ✓ se guardan y 2)
  «¿Qué comiste antes?»: «Llevaba horas sin comer», qué fue (texto), grupos rellenados con `inferFoodGroups` y
  corregibles, cuánto antes (<1 h, 1-3 h, 3-6 h, >6 h), cuánto (un poco / como siempre / mucho) y, solo la primera
  vez que sale cada grupo, «¿cada cuánto lo sueles tomar?». «Ahora no» deja la molestia guardada sin comida.
  `?id=` abre la comida de un apunte para añadirla o corregirla (desde la fila de Hoy en Digestión).
- **Datos:** `DigestionEntry.food` (`FoodBefore`) y frecuencias en `user_flags.gut_usual_foods`. La migración
  `20261018150000_gut_symptom_logs.sql` (aún SIN aplicar) lleva ya las columnas `food_*`.
- **Análisis** (`logic/gutPatterns.ts`): como ya no hay comidas «buenas», se compara con la frecuencia habitual
  (case-crossover, Maclure 1991): binomial de una cola y razón de odds frente a la parte de comidas de cada
  respuesta (casi todas 0,75; una al día 0,3; algunas por semana 0,1; casi nunca 0,03). Mínimo 5 apuntes con
  comida. Dos alimentos que van juntos: el que tomas mucho más a menudo queda explicado por el otro (pan y café
  con la leche); si no se pueden separar, se avisa y se sugiere probar uno sin el otro. Solo cuenta como confusión
  lo que puede dar esas mismas molestias (el café no hincha). Las heces sueltas se cruzan por la hora con esas
  comidas. Fuera el factor FODMAP conjunto y la «cena tardía» como patrón: la cena tarde y las comidas abundantes
  quedan como nota del reflujo frecuente (y de la pesadez). Tests reescritos (28).
- **Lo que vemos en tu digestión:** progreso «X de 5 apuntes con lo que comiste antes» y tarjeta «Cada cuánto los
  sueles tomar» para contestar o cambiar las frecuencias. Ficha de método (`evidence.ts`) y textos en español al día.
- Comprobado en la web demo local: guardar molestia → paso de comida → grupos deducidos → frecuencias → fila de Hoy
  con «Antes: …» y progreso 1 de 5; reabrir la comida por `?id=`.

## 2026-10-19 — Icono del intestino nuevo y app preparada para Apple Salud

**Publicado 4ca4ac5 el 19/10** con el OK del fundador («publica la app con npm run release», sabiendo que también salía
Digestión a0e488b): EAS Update grupo c2ea682e y las dos webs, todo a la primera con `npm run release`. La migración
`20261018150000_gut_symptom_logs.sql` sigue SIN aplicar (Digestión se guarda en el móvil).

- **Icono del intestino** (`components/IntestineIcon.tsx`): redibujado como la referencia que mandó el fundador:
  un tubo con tres asas que se meten unas en otras y un tramo recto arriba y abajo. Trazo 1,5 (1,7 a partir de
  40 px) para que a 16-17 px se vea el hueco entre las asas. Mismo uso en toda la app (`AppIcon name="intestine"`).
- **Apple Salud** (preparado, sin probar en un iPhone: no hay compilación de iPhone todavía):
  - Librería `@kingstinct/react-native-healthkit` 16.2 + `react-native-nitro-modules` 0.37.
  - `wearables/providers/appleHealth.ios.ts` lee pasos, energía activa y distancia (totales por día de Salud, sin
    duplicar reloj y móvil), pulso medio, pulso en reposo (el del reloj o, si no hay, la media horaria más baja),
    VFC y sueño con fases y horas. `appleHealth.ts` es la versión vacía para Android y web: sus bundles no llevan
    HealthKit, así que la APK publicada no se entera. Mismo formato y tabla (`wearable_daily`, provider
    `apple_health`), así que la web de la app lo enseña sin más.
  - **La VFC de Apple es SDNN**, no RMSSD: se guarda en `hrv` con `raw_type_id = 'HeartRateVariabilitySDNN'`.
    Cualquier umbral absoluto de VFC tiene que mirar ese campo.
  - Salud **no dice qué permisos de lectura se han dado**: «conectado» = ya se enseñó la pantalla de permisos
    (`getRequestStatusForAuthorization`). Lo que no llega sale «Sin datos» con una pista.
  - Sueño: `appleSleepSessions` (seriesLogic) junta los tramos por fuente en sesiones (hueco < 1 h) antes de
    `summarizeSleepSessions`; «en la cama» no cuenta. Fuentes: `appleSourceName` da «Apple Watch» / «This phone»
    por el modelo, nunca el nombre que el usuario puso al reloj. Tests nuevos en `seriesLogic.test.ts`.
  - `syncWearablesIfDue` (dailySeries) elige Apple Salud en iPhone y Health Connect en Android; Hoy sincroniza
    como mucho cada 10 min. Pantalla Wearables: en iPhone, tarjeta «Apple Salud» (conectar, sincronizar, abrir Salud,
    qué llega); en la web salen las dos tarjetas con su aviso.
  - `app.json`: bloque `ios` (identificador **`com.kuovahealth.app`**, pendiente de que el fundador lo confirme
    antes de crear la app en App Store Connect; `supportsTablet: false`; textos de cámara, fotos y micrófono),
    plugin de HealthKit (solo lectura, sin segundo plano) y `locales.es` (`assets/locales/es.json`, textos de
    permisos en español). Perfil `testflight` en `eas.json` (canal `preview`: recibe los mismos `npm run release`).
  - Pasos para el fundador (cuenta de Apple Developer, TestFlight, lo que bloquea la App Store):
    `docs/iphone-y-apple-salud.md`. **Bloqueante para la App Store y Google Play: no hay «Borrar mi cuenta» en la app.**

## 2026-10-19 (tarde) — Peso y composición corporal en Hoy

- Tarjeta **Peso** en Hoy (Biomarcadores): último valor y "Toca pesarse" / "Próxima: lun 26". Abre `/weight-detail`
  (gráfica e historial como el resto de mediciones, tendencia de las últimas semanas, próxima pesada, última
  composición y "Cómo pesarte") y `/log-weight` (ruedas como las demás mediciones + composición opcional a mano:
  grasa %, agua %, músculo kg, hueso kg, con rangos y aviso en rojo).
- Aviso pedido por el fundador: no hace falta pesarse a diario (1-2 kg de un día a otro por comida, sal, líquido
  retenido, ciclo); una vez por semana, mismo día, por la mañana, después del baño y antes de desayunar. Si ya te
  pesaste hace menos de 7 días se explica (no se bloquea); con 3 o más en una semana, aviso en la ficha.
- Datos: tabla genérica `metric_readings` (kinds `weight`, `body_fat`, `body_water`, `muscle_mass`, `bone_mass`),
  **sin migración**. La composición lleva la fecha de la pesada y su id + "-tipo". La pesada más reciente actualiza
  `profiles.weight_kg` (lo usan el menú semanal y otros cálculos). Lógica en `src/logic/weight.ts` (8 tests;
  días de calendario por el cambio de hora). Umbral de "estable" ±0,2 kg/semana = SUPUESTO.

## 2026-10-19 — Entrenamientos: generador, sesión guiada y vista del entrenador (rama `workouts`, juntada con master el 2026-10-19)

Hecho en el worktree `C:\Users\Astor\proyectos\hometest-app-workouts` (rama `workouts`, sale de a0e488b),
porque `master` tenía cambios de la sesión de Apple Salud. Commiteado (9ac1182, e349250), juntado con master (29404af) y publicado el 2026-10-19 (ver al final).

- **Catálogo provisional** (`src/data/workouts/exerciseData.ts`, GENERADO por `scripts/exercise-catalog.py`):
  126 ejercicios de free-exercise-db (commit fijado f00c92c), con patrón de movimiento, material, por tiempo /
  por lado / con saltos, y nombre e indicaciones en español escritos a mano. Dos fotos por ejercicio (inicio y
  final) que `ExerciseLoop` alterna con un fundido, como un GIF de ~2 s. Las fotos se cargan de
  raw.githubusercontent.com (no van en el bundle). **Son provisionales**: el repositorio se declara de dominio
  público pero no dice de dónde salen las fotos (parecen de una web comercial). Antes de usuarios reales,
  sustituirlas por clips propios: solo hay que cambiar `exerciseMedia()` en `src/data/workouts/catalog.ts`.
- **Generador** (`src/logic/workoutGenerator.ts`, 13 tests): objetivo (salud, fuerza, músculo, perder grasa,
  movilidad), nivel, 2-5 días, 20-60 min, dónde (casa sin material / con material / gimnasio) y "sin saltos".
  Reparto: cuerpo completo hasta 3 días, torso/pierna con 4-5; huecos por patrón con alternativas si falta
  material; dosis ACSM 2009 (supuestos, ver backlog clínico); se ajusta a los minutos; determinista por semilla.
- **App**: `/workouts` (programa activo, siguiente sesión, esta semana, cómo progresar, otros programas,
  biblioteca), `/workout-new` (cuestionario + vista previa + "Otra versión"), `/workout-session` (lista y modo
  guiado: vídeo, serie, temporizador, descanso con cuenta atrás; al acabar guarda la sesión en el programa y un
  entrenamiento en `workouts`, que cuenta para las 3 de fuerza), `/exercise-info`, `/exercise-library`.
  La acción de fuerza del plan (Hoy y Plan completo) ahora lleva a `/workouts` (antes, `/log-workout`, que sigue
  desde allí). Entrada "Entrenamientos" en el menú de la web del paciente. En cuentas de prueba y en la demo sale
  un programa de ejemplo "de Álex Romero" (entrenador ficticio).
- **Portal**: sección Entrenamientos (`/pro-workouts`: programas mandados con sesiones hechas, nuevo programa,
  biblioteca) y editor `/pro-workout?patient=` (borrador desde el objetivo del paciente; cambiar ejercicio por otro
  del mismo patrón, series/repeticiones/descanso, indicación por ejercicio, orden, añadir; mandar o actualizar).
  Botón "Crear entrenamiento" en la ficha del paciente. En la demo se guarda en el estado de la demo (Elena y
  Javier ya tienen uno).
- **Supabase**: migración `20261019120000_workout_programs.sql` **APLICADA el 2026-10-19** (OK del fundador;
  `db query --linked` en transacción + `migration repair`) y `REMOTE_HAS_WORKOUT_PROGRAMS = true`; lo guardado en
  el móvil antes se sube la primera vez. Antes decía: PREPARADA, SIN APLICAR (tabla
  `workout_programs`, RLS paciente/profesional con `is_my_patient`, trigger que impide cambiar de quién es).
  Mientras `REMOTE_HAS_WORKOUT_PROGRAMS = false` (`src/data/workouts/programRepository.ts`), los programas propios
  van al móvil y el portal real avisa de que no puede mandar. Decisión pendiente: el profesional ve las sesiones
  hechas del programa que mandó sin pedir el permiso "Actividad y entrenamientos"; si se quiere exigirlo, añadir
  `has_share(patient_id, 'activity')` a su política de lectura.
- Textos en español en `src/i18n/workoutsEs.ts` (se junta con es.ts en `src/i18n/index.ts`).
- Probar: `preview_start expo-web-workouts` (puerto 8086, desde `proyectos/.claude/launch.json`).

## 2026-10-19 — Menús semanales: recetario con datos públicos, generador sin IA y vista del dietista (rama `dietas`, juntada con master el 2026-10-19)

Worktree `C:\Users\Astor\proyectos\hometest-app-dietas` (rama `dietas`, sale de a56610b). Commiteado (8ad0976, fabab6a), juntado con master (b7a2c49) y publicado el 2026-10-19 (ver al final).
Decisiones del fundador (19/10): dieta personalizada completa (también con patologías), fotos generadas con IA, sin IA
en la primera versión (todo programado, 0 tokens), rama aparte.

- **Alimentos** (`src/data/diet/dietData.ts`, GENERADO por `scripts/diet-catalog.py` desde USDA FoodData Central SR
  Legacy 04/2018, dominio público): 111 ingredientes con composición por 100 g, precio orientativo (€/kg, estimación),
  tipo, alérgenos UE y los grupos de Digestión (`logic/foodGroups.ts`). Legumbres de bote = enjuagadas.
- **Recetario**: 95 recetas propias (21 desayunos, ~57 comidas/cenas, 17 tentempiés) en el mismo script, con gramos
  en crudo por ración y pasos en es/en; nutrientes, coste, dieta que admite y alérgenos calculados.
- **Generador** (`src/logic/dietPlanner.ts`, 17 tests): kcal Mifflin-St Jeor × actividad (perder −20 % con suelo),
  proteína por objetivo, objetivos por analítica (LDL, TG, glucosa, ácido úrico, hígado, tensión, hierro, vit. D, B12,
  homocisteína, PCR, omega-3, magnesio, HDL), filtros duros (dieta, alergias, lo que sienta mal, lo que no le gusta),
  blandos (tiempo, dificultad, presupuesto; se aflojan si no hay opciones), cuotas semanales (pescado azul, legumbres,
  carne roja, procesada), variedad, sal por día, raciones a las kcal, "cocinar una vez para dos días", lista de la
  compra. **Deriva al dietista** (sin menú automático): embarazo/lactancia, enfermedad renal o filtrado bajo, potasio
  alto, TCA, insulina o fármacos con hipoglucemia, menores. Reglas = SUPUESTOS (backlog clínico).
- **Contexto** (`src/data/diet/context.ts`): última analítica subida (en cuentas de prueba, la de ejemplo), perfil y
  sospechas del diario de Digestión (premarcadas en "lo que me sienta mal").
- **App**: `/diet` (Día con fotos grandes / Semana en cuadrícula, por qué este menú, resumen, otra versión),
  `/diet-new` (cuestionario de 12 pasos), `/recipe` (ración ajustable, nutrientes, por qué te conviene, ingredientes,
  pasos, cambiar plato), `/shopping-list` (por secciones, casillas, copiar/compartir). Entrada en "Tus nutrientes" y en
  el menú de la web del paciente.
- **Portal**: `/pro-diet?patient=` desde la ficha del paciente ("Crear menú"): borrador con sus analíticas compartidas,
  kcal y proteína fijables, cambiar plato/ración/indicación por comida, mandar o actualizar. Demo: estado de la demo.
- **Supabase**: migración `20261019130000_diet_plans.sql` **APLICADA el 2026-10-19** (OK del fundador) y
  `REMOTE_HAS_DIET_PLANS = true`; lo guardado en el móvil antes se sube la primera vez. Antes decía: PREPARADA, SIN
  APLICAR (`REMOTE_HAS_DIET_PLANS = false`
  en `src/data/diet/dietRepository.ts`): mientras tanto, los menús propios van al móvil y el portal real avisa.
- **Fotos**: 95 con fal (FLUX.2 Pro, 1024×768, estilo "foto de móvil realista, plato blanco, mesa de madera limpia"
  elegido por el fundador tras dos pruebas; ≈3,1 $ en total con las pruebas y 2 repeticiones). Originales y
  `prompts.json` en OneDrive `05 Marca\Contenido IA\2026-10\recetas`; WebP 640×480 (2,2 MB) en
  `assets/images/recipes` con `scripts/recipe-photos.py` (índice `src/data/diet/recipePhotos.ts`, solo lo importa
  `RecipeImage`, para que los tests no carguen imágenes).
- Textos en español en `src/i18n/dietEs.ts`. Probar: `preview_start expo-web-dietas` (8087, con `--clear`).
- **Ojo con los worktrees**: comparten `node_modules` por un junction, y Metro reutilizaba la caché de otro worktree
  (servía pantallas de `hometest-app-workouts`). Por eso las configuraciones de los worktrees arrancan con `--clear`.
- **Notas del fundador (19/10, tarde), hechas en la misma rama**: en el portal, "Tiempo disponible por comida" va en
  su propia sección; macros en donut (proteína/hidratos/grasa, `components/diet/MacroDonut.tsx`, colores validados
  con el validador de dataviz en claro y oscuro, siempre con leyenda en g y %) para la media diaria, cada día y cada
  comida (app y portal); fuera los "× 1,25": en la app se enseñan kcal, y en la receta las cantidades ya salen para
  tu ración, con un selector "para ti / para N personas"; en el portal la ración se ajusta en kcal. **"Tus
  nutrientes" pasa a "Alimentación"** (título, plan y menú de la web): arriba "Hoy en tu menú" o "Construye tu plan"
  (`components/diet/TodayMenuCard.tsx`), debajo "Lo que conviene hoy". El menú va con suscripción: fila
  `diet_menu` en `src/data/access.ts` (gratis no; Basic y Premium sí; editable en /admin-plans), bloqueado como
  "Escanear informes" (en la demo y sin la migración de planes, todo abierto).

## 2026-10-19 (noche) — Publicado: entrenamientos, menús, peso y Digestión en la cuenta

Con el OK del fundador («migra lo de digestión y demás», «publica y push»):

- **Supabase**: aplicada `20261018150000_gut_symptom_logs.sql` (tabla `gut_symptom_logs` con RLS + columna
  `bowel_logs.movements`), con `db query --linked` en una transacción + `migration repair`. Ya estaban aplicadas
  `20261019120000_workout_programs` y `20261019130000_diet_plans`. No queda ninguna migración pendiente.
- **Código**: `REMOTE_HAS_GUT_LOGS = true` (df5f2fb). Lo apuntado en Digestión antes (se guardaba en el móvil
  también con cuenta) se sube solo la primera vez que se abre con cuenta y se borra del móvil
  (`uploadPhoneEntries` en `src/data/digestionRepository.ts`). Las horas de Heces ya se guardan en la cuenta.
- **Ramas** `workouts` (29404af) y `dietas` (b7a2c49) juntadas con master. Conflictos solo de "los dos añaden":
  HANDOFF, `specialistPortal.ts` (estado demo con `workouts` y `diets`), `i18n/index.ts`
  (`{ ...workoutsEs, ...dietEs, ...es }`) y las acciones de la ficha del paciente. Sin dependencias nativas nuevas:
  vale el APK ee97dd7d.
- Peso: «Ya te has pesado hoy» / «Te pesaste ayer» en vez de «hace 0 días» (c99db8f).
- **Publicado c99db8f**: EAS Update grupo `f4bab0a8-321a-4c24-a974-9218827a5989` (preview, android + ios). Con
  ~2 GB de RAM libres se hizo a mano (export `--clear --max-workers 1` de android + ios, luego `eas-cli update
  --skip-bundler`), y después `deploy-web.mjs` y `deploy-web.mjs demo` (las dos webs a la primera).
- Sin probar con una cuenta real: guardar un entrenamiento, un menú y Digestión en Supabase (en la demo todo va al
  móvil). Las fotos de ejercicios (free-exercise-db) siguen siendo provisionales y de origen poco claro.
- Los worktrees `hometest-app-workouts`, `hometest-app-dietas` (y `hometest-app-sleep`) ya no hacen falta.

## 2026-10-19 (noche) — Menús con valores de riesgo: se hace el menú con «¡Atención!»

El fundador no conseguía su menú porque tiene la creatinina alta. Ahora `referralReasons` se parte en `blockingReasons`
(trastorno de la conducta alimentaria, menores de 18: siguen sin menú) y `cautionReasons` (riñón, creatinina o
filtrado, potasio alto, embarazo, insulina). Con una de estas, el menú se hace adaptado (ver la cabecera de
`src/logic/dietPlanner.ts`) y `DietScreen` muestra arriba «¡Atención! Consúltalo con un médico», con el porqué, lo
que lleva de verdad el menú y botones a médico y dietista. Los avisos van en `reasons` con `caution: true`, en el
jsonb de siempre (sin migración). Lo que se vio al probarlo: el generador nunca respetaba la proteína objetivo (salían
~120-150 g); con el riñón ahora la puntuación la limita por cada 500 kcal y con un tope diario, y la cabecera del
menú enseña la proteína real. 0835e16, sin publicar.

Corrección el mismo día (el fundador: demasiado alarmista y «no puedes diagnosticar»): la tarjeta es «Para comentar con
tu médico», neutra (borde con el color de acento, sin rojo). Los textos siguen `prompts/system-prompt.md`: lo de la
analítica, frente al rango del laboratorio («Tu creatinina salió por encima del rango del laboratorio», según el
marcador); lo del cuestionario, «Has marcado: …»; sin «no siempre es el riñón» y sin hablar de dosis. Un test de
`dietPlanner.test.ts` impide que vuelvan las frases de diagnóstico y comprueba que todo está traducido.


**Publicado f139bb0** (2026-10-19, OK del fundador «Publica»): EAS Update grupo `883d4dc4-0434-48f1-ab71-c8429ff7282a`
(preview, android + ios) y las dos webs a la primera. Pasos a mano otra vez (1,7 GB de RAM libres): export `--clear
--max-workers 1`, `eas-cli update --skip-bundler`, `deploy-web.mjs` y `deploy-web.mjs demo`. Sin dependencias nativas
nuevas: vale el APK ee97dd7d.

## 2026-10-19 (noche) — Encuesta del periodo en español, publicada

Las respuestas de la encuesta inicial del ciclo (`CycleGoalScreen`) iban sin `tr()` y salían en inglés aunque la
traducción existía; también el párrafo de la temperatura después de ovular, el objetivo en `CycleGoalPanel` y la
leyenda «Wearable (noche)». 6927ae1, **publicado** (OK del fundador): EAS Update grupo
`1676a3a5-2797-4236-b1ba-3ffd7b346310` y las dos webs a la primera (pasos a mano, 1,4 GB de RAM libres).
Nota: expo-updates descarga la actualización al abrir la app y la aplica la siguiente vez que se abre desde cerrada;
el fundador seguía viendo el menú bloqueado por la creatinina con la versión anterior en el móvil.

## 2026-10-20 — Notas del fundador: ejercicios, menú, «Lo que conviene hoy», creatina

- **Cambiar ejercicios** en tu programa (`WorkoutSessionScreen`): botón ⇄ en cada ejercicio → los del mismo tipo de
  movimiento y con tu material (`ExerciseLibrary forSelf`, «Solo con mi material»); en los principales se mantienen
  series y repeticiones. Si el programa es de su entrenador, se avisa de que lo verá (la fila es suya; RLS ya lo deja).
- **«¿Te has tomado la creatina?» con la toma ya marcada**: el aviso se quedaba en la bandeja. Ahora las reglas con
  `resolvesWhenDone` (toma sin marcar, regla tardía, sin heces 3 días, temperatura, check-in, inactividad) salen de
  la bandeja al dejar de tocar (`pruneResolved` en `logic/nudges/engine.ts`). Los avisos de salud se quedan.
  También: «When needed · N today» de Medicación iba en inglés y contaba el día en UTC.
- **«Lo que conviene hoy»**: en cuentas reales usaba solo el plan (sin analítica): ahora usa la última analítica
  subida (`labFlags` de `data/diet/context.ts`, como el menú). Más sencillo: «Fruta y verdura» y «Una ración de
  proteína en cada comida» primero, como mucho 5; sin «tentempié» si su menú no los lleva; sin empujar la proteína
  con creatinina/filtrado fuera de rango. El plan de «rendir más» ya no habla de hidratos alrededor de las sesiones.
  La clave del día de las casillas pasa a día local (antes UTC).
- **Hoy → Tu plan**: la fila de Alimentación dice «Marca lo que comes bien hoy» (cuenta las casillas de arriba).
- **Menú**: sin tofu ni tempeh si come carne o pescado; en vegetariano 2 y en vegano 3 a la semana como mucho, con
  una nota neutra sobre la soja. Pregunta opcional de **pautas religiosas o culturales** (`customs`: halal, kosher,
  viernes sin carne, Ramadán; dato sensible, apuntado en el borrador de la política). Ramadán: antes del amanecer
  (suhoor) y al romper el ayuno (iftar), raciones hasta 2,25 y aviso para el médico si usa insulina, diabetes o
  embarazo. **Marcar como comida** cada comida de hoy (user_flags `diet_eaten:AAAA-MM-DD`, sin migración).
- **Lista de la compra** con cabecera «Lista de la compra · KUOVA» al compartir, y **menú + lista en PDF** con la
  marca (`utils/menuPdf.ts` + `utils/shareHtml(.web).ts`; móvil: expo-print, ya en el APK ee97dd7d; web: imprimir).
- Precios: siguen siendo estimaciones de supermercado en España (€/kg en `scripts/diet-catalog.py`), sin factor por
  zona. Pendiente: el plan de «rendir más» sigue titulado «Proteína en cada comida» aunque la creatinina salga alta.
- Notificaciones con la app cerrada: no hay todavía (hace falta expo-notifications y un APK nuevo).

**Publicado 7db7587** (2026-10-20, OK del fundador): EAS Update grupo `b6dbf5a4-6ed9-4121-bf48-ef8a84957cc1` (preview,
android + ios) y las dos webs a la primera (pasos a mano: export `--clear --max-workers 1`, `eas-cli update
--skip-bundler`, `deploy-web.mjs` y `deploy-web.mjs demo`). Sin dependencias nativas nuevas: vale el APK ee97dd7d.
Las notificaciones con la app cerrada van en otra sesión (rama propia, necesita APK nuevo con su OK).

## 2026-10-20 — Recordatorios en el móvil con la app cerrada (rama `notificaciones-locales`, juntada con master el 2026-10-20, sin publicar)

- **Qué llega**: notificaciones **locales programadas** con `expo-notifications` (sin servidor ni push). Tomas de
  medicación y suplementos a su hora (solo las que tienen el recordatorio encendido y sin silenciar; varias a la misma
  hora van en un aviso), pesarse a la semana de la última pesada (08:00; si no, a la semana siguiente; tras 4
  semanas se deja), temperatura basal cada mañana a la hora de costumbre (mediana de sus tomas, 07:30 si aún no hay
  3; se deja tras 7 días sin apuntarla) y el check-in (la regla `checkin_missed_3d` evaluada a las 20:00 de los
  próximos días). Lógica pura en `src/logic/nudges/phone.ts`, tests en `src/logic/__tests__/phoneReminders.test.ts`.
- **Reglas**: respeta los interruptores de Notificaciones (temperatura y check-in usan los suyos; nuevo `weigh_in`,
  «Pesarte cada semana»), los silencios, las secciones de la app y `MAX_NUDGES_PER_DAY` contando lo que ya salió ese
  día en la bandeja y en el móvil (prioridad: temperatura, peso, check-in). Las tomas no cuentan para el máximo: son
  alarmas que pide el usuario. Lo que saltó en el móvil también cuenta para la bandeja (`data/phoneReminderLog.ts`).
- **Cuándo se reprograma**: al abrir la app, al volver a ella (como mucho cada 15 min) y tras cada cambio: los
  repositorios y `userFlags.set` avisan por `data/dataEvents.ts` y `data/phoneReminders.ts` recalcula (una semana
  vista, máx. 60 por el límite de 64 de iOS) y solo cancela/programa la diferencia (ids estables). Marcar una toma
  cancela su aviso y lo quita de la barra si ya había salido. Al cerrar sesión se borra todo.
- **Permiso**: nunca al arrancar. Sale el del sistema al encender recordatorios de un medicamento o la temperatura del
  ciclo; tras pesarse o un check-in (con 3 días o más) primero un diálogo propio («¿Te avisamos en el móvil?»). Cada
  motivo, como mucho una vez al mes. En Ajustes → Notificaciones, tarjeta «En el móvil» (Activar / Abrir ajustes /
  Próximos avisos / Desactivar en este móvil). Además del permiso hace falta el «sí» en Kuova (en Android ≤ 12 el
  permiso viene dado). Dos canales Android (`tomas` alta, `recordatorios` normal), con el texto oculto en la
  pantalla bloqueada. Icono `assets/images/notification-icon.png` (la K blanca), color `#2E7D5B`.
- **APK publicado sin el módulo**: `expo-notifications` se carga con `requireOptionalNativeModule` (como expo-print).
  En el APK ee97dd7d y en la web no hace nada y sigue la bandeja como hasta ahora. Para que lleguen hace falta un APK
  nuevo (`eas build --profile preview`, mismo keystore) y, en iOS, el build `testflight` (el plugin añade el
  entitlement `aps-environment`; EAS lo sincroniza con el App ID). Sin `SCHEDULE_EXACT_ALARM`: Android puede
  retrasar unos minutos un aviso con el móvil en reposo.
- **APK nuevo (2026-10-20, con OK del fundador)**: EAS build `bffff89c` (perfil preview, mismo keystore, commit e35e1fb
  de esta rama), solo Android: https://expo.dev/artifacts/eas/UhATCBM_hWAOE6IRWwRm8dc10zjemfRuAhwzsiXDR_A.apk
  iOS no: EAS aún no tiene credenciales de Apple (la primera compilación de iPhone la lanza el fundador con su Apple ID).
  **Juntar esta rama con master antes del próximo `npm run release`**: si sale una release de master sin ella, el APK
  nuevo pasa a la JS sin recordatorios y los ya programados (hasta una semana) siguen saltando sin cancelarse.

## 2026-10-20 (tarde) — Timbre del entrenamiento y consultas en la Agenda (master, sin commit ni publicar)

- **Consultas en la Agenda**: la Agenda nunca leía las citas con especialistas (`consult.myAppointments()`); solo Hoy.
  Ahora salen como tipo `consult` (verde) con hora local, duración y estado («Pendiente de confirmar» / «Confirmada»),
  y una videoconsulta real confirmada se abre desde la tarjeta («Entrar en la videollamada»). Las canceladas no salen.
  `consultationEvent(s)` en `src/data/consultations.ts`; `appointmentTitle` y `canJoinVideo` en `specialistTypes.ts`;
  `summaryAppointments` en `logic/summary.ts` (Hoy y el resumen de la web del paciente, que no mostraba consultas).
- **Timbre**: suena al acabar el descanso, al acabar un ejercicio por tiempo y a mitad de los que van por lado
  («Cambia de lado»). Hoja «Sonido» desde la campana del modo guiado o la fila «Sonido: Campana» de la lista:
  interruptor para silenciarlo y 4 tonos (Campana, Cuenco, Tres toques, Pitido; suenan al tocarlos). Preferencia por
  móvil (`workoutBell.v1`). Tonos sintetizados con `scripts/workout-bells.py` → `assets/sounds/kuova_*.wav` (sin
  licencias de terceros). En la app suenan con expo-audio, mezclados con la música y también con el móvil en silencio.
- **Cuenta atrás por la hora**: antes restaba 1 por tic y con la pantalla bloqueada se paraba (React Native no da
  temporizadores en segundo plano). Ahora guarda la hora de fin (`endsAt`) y al volver marca lo que queda; si el
  ejercicio acabó bloqueado, el descanso cuenta desde que acabó. Lógica en `src/logic/workoutTimer.ts` (tests en
  `workoutTimer.test.ts`, también los de la agenda).
- **Con la pantalla bloqueada**: al pasar a segundo plano se programan avisos locales (`expo-notifications`, ids
  `entreno-*`, no `kuova-*` para que los recordatorios no los cancelen) para cada final que quede (cambio de lado,
  fin del ejercicio y fin del descanso siguiente); al volver se cancelan y se quitan de la barra. El permiso se pide
  una vez al empezar la primera sesión guiada con sonido, o desde la hoja. Necesita un APK con expo-notifications
  (bffff89c o posterior); con ee97dd7d solo suena con la app delante.
- **APK 1.1.0 (construido el 2026-10-20 con OK del fundador, EAS build `01beee90`, commit ac1bff3 = código de e9045d3, solo Android)**: https://expo.dev/artifacts/eas/C9T1bG5kYt2Ng2FcUI3xRuytyx8FdGmA9Kigs2OGZLY.apk — sustituye a bffff89c (no hace falta instalar esa antes). Lo que lleva: `app.json` lleva ya `version` 1.1.0, los 4 WAV en `sounds` del plugin de
  expo-notifications (res/raw) y `SCHEDULE_EXACT_ALARM`. Un canal Android por tono (`entreno-campana`…; el sonido de un
  canal no se puede cambiar). La app sabe si la APK los lleva por `nativeApplicationVersion` ≥ 1.1.0 (`lockToneAvailable`
  en `data/workouts/bell.ts`); con bffff89c usa el canal `entreno` con el tono de avisos del móvil (crear un canal con
  un sonido que no está en la APK lo dejaría con el tono por defecto para siempre). Sin alarmas exactas (bffff89c, o
  Android 14+ sin «Alarmas y recordatorios» permitido) Android puede retrasar el aviso; la hoja lo explica. Si se
  cambian los tonos, regenerar con el script y hace falta otra APK para la pantalla bloqueada.
- Sin probar en un móvil: el aviso con la pantalla bloqueada y los canales. Probado en la web (demo): reserva → sale en
  la Agenda; fin de descanso, cambio de lado y fin de ejercicio suenan; silenciado no suena.

## 2026-10-20 (noche) — Edad KUOVA real (PhenoAge), insignia difuminada, Agenda por meses y consultas sin duplicar

- **Edad KUOVA con datos reales**: `src/logic/phenoAge.ts` = PhenoAge (Levine 2018, tabla 1; coeficientes de
  `phenoage0` de BioAge; Liu 2018 trae erratas). Pasa las unidades españolas a las del modelo (PCR mg/L ÷ 10 antes
  del logaritmo, albúmina g/dL × 10, glucosa mg/dL ÷ 18,016, creatinina mg/dL × 88,42, leucocitos por µL ÷ 1000) y
  rechaza las que no sirven (ADE en fL, PCR sin unidad). Suelo de PCR 0,01 mg/dL. No calcula con PCR > 10 mg/L ni
  fuera de 20-84 años. `kuovaAgeFromUploads` (`logic/kuovaAge.ts`) usa la analítica subida completa más reciente y la
  fecha de nacimiento; si hay otra completa antes, compara.
- **Margen en vez de "% de confianza"**: propagación de errores con los CVi de la EFLM (biologicalvariation.eu,
  consultada el 20/10) y CVa = CVi/2 (Fraser, el mínimo exigible: el margen real puede ser algo mayor, sobre todo por el
  ADE y el % de linfocitos). Sustitutos sin entrada propia: % linfocitos → linfocitos absolutos, ADE-CV → ADE-SD,
  FA total → FA hepática. Sale unos ±3 años (95 %); un cambio entre analíticas solo se enseña si supera √(m1² + m2²)
  (`realChange`), si no «sin cambio real». Todo en la lista del asesor (`kuova-clinical-review-backlog`).
- **Informes de ejemplo corregidos**: 25,5 ± 3,0 (actual) y 31,3 ± 3,1 (inicial), lo que dan sus propios valores; los
  «drivers» son solo valores de PhenoAge (años frente a un adulto típico, `phenoAgeDrivers`). Un test comprueba que
  cuadren. `rulesEngine/computeBiologicalAge` ya calcula con el mismo módulo (antes lanzaba un error).
- **Insignia difuminada** (cuenta real sin Edad KUOVA): la misma insignia con el fondo desenfocado (expo-image
  `blurRadius`) y «00,0» desenfocado en SVG (`FeGaussianBlur`; Text no admite blur en iOS), nunca una cifra real. 9
  puntos con los valores que ya tiene y una frase según el motivo: faltan valores («Mide tu albúmina, PCR y fosfatasa
  alcalina o pide la analítica completa…», enlace a la tienda: la «Analítica esencial» no trae 7 de los 9), falta la
  fecha de nacimiento, edad fuera de rango, PCR alta o unidad ilegible. El detalle enseña los 9 marcados.
  «VCM» y «ADE» añadidos como alias en `knowledge/biomarcadores/hematologia.json`.
- **Agenda**: abre en el mes (no en un día): «Próximas citas» y debajo «Citas pasadas» (más apagadas, sin añadir al
  calendario, «Ver la cita»); tocar un día lo filtra y «Todo el mes» vuelve. Una cita de laboratorio pasada ya no se
  puede cambiar ni cancelar: «Pedir otra cita» en el mismo centro.
- **Consultas sin duplicar**: al reservar, si hay una consulta con ese especialista pedida en los últimos 7 días que
  sigue en pie (`recentAppointmentWith` en `specialistTypes.ts`; las citas guardan `createdAt`), arriba sale «Ya pediste
  una para el…» y al pulsar «Solicitar» se pregunta: sin respuesta, cambiarla o dejarla; confirmada, además cancelarla.
  Al cambiarla, la anterior solo se cancela si la nueva se guarda. Solo en reservar consulta, no en «Enviar una solicitud».
- Probado en la web (cuenta real local y demo). Todo JS: llega por EAS Update también a los APK anteriores.

**Publicado e9045d3** (2026-10-20 noche, OK del fundador): EAS Update grupo `82ecdd33-5570-48d2-aed3-4b5b7c5431a0`
(preview, runtime exposdk:57.0.0) y las dos webs (hometest-app y hometest-demo) a la primera con `npm run release`.
Incluye el timbre del entrenamiento (3ef2529): en los APK 1.0 solo se degrada; el APK 1.1.0 se construye desde aquí.

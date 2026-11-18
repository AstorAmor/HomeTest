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
- **Entorno de pruebas (desde 2026-11-09)**: app «Kuova Pruebas» (canal `staging`) contra la base «Kuova pruebas»
  (`bujbvrozmtcnnmhvkupj`). Todo cambio de base de datos, función o ajuste de Auth va **primero ahí**:
  `npm run release:staging -- "qué cambia"` y `docs/entorno-de-pruebas.md`. Ojo: el canal `pruebas` es la beta de
  amigos y va contra **producción**.

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
- **Fuera de los buscadores (2026-11-09, rama `web-noindex`)**: la web de Kuova es kuovahealth.com; la app y la demo no
  deben indexarse. `scripts/deploy-web.mjs` añade en las dos `X-Robots-Tag: noindex, nofollow` en todas las rutas
  (`headers` de `vercel.json`) y `<meta name="robots" content="noindex, nofollow">` en `index.html`. Solo web: la app
  nativa no pasa por ahí. **No** poner un `robots.txt` con `Disallow`: el buscador no entraría y no vería el noindex.
  Comprobado sin exportar (poca RAM): con la exportación web de 3340800, la salida solo cambia en esas dos cosas, y
  `vercel build` local genera la ruta de la cabecera para todo. Si se republica sin esta rama, el noindex desaparece.
  **Publicado el 2026-11-09 solo en la web** (OK de Astor «Sí, publícalo»), sin `npm run release` ni compilar: copia de
  `deploy/hometest-app` y `deploy/hometest-demo` (lo que estaba en vivo, de 3340800) con solo la meta y la cabecera, y
  `npx vercel deploy --prod --yes` en cada una. Mismos bundles (`index-c929cdf8…` app, `index-3325658b…` demo); `curl -sI`
  da `X-Robots-Tag: noindex, nofollow` en `/`, en rutas internas y en los JS de las dos. La carpeta `deploy/` de la
  copia principal no se tocó (sigue sin el noindex hasta la próxima publicación con esta rama).

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
- **2026-10-23, «Seguir este programa» y atrás**: al seguir otro, la lista vuelve arriba (antes en el hueco pulsado
  salía el anterior con el mismo botón y parecía que no hacía nada). Con cuenta, el ejemplo vive en el móvil y el
  resto en Supabase: `save` ahora deja de seguir los de los dos sitios, y `onlyOneActive` en `list()` enseña uno
  solo como el tuyo (el del entrenador llega ya activo y antes escondía el otro). Al crear un programa o acabar una
  sesión, `router.dismissTo('/workouts')` en vez de `replace` (quedaban dos listas y «atrás» volvía a la misma).
  Test: `src/logic/__tests__/workoutPrograms.test.ts`.

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

## 2026-10-20 (noche) — Notas del fundador: entrenamiento, medicación, edad KUOVA, resultados, suscripción, transiciones, objetivos

- **Timbre que no sonó**: con la app delante suena (probado en web); lo probable es que la pantalla se apagara sola en el
  descanso (a los ~30 s) y ahí depende del aviso del móvil. Ahora la pantalla se queda encendida durante la sesión
  (`expo-keep-awake`, que ya viene con Expo en todas las APK; añadido a package.json sin cambiar nada nativo). Sin
  confirmar en el móvil del fundador.
- **Entrenamiento**: lápiz en cada ejercicio de la lista (`components/workouts/DoseEditor.tsx`): series, por
  repeticiones o por tiempo (min + s), y descanso (0–5 min de 15 en 15), con ruedas. −15 s en el descanso.
  `timedSeconds/isTimedReps/timeText` pasan a `logic/workoutTimer.ts` y leen "1 min 30 s".
- **Medicación**: «Borrar» en el menú (⋮ junto a la campana) y papelera en la edición; borra el medicamento y sus tomas
  (`deleteMedication` en medicationRepository). «Lo he dejado» sigue guardando el historial.
- **Edad KUOVA**: el detalle salía a trozos (primero «Cómo se calcula», luego lo de arriba). Ahora sale con lo que ya
  calculó Mis datos (`data/kuovaAgeCache.ts`) y, sin eso, todo a la vez tras un indicador. «Pedir la analítica
  completa»: no existe como producto suelto; lleva al pago de Kuova Basic (o a Laboratorio si ya tiene suscripción).
  Decisión de negocio abierta: ¿vender el panel completo suelto?
- **Resultados**: «Todos tus valores» de una analítica guardada en formato compacto (`components/LabValuesList.tsx`);
  la revisión al escanear sigue con LabReportTable (deja corregir). Barra de rango (`components/RangeBar.tsx`, lógica en
  `utils/rangeBar.ts` con tests): verde dentro, naranja fuera, límites debajo y triángulo en el valor. También en «Para
  revisar». El RangeBar antiguo no lo usaba nadie y se sustituyó.
- **Mi suscripción**: la comparación va dentro (`components/PlanComparison.tsx`, también en /compare-plans) con la
  columna de tu nivel marcada («Tu plan»: la suscripción pagada o el acceso por invitación/admin; gratis si nada).
- **Configura tu experiencia**: SectionToggles no pasaba los textos por t() (las traducciones ya existían).
- **Transiciones**: al tocar una pestaña, fundido corto en vez de deslizar por todas las de en medio; en la web las 5
  quedan montadas (antes se recargaba Hoy entera). Tema: `Updates.reloadAsync` con `reloadScreenOptions` del color del
  tema nuevo, sin rueda y con fundido (antes salía la pantalla de carga blanca); fundidos algo más largos con easing.
- **Objetivos del día** (`/daily-goals`, modal desde los círculos de «Tu estado de hoy»): pasos, kcal activas, sueño y
  distancia con ruedas; se sugieren los del plan (pasos y sueño) o generales (8.000, 500 kcal, 7 h 30, 6 km;
  kcal y distancia = SUPUESTO); se guarda solo lo cambiado en user_flags 'daily_goals.v1'. `logic/dailyGoals.ts`.
- **Lo que no va en tu plan**: `components/SubscribePopup.tsx` «Suscríbete a Kuova Basic» (el nivel más barato que lo
  incluye según la tabla), con Ver suscripciones / Tengo un código / Ahora no; al cerrar vuelve atrás. En escanear
  informes, el menú semanal y crear el menú (las funciones bloqueadas hoy: scan_reports y diet_menu). No visto en la
  web: la demo tiene todo abierto.

**Publicado 671d0c8** (2026-10-20 noche, OK del fundador «Haz commit de todo y publica con npm run release»): EAS Update grupo `04ded867-6945-4d87-8eef-43c50e64e6da` (preview, android + ios) y las dos webs a la primera (`npm run release` entero, con 2,8 GB libres). Llega a las APK ee97dd7d, bffff89c y 1.1.0 al cerrar y abrir la app.

## 2026-10-20 (noche, 2) — Ajustes tras probar 671d0c8

- Círculos de «Tu estado de hoy» otra vez repartidos (el botón que los envuelve no ocupaba todo el ancho).
- Objetivos sugeridos según cada persona (`logic/dailyGoals.ts`, tests en `dailyGoals.test.ts`): pasos 8.000 antes de
  los 60 y 7.000 desde los 60, sueño 7 h 30 (9 h en menores de 18), o los del plan si los tiene; kcal activas = lo
  que gastan esos pasos con su peso (0,5 kcal/kg/km) + 30 min/día de actividad moderada (3 MET netos, OMS 150-300
  min/semana); distancia = pasos × zancada (41,5 % de la altura, 41,3 % en mujeres). Peso y altura de referencia si
  faltan. Textos «Para tu edad», «Para tus pasos, tu sexo y tu peso»… y (i) con fuentes (evidence 'daily_goals').
- Pestañas: vuelve el deslizamiento lateral al tocarlas (el fundido no gustó) y `offscreenPageLimit` = 4 para que
  Android no suelte las pestañas que no se ven (al volver a Hoy la repintaba entera mientras deslizaba: ese era el
  salto). Web: sin fundido, pestañas montadas. El fundido se queda solo para el cambio de tema.
- Medicación: una hora añadida a mano no se quita al tocarla; lleva su ×. «¿A qué hora?» y «Añadir 09:00» en español.

**Publicado ea28241** (2026-10-20 noche, OK del fundador «Haz commit de todo y publica con npm run release»): EAS Update grupo `018cfd62-9cf4-434c-aa8f-54efe51b4a41` (preview, android + ios) y las dos webs a la primera (`npm run release` entero, aunque solo había 1,4 GB libres).

## 2026-10-21 — Notas del fundador: especialista, filas de resultados, originales, entrenamiento, edad KUOVA, permisos

- **Habla con un especialista** (/talk-to-specialist, desde Tu plan y el plan del informe): era un prototipo en inglés
  que no enviaba nada; ahora en español, eliges médico, dietista o entrenador y te lleva a /professionals?role=… (reserva
  de verdad).
- **Resultados**: una sola fila para «Para revisar» y «Todos tus valores» (`components/LabValueRow.tsx`): nombre con el
  valor debajo, estado a la derecha («En rango», «Por encima»…), flecha para desplegar qué es, para qué se mide, qué
  puede moverlo y qué ayuda (en rango: «Nada que cambiar…» si no hay regla del plan), y la barra de rango.
- **Originales en Tus archivos**: al guardar una analítica escaneada se suben también las fotos o el PDF al bucket
  privado `lab-files` (ya existía, esquema inicial; políticas solo del dueño) en `<usuario>/uploads/<id>/<n>.jpg|pdf`,
  sin tabla nueva (se listan por carpeta). «Ver original» → /lab-original (fotos en la app, PDF con el visor del móvil).
  Lo subido antes no tiene original. En la demo no se guarda. Pendiente (tarea en next-actions): la política de
  privacidad debe decir que se guarda una copia (lleva nombre y datos del laboratorio); al borrar la cuenta habrá que
  borrar también esa carpeta.
- **Sigue aprendiendo → Entrenamiento**: tarjeta «Tu plan de entrenamiento · Construye tu plan» (o ir a tu programa)
  como el menú en Alimentación (`components/workouts/TrainingPlanCard.tsx`). Sin bloquear todavía; cuando vaya con
  suscripción, SubscribePopup y una fila en la tabla de planes.
- **Edad KUOVA, ida y vuelta**: el «00,0» difuminado era un SVG con FeGaussianBlur (en Android se calcula por software
  cada vez que se pinta: tirón al entrar y al volver a Mis datos). Ahora es una imagen ya pintada
  (`scripts/kuova-age-blur.py` → `assets/images/kuova-age/blur_*`). Sin probar en el móvil.
- **Permisos al abrir por primera vez** (`components/PermissionsIntro.tsx`, en el layout): ventana «Antes de empezar» con
  avisos, Health Connect / Apple Salud, cámara y fotos, micrófono: para qué y cuándo se piden, y que se puede decir que
  no. «Continuar» pide ya el de avisos (turnOnPhoneReminders); el resto sigue pidiéndose al usarlo. Una vez por
  instalación (AsyncStorage `permissionsIntro.v1`); quien ya tenía la app también la ve una vez.

**Publicado ee21efa** (2026-10-21, OK del fundador «Haz commit de todo y publica con npm run release»): EAS Update grupo `e41021c1-99c8-495d-a15c-48e05acfed8b` (preview, android + ios) y las dos webs a la primera (`npm run release` entero, 1,7 GB libres).

## 2026-10-21 (tarde) — Tutorial guiado

- **Qué es**: pantalla oscurecida con un hueco sobre cada parte principal y un bocadillo («3 de 9», título, texto,
  Saltar / Siguiente); tocar el hueco también avanza. 9 pasos: pestaña Hoy, check-in, «Tu estado de hoy», Tu plan,
  pestaña Mis datos, Edad KUOVA, Subir un informe (Laboratorio), pestaña Agenda y la fila «Tutorial» de Más. Cambia de
  pestaña con el deslizamiento normal y baja hasta el elemento si está más abajo (nativo: measureLayout contra
  `innerViewRef` + scrollTo; web: scrollIntoView sin «smooth», que con la ventana abierta no bajaba). Al irse de una
  pestaña, la deja otra vez arriba. Vuelve a medir cada 0,5 s por si algo carga tarde y mueve el elemento.
- **Código**: `src/components/tour/` (tourStore: pasos, registro de elementos, empezar, «en marcha»; TourTarget;
  TourOverlay, montado en MainTabsScreen y su variante web, apagado en la web de escritorio). Los pasos cuyo elemento
  no está (sección apagada en Configura tu experiencia) se saltan. `inset` ajusta el hueco a la tarjeta cuando el
  View ocupa todo el ancho.
- **Cuándo sale**: al terminar los cuestionarios del inicio (también con «Omitir»; flag AsyncStorage
  `tour.pending.v1`, también si antes pasa por la presentación del plan) y desde Más → Tutorial. Los avisos de
  bienvenida de Hoy (perfil genético, ciclo) esperan a que acabe (`useTourActive`).
- Probado en la web (demo, 375 × 812): sale tras los cuestionarios, los 9 huecos caen sobre su elemento, las pantallas
  vuelven arriba y el aviso del perfil genético sale al acabar. En el móvil sin probar (coordenadas con
  statusBarTranslucent y edge-to-edge).

## 2026-10-21 (noche) — Cuentas reales por defecto, ciclo tipo Flo, IMC, temperatura con ruedas, contraseña

- **Cuentas**: toda cuenta es real (sin selector «developer», sin datos de ejemplo, directa a los cuestionarios).
  Solo los probadores pueden tener cuenta de prueba: `is_tester()` en Supabase (admins y los «+alias» del email de un
  admin; sin emails en el código), migración `20261021100000_testers.sql` (aplicada el 2026-10-21, ver abajo). Sin ella, la app
  trata como probadores solo a los admins (`amITester` en data/dataMode.ts). «Cuenta real» y «Casos de prueba» en
  Ajustes, solo para probadores (`isTester` en AuthContext).
- **Primer arranque**: fuera la pantalla «Construyendo tu plan…» y las de presentación del plan (/plan-intro sigue
  existiendo pero ya no se llega desde los cuestionarios) y el bloque «Tu plan de partida» de «¿Qué quieres
  conseguir?». Al acabar: Hoy y el tutorial.
- **Encuesta del ciclo** (CycleGoalScreen): empieza vacía (no carga respuestas guardadas), «¿Qué quieres hacer?» con
  varias a la vez (`goals`; `goal` = la principal para lo que ya lo usaba), y preguntas nuevas: última regla
  (calendario; se apunta como primer ciclo si no hay uno esos días), duración del ciclo y de la regla (ruedas, «No lo
  sé»), regularidad y sangrado, dolor y síntomas (multi), anticonceptivo (lista completa; `hormonalContraception` se
  deduce), diagnósticos (multi) y, si busca embarazo, lo de antes. Con sangrado muy abundante o dolor fuerte, una nota
  neutra para comentarlo con la ginecóloga. La predicción usa la duración que dijo mientras no haya dos reglas
  apuntadas (`currentCyclePhase(…, typicalLength)`). Todo en español. Las preguntas de Flo que pasó el fundador no
  estaban guardadas en ningún sitio (eran capturas): hecho con las habituales de Flo.
- **Temperatura** (LogTemperatureScreen): ruedas (grados + centésimas de 5 en 5; basal 35–38, termómetro hasta 41) y
  textos en español.
- **Peso** (WeightInfo): IMC con la altura del perfil y el último peso (barra de rango 18,5–24,9 de la OMS, textos
  neutros, en menores de 18 solo orientativo) con «Qué dice y qué no»; composición en donut (kg de grasa, músculo,
  hueso y resto; el agua aparte). `bmi`, `bmiBand`, `compositionSlices` en logic/weight.ts con tests.
- **Entrar / crear cuenta**: ojo para ver la contraseña (components/PasswordInput.tsx), «Repite la contraseña» al
  crearla, errores de Supabase en español y, con «Confirm email» activado, aviso de que te hemos enviado el correo
  (signup devuelve 'confirm_email' en vez de lanzar un error).
- **Correo desde hello@kuovahealth.com**: se configura en el panel de Supabase (SMTP de M365 con la contraseña del
  buzón: lo hace el fundador; tarea en next-actions). Plantilla en español lista para pegar:
  `supabase/templates/confirmar-cuenta.html`.

**Publicado 46f2578** (2026-10-21, OK del fundador «Haz commit de todo, publica con npm run release y aplica la migración de probadores en Supabase»): migración 20261021100000_testers aplicada antes (db query --linked en una transacción + migration repair; comprobada con claims simulados: alias «+» de un admin = true, otro email = false). EAS Update grupo `06f0cbd1-ac80-448e-8eb9-25efcf679c3e` (preview, android + ios) y las dos webs a la primera. Incluye el tutorial guiado. Sin migraciones pendientes. Falta (fundador): SMTP de hello@kuovahealth.com y «Confirm email» en Supabase.

## 2026-10-21 — iPhone: lo que se puede preparar sin cuenta de Apple (master, sin commit)

Guía completa y pasos del fundador en `docs/iphone-y-apple-salud.md` (actualizada hoy).

- **Fecha y hora en iPhone** (`components/DateTimeSheet.tsx`): las pantallas de tensión, glucosa, peso y métricas
  sueltas pintaban `DateTimePicker` en modo rueda al pie de la pantalla, y en iOS esa rueda no se cierra sola ni
  trae botón: se habría quedado abierta. Ahora en iOS va en una hoja abajo con «Hecho» (cada giro ya cambia el
  valor); en Android y web sigue el diálogo del sistema, igual que antes.
- **app.json**: `NSPhotoLibraryAddUsageDescription` (sin él, «Guardar imagen» en la hoja de compartir de iOS cierra
  la app); texto del permiso de Salud ampliado a peso, entrenos, tensión, glucosa, oxígeno, temperatura y
  respiración (el texto es nativo: así se pueden leer más tipos con una actualización); `expo-audio` con
  `enableBackgroundPlayback: false` y fuera `FOREGROUND_SERVICE` / `FOREGROUND_SERVICE_MEDIA_PLAYBACK` de Android
  (nada reproduce en segundo plano: `shouldPlayInBackground: false` en todas partes). Afecta solo a la próxima
  compilación nativa; la APK 1.1.0 instalada no cambia.
- Ajustes → Permisos dice «Apple Salud» en iPhone, y la tarjeta de Huawei en Wearables explica que en iPhone
  Huawei Health puede escribir en Salud.
- Comprobado sin Mac: `npx expo config --type introspect` (Info.plist con los dos idiomas, entitlement de HealthKit,
  `aps-environment`, sin `UIBackgroundModes`). `expo prebuild --platform ios` no funciona en Windows. tsc + 380 tests.
- Sigue faltando antes de la App Store: **borrar la cuenta desde la app** (también lo pide Google Play) y la
  decisión de cómo se cobra en iPhone (tareas del fundador ya en next-actions).

## 2026-10-21 (tarde) — Lote de notas del fundador: baño, agua, tutorial, disposición, dietas del especialista, gota de la orina

Con el OK del fundador («Primero actualiza la app», tras «No publiques aún; sigue con el resto y lo publicamos todo junto»),
publicado junto con lo del iPhone de la sección anterior. Detalle de cada ronda en la memoria del proyecto (hometest-app-wip).

- **Barra de pestañas en Android**: desaparecía (el `flex: 1` del botón dentro de la columna del tutorial daba alto 0).
- **Resultados**: unidades con `UnitLabel`, grupos «Para revisar / En rango / Sin referencia» (los contadores bajan a su
  grupo), «Qué se ha asociado a mejores valores» con matices (`utils/labEvidence.ts`) o «habla con un médico».
- **Ciclo** traducido; **Acceso profesionales** en el login (el alta del profesional se guarda en
  `user_metadata.pending_professional` y la fila se crea al primer inicio de sesión).
- **Agua**: `metric_readings` tipo `water` (sin migración), objetivo diario EFSA por sexo, «+» en Hoy, `WaterCard`,
  `/log-water` con rueda; cantidad habitual del «+» (`user_flags water_usual_ml`); Hidratación en su azul `Colors.water`.
- **Hoy**: Digestión e Hidratación con dos capas (caritas / agua, y debajo las veces del baño con «+»); Objetivos del día
  con «En Hoy / Oculto» por objetivo.
- **Orina y heces del día**: «¿Cuántas veces hoy?» con − / + y «Cada vez» (`components/BathroomVisits.tsx`: hora,
  color, escozor o forma de Bristol, prisa). Heces en `bowel_logs.movements`; orina en **`urine_logs.visits`**:
  migración `20261021120000_urine_visits.sql` **aplicada el 2026-10-21** (db query --linked en una transacción +
  migration repair; columna jsonb comprobada) y `REMOTE_HAS_URINE_VISITS = true`.
- **Colores de la orina con forma de gota** (la de la infografía de la newsletter n.º 1): `UrineDrop` en
  `components/BathroomVisuals.tsx` (borde #D9CFBE en los tonos muy claros, brillo, motas en «Turbia», anillo de selección
  con la forma de la gota, check oscuro en los tonos claros) y `ColorSwatches shape="drop"`; también en la fila de cada
  vez y en la vista previa de Hidratación. Las heces siguen con círculo.
- **Tutorial**: 23 pasos, «Saltar», pasos con `route`; «Configura tu experiencia» también en Más.
- **Disposición** (readiness) nueva en `computeReadiness`: VFC y pulso en reposo frente a tus 28 días anteriores, sueño
  frente a tu objetivo y fase lútea; rangos por fecha de calendario; cerrar sesión limpia el usuario al momento.
- **Portal del especialista**: sección Dietas (`/pro-diets`), macros del día y por comida, porciones que se reajustan
  (`fitPortions`, hasta 4 raciones) y detalle por día con sus propios objetivos.
- tsc + 380 tests. Sin migraciones pendientes de la app (la `20261021180000_newsletter.sql` es de la newsletter de la web,
  de otra sesión: ni aplicada ni en este commit).

**Publicado 9317547** (2026-10-21 noche, OK del fundador «publica ya 9317547 (EAS Update y las dos webs) con los pasos a mano»; el fundador había vuelto a perder la barra de abajo en Android, que es el fallo de 46f2578 arreglado en este commit). `npm run release` no valía por la migración de la newsletter sin commitear, así que a mano con 1,2 GB de RAM libres: `expo export --clear --platform android --platform ios --max-workers 1` a la primera, `eas-cli update --skip-bundler` → grupo `38f8c912-ae08-46f7-89e0-865d49dbf259` (preview, android + ios) y las dos webs con `deploy-web.mjs` a la primera.

## 2026-10-22 — Próxima regla estimada en la tarjeta del ciclo (publicado 6dd588a)

Petición del fundador al revisar «La app, por dentro» de la web: «según tus registros, te debería venir la regla en X días» también en la app.
- Ya había una predicción: el detalle del ciclo llama a `predict-cycle` (mediana de los últimos 6 ciclos, margen por desviación de 2 a 7 días, «N días de retraso»), solo con 2 reglas o más y con conexión. Lo nuevo se calcula en el móvil con el mismo método, así que la fecha coincide con la de esa tarjeta (hay un test que lo comprueba).
- `currentCyclePhase()` (`src/utils/cyclePhase.ts`) devuelve ahora `next`: fecha, días que faltan, margen, base (ciclos apuntados o la duración de la encuesta), estado y el texto en inglés con su nota (se traducen con `t()`). Cuarto argumento opcional: la encuesta del ciclo (`regularCycles`, `hormonalContraception`).
  - Textos: «Según tus últimos ciclos, tu próxima regla llegaría en unos 20 días» / «más o menos mañana» / «más o menos hoy» / «por estos días» (pasada la fecha, dentro del margen) / «se esperaba hace N días. Si ya te ha venido, apúntala». Sin apuntar ninguna en más de un ciclo entero: «Tu última regla apuntada fue hace N días. Si has tenido alguna después, apúntala para estimar la siguiente». Con una sola regla y la duración de la encuesta: «Según la duración de ciclo que nos indicaste, …».
  - Una nota de cuánto fiarse (solo la que más pesa, y no cuando ya pasó la fecha): método hormonal marcado; ciclos que se diferencian más de 7 días («Entre tus últimos ciclos hay hasta N días de diferencia, así que puede adelantarse o retrasarse»); ciclos irregulares marcados en la encuesta (con menos de 3 ciclos apuntados); uno o dos ciclos apuntados; o solo la encuesta.
  - No sale con el ciclo de ejemplo de la demo (`isSample`) ni con una sola regla sin duración en la encuesta (los 28 días por defecto no son un dato suyo).
- Cambia también: el día del ciclo se cuenta por días del calendario (antes cambiaba a mediodía); la duración es la mediana de verdad redondeada como `predictCycle` (con ciclos de 27 y 30, 28 en vez de 30); si la regla se retrasa, el día sigue contando («Día 31», fase lútea, marcador al final de la barra) en vez de volver al día 1, y solo pasado un ciclo entero sin apuntar vuelve a dar la vuelta como antes.
- Dónde sale: en la tarjeta del ciclo (`CycleStrip`) de Hoy y Mis datos; arriba del detalle del ciclo (la misma tarjeta, sin el ejemplo; el aviso «Apunta al menos 2 reglas» se oculta si ya hay estimación); y en el resumen web, como texto de la tarjeta del ciclo. El detalle manda a `predict-cycle` el día local (`toDayKey`) en vez de `fecha.slice(0, 10)`, que con reglas guardadas a medianoche daba el día anterior.
- Tests: `src/utils/__tests__/cyclePhase.test.ts` (13: ciclos regulares, cambio a medianoche, misma fecha y margen que `predictCycle`, mañana y hoy, retraso dentro y fuera del margen, sin registros recientes, ciclos irregulares, pocos ciclos, encuesta, método hormonal, demo y traducciones). tsc + 393 tests. Los textos nuevos pasan también las reglas de `healthTexts.test.ts` (rama `textos-sin-diagnostico`, sin unir).
- **Publicado 6dd588a** (2026-10-22, OK del fundador «OK, release 6dd588a with npm run release»): EAS Update grupo `562b7ece-87d1-4749-bc8b-401b9ae06f2e` (preview, android + ios) y las dos webs a la primera; el texto nuevo está en los bundles publicados de hometest-app y hometest-demo. `npm run release` no valía porque la nota de 9317547 de otra sesión seguía sin commitear en HANDOFF, así que los mismos pasos a mano con ~2 GB de RAM libres: push, `expo export --clear --platform android --platform ios --max-workers 1`, `eas-cli update --skip-bundler --input-dir dist` con `EAS_SKIP_AUTO_FINGERPRINT=1`, `deploy-web.mjs` y `deploy-web.mjs demo`. Sin dependencias nativas nuevas: no hace falta APK.

## 2026-10-22 — Orina: sin avisos de «pocas veces hoy» (publicado ce6506c)

Nota del fundador: al marcar 2 veces, la app le decía que había orinado poco hoy; «no ha terminado el día… No aporta nada. Aporta el color o luego una revisión semanal».
- `hydrationFromUrine()` (`src/logic/bathroom.ts`), la etiqueta de hidratación de Hoy, del resumen web y de Digestión → Vejiga, sale solo del color. Antes, 3 veces o menos movía la regla un punto hacia «Signos de deshidratación» y, sin color, ponía «Podrías beber un poco más». Ahora, sin color: «Añade el color».
- `urineAdvice()` (el aviso al guardar) ya no tiene «Pocas veces hoy»; quedan los del color (rojo, marrón, ámbar, amarillo oscuro, turbia) y el escozor. Fuera sus dos textos de `es.ts`. `LogUrineScreen` ya no necesita quitar las veces al apuntar sobre la marcha.
- Revisión semanal (`urineObservations`): «Orinas poco» y «Orinas muy a menudo» se calculan solo con los días ya terminados; las veces de hoy no bajan la media.
- Tests: `planAndHydration.test.ts` (las veces de hoy no cambian la hidratación ni dan aviso; el color y el escozor, sí) y `bathroomFertility.test.ts` (la semana sin el día de hoy). tsc + 395 tests.
- **Publicado ce6506c** (2026-10-22, OK del fundador «OK, release ce6506c (EAS Update and both webs)»): EAS Update grupo `6c06b671-bed7-4239-9c0b-50e78b29b3ae` (preview, android + ios) y las dos webs a la primera; el texto «Pocas veces hoy» ya no está en los bundles publicados. Mismos pasos a mano que 6dd588a (la nota de 9317547 de otra sesión sigue sin commitear), con ~1,4 GB de RAM libres. Sin dependencias nativas nuevas: no hace falta APK.

## 2026-10-23 — Historial de medicación editable (publicado 258bf6b)

Petición del fundador: un histórico que no se vea de entrada; al pulsar, cada día con lo que tocaba, editable («ayer se me olvidó marcar la medicación, pero la tomé»), para ver si cada día tomó lo que corresponde.
- Pantalla nueva `/medication-history` (`MedicationHistoryScreen`). Se entra desde Medicación y suplementos (fila «Historial» bajo las tomas de hoy) y desde Tus últimos días (la línea «Medicación: x de y tomas» abre ese día con `?date=`). Arriba, los 7 días hasta ayer («4 de 7 días con todo tomado · Tomaste 18 de 21 tomas · 1 sin tomar · 2 sin marcar»); debajo, cada día plegado con un punto por toma y «Todo tomado» / «2 de 3 tomadas · 1 sin marcar» / «Nada previsto». Al tocarlo se despliega: cada toma con «Tomada / No tomada» (tocar la marcada la deja sin marcar) y lo de «solo cuando haga falta» con − n +. 14 días por página, desde el primer alta.
- `setDoseStatus()` y `addAsNeededDose()` en `medicationRepository.ts`: se corrige el registro que había (sin duplicar) y lo de «cuando haga falta» de un día pasado va a mediodía de ese día, para que no cuente como de hoy.
- `dosesForDay()`: lo marcado a una hora que ya no está en la pauta (se cambió la hora o la zona horaria) cuenta para la toma sin marcar de ese día; un doble toque en una hora que sí está no marca la siguiente. Afecta también a Hoy, Tus últimos días, el resumen web y los avisos.
- `DoseRows`: un doble toque en «Tomada» apuntaba la toma dos veces; ahora se ve marcada al momento y no se puede repetir.
- Limitación: la pauta no se versiona, así que los días pasados se juzgan con la pauta de ahora (si pasa de 2 tomas a 1, los días anteriores salen con 1).
- Tests: `medication.test.ts` (hora cambiada, doble toque, otro día, días del historial, resumen del día, «cuando haga falta»). tsc + 401 tests. Probado en la web local (8084, datos de prueba en el navegador): marcar ayer, cambiar a «No tomada», dejar sin marcar, + de ibuprofeno, corregir una toma apuntada a la hora antigua y el enlace desde Tus últimos días.

## 2026-10-23 — Entrenamientos: «Crear mi propia rutina» y sesión tipo Hevy (rama `rutina-propia`, 164d1b6, juntada con master el 2026-10-23)

Petición del fundador: crear una rutina a mano como en Hevy o Strong y acercar la sesión a esas apps. Eligió «las dos» vistas
de sesión (lista tipo Hevy por defecto y modo guiado a un toque). Worktree `C:\Users\Astor\proyectos\hometest-app-rutinas`,
sale de eb3dd7c; probar con `preview_start expo-web-rutinas` (puerto 8090, demo sin Supabase, en `proyectos/.claude/launch.json`).
- **Rutina propia** (`/workout-custom`, `CustomRoutineScreen`; con `?program=` se edita): nombre, días A–G (añadir, quitar,
  nombre opcional; sin nombre se llama «Día A»), «Añadir ejercicios» con la biblioteca en modo de elegir varios
  (`ExerciseLibrary selectedIds`, pie fijo «Añadir N ejercicios» con `WorkoutModal footer`), ↑↓, quitar y el lápiz de siempre
  (`DoseEditor`) con **peso por serie** (`withWeight`, solo si el ejercicio lleva mancuernas, pesa rusa, barra o máquina:
  `isLoadable` en catalog.ts). Se guarda como un `WorkoutProgram` más: `source 'self'`, `prefs.custom = true`,
  `WorkoutExercise.weightKg` (lógica en `src/logic/customRoutine.ts`). En Entrenamientos: botón «Crear mi propia rutina» y
  «Editar» en la tarjeta de las rutinas propias; el generador ya no parte de las respuestas de una rutina propia.
- **Biblioteca**: desplegables «Músculo» y «Material» (también «Sin material») además de los grupos; salen en la app, al elegir
  ejercicios y en el portal (no en «Cambiar ejercicio», que ya filtra por patrón).
- **Sesión** (`WorkoutSessionScreen`): la vista previa enseña «La última vez: 20 kg × 10, 10, 8» en cada ejercicio y dos
  botones, «Empezar» (lista) y «Modo guiado». Lista tipo Hevy: cada ejercicio con su tabla (`SetTable`: Serie · Anterior ·
  kg · Reps · ✓; por tiempo, Duración con ▶ y su cuenta atrás); al marcar empieza el descanso en una barra abajo (−15/+15/Omitir);
  «+ Añadir serie», «Quitar serie»; «Terminar» (pregunta si quedan series sin marcar). Modo guiado: el de antes (vídeo,
  timbre, avisos con la pantalla bloqueada) con la tabla del ejercicio debajo y la fila en curso marcada; se cambia de una
  vista a otra sin perder nada (el descanso sigue). En gris, lo que se guarda si se marca sin escribir: la misma serie la
  última vez; si no, el peso de la fila de arriba; si no, la rutina (`rowHints`). «Omitir» en el guiado ya no abre descanso.
- **Resumen**: minutos, series, «N kg en total» (peso × reps) y por ejercicio la mejor serie frente a la mejor de la última
  vez («Más peso / Más repeticiones / Igual que la última vez», «Primera vez que lo apuntas»; si baja, solo «La última vez: …»).
- **Datos**: cada serie va en `completions[].sets` (`{ exerciseId, kg?, reps?, sec? }`) dentro del jsonb que ya existe; el peso
  de la rutina, en `sessions`. **Sin migración.** «La última vez» se busca en todos los programas (`lastTimes`).
- Tests: `workoutLog.test.ts` y `customRoutine.test.ts` (14). tsc + 409 tests. Probado en la web (demo, 375 px): crear,
  filtrar, elegir varios, ordenar, peso, dos días, guardar, entrenar en lista y en guiado, plancha por tiempo, resumen,
  segunda sesión con comparación, editar.
- **Al juntar con master**: otra sesión cambió a la vez `router.replace('/workouts')` por `router.dismissTo('/workouts')` y
  arregló «Seguir este programa» (`programRepository.onlyOneActive`, `WorkoutsScreen.use`). Esta rama ya usa `dismissTo` en la
  sesión y en la rutina; en `WorkoutSessionScreen` vale la versión de esta rama (lleva su cambio). Choques esperables: final de
  `workoutsEs.ts` y de HANDOFF (los dos añaden).
- Pendiente: el portal no deja poner peso ni ve las series apuntadas (están en `completions`); la sesión en marcha no
  sobrevive a cerrar la app; al cambiar series en la sesión no se ofrece actualizar la rutina (Hevy lo pregunta).

**Publicado 258bf6b** (2026-10-23, OK del fundador «junta la rama rutina-propia con master, pasa tipos y tests, compruébalo
en la web y publica todo»): historial de medicación (fcfa8c9), «Seguir este programa» y atrás (0ee9fd6) y la rutina propia
tipo Hevy (164d1b6, juntada en 7b6a0cb; solo chocó el final de HANDOFF). tsc limpio (tras regenerar los tipos de rutas con el
servidor de Expo: `.expo/types/router.d.ts` no tenía `/workout-custom`) y 417 tests. Probado en la demo web (8082): crear una
rutina con dos ejercicios, entrenarla en lista marcando 12 kg × 10, terminar y guardar (las series quedan en `completions`),
atrás desde la lista va a Inicio, «Seguir este programa» en el ejemplo, y el historial de medicación con una vitamina D de
prueba (ayer marcada → «Todo tomado»). `npm run release` a la primera con ~4,2 GB libres: EAS Update grupo
`de7d6b9c-c2f3-4c7b-9a17-22ef418b4daa` (preview, android + ios) y las dos webs; los bundles publicados llevan las tres cosas.
Sin dependencias nativas ni migraciones nuevas: no hace falta APK. Con la cuenta real no se ha probado el guardado en Supabase.

## 2026-10-23 (tarde) — Entrenamientos: la sesión, como Hevy, y el «se queda atascado» al deslizar (rama `entreno-hevy`, publicado 5d8288e)

Nota del fundador (pasada por otra sesión, con captura de Hevy en Android): «los entrenos no me gustan, quiero que sea como
hevy (… que se vea todo, poner fácilmente el peso de cada uno… una interfaz fácil y sencilla)» y «da algo de fallo cuando
quieres deslizar hacia abajo la ventana, se queda atascado». Worktree `hometest-app-rutinas`, rama `entreno-hevy` desde faa7500.
- **Sesión como Hevy** (`WorkoutSessionScreen`, vista por defecto): arriba ✕, nombre, modo guiado (cámara), timbre y
  «Terminar»; debajo **Duración · Volumen · Series** en vivo. Cada ejercicio (`components/workouts/ExerciseBlock.tsx`):
  miniatura redonda y nombre en color (tocar = cómo se hace), «Objetivo: 3 × 8–10 · 20 kg», chip **«Descanso: 1 min 30 s»**
  que se cambia ahí (no, 30 s … 3 min; solo para hoy) y la tabla (`SetTable`, rehecha): número de serie en su casilla (tocarlo
  quita la serie si no está hecha, con confirmación), Anterior, **casillas grandes** de kg y reps (42 px), ✓ grande y
  **«+ Añadir serie» a todo el ancho**. Al final, **«+ Añadir ejercicio»** (biblioteca, elegir varios; dosis de partida de
  `addExercises`) y «Descartar el entrenamiento». El ▶ de la tarjeta de Entrenamientos empieza ya (`?start=list`); tocar el
  resto de la tarjeta abre la vista previa como antes. Modo guiado y resumen, igual (con la tabla nueva).
- **Atascos al deslizar**, tres arreglos: (1) el lápiz (`DoseEditor`) ponía tres ruedas de 200 px una debajo de otra en una
  ventana más alta que el móvil: para bajar había que arrastrar sobre una rueda y la rueda se llevaba el gesto. Ahora series,
  reps (o min y s) y descanso van en una fila y el peso debajo: cabe sin deslizar. (2) `WorkoutModal` envolvía el ScrollView en
  un Pressable (el fondo que cierra): ahora el fondo va detrás, como capa aparte, y el ScrollView lleva `nestedScrollEnabled`.
  (3) el reloj de la sesión repintaba toda la lista cada segundo: ahora cuenta en su propio componente (`Elapsed`) y los
  bloques son `memo` con acciones estables. No probado en un Android de verdad: confirmar con el fundador en qué pantalla le
  pasaba.
- «Atrás» (o el gesto) a mitad de la sesión pregunta «¿Parar la sesión?» (`beforeRemove`); en el resumen, «¿Salir sin guardar?».
- En la web, las casillas de texto no encogían por debajo de su ancho natural y se comían «Anterior»: `minWidth: 0`.
- tsc + 417 tests. Probado en la web demo a 375 px: empezar desde ▶, cambiar el descanso, apuntar 22,5 × 10 (volumen 225 kg,
  1/10), quitar una serie, añadir un ejercicio, el lápiz sin deslizar, el modo guiado y el «atrás» que pregunta.
- **Quitar ejercicios y ver más** (nota del fundador: «necesito poder ver más… no puedo eliminar ejercicios»):
  - «Editar» en la tarjeta de **cualquier** programa y en la vista previa de la sesión (abre ese día): es el editor de rutinas
    (`CustomRoutineScreen`), que ahora cambia también los del generador y los del entrenador («Álex verá el cambio»): quitar
    (✕), añadir (antes de los estiramientos), ordenar y el lápiz. Etiqueta «Calentamiento · …» / «Vuelta a la calma · …» en
    esos ejercicios. Un programa del generador sigue siéndolo al guardarlo (mismas respuestas, mismo tipo de día):
    `customProgram` con `base` ya no lo marca como rutina propia y `cleanDays(days, keepFocus)`.
  - En la sesión tipo Hevy, papelera en cada ejercicio: lo quita de la sesión de hoy (la rutina no cambia).
  - «Cambiar ejercicio»: además de los del mismo tipo y con tu material, **«Ver todos los ejercicios»** (toda la biblioteca
    con sus filtros; antes podían salir solo 2).
  - Los 25 ejercicios de gimnasio que añadió la otra sesión (fondos para pecho y para tríceps, press inclinado con barra…)
    están en la carpeta principal sin commit: no en esta rama. (Después: commit c353b65 en master, juntado en esta rama
    con 5d8288e.)

**Publicado 5d8288e** (2026-10-23 tarde, OK del fundador «todo con master, commit, publish y tal»): master avanzó sin
merge hasta `entreno-hevy` (0fd75a7 sesión tipo Hevy + c353b65, 25 ejercicios más, 151 en total). tsc limpio y 418 tests.
Probado en la demo web (8082, 471 px): la sesión enseña Duración / Volumen / Series arriba, «Anterior» con lo de la última
vez, cajas grandes de kg y reps; al marcar 14 kg × 10, volumen 140 kg y 1/6 series, barra de descanso; terminar → resumen
«Más peso que la última vez» → guardar vuelve a la lista con las series en `completions`; la biblioteca dice 151 ejercicios.
El atasco al deslizar en Android sigue sin probar en un móvil. `npm run release` a la primera con ~3 GB libres: EAS Update
grupo `0151dcca-38b4-4a59-95a6-351392ffddfa` (preview, android + ios) y las dos webs; los bundles publicados llevan la
sesión nueva. Sin dependencias nativas ni migraciones: no hace falta APK.

## 2026-10-23 (tarde, 2) — Editar la rutina serie a serie, como Hevy, y el teclado que tapaba la casilla (rama `rutina-series`, e5bfd15; publicado e283f0c)

Nota del fundador (pasada por la sesión principal, con captura de «Edit Routine» de Hevy): «tienes que ir ejercicio a ejercicio
y se me complica más… que te aparezca para un ejercicio cada una de las series, peso y reps… el teclado tapa el input».
Worktree `hometest-app-rutinas`, rama `rutina-series` desde a893b6c.
- **Editor como Hevy** (`CustomRoutineScreen`, crear y «Editar» cualquier programa): arriba Cancelar · título · Guardar; el
  nombre grande con ✕; los días; y todos los ejercicios del día a la vista (`components/workouts/RoutineExerciseCard.tsx`):
  miniatura y nombre (tocar = cómo se hace), ⋮ (subir, bajar, cambiar por otro, quitar), chips «Descanso» y «Nota», y la tabla
  **Serie · kg · Reps** con una fila por serie (tocar «Reps ▾» lo pasa a segundos y al revés; tocar el número quita la serie;
  «Añadir serie» copia la última). Sin lápiz ni ruedas. Salir con cambios sin guardar pregunta.
- **Datos**: `WorkoutExercise.setPlan?: { kg?, reps }[]` (en el jsonb `sessions`, sin migración). Solo se guarda si las series
  no son todas iguales; siempre se guarda también el resumen (`sets`, `reps` «8–12», `weightKg` de la primera), que es lo que leen
  el generador, el portal y lo guardado antes. Lógica en `src/logic/setPlan.ts` (`plannedSets`, `withPlan`, `applyDose`) y en
  `customRoutine.ts` (`toDraft`, `fromDraft`, `switchTimed`). El lápiz de la vista previa y el portal (cambiar series o reps)
  vuelven a series iguales; si solo cambia el descanso, se respetan.
- **Sesión**: lo que sale en gris en cada serie es el objetivo de la rutina para esa serie (peso y reps; por tiempo, sus
  segundos y su temporizador); «Anterior» sigue mostrando la última vez. Cambio de criterio: antes el peso salía de la última
  vez antes que de la rutina; ahora manda la rutina si dice peso (si no, la última vez, como antes) y las reps son siempre las
  de la rutina. «Objetivo: 4 × 8–12 · 17,5–20 kg».
- **Teclado** (`components/KeyboardAwareScroll.tsx`, sin dependencias nativas): con Expo 57 la app va de borde a borde y en
  Android la ventana no encoge con el teclado. Con el teclado fuera se deja su alto de hueco debajo y se sube lo justo para ver la
  casilla enfocada (`measureInWindow` frente a `keyboardDidShow.screenY`; el `scrollResponderScrollNativeHandleToKeyboard` de RN
  da por hecho que el ScrollView empieza arriba de la pantalla); en la web, `scrollIntoView` al centro. Lo usan el editor y la
  sesión (lista y guiado). **No probado en un Android de verdad.**
- tsc + 424 tests (`setPlan.test.ts` nuevo, `workoutLog.test.ts` con el nuevo criterio). Probado en la web móvil (375 px): poner
  20 × 8, 20 × 8–10, 17,5 × 12 y añadir una 4.ª serie, guardar (setPlan en el jsonb; la sentadilla, sin tocar, sigue sin él), la
  sesión con esos objetivos por serie y «Anterior», y que al tocar una casilla de abajo sube al centro (737 → 448 en la sesión,
  745 → 413 en el editor).

**Publicado e283f0c** (2026-10-23 tarde, OK del fundador «haz commit de los 26 ejercicios con «+kg», pasa tipos y tests,
compruébalo en la web y publica todo»): editor de rutina serie a serie y teclado (e5bfd15, rama `rutina-series` juntada sin
merge con su OK) + 26 ejercicios más y lastrados con «+kg» (e283f0c, commit de la sesión del catálogo: `CatalogExercise.load`
'added' / 'none', `isLoadable` y `kgHead` en catalog.ts; 177 en total). tsc limpio y 425 tests. Probado en la demo web: la
biblioteca dice 177; en «Crear mi propia rutina», «Dominadas lastradas» sale con columna «+KG» y el press Arnold con «KG», una
fila por serie. `npm run release` a la primera con ~3 GB libres: EAS Update grupo `2cfab6cb-4aee-46db-bf71-530718fa5842`
(preview, android + ios) y las dos webs; los bundles publicados llevan «+kg», `Weighted_Pull_Ups` y el editor. Sin dependencias
nativas ni migraciones. El teclado en Android y el atasco al deslizar siguen sin probar en un móvil.

## 2026-10-23 (noche) — iPhone: cuenta de Apple, compilación de simulador y primera compilación de TestFlight

- El fundador pagó Apple Developer **como particular** (Apple ID de Gmail; equipo «Astor Garcia», C9CLVQ3G4L) y la cuenta ya
  está activa. Solo sirve para TestFlight: la norma 5.1.1(ix) pide que las apps de salud las publique la sociedad (Pulse Health
  con D-U-N-S, y pasar la cuenta a organización). Detalle en `docs/iphone-y-apple-salud.md` (puntos 2, 4 y 6, al día).
- `eas.json`: perfil `simulator` (canal `preview`, `ios.simulator`, sin credenciales de Apple) para Appetize.io. Compilación
  c20b8d6b-8b31-4e21-910a-3abc7a60adfa terminada (la primera de iPhone: compila HealthKit y nitro-modules). Sin probar en Appetize.
- Identificador `com.kuovahealth.app` confirmado por el fundador. Compilación de TestFlight fbe640b3-655d-418d-9df0-75376a0b9cdd
  (perfil `testflight`, 1.1.0, compilación 2) terminada en ~7 min; EAS guardó el certificado y el perfil en sus servidores.
- `eas submit --platform ios --id fbe640b3…` (perfil de subida `production`): registró el identificador, creó la app «Kuova» en
  App Store Connect (ASC App ID 6826360385, ya en `submit.production.ios.ascAppId` junto a `language: "es-ES"`), el grupo de
  TestFlight «Team (Expo)» con el Apple ID del fundador y una clave de la API de App Store Connect (rol ADMIN, guardada en EAS)
  para que las próximas subidas no pidan contraseña. Envío 1962bd00-31f5-45bb-a9fe-4d0dd3441d49.
- El fundador no tiene iPhone: para probar en un móvil hay que invitar a alguien como usuario de App Store Connect y probador
  interno.
- **2026-10-24: Apple rechazó la compilación 2 al procesarla** (correo de las 20:57, ITMS-90683): falta
  `NSHealthUpdateUsageDescription`. El plugin de HealthKit lo quitaba porque en `app.json` estaba a `false` (solo leemos), pero la
  librería lleva el código de escritura y Apple pide el texto igualmente. Ahora es un texto que dice que Kuova no guarda nada en
  Salud (inglés en `app.json`, español en `assets/locales/es.json`); comprobado con `npx expo config --type introspect`. Nueva
  compilación de TestFlight con `--auto-submit-with-profile production` (sube sola con la clave de la API guardada en EAS).
  Compilación 3 (23c1d3d1-d7c1-439b-b740-1c36dbd7048f) terminada y subida a App Store Connect sin pedir nada (envío
  0acf315c-7343-4f61-938a-affe56734620). Falta que Apple la procese sin rechazos.

## 2026-10-26 — El entreno a medias ya no se pierde al bloquear el móvil, e historial de entrenos (889334b, publicado)

Nota del fundador: entrenando, tras bloquear el móvil unas 4 veces entre series, la app «se reinició», le sacó del entreno y
perdió lo marcado; y quiere un historial sencillo, sin editar, de lo entrenado.

- **Causa:** la sesión en curso vivía solo en el estado de `WorkoutSessionScreen`. Con la pantalla bloqueada Android puede matar
  el proceso para liberar memoria y, al volver, la app arranca de cero. No hay recarga propia al volver (expo-updates solo
  aplica en arranque en frío; el tema solo recarga al cambiarlo a mano), así que la causa más probable es esa; un cierre por
  error se arregla igual.
- **Arreglo:** `src/data/workouts/activeWorkout.ts` copia la sesión en AsyncStorage (`workouts.active.v1`, con el id del
  usuario) en cada cambio: ejercicios de hoy, filas, vista, serie en curso, descanso o temporizador (por la hora de fin), modo
  resumen e intensidad. La pantalla compara el JSON tras cada pintado y solo escribe si cambió. Al abrir esa sesión se restaura
  tal cual (la cuenta atrás sigue por la hora y se cancelan los avisos del móvil pendientes); `src/app/index.tsx` la abre sola
  en el primer arranque si se tocó hace menos de 6 h; Entrenamientos y la vista previa de otra sesión muestran «Entreno a
  medias» (`components/workouts/UnfinishedWorkout.tsx`) con Seguir y Descartar, y empezar otra sesión pregunta antes de
  descartarla. Se borra al guardar, al descartar o al salir confirmando.
- **Guardar sin conexión:** antes, si `logCompletion` fallaba, el botón se quedaba desactivado y se perdía la sesión. Ahora
  avisa, el botón pasa a «Reintentar» y la copia del móvil se queda; al reintentar usa la misma hora y no repite la sesión si ya
  se guardó. `programRepository.logCompletion` lanza un error si no encuentra el programa (antes volvía sin guardar nada).
- **Historial** (`/workout-history`, `screens/workouts/WorkoutHistoryScreen.tsx`, lógica en `src/logic/workoutHistory.ts`): por
  meses, más reciente arriba; cada sesión de programa con día, minutos, series, kilos y las series de cada ejercicio
  (`setsText`), y los entrenos de la tabla `workouts` apuntados a mano. El de `workouts` que se guarda con cada sesión (misma
  hora, margen de 2 s) no se repite. Si se borra un programa, sus sesiones siguen en el historial por ese registro (día, tipo
  y minutos, sin series); el aviso de borrar programa lo dice. Guardarlas siempre pediría una tabla propia (migración).
- tsc limpio y 433 tests (nuevo `workoutHistory.test.ts`). Probado en la demo web (recargar = proceso muerto): con 2 series
  marcadas (22 kg) y el descanso en marcha, recargar desde «/» vuelve a la sesión con la duración y el descanso siguiendo
  (0:49, no 1:00); también en el resumen antes de Guardar; el aviso de Entrenamientos y «Seguir»; Guardar sin el programa da
  el aviso y «Reintentar» lo guarda después; el historial no duplica la sesión.

**Publicado 889334b** (2026-10-26, OK del fundador «Commit it to master and publish it with npm run release»): EAS Update grupo
`2b3b83da-1025-4169-8b94-9788e06bb193` (preview, android + ios) y las dos webs (los bundles llevan `workouts.active.v1` y
`/workout-history` responde 200). Sin dependencias nativas ni migraciones: no hace falta APK. Falta probar en un móvil que,
tras bloquearlo varias veces entre series, vuelve al entreno.

## 2026-10-30 — «Tu plan personalizado» con tus datos, sin consejos genéricos (master, publicado 02bcde7)

Nota del fundador: «Tu plan» → «Tu plan personalizado»; la tarjeta resaltada solo la primera vez; el plan completo debajo de
fuerza, comida y caminar; y nada genérico («Mantén tu horario de sueño regular» sin más): cada acción con lo que hace ahora y
lo recomendable, y solo si no lo cumple ya.

- **Hoy:** título «Tu plan personalizado»; debajo, las acciones con una línea de dónde estás (`PlanItem.detail`), luego
  «Ya cumples» (`planKept`) y al final «Tu plan completo» (→ /action-plan), con borde dorado solo hasta abrirlo una vez
  (user_flag `full_plan_opened.v1`, lo pone ActionPlanScreen). El tutorial (`today.plan`) señala ahora la lista.
- **Datos que mira el plan** (`src/logic/planHabits.ts`, pura): pasos de media de los 14 días anteriores a hoy (≥7 días) y
  entre semana / fin de semana; sueño de las 14 últimas noches (≥5) con media y desviación típica de la hora de acostarse y
  de levantarse (`sleep_start`/`sleep_end`); entrenos de fuerza y sesiones de calma por semana en las últimas 4 semanas (menos
  si empezó a registrar hace poco; sin ningún registro, no se usa); estrés alto en check-ins (4-5 de 5, o ánimo estresado o
  ansioso, ≥3 check-ins en 14 días); azúcar añadido de las comidas (≥5 en 14 días). Hoy lo calcula con la serie del reloj
  que ya tiene; el resto de pantallas con `loadPlanHabits()` (planRepository; en cuentas de prueba sin datos, el reloj de
  ejemplo).
- **`buildPlan(profile, habits)`** (`src/logic/plan.ts`): con datos, manda lo medido sobre lo que contó. Pasos: «Camina 2.000
  pasos más al día» + «Haces 5.600 de media (últimos 14 días); tu meta es de 7.500», y el bache del fin de semana en el cómo.
  Fuerza: «Añade 1 sesión de fuerza a la semana» + «Has registrado 4 en las últimas 4 semanas (1 a la semana); lo
  recomendable son 2 o más a la semana». Sueño: si duerme <7 h, «Duerme 40 min más cada noche» con desde qué hora adelantar;
  si no, horarios solo si la hora varía ±45 min o más (`PLAN_LIMITS.timingSdNotable`; meta <±30 min, grupo de referencia de
  MESA, Huang 2020), con entre semana / fin de semana y la hora de su despertador. Calma: sesiones y estrés marcado. Comida:
  «Azúcar añadido en 3 de tus últimas 6 comidas»; si es un tercio o más y no hay condición, la acción pasa a «Reduce el azúcar
  añadido». Lo que ya cumple sale del plan y va a «Ya cumples». Sin reloj, a quien duerme 7 h o más ya no se le pone «Mantén
  horarios regulares». Ya no se rellena hasta 3 con acciones de 0 puntos; la cuarta entra si suma 4+ puntos o sale de un
  hueco medido (`measured`), para que un sueño irregular no se quede fuera por tener ya pasos, fuerza y comida. Las horas se
  redondean a 5 min y el aviso para desconectar va 30 min antes de la hora de acostarse entre semana. Los círculos de Hoy
  siguen con las metas del plan de las respuestas (`buildPlan(profile)`), así que no cambian.
- Hoy va en corto (fundador: «añades mucho texto de primeras»): una línea por acción (`PlanItem.short`: «6617 al día · meta
  8000», «0,8 a la semana · meta 2», «Al acostarte: ±59 min · meta ±30», «Azúcar en 3 de 6 comidas») y «Ya cumples» igual
  (`PlanKept.short`: «Pasos: 8800 al día · meta 8000»). La frase entera (`detail`) y el porqué van en el plan completo.
- Plan completo: la línea de datos en negrita bajo cada acción y «Ya cumples» en su bloque. «Tus planes» usa el mismo plan.
  Evidencia «Cómo hacemos tu plan»: dos párrafos nuevos y la fuente de MESA.
- tsc limpio y 447 tests (nuevo `planHabits.test.ts`; el de «más de 8 h y dormir mejor» ahora espera que no salga el sueño).
  Probado en la demo web (español, móvil): con el reloj de ejemplo, pasos y sueño salen en «Ya cumples»; con datos de prueba
  (acostarse 23:25 entre semana y 01:30 el fin de semana, 6.617 pasos, 3 sesiones de fuerza en 4 semanas, 3 de 6 comidas con
  azúcar) salen las 4 acciones con sus cifras; «Tu plan completo» pierde el borde dorado tras abrirlo; sin errores en consola.
- **Publicado 02bcde7** (2026-10-30, OK del fundador «Commit y publicar»): EAS Update grupo
  `e33b1d04-e5ab-4470-976d-c90a30e08e28` (preview, android + ios) y las dos webs (comprobado en los bundles en vivo). Sin
  migraciones ni dependencias nativas.
- **Pendiente:** revisión médica de umbrales (±45 min, 1/3 de check-ins con estrés, 1/3 de comidas con azúcar); probar en un
  móvil con datos reales.

## 2026-10-30 (tarde) — El plan con metas: Hoy en corto, el plan completo como página intermedia (master, publicado c5849bb)

Nota del fundador sobre lo publicado en 02bcde7: «Añade 2 sesiones de fuerza a la semana / 1,3 a la semana · meta 3 / 3/3 esta
semana» era un caos. Quiere la meta como título («Completa 3 sesiones de fuerza a la semana»), debajo solo «3/3 esta semana», y
al tocar, la explicación («De acuerdo a tu información, realizas 1 día de fuerza… Las guías recomiendan…») y luego el programa.
«Tu plan completo» es esa página intermedia. Además: preguntar fuerza, cardio y pasos en el cuestionario; en Hábitos, check-in,
meditación y agua sin ser intrusivo; en Nutrición, las tomas de medicación que se ha saltado.

- **Hoy:** cada acción es su meta (`title`) + barra + avance de la semana o del día («3/3 esta semana», «10.915 hoy», «0 L hoy»;
  la regularidad del sueño trae su avance fijo en `PlanItem.progress`). Sin línea de datos (se quitó `PlanItem.short`). Tocar una
  acción abre `/action-plan?focus=<kind>`. Como mucho 2 acciones del mismo bloque (antes salían 3 de actividad física); la cuarta
  es la primera que quede con 4+ puntos o medida (antes, solo si caía justo en la posición 4).
- **Plan completo** (`ActionPlanScreen`): todas las acciones con puntos (`buildFullPlan`), no solo las de Hoy, por bloques. Cada
  una: meta, `detail` en negrita («Según tus registros, has hecho 4 sesiones de fuerza en las últimas 3 semanas: 1,3 a la semana
  de media. Las guías recomiendan hacer fuerza 2 o más días a la semana; para tu objetivo, 3.» / «Nos dijiste que…» / «Según tu
  reloj…» / «Según lo que apuntas…»), el porqué, el cómo y un botón a lo suyo (`PLAN_ITEM_ACTION`: «Ir a tu programa de fuerza»,
  «Apuntar un entreno de cardio» → `/log-workout?type=cardio`, «Apuntar lo que bebes», «Hacer un check-in», «Ir a tu medicación»…).
  Con `focus`, baja hasta esa acción (onLayout del bloque + de la acción, una vez cargado todo) y la marca con borde dorado.
  «Tus planes» usa también `buildFullPlan`.
- **Acciones nuevas** (`src/logic/plan.ts`): cardio (actividad; meta 3 días, 2 si está sentado casi todo el día; OMS 150 min/semana;
  cuenta entrenos `cardio` y `sport`), agua (hábitos; solo si apunta lo que bebe 5+ días de 14; meta `waterForSex`; entra si bebe
  menos del 90 %), check-in (hábitos; solo a quien lo usó y hace menos de 4 en 2 semanas; nunca en Hoy) y tomas (nutrición; tomas
  con hora de los 14 días anteriores a hoy, desde el alta: saltadas + sin marcar; «En los últimos 10 días te has saltado 3 de tus
  20 tomas. 1 está sin marcar…»; nunca en Hoy, que ya tiene su tarjeta de medicación). `FULL_PLAN_ONLY = ['medication', 'checkin']`.
  Calma: «Haz 3 sesiones cortas de calma a la semana» (respiración, meditación o body scan), +1 punto si ya las probó y lo dejó.
  `KIND_CATEGORY` vive ahora en plan.ts (planCategories lo reexporta).
- **Cuestionario:** paso nuevo «Tu actividad» (entre cuerpo y hábitos; 8 pasos): cuánto te mueves (se movió aquí), días de fuerza
  y de cardio (Ninguno / 1 / 2 / 3 o más) y pasos al día (5 tramos + «No lo sé»). `UserProfile.strengthDays/cardioDays/stepsBand`;
  se ven en Perfil. Lo registrado en la app manda; lo contado se usa si no registra ese tipo de entreno (o no tiene reloj, para
  los pasos: punto medio del tramo). Si ya llega a la meta por lo que contó, sale en «Ya cumples» («Fuerza 3 días o más a la semana,
  según nos dijiste»).
- **Migración `supabase/migrations/20261030120000_profile_activity_answers.sql` APLICADA el 2026-10-30** antes de publicar (OK
  del fundador «Sí, migrar y publicar»): profiles.strength_days, cardio_days, steps_band con checks. Esta vez con
  `npx supabase db push --linked --yes` tras un `--dry-run` que solo listaba esta (la CLI de npx ya no tiene token de acceso, así
  que `db query --linked` falla; `db push` y `migration list` van por el rol de login). Comprobado: en el historial remoto y
  `GET /rest/v1/profiles?select=strength_days,cardio_days,steps_band&limit=0` da 200. Por si acaso, `toRow` solo manda esas
  columnas si están contestadas.
- Evidencia «Cómo hacemos tu plan»: párrafos de respuestas y datos actualizados y uno nuevo (fuerza y cardio según la OMS; agua,
  check-in y tomas solo si los apunta). Tutorial `today.plan` y `today.plan.strength` con el nuevo comportamiento. ~110 traducciones.
- tsc limpio y 459 tests (planHabits.test.ts: 26). Probado en la demo web (español, móvil) con datos de prueba: Hoy enseña fuerza
  «Completa 3 sesiones de fuerza a la semana · 3/3 esta semana», pasos, comida y «Bebe 1,6 L al día» (cardio pasa al plan
  completo por el tope de 2); el plan completo trae los textos de arriba, el check-in y las tomas saltadas; sin errores en consola.
  **Sin comprobar:** la bajada automática a la acción tocada y el paso nuevo del cuestionario (el panel del navegador estaba oculto:
  sin pintado no hay onLayout ni clics). Probar en un móvil.
- **Publicado c5849bb** (2026-10-30, OK del fundador «Sí, migrar y publicar»): migración aplicada antes; EAS Update grupo
  `47c615f4-8037-4f44-8626-f73f838d78dc` (preview, android + ios) y las dos webs (comprobado en los bundles en vivo).
  **Ojo:** lo publicado lleva también los cambios SIN COMMIT de la sesión «¿Para qué usas Kuova?» (sección «2026-10-30
  (noche)»), que estaba editando esta misma carpeta mientras se exportaba (EAS marca el commit «c5849bb*»; sus textos están en
  los bundles en vivo). `release.mjs` solo mira si el árbol está limpio al empezar. Producción = c5849bb + esos cambios hasta que
  esa sesión los commitee.
- **Pendiente:** revisión médica (umbrales de agua 90 %, cardio 2/3 días, contar las tomas sin marcar como saltadas); en la demo,
  el informe de ejemplo dice «Haz 2 sesiones de fuerza a la semana» y el plan de un perfil de rendimiento, 3.

## 2026-10-30 (noche) — «¿Para qué usas Kuova?» deja claro que define la experiencia (master; salió con la publicación de c5849bb)

El fundador quiere que en la configuración quede muy claro que la respuesta a «para qué quieres Kuova» define la experiencia y
las opciones que aparecen (ya funcionaba así: `PURPOSE_HIDDEN` en `data/appPrefs.ts` → tarjetas de Hoy, Mis datos, avisos y menú web).

- **Configura tu experiencia** (`AppSectionsScreen`): aviso bajo el título («Tu respuesta define tu experiencia: decide qué partes,
  tarjetas y opciones aparecen en Hoy, Mis datos y el resto de la app, y qué avisos te llegan…») y un recuento que cambia al elegir
  («Con tu respuesta ves 1 de 11 partes de la app» / «Aún no has elegido: ves 8 de 11…»). El texto de «Qué ves» dice que la lista
  sale de esa respuesta y se vuelve a ajustar si la cambias.
- Subtítulo de la fila en Ajustes y en Más: «Para qué usas Kuova define lo que ves y las opciones que aparecen».
- Onboarding (paso «¿Para qué quieres Kuova?») y paso «A tu manera» del tutorial con la misma idea; el onboarding decía
  «Configurar mi experiencia» y la pantalla se llama «Configura tu experiencia» (corregido).
- tsc limpio. Probado en la demo web: el recuento y los interruptores cambian al tocar una opción; la demo quedó sin respuesta.
- **Ojo:** otra sesión publicó c5849bb mientras estos cambios estaban sin commit en la carpeta, y el export se los llevó: están
  en las dos webs (comprobado en los bundles en vivo) y casi seguro en el EAS Update 47c615f4. El commit de después solo pone git al día.

## 2026-11-02 — iPhone: la pantalla Wearables cerraba la app (master, 3340800, publicado)

Primera prueba en un iPhone real (TestFlight 1.1.0 (3)): todo iba salvo Wearables («Configure» en Hoy o Conexiones en Más),
que cerraba la app. Diagnosticado en una sesión de SecondBrain y arreglado aquí.

- **Causa:** `appleHealth.ios.ts` hacía `export { APPLE_READ_TYPES, APPLE_TYPE_LABEL } from './appleHealth'`. En iOS Metro resuelve
  `./appleHealth` al propio `.ios.ts`, y Babel lo deja como un getter que se lee a sí mismo: `RangeError: Maximum call stack size
  exceeded` en el primer render de `WearablesScreen` (el `useMemo` de `coverage`). En Android y la web se usa el stub, por eso no
  pasaba. Venía de 4ca4ac5 (19/10).
- **Arreglo:** `src/wearables/providers/appleHealthShared.ts` (sin versión `.ios`) con `APPLE_READ_TYPES`, `APPLE_TYPE_LABEL` y el tipo
  `AppleHealthRead`; el stub y la versión de iOS reexportan de ahí. **Regla:** un `x.ios/.android/.web/.native.ts(x)` nunca importa
  con valor `./x` (los `import type` sí valen, se borran al compilar). Lo vigila `src/__tests__/platformFiles.test.ts`, que falla
  con el código anterior. El único otro caso, `shareBadge.web.ts`, es `import type` y no da problemas.
- **Ojo con las pruebas que leen archivos:** TypeScript 6 deja `types = []`, así que la app no ve los tipos de Node; la prueba los
  carga con `await import('node:fs' as string)` y tipos locales en vez de tocar el tsconfig.
- tsc limpio y 462 tests. Comprobado en un `expo export --platform ios --no-minify --no-bytecode`: el módulo de `appleHealth.ios`
  ya no depende de sí mismo, tira de `appleHealthShared`, y ejecutado con un require como el de Metro da las 7 constantes;
  `WearablesScreen` usa la versión de iOS (el stub no está en el bundle).
- **Publicado 3340800** (2026-11-02, OK de Astor «Sí, pásalo»): EAS Update grupo `43615f6f-b8fd-4b0b-adfc-13022af48525` (preview,
  android + ios, runtime `exposdk:57.0.0`) y las dos webs. Solo JavaScript: no hace falta compilación nueva.
- **Sin comprobar en el iPhone:** abrir Wearables tras recibir la actualización, y pulsar «Conectar Apple Salud» por primera vez
  (la pantalla de permisos de HealthKit y la lectura nunca se han probado en un dispositivo).

## 2026-11-10 — Idioma: se detecta el del móvil y se elige en la pantalla de entrar (master, 466f1b5, publicado)

Astor creó una cuenta de paciente en Kuova Pruebas con el móvil en español y la app le salió en inglés. Lo mismo pasaba en la
app pública: el idioma salía solo de `Intl`, que en Android da inglés.

- `src/i18n/locale.ts` (con tests): mira primero el idioma del sistema (`I18nManager.getConstants().localeIdentifier`),
  luego `navigator.language` e `Intl`. Acepta `es_ES`, `es-419`…, y catalán, gallego y euskera van a español; si no
  reconoce ninguno, inglés.
- `src/components/LanguagePicker.tsx`: «Español / English» arriba a la derecha de la pantalla de entrar (cada idioma con su
  nombre propio). Guarda y recarga como Ajustes → Idioma. En `LoginScreen` va arriba del todo, y dos `spacer` con flexGrow
  dejan la marca y el formulario centrados en el resto (466f1b5: antes iba pegado encima de «KUOVA»).
- **Publicado 466f1b5** (2026-11-10, OK de Astor «para todos, sí», con la condición de que el selector no quedara encima
  de la marca): EAS Update grupo `4ed9f8c2-3c02-4ea8-abce-5bf2de923f68` (preview, runtime `exposdk:57.0.0`) y las dos webs.
  Las dos responden con `X-Robots-Tag: noindex, nofollow`. Solo JavaScript. Publicado desde el worktree
  `hometest-app-idioma` (la copia principal está en `metas-fase1`), con `.env.local` y `deploy/*/.vercel` copiados de la
  copia principal y `NODE_OPTIONS=--max-old-space-size=6144`.
- No ha ido a la app pública lo del orden de los avisos («Discover your genetic profile» espera a «Before we start»,
  `permissionsGate`), que está en `entorno-pruebas` y `metas-fase1`. La beta de los amigos (canal `pruebas`) recibe el
  idioma con el OTA de `metas-fase1`, cuando Astor dé el OK en esa sesión.
- **Sin comprobar en un móvil** que el idioma del sistema se detecte bien.

## 2026-11-11 — «¿Has olvidado tu contraseña?» para la app pública (rama `contrasena-olvidada`, PUBLICADO b3c94a1)

Lo pidió Astor («tenemos que incluir algo también de forgot your password»); primero se hizo y se probó en
`entorno-pruebas` (89eb7a6, Kuova Pruebas). Esta rama, desde master, es la misma función sin el doble factor ni la
confirmación del email (que master no tiene):

- Pantalla de entrar: «¿Has olvidado tu contraseña?» bajo la contraseña (solo con cuentas reales) → email → «Enviarme el
  código» → código de 6 cifras del correo. Supabase no dice si la cuenta existe; el texto empieza por «Si hay una cuenta
  de Kuova con…». Reenvío con espera de 1 minuto.
- Con el código se abre la sesión y `PasswordResetGuard` (en `_layout`, delante de todo) enseña solo
  `NewPasswordScreen` hasta guardar (reglas 8+ con letras y números, `PasswordRules`). Marca en el móvil
  (`src/data/passwordReset.ts`) para seguir ahí si la app se cierra; se olvida al día, al cerrar sesión o al entrar con
  contraseña. Textos en `src/i18n/authEs.ts` (en `entorno-pruebas` ese archivo trae más: al juntar, quedarse con aquel).
- Probado en la web contra la BASE DE PRUEBAS (preview `expo-web-olvido`, cuenta inventada borrada después): código
  malo, código bueno, contraseña nueva, la vieja deja de valer. 474 tests, tsc limpio.

**Para publicarlo (en este orden, cada paso con el OK de Astor en el chat):**
1. Astor pone el SMTP de Brevo en producción (Supabase → proyecto HomeTest00 → Authentication → Emails → SMTP
   Settings), con una clave SMTP nueva de Brevo. Hoy producción no tiene SMTP propio: Supabase solo manda correos a los
   miembros del equipo, así que nadie más recibiría el código.
2. `node scripts/plantillas-produccion.mjs` (enseña qué cambia) y, con el OK, `--subir`: código de 6 cifras (producción
   venía con 8), la plantilla `recuperar-contrasena.html` y el aviso `contrasena-cambiada.html`. Nada más de Auth (no
   usa `supabase/config.toml`). Comprobado el 2026-11-11 con el diff: 4 cambios declarados y el resto sin tocar.
3. Juntar la rama en master (fast-forward), push y `npm run release` desde este worktree.
Al revés (la app antes que las plantillas) el correo de Supabase por defecto traería un enlace y un código de 8 cifras.
La beta de los amigos (canal `pruebas`) no lo lleva: iría con un OTA de `pruebas`, aparte.
- 2026-11-11: **pasos 1 y 2 hechos.** Astor puso el SMTP de Brevo en HomeTest00 (clave «Supabase Kuova produccion»;
  smtp-relay.brevo.com:587, remitente support@ «Kuova Health») y, con su OK («Sí, súbelos»), se subieron las dos plantillas y
  el código de 6 cifras (`plantillas-produccion.mjs --subir`: 6 propiedades de Auth; el diff de después, sin cambios
  pendientes). Falta el paso 3 (publicar la app). La política de privacidad nombra a Brevo solo para la newsletter: hay
  que añadir los correos de la cuenta antes de publicar (tarea de Astor en el vault, con el abogado).
- 2026-11-11: prueba real en producción OK (correo con el código a una cuenta de Astor, por Brevo). Política de privacidad
  publicada en kuovahealth.com (HomeTest-web e114725, OK de Astor): Brevo también envía los emails de la cuenta. **Solo
  falta el paso 3** (publicar la app), con su OK.
- 2026-11-11: **PUBLICADO** con el OK de Astor («Sí, publícala»): master avanzado a b3c94a1 (fast-forward), push y
  `npm run release` desde el worktree `hometest-app-idioma` (`NODE_OPTIONS=--max-old-space-size=6144`). EAS Update canal
  `preview`, grupo 9706e52b-efff-4283-a899-ebd9da1226ed (android + ios, runtime exposdk:57.0.0), y las dos webs
  (hometest-app.vercel.app y hometest-demo.vercel.app). Antes: 474 tests y tsc limpio. Comprobado en las dos webs: el
  bundle trae «Forgot your password?» y la base de producción (ni rastro de la de pruebas), y en hometest-app.vercel.app
  el enlace abre el panel del email (sin mandar nada). **Sin probar en un móvil.** La beta de los amigos (canal `pruebas`)
  no lo lleva hasta un OTA de `pruebas` (rama `pruebas-entrada`, en espera del OK de Astor).
## 2026-11-05 — Fase 1 de metas: «Cumple tus objetivos» en Hoy (rama `metas-fase1`, sin commit, sin publicar)

Lo del prototipo v7 (`kuova-recomendaciones.vercel.app`) pasado a la app. **No está publicado ni hay migración**: solo
compilaciones de prueba en el canal `pruebas` (abajo).

- **Hoy:** la sección del plan se sustituye por `MetasToday` (`src/components/metas/MetasToday.tsx`): la enhorabuena o el ánimo
  de la semana cerrada (se cierra con la ×, guarda `closedWeek`), el título «Cumple tus objetivos ›» (a `/metas`) y un donut por
  área (Ejercicio, Alimentación, Hábitos; a `/metas-area`, o a `/metas-elegir` si el área está vacía). TodayScreen ya no carga lo
  del plan antiguo (planHabits, nutrientes, mindful, labUploads…); `show('plan')` sigue mandando.
- **Lógica:** `src/logic/metas.ts` (catálogo de 15 metas, objetivos de laboratorio y propios, evaluación de 7 días, donut por
  área, recomendadas, enhorabuena semanal, textos, demo). Reglas del prototipo: la semana empieza el día que firmas; «pocas» = ≤3
  cosas fallidas; una meta cuenta en el donut desde su primer dato; máx. 3 objetivos y 3 metas por área. Tabaco solo si fumas,
  alcohol solo si bebes. Objetivos de laboratorio: LDL, triglicéridos, glucosa/HbA1c por encima del rango y HDL por debajo (lecturas
  de la demo o de los análisis subidos).
- **Pantallas** (`src/screens/MetasScreens.tsx`, rutas `src/app/metas*.tsx`): Tus objetivos (`/metas`, con el enlace a «Tu plan
  completo»), elegir objetivos (`/metas-objetivos`), un área (`/metas-area?area=`), elegir metas (`/metas-elegir?area=`), Ajustar
  (`/metas-ajustar?id=`), Otra meta (`/metas-otra?area=`), la (i) (`/metas-info?id=`) y el compromiso (`/metas-firmar`, 4/8/12
  semanas). Piezas comunes en `src/components/metas/MetaParts.tsx` (interruptor A mano · Reloj/Entrenamientos, «− # +» con la
  unidad fuera, los 7 días con su ruedita, la ruedita de la meta). Guardar/Añadir vuelven atrás o, si no hay pantalla anterior
  (enlace directo), van al área.
- **Datos, sin migración:** la configuración va en `user_flags` clave `metas.v1`; lo marcado a mano en `metric_readings` con
  `kind = 'meta'` e id `meta:<meta>:<YYYY-MM-DD>` (unidad base; tabaco en cigarrillos). Lo automático se calcula cada vez y no se
  copia: pasos y horas de sueño del reloj, «a tu hora» = ±30 min de la mediana de la hora de dormir (≥3 noches), cardio y fuerza de
  Entrenamientos, check-in de los check-ins. `src/data/sharing.ts` excluye `kind = 'meta'` de lo que ve un profesional.
- **Textos:** claves en inglés y español en `src/i18n/metasEs.ts` (se mezcla antes de `es.ts`, que gana). `metasEs.test.ts` falla
  si un `t('…')` de las pantallas de metas no tiene traducción. El tour: `today.plan` y `today.plan.ej` (sustituye a
  `today.plan.strength`).
- **Pendiente de revisión médica:** las metas que sugiere cada objetivo de laboratorio y los textos de la (i)
  (`src/data/metasInfo.ts`).
- tsc limpio y 486 tests. Comprobado en la demo web (375 px): Hoy, las tres áreas, Ajustar con la ruedita, Otra meta (con el aviso
  de 3), la (i) y el compromiso firmado.

### Compilaciones de prueba (canal `pruebas`)

- `eas.json`: perfiles `pruebas` (APK, hereda de `preview`) y `pruebas-ios` (TestFlight, hereda de `testflight`), los dos con
  canal `pruebas` y **`environment: preview`**. Ojo: el entorno `production` de EAS **no tiene** las variables de Supabase, y los
  perfiles de tienda lo usan por defecto; las compilaciones de TestFlight anteriores funcionaban porque recibían la actualización
  del canal `preview`, que se publica con `--environment preview`.
- Al estar en otro canal, `npm run release` (canal `preview`) **no** las pisa: llevan la fase 1 tal como se compiló. Para darles
  cambios: nueva compilación, o `eas update --channel pruebas --environment preview`.
- Una compilación de TestFlight nueva la reciben todos los probadores internos de la app, no solo el nuevo.
- **iPhone:** compilación de TestFlight 1.1.0 (4) `9f1fe5f8-1f67-4c7e-9dad-3eadb0c86695` (perfil `pruebas-ios`), subida a App Store
  Connect sin pedir nada (envío `e7e97408-5f0b-4de5-b21a-1a3b4b324783`). Apple la procesó y entró sola en «Team (Expo)».
- **Android:** APK `bd6f7b80-c057-44e8-923a-90bd48541d5a` (perfil `pruebas`), se instala desde
  https://expo.dev/accounts/astoramor/projects/app-tests-medicos/builds/bd6f7b80-c057-44e8-923a-90bd48541d5a (misma firma que el
  APK de siempre: se instala encima y conserva la sesión; a partir de ahí ese móvil ya no recibe lo que se publique en `preview`).
- **Probador nuevo (2026-11-05):** ya estaba invitado como usuario de App Store Connect (rol Developer, todas las apps) sin
  aceptar; se le reenvió la invitación. Cuando acepte, hay que añadirlo al grupo interno «Team (Expo)» de TestFlight (que tiene la
  distribución automática: la compilación 4 ya está ahí). Hoy el grupo solo tiene la cuenta del fundador (1.1.0 (3) instalada en
  un iPhone 11 el 2026-11-02).

### Notas del fundador desde el APK de pruebas (2026-11-05, misma rama, sin commit)

- **Hoy:** «Tu resumen» solo sale si hay algo previsto (sin «No tienes nada previsto»); la tarjeta de avisos ya no sale en Hoy
  (los avisos se siguen calculando y se ven en Más → Notificaciones). Lo primero es el check-in.
- **Check-in en Hoy:** `src/components/CheckInButton.tsx`: botón redondo con la carita sobre un degradado (ámbar → dorado) y un
  donut de 3 tramos con los check-ins del día (`checkInDayKey`, así que de madrugada cuenta el día anterior). Sin «¿Cómo te
  encuentras?».
- **Textos del check-in:** «¿Qué día estás registrando?», «¿Cómo está tu energía?», «¿Cómo te sientes?», «Emocionado», «Ansioso»,
  nuevo estado `unmotivated` «Desmotivado» (puntuación 2, negativo; `mood` es texto libre en la tabla, sin migración), y «Acabo de
  despertarme» / «Mi día está acabando» con mayúscula.
- **Cumple tus objetivos:** encima de «Tu estado de hoy» (también en el tutorial); sin flecha; (i) con una hoja que explica de
  dónde salen los objetivos, los enseña y lleva a «Ver tus objetivos» / «Cambiar mis objetivos»; los tres donuts centrados en un
  mismo bloque, sin «Toca para marcar». «Tu plan completo» ya no se enlaza desde Tus objetivos (la pantalla `/action-plan` sigue).
- **Metas con el reloj:** un día se puede corregir a mano aunque la meta vaya por reloj/Entrenamientos/check-in: lo apuntado a
  mano manda ese día (`valuesFor`), el panel dice «Corregido a mano (X del reloj)» con «Deshacer». La ruedita de las metas es de 3
  filas (`WheelPicker` `visible={3}`, `fadeColor`) y la unidad va en grande.
- **Abrir un área ya no se queda en blanco:** `useMetas` comparte lo cargado entre Hoy y las pantallas de metas (en memoria, por
  usuario) y recarga detrás; también guarda la última serie del reloj mientras carga la nueva. En la demo web, 60 ms.
- **Más → Notificaciones** (`/notifications`), justo antes de Ajustes.
- **Tu historial en Mis datos** (tras la edad KUOVA): alergias (solo se editan en «Editar»: medicamentos, alimentos, otras y «Otra»),
  grupo sanguíneo (ruedita; se guarda `O-`/`O+`, se ve 0−/0+), vacunas (una fila por dosis, mes y año opcionales), cirugías e
  historia clínica (nombre y año), con enlaces a medicación, antecedentes familiares y archivos. Todo en `user_flags`
  `historial.v1` (sin migración); en la demo, una persona de ejemplo inventada. Lógica `src/logic/historial.ts`, pantallas
  `src/screens/HistorialScreens.tsx`, rutas `src/app/historial-*.tsx`, textos `src/i18n/historialEs.ts`.
- **Mi tarjeta de emergencia** (Más, tras Mi suscripción, y desde Tu historial; `/emergency-card`): nombre, teléfono de
  emergencia (y de quién es), grupo sanguíneo y alergias a medicamentos del historial, en una tarjeta con los colores de KUOVA y
  un QR de **texto plano** (se lee sin internet; no se sube nada). Se comparte como imagen (`shareBadge`, 1080×1350) y se puede ver
  el QR en grande. QR con `toqr@0.1.1` (JS puro; el mismo que usa la CLI de Expo), nivel M: comprobado que un lector distinto
  (jsQR) lo descodifica, tildes incluidas.
- **Fuera por ahora:** importar el historial de un PDF o una foto con IA y compartirlo con los profesionales (6 alcances nuevos,
  necesita migración); «no tengo alergias conocidas»; que Menús y metas lean las alergias. La política de privacidad tendrá que
  nombrar estos datos (abogado).
- tsc limpio y 500 tests. Comprobado en la demo web a 375 px: Hoy, check-in, Cumple tus objetivos con su (i), corregir un día
  del reloj y deshacerlo, Tu historial, editar alergias, la tarjeta y Más.
- **Mandado al canal `pruebas`** (OK del fundador «mándalos»): EAS Update grupo `cb83a571-0bcc-43d7-9d05-00d1daef859a` (android +
  ios), con los pasos a mano por la RAM (`expo export --clear --platform android --platform ios --max-workers 1` y
  `EAS_SKIP_AUTO_FINGERPRINT=1 eas-cli update --channel pruebas --environment preview --skip-bundler --input-dir dist`). El
  export coge Supabase de `.env.local`. El APK y TestFlight de pruebas lo reciben al cerrar y volver a abrir la app (a veces, dos
  veces).

### Semanas de calendario en las metas (2026-11-05, misma rama, sin commit)

Fundador: «aunque empieces un miércoles, que la semana empiece el lunes/domingo (según configuración en Más) … si empiezas un
miércoles, la semana acabe el domingo y te diga: esta semana lo has cumplido (si has hecho lo correspondiente a esa parte)».

- **Ajustes → «La semana empieza el»** Lunes / Domingo (`src/components/metas/WeekStartSetting.tsx`). Se guarda en el estado de
  las metas (`weekStart`, 1 lunes / 0 domingo, por defecto lunes; `user_flags` `metas.v1`, sin migración), así que vale igual en
  el móvil y en la web.
- **Lógica** (`src/logic/metas.ts`): `weekStartOf`, `weekOf(día, estado, hoy)` → `{ days, from, to, current, share }`. `from` es el
  día en que firmaste el compromiso si cae en esa semana (sin compromiso, la semana cuenta entera); `to` es hoy en la semana en
  curso. Los días fuera de `from..to` son `'off'` (apagados, no se tocan). `weekGoal(m, share)`: en la primera semana, las metas
  **a la semana** van en proporción, a pasos de la meta y al menos uno (cardio 90 min empezando un miércoles → 60; fuerza 2 → 1);
  un límite se redondea hacia arriba («menos de 1,4 raciones» = «menos de 2»), y las de cada día no cambian.
- **Enhorabuena:** el primer día de cada semana, sobre la anterior (`closedWeek`), con `closedWeek` del estado = el primer día de
  esa semana. Si empezaste a mitad, añade «Como empezaste a mitad de semana, contaba solo esa parte.». Fechas con `rangeText`
  («del 2 al 8 de noviembre»).
- **Donuts y textos:** la semana en curso hasta hoy (antes eran los últimos 7 días), así que el lunes empiezan de cero. Una meta
  con datos en las 4 semanas anteriores sigue contando aunque esa semana aún no tenga nada (`knownBefore`), para que no salga
  «Cuenta desde que la marques». Una meta a la semana cumplida dice «· cumplida»; un límite, «esta semana / esa semana».
- **Pantallas:** el área tiene arriba «Esta semana · del 2 al 8 de noviembre» con flecha a «La semana pasada» (para apuntar el
  domingo el lunes; solo si ya habías empezado entonces), sin «Hoy» en la pasada, y en tu primera semana «Tu primera semana cuenta
  desde el miércoles 28: las metas de la semana van en proporción.». Hoy: «Esta semana: del 2 al 8 de noviembre.». El compromiso
  explica la semana y la proporción.
- tsc limpio y 508 tests (nuevos en `metas.test.ts`: semanas lunes/domingo, el miércoles, la proporción, días `off`, metas con
  historia, fechas). Comprobado en la demo web a 375 px: área (esta semana y la pasada con la nota de la primera), Hoy (pie y
  enhorabuena de la primera semana), Ajustes (cambiar a domingo → «Del 1 al 7 de noviembre» y vuelta a lunes); sin errores.
- **Mandado al canal `pruebas`** con los mismos pasos a mano: EAS Update grupo `b108c9ab-3c02-4d62-9037-2e78d041232f`.
- Pendiente de decidir: una meta añadida a mitad de una semana que no es la primera no va en proporción (solo cuenta el
  compromiso); y el compromiso de 4/8/12 semanas no tiene final todavía.

### Historia clínica por categorías y tarjeta de emergencia editable (2026-11-05, misma rama, sin commit, sin publicar)

Fundador: historia clínica con eventos (no «problemas») en categorías; tarjeta con dirección, campos que se eligen (recomendados
nombre, grupo, alergias y contacto), avisos como diabetes, Sintrom o embarazo más los que escribas; descargarla completa o solo con
el QR, con KUOVA en las dos; el QR se amplía al tocarlo; «Tu historial» se oculta; en Más faltaban Entrenamientos y Plan de comidas.

- **Historia clínica = eventos** (`HistoryEvent { id, cat, name, year }`, `historial.v1.events`): Cirugías, Ingresos hospitalarios,
  Enfermedades graves, Enfermedades crónicas, Accidentes y lesiones, Otros (`EVENT_CATS`, `EVENT_CAT_NAME`, `EVENT_PLACEHOLDER`).
  Las dos listas de antes se migran solas al leer: `surgeries` → «Cirugías», `conditions` → «Otros» (solo si no hay `events`).
  `/historial-lista` agrupa por categoría y se añade eligiendo la categoría con chips. En Mis datos, una ficha ancha «Historia
  clínica» («4 eventos» y los nombres con año).
- **Tarjeta editable** (`CardData`: `fullName`, `phone`, `contact`, `address`, `notices`, `show`): cada bloque tiene su interruptor
  «Mostrar … en la tarjeta»; los recomendados llevan la etiqueta «Recomendado» y, si se enseñan vacíos, salen «Sin indicar». Por
  defecto se ve todo menos «Alergias a alimentos y otras». «A tener en cuenta»: lista (`NOTICE_CATALOG`: diabetes, anticoagulantes
  (Sintrom…), embarazo, epilepsia, marcapasos, asma, corazón, lentillas, donante) más «Otra cosa» escrita, máximo 8
  (`toggleNotice`). `cardContent(h, { lock })` decide qué sale, y el QR (`emergencyQrText`) lleva exactamente lo mismo.
- **Tres versiones de la imagen** (`EmergencyCard` con `variant`, `cardLayout`): **Completa** (1080 de ancho y alto según lo que
  lleve, mínimo 1350), **Compacta** (1080×1350: nombre y QR grande, «Escanéalo con la cámara de otro móvil») y **Bloqueo**
  (1080×2340, para fondo de pantalla: el contenido baja para no quedar bajo el reloj; **sin dirección**, porque la vería cualquiera
  que coja el móvil). Las tres con el logo KUOVA. «Guardar o compartir la imagen» usa `shareBadge` con el tamaño de cada una (en el
  iPhone, «Guardar imagen» de la hoja de compartir; en la web descarga el PNG).
- **El QR se amplía al tocarlo** (capa transparente encima del QR de la vista previa → modal con `BigQr`; se cierra tocando en
  cualquier sitio). Fuera el botón «Ver el QR en grande».
- Consejo debajo: rellenar también la Ficha médica de la app Salud (iPhone) o la información médica de Ajustes → Seguridad y
  emergencia (Android), que se ven sin desbloquear.
- **Tu historial se oculta:** botón «Ocultar» junto al título en Mis datos y nueva sección `history` en Configura tu experiencia
  (`SECTION_OPTIONS`, `FEATURE_GUIDE`, `FeaturePreview`). La tarjeta sigue en Más.
- **Más:** «Entrenamientos» (`/workouts`) y «Plan de comidas» (`/diet`), tras Mi suscripción, si la sección «Plan personalizado»
  está visible.
- **Textos:** `src/i18n/historialEs.ts`. Ojo con las claves que ya existen en `es.ts` con otro sentido (`Suggested` = «Sugeridas»,
  `Full` = «A tope», `Other allergies` = «Otras»): por eso la etiqueta es `Recommended field` y las versiones `Full version`, etc.
  `historialEs.test.ts` también lee las versiones y sus notas de `HistorialScreens.tsx`.
- **Wallet (respuesta al fundador; descartado por ahora, 2026-11-05):** Apple Wallet necesita un certificado Pass Type ID (cuenta de Apple Developer, el
  fundador) y firmar el pase en el servidor (Edge Function); Google Wallet necesita cuenta de emisor y el pase se guarda en
  Google, con datos de salud: abogado antes. Guardar directo en la galería pide `expo-media-library` y un build nativo nuevo.
- tsc limpio y 512 tests (nuevos en `historial.test.ts`: migración a eventos, tarjeta normalizada, avisos, lo oculto no sale ni
  en el QR, la dirección nunca en el fondo). Comprobado en la demo web a 375 px: historia por categorías y añadir un ingreso, la
  tarjeta (dirección, ocultar el grupo, aviso escrito, las tres versiones, el QR en grande y cerrarlo), ocultar Tu historial y
  volver a enseñarlo desde Configura tu experiencia, y Más. No probado en el móvil (la hoja de compartir con cada tamaño).
- **Mandado al canal `pruebas`** (OK del fundador «adelante con esto, sin incluir el Wallet»): EAS Update grupo
  `c5041aec-5075-49e0-9b63-6319a5966d76` (android + ios), con los mismos pasos a mano. El Wallet queda fuera por decisión del
  fundador.

### Alergias, QR con la K, fondo de bloqueo con foto y check-in nuevo (2026-11-05, misma rama, sin commit, sin publicar)

Fundador: al añadir «Metamizol» salía raro y al volver la lista tardaba; fondo de bloqueo «mucho más bonito», con la foto que
quieras y el QR en el tercio de abajo con la K de KUOVA (todos los QR con la K y «Kuova Health»); sin contacto, nada del contacto;
fuera «escanéalo con la cámara»; check-in en verde KUOVA con la carita dorada, donut que se llena, confeti al hacer los 3,
historial del día en el momento, «Momento del día», días centrados y Acelerado en vez de Desmotivado.

- **Alergias:** lo escrito se compara con la lista sin tildes, mayúsculas ni puntos (`catalogAllergy`, `hasAllergy`; también el
  nombre entre paréntesis y en los dos idiomas), así «Metamizol» marca «Metamizol (Nolotil)» en vez de crear un chip duplicado, y
  las alergias escritas antes que coinciden se pasan solas al elemento de la lista (`normalizeHistorial`). Confirmación «Marcada:
  …, en …», fuera la etiqueta «Añadida por ti», Guardar cierra el teclado y guarda también lo que esté escrito sin añadir.
  `useHistorial` es ahora un almacén compartido (todas las pantallas reciben el cambio al momento, y una carga que empezó antes de
  guardar se ignora): la lista sale actualizada al volver, sin esperar a la red.
- **QR con la K** (`src/logic/qr.ts`): corrección H y un hueco en el centro (30 % × 25 %, a 9 módulos o más del borde) con una
  placa crema, la K y «KUOVA HEALTH» (`QrBadge` en `EmergencyCard.tsx`). Comprobado con jsQR (textos cortos, largos, borrosos y
  el PNG de bloqueo con foto que dibuja la web): todos se leen.
- **Fondo de bloqueo** (1080×2340): sin textos, la foto que elijas (`pickWallpaperPhoto` en `src/utils/wallpaperPhoto.ts`,
  recortada a 1080×2340 en JPEG) o, sin foto, un degradado con ondas doradas; el QR (560 px) en el tercio de abajo con un halo
  blanco. La foto se queda en el móvil (`src/data/cardPhoto.ts`, AsyncStorage `historial.cardPhoto.v1:<usuario>`), nunca se sube.
  Enlaces «Elegir una foto» / «Cambiar foto» / «Quitar foto» solo en esa versión.
- **Contacto:** si no hay contacto de emergencia no sale nada de él (ya no es recomendado ni sale «Sin indicar»). Fuera todos los
  «Escanéalo con la cámara…».
- **Check-in** (`CheckInButton.tsx`): en modo claro círculo verde KUOVA `#0E2A24` y carita en dorado `#C9A366`; el tramo nuevo se
  rellena poco a poco y el donut coge color con cada check-in (`#E3CFA3` → `#D6B97F` → `#C9A366`); al completar los 3 justo
  después de guardar (`src/logic/checkInCelebration.ts`, ventana de 2 min) el anillo se cierra, la carita sale hacia delante
  (1,32 y se queda en 1,08) y Hoy suelta confeti (`Confetti`, 90 piezas). Al abrir la app con los 3 ya hechos no salta.
- **Pantalla del check-in:** «Momento del día»; los momentos ya hechos ese día llevan un check verde; Hoy / Ayer / el otro día
  centrados; Desmotivado sale del selector (`MOOD_PICKER`; los guardados se siguen viendo, `legacy`) y entra **Acelerado 😬**
  (`wired`, puntuación 2,2, cuenta como estado negativo).
- tsc limpio y 517 tests (nuevos: `checkInCelebration.test.ts`; en `historial.test.ts` la lista sin tildes, el contacto vacío y
  el hueco del QR). Comprobado en la demo web a 375 px: añadir Metamizol y volver, las tres versiones de la tarjeta, la foto en el
  PNG y su QR leído, el check-in en modo claro (colores, check de momentos, días centrados, Acelerado) y el confeti al hacer el
  tercero. No probado en el móvil: elegir la foto, compartir la imagen con foto, las animaciones y la sombra en iOS.
- **Mandado al canal `pruebas`** (OK del fundador «Sí, a pruebas»): EAS Update grupo `146c0197-2fa0-40b4-8e61-1d26452a174e`
  (android + ios), con los mismos pasos a mano. La foto usa `expo-image-picker` y `expo-image-manipulator`, que ya estaban en
  las builds de pruebas, así que no hace falta build nueva.

### % ponderado, celebraciones al 100 %, Kegel con histórico y retoques (2026-11-05, misma rama, sin commit, sin publicar)

Fundador: el % de hábitos bajaba al marcar (3 frutas → 100 %, 1 verdura → 80 %); placa del QR «un poco fea», K dorada y KUOVA /
HEALTH con el logo; el check-in no enseñaba lo marcado al volver a un momento hecho; en claro, botón blanco con la carita en verde;
alergias con un solo «Editar»; hueco del tutorial redondeado; Kegel con segundos por tramo y sin saltos del círculo; estiramientos
ponía 5 min y duraba 8; «Registra tu micción»; confeti y «zoom y vuelta» del donut al llegar al 100 %, algo más épico con los tres;
fuera la foto de perfil de Hoy; Kegel debajo de «Apuntar regla» con un histórico minimalista de cuándo los has hecho.

- **% de metas** (`src/logic/metas.ts`): cada meta pesa igual y, en las de cada día, cuenta lo que llevas (`dayScore`: v/objetivo
  con tope 1; en un «como mucho» pasado, objetivo/(v+paso); sí/no, 0 o 1). Las manuales cuentan desde el primer día de la
  semana en curso (con 0 hasta que marcas; `countsInArea`), las del reloj desde que llegan datos; en una semana pasada, las que
  no tienen datos se quedan fuera («Sin datos esa semana»). Así marcar nunca baja el % (test «marcar nunca baja el %»). Ojo: marcar
  un día pasado que estaba vacío sí puede bajarlo (decisión anterior: los días vacíos pasados no cuentan).
- **QR: sigue siendo texto plano**, que cualquier cámara lee sin internet (`emergencyQrText`). Se probó que abriera la tarjeta con
  formato en una página de la web (`kuovahealth.com/e#<datos en base64url>`, HTML suelto sin servidor), pero el móvil que escanea
  necesita conexión y el fundador prefiere que se lea sin ella (2026-11-05). Con formato y sin internet no se puede en un móvil sin
  la app: la cámara solo abre enlaces (red) o enseña texto. Se quitó todo (ni `cardLink.ts` ni `public/e.html`; la web no se tocó).
- **Placa del QR** (`QrBadge` en `EmergencyCard.tsx`): crema con filete dorado, K dorada, la palabra KUOVA (`KuovaMark`) en verde y
  HEALTH debajo en dorado oscuro, centrado.
- **Check-in:** al tocar un momento ya hecho ese día se carga lo que marcaste (título «Editar check-in», «Guardar cambios»); al
  pasar a uno sin hacer, el formulario vuelve a vacío. En modo claro el botón es un disco blanco con sombra verde suave y la carita en
  verde KUOVA.
- **Otros:** alergias sin el «Editar» de arriba; Hoy sin la foto de perfil; el tutorial oscurece con un `Path` evenodd y el hueco
  tiene esquinas de 14 (`shadeWithHole` en `TourOverlay.tsx`).
- **Ejercicios** (`ExerciseScreen.tsx`, `exercises.ts`): el Kegel es **todo contracciones lentas** (fundador: nada de 30 s de
  explicación con el círculo respirando): 10 × (aprieta y aguanta 6 s + suelta 6 s) = 2 min justos, «Contracción n de 10» debajo
  y, dentro del círculo, el tramo y sus segundos 6…1; aprieta = se encoge en 1,2 s y aguanta, suelta = crece en 2 s (`to`, `move`;
  el círculo empieza grande porque lo primero es apretar). Fuera las rápidas y los pasos de texto. Lo de cómo se hace va antes de
  empezar (`howTo` en el ejercicio): la intro, «Cómo hacerlo» con 5 pasos numerados (postura, encontrar los músculos «como si
  cortaras el pis… no lo practiques cortándolo de verdad», respirar, qué hacer cuando el círculo se encoge o crece, tres veces al día
  y 3–6 meses) y el botón «Ir al ejercicio · 2 min». Pauta NHS (aguantar 5–10 s, hasta 10 veces), pendiente de revisión clínica.
  Los pasos de texto largo de otros guiados enseñan un número grande con lo que les queda. El círculo de fondo de los guiados sigue desde donde está
  (`resetBeforeIteration: false`): antes, al acabar de encogerse, volvía de golpe. La etiqueta de Yoga sale de
  `EXERCISES.stretch.minutes` («Haz 8 minutos de estiramientos»). Hidratación: «Registra tu micción».
- **Kegel en el ciclo, con histórico** (`CycleDetailScreen.tsx`): debajo de «Apuntar regla», el título «Ejercicios de Kegel» y una
  tarjeta como el bloque de objetivos de Hoy, todo centrado: un anillo con cuántos días de los últimos 7 los hiciste («1 de 7
  días»), 7 puntos (uno por día, del más antiguo a hoy, con la inicial; lleno si lo hiciste), «Última vez: hoy / ayer / 3 nov.» o
  «Aún sin hacer» y «Empezar · 3 min ›»; toda la tarjeta abre el ejercicio (`src/logic/kegel.ts`, test `kegel.test.ts`). Cada Kegel terminado se
  guarda (`logKegelSession` en `src/data/kegelRepository.ts`): en las cuentas, metric_readings con kind `kegel` (valor = minutos),
  sin migración; no sale en la vista del profesional (`sharing.ts`, `.not('kind', 'in', '(meta,kegel)')`) y se vacía con los demás
  registros en las cuentas de prueba (`simulation.ts`).
- **Reloj de los ejercicios** (`ExerciseScreen.tsx`): los segundos salen de la hora real (`Date.now()` desde que empezaste, sin las
  pausas; aviso cada 250 ms), no de sumar 1 por cada aviso de 1 s. Si el móvil retrasa o junta los avisos (segundo plano, hilo
  ocupado), la cuenta no se adelanta ni se queda atrás. Medido en la demo: 30 s reales = 30 s en pantalla; en pausa no corre; tras
  bloquear el hilo 3 s marca 3 s más. El «ritmo imposible» que vio el fundador en el navegador era una prueba mía que aceleraba los
  avisos de esa pestaña; en la app no pasaba.
- **Al 100 %** (`MetaParts.tsx`, `MetasScreens.tsx`, `MetasToday.tsx`): al marcar algo con lo que un área llega al 100 % de la
  semana en curso, su donut crece a 1,24 y vuelve con muelle y salta confeti (70); si con ella ya están las tres, 170 piezas doradas
  durante 4,2 s, el donut a 1,38 y la tarjeta «¡Los tres al 100 %!». Solo al marcar tú, no al abrir la pantalla ya al 100 %. Al
  volver a Hoy, ese donut da también su saltito (`takePop`).
- tsc limpio y 521 tests (nuevo `kegel.test.ts`; `metas.test.ts` y `historial.test.ts` al día). Comprobado en la demo web a
  375 px: % parciales (Alimentación 92 % = (3 + 2/3)/4) que suben al marcar, confeti y saltos (el épico incluido), el check-in que
  carga lo marcado, la placa del QR, Kegel (5→1 por tramo, círculo 0,50↔1 sin saltos), estiramientos (sin saltos, 8:00), alergias,
  tutorial y Hoy; la tarjeta de Kegel en el ciclo (vacía, y tras hacer uno entero, hoy lleno y «1 de 7 días») y el reloj. No probado en el
  móvil (ni guardar el Kegel en una cuenta de Supabase).
- **Mandado al canal `pruebas`** (OK del fundador «Sí, a pruebas»): EAS Update grupo `64542308-2a21-471a-a705-2e10fa26a8c9`
  (android + ios), con los mismos pasos a mano (`expo export --clear … --max-workers 1` y `eas-cli update --channel pruebas
  --environment preview --skip-bundler --input-dir dist`). Sin build nueva ni cambios en la web.

### Notas del fundador del 2026-11-06: peso, Analíticas, cada marcador, plan del especialista, entrenos, Bloqueo (misma rama, sin commit; OTA a `pruebas` y APK de pruebas nuevo)

- **Peso en Mis datos** (`MyDataScreen.tsx`): no salía porque Mis datos nunca cargó `weightRepository`; el peso solo estaba en Hoy
  (desde el 2026-10-19). Ahora tiene su tarjeta después de la tensión (gráfica violeta; abre `/weight-detail`, o `/log-weight` si
  no hay ninguno; sin datos, «Pésate una vez a la semana…»). El VO2max baja a Mediciones, después de Temperatura. El título de
  arriba es siempre «Mediciones» («De tu reloj (últimos 14 días) y lo que apuntas» / «Lo que apuntas»).
- **«Analíticas» en Mis datos** (fundador: «lo que hace referencia a analíticas que sea "analíticas" y no biomarcadores, porque todo
  son biomarcadores»): la sección que antes se llamaba Biomarcadores ahora es «Analíticas». Tiene las tarjetas de Glucosa, Colesterol total y Cortisol
  (se apuntan también a mano y tienen su pantalla) y «Todos tus valores»: el último valor de cada marcador de las analíticas
  subidas y, en las cuentas de prueba, de los dos informes de ejemplo. Van primero los que están fuera del rango, luego en rango y
  al final sin referencia. Se ven los `max(6, fuera)` primeros con «Ver los N valores», «Última analítica: fecha · laboratorio»,
  los recuentos y una leyenda neutra («…no es un diagnóstico; tu médico lo pone en contexto»). La lógica está en `src/logic/labMarkers.ts`
  (pura, test `labMarkers.test.ts`): `markerKey` usa el marker_id del catálogo o, si no lo hay, `n:` + el nombre normalizado. Junta
  laboratorios distintos.
- **Hoy** sigue con «Biomarcadores», más la línea «Lo que apuntas y lo que viene de tu reloj…». Con datos propios, la glucosa y la
  tensión ya no enseñan el estado y el color del ejemplo («¡Excelente!»; era un P0 de la auditoría). Enseñan de dónde y de cuándo son
  («De tu analítica · 12 oct.» / «Apuntado el 12 oct.»), con estado neutro: `own()` en `liveBiomarkers.ts`, `fecha`/`fromLab` en
  `Biomarker`. En la demo, sin datos propios, sigue el ejemplo.
- **Cada marcador, con todos sus valores** (`/lab-marker?key=…&from=upload:id|report:id`, `LabMarkerScreen.tsx`). Arriba el último
  valor con el rango del laboratorio y su barra. Debajo, «Cómo ha cambiado»: no mezcla unidades y avisa de los valores en otra
  unidad. La franja del rango se recorta cerca de los valores (`chartBand`), porque con ferritina 30–400 y valores de 24 y 34 la
  línea quedaba plana; vale con un solo límite (LDL < 130). Luego «Tus N resultados», donde cada uno abre su analítica y el de
  `from` lleva «esta analítica», y una ficha de `getParameterCard`. Si el valor está fuera del rango se añade lo asociado a mejores valores (`labEvidence`) o
  «Habla con un médico…», y «Tu objetivo para esto» cuando hay uno (`labGoalForMarker`: LDL, TG, glucosa/HbA1c, HDL bajo).
  Se abre:
  - desde cualquier fila de una analítica subida: `LabValueRow` ya no se despliega, ahora es un enlace (lo desplegado está en la ficha);
  - desde las filas de los informes (`LabReportScreen`, los dos, no solo el actual);
  - desde «Ver todos tus resultados en Mis datos» en `ReportMarkerDetailScreen`;
  - desde la lista de Mis datos.
  Glucosa, colesterol total y cortisol van a su propia pantalla (`markerHref` en `src/utils/markerLinks.ts`).
- **Plan: la app ya no hace planes** (fundador, «Objetivos + plan del médico»; decisión apuntada en el vault,
  `Strategy/Kuova/Plan personalizado - objetivos y plan del especialista.md`):
  - `/plans` es «El plan de tu especialista»: solo las versiones con `source: 'professional'` (`specialistPlans`). Si no hay
    ninguna, «Habla con un especialista» y «Ver tus objetivos».
  - En Tus objetivos sale una tarjeta hacia ese plan solo si hay uno.
  - Tras una analítica (`ProgressScreen`, `UploadTestScreen`), «Actualizar mi plan» pasa a ser «Revisar mis objetivos»
    (`/metas-objetivos`) con «Pedir que lo revise un médico» (`/professionals`, rol médico).
  - En el menú de la web, «Mi plan» pasa a «Tus objetivos» (`/metas`).
  - Los textos de la sección están en `appPrefs.ts` y `featureGuide.ts`.
  - Las pantallas del plan automático (`/action-plan`, `/plan-update`, `/report-plan`, `goalsPlan`, `planHistory`) siguen en el
    código, pero nada las enlaza.
  - Las versiones antiguas (upload/report) siguen en la base de datos sin enseñarse.
  - **Pendiente:** el tema `plan` de `EvidenceScreen` aún describe el plan automático.
- **Entrenos:**
  - «Descartar este entrenamiento» en la propuesta de «Crear mi entrenamiento» vuelve atrás sin guardar (`/workouts` si no hay
    atrás).
  - En el Historial, una papelera en cada entreno, con confirmación («Desaparecerá de tu historial y dejará de contar en tus
    metas»). `historyRemoval` en `workoutHistory.ts`:
    - una sesión de programa sale de sus `completions` (por posición o, si cambió, por hora), y se borra el entreno del plan
      guardado con ella (±2 s);
    - uno apuntado se borra solo con su fila (la RLS «own rows: delete» de `workouts` ya existía).
- **Tarjeta de emergencia, versión Bloqueo** (fundador, «Instrucciones + Android directo»): la nota dice «Solo para la pantalla de
  bloqueo, no la de inicio» y debajo del botón salen los pasos a mano (`LockSteps` en `HistorialScreens.tsx`). Son los de iPhone en
  iOS, los de Android en Android y los dos en la web:
  - iPhone: Fotos → Compartir → «Usar como fondo de pantalla» → «Añadir» → «Personalizar pantalla de inicio» con otra foto o un
    color.
  - Android: Galería o Google Fotos → ⋮ → «Establecer como fondo de pantalla» → «Pantalla de bloqueo».
  - En Android hay además un botón, «Ponerla en mi pantalla de bloqueo». Usa un **módulo nativo local nuevo**,
    `modules/kuova-wallpaper` (solo Android, Kotlin, `WallpaperManager.setStream(…, FLAG_LOCK)`, permiso normal `SET_WALLPAPER` sin
    diálogo; autolinking lo encuentra). Del lado JS, `src/utils/lockWallpaper.ts` (+ `.web.ts`) guarda el PNG en la caché y lo pone.
  - El botón solo aparece si el módulo existe (`requireOptionalNativeModule`), así que **hace falta un APK de pruebas nuevo**. Como
    el runtime es `exposdk:57.0.0`, el OTA llega también a los APK viejos, que siguen con los pasos a mano.
  - **Sin probar en un móvil:** el Kotlin compila (build de EAS `b3972691`, más abajo), pero el botón no se ha pulsado en un
    teléfono. Algunas capas de fabricante podrían ignorar `FLAG_LOCK` y cambiar también la de inicio.
- **Placa encima del QR en Bloqueo** (fundador, a media tarea): «INFORMACIÓN DE EMERGENCIA» en dorado y «Escanea el QR con la
  cámara de un móvil» en crema, sobre una placa verde oscura al 78 % con borde dorado, justo encima del halo del QR
  (`EmergencyCard.tsx`, y = QR − 180). Se lee sobre cualquier foto; comprobado en la demo.
- **Fondo de Bloqueo a elegir** (fundador: «otros patrones: claros, el verde… 2 o 3 más»): bajo la vista previa, «Fondo» con
  cinco miniaturas: Verde (el de antes), Capas (láminas verdes), Crema (claro, con ondas doradas), Arena (láminas claras) y Tu foto
  (si no hay, la elige). Las capas siguen el estilo de la marca: 5 láminas con curvas suaves (dos senos, sin azar, Catmull-Rom),
  sin contornos y con una sombra tenue (`sheetPath`/`Sheets` en `EmergencyCard.tsx`). En los fondos claros el halo del QR es verde
  suave. La elección va con la tarjeta (`CardData.lockBg`, user_flags `historial.v1`); la foto sigue solo en el móvil.
  `lockBackground()` decide el que se pinta: «tu foto» sin foto en ese móvil = verde, y sin elegir, la foto si la hay (tarjetas de
  antes). Los degradados llevan un id por dibujo (`idp`), porque en la web las miniaturas pisaban los del dibujo grande.
- **Aviso del perfil genético** (`WelcomePrompts.tsx`; fundador: «¿qué diferencia hay entre Luego y Saltar?»): ahora tiene
  «Omitir por ahora», con la línea «Te lo recordaremos dentro de 3 días.», y «No volver a mostrar este aviso» (ese aviso no vuelve).
  Se quitan «Más tarde», «Saltar» y «Silenciar estos avisos»; quien ya los silenció sigue sin verlos.
- **Mis datos, «Todos tus valores»**: la flecha de arriba a la derecha abre y cierra la lista entera (la de abajo también; antes
  solo estaba al final de una lista de más de 100 valores). **El ojo**: cada valor lleva un ojo que pone o quita su gráfica en
  Analíticas, y cada gráfica lleva el suyo para quitarla.
  - Por defecto se ven azúcar, colesterol total y cortisol. La lista ahora los incluye también.
  - Los demás salen como `LabChartCard`: el último valor y la línea si hay dos o más en la misma unidad, con la franja recortada;
    con uno solo, «De momento hay un resultado…».
  - Se guarda en user_flags `mydata_charts` (`{ keys }`; `normalizeCharts`/`toggleChart` en `labMarkers.ts`).
  - Comprobado en la demo con clics de verdad: el ojo no abre la ficha (botones anidados en la web, sin problema).
- **Otros:** el título «Lab Results» del informe ahora pasa por `t()` («Resultados de laboratorio»). Todos los textos nuevos están
  en `es.ts` / `historialEs.ts`, con la prueba `notasFundador1106Es.test.ts`, que mira cada `t('…')` de las pantallas tocadas.
- **Pruebas:** tsc limpio y 538 tests (`labMarkers.test.ts` con `chartBand` y las gráficas, `notasFundador1106Es.test.ts`, `historyRemoval` en
  `workoutHistory.test.ts` y el fondo en `historial.test.ts`). Comprobado en la demo web a 375 px:
  - Hoy y la línea de Biomarcadores;
  - Mis datos: Peso, Analíticas y «Todos tus valores» con los recuentos;
  - la ficha de LDL y la de ferritina (franja recortada), con «esta analítica» al venir del informe;
  - el informe que se abre desde un resultado;
  - `/plans` vacío;
  - apuntar un entreno y borrarlo con la confirmación;
  - Descartar, que vuelve a Entrenamientos;
  - Bloqueo con los dos pasos y sin desbordar.
  El localStorage de la demo quedó vacío, como estaba. No probado en el móvil, ni con una analítica subida en una cuenta real, ni
  la pantalla de Progreso con sus botones nuevos.
- **Publicado solo en pruebas** (con el OK del fundador, «Sí, OTA y APK»; producción sin tocar, ni `npm run release` ni submit):
  - OTA al canal `pruebas`, grupo `92ccf010-21f6-42e1-af89-a97d0e4f0c41` (runtime `exposdk:57.0.0`, Android e iOS; export con
    `--max-workers 1`, `EAS_SKIP_AUTO_FINGERPRINT=1`, `--environment preview`). Llega a los APK y TestFlight de pruebas que ya hay.
  - APK de pruebas nuevo (perfil `pruebas`), build `b3972691-7748-4516-ba75-715f7fbf80a0`, **terminada** (el módulo Kotlin
    compila), para el botón de la pantalla de bloqueo. Se descarga desde la página de la build en expo.dev. `modules/` está sin
    seguimiento en git, pero no ignorado, así que EAS lo sube.

### Después del OTA del 2026-11-06: metas debajo de los objetivos, y fumar, alcohol y cafeína en Hábitos (misma rama, sin commit; OTA a `pruebas`)

- **Las metas, debajo de los objetivos** (fundador: «en "Tus objetivos" tendría directamente las metas también»):
  - En «Tus objetivos» (`/metas-objetivos`, `GoalsPickScreen`), debajo de los objetivos, sale «Tus metas» con las tres áreas
    (`AreaTargets` en `MetasScreens.tsx`). Cada una enseña las que tienes y las que recomiendan los objetivos que eliges, que
    cambian al marcar uno. Se ponen y se quitan ahí mismo (hasta 3 por área), con «Ajustar» y «Ver todas» (`/metas-elegir`).
  - Una meta que quitas sigue en la lista, sin marcar, mientras estás en la página. Si no, desaparecía y la lista saltaba.
  - En la hoja (i) «Tus objetivos» de Hoy (`MetasToday.tsx`), debajo de los objetivos, salen tus metas de cada área.
  - `/metas` ya tenía las metas bajo «Tus áreas de acción», y no cambia.
- **Hábitos** (fundador: «incluiría dejar de fumar, reducir el consumo de alcohol, reducir el consumo de cafeína…»):
  - Nueva `sinhumo`, «Sin fumar cada día» (sí / no; «Sin fumar» / «He fumado»; a la semana, «Sin fumar, 5 días a la semana»).
  - Nueva `cafeina`, «Menos de 3 cafés al día» (límite; su (i) cuenta qué vale como un café y cita la EFSA: 400 mg al día en
    adultos sanos, 200 en el embarazo, y la cafeína en las 6 h antes de acostarte).
  - Tabaco (`tabaco`, reducir) y alcohol (`alcohol`, reducir) ya existían, pero solo salían a quien marcó en el cuestionario que
    fuma o bebe. Ahora salen a todo el mundo: a quien lo marcó, primero y con su nota («Sale porque has marcado…»); a los demás,
    al final. Se recomiendan solo a quien lo marcó, como antes.
  - El objetivo «Dejar de fumar» recomienda «Sin fumar» y «Tabaco». «Dormir mejor» incluye la cafeína, pero va la última en el
    orden, así que no cambian las recomendadas por empate (siguen paseo y hora). Los objetivos «Dejar de fumar» y «Beber menos
    alcohol» siguen saliendo solo a quien lo marcó.
  - Lógica: `pickList` (orden de la lista) y `toggleSel` (poner o quitar, hasta 3) en `metas.ts`, que usan las dos pantallas.
- **Pruebas:** tsc limpio y 542 tests (`metas.test.ts`: orden, frases, recomendadas y poner/quitar; `metasEs.test.ts` cubre los
  textos nuevos del catálogo y de las pantallas). Comprobado en la demo web a 375 px: las metas debajo de los objetivos, quitar
  y volver a poner fuerza, Hábitos con las nuevas, la (i) de la cafeína y la hoja de Hoy (cabe sin desplazar con 9 metas). Se
  dejaron el localStorage de la demo y su tamaño como estaban. Pendiente: la (i) de la cafeína y de «Sin fumar» también va a la
  revisión médica (como el resto de `metasInfo.ts`).
- **Publicado solo en pruebas** (OK del fundador, «Sí, OTA a pruebas»): OTA al canal `pruebas`, grupo
  `fc87d40f-94e4-42e3-bc45-43f14fea0e2c` (Android e iOS, runtime `exposdk:57.0.0`). No hace falta APK nuevo. Producción, sin tocar.

### Después del OTA fc87d40f (2026-11-06): metas sin tope y la gráfica de «Tus últimos días» (misma rama, sin commit; OTA a `pruebas`)

- **Metas sin tope** (fundador: «que se puedan seleccionar tantas cuantas quieras. Pero que si te pasas de 3 aparezca arriba…»):
  - `toggleSel` ya no devuelve null con 3 y `normalizeState` ya no recorta a 3. `METAS_MAX` (3) queda como el número a partir
    del cual sale el aviso: `tooMany(s, area)`.
  - El aviso (`ManyTip` en `MetasScreens.tsx`): «Está genial que te propongas muchas metas, pero a veces vale más consolidar unas
    pocas (hasta 3 por área) antes de pasar a las siguientes». Sale arriba en «Tus metas» (`/metas-elegir`, para el área que
    miras) y arriba de la sección «Tus metas» de «Tus objetivos» (si alguna área pasa de 3). Fuera los textos de «hasta 3» y
    «Ya tienes 3: quita una»; «Otra meta» siempre queda marcada.
  - `pickList` ya no sube arriba una meta al marcarla (a quien no fuma, «Sin fumar» marcada saltaba al principio). Orden estable.
- **La gráfica de «Tus últimos días»** (`/your-days`, `DaysScreen`; fundador: «que se pueda ver también la gráfica del estado
  anímico… que por defecto sea estado anímico y energía… y a las chicas les aparezca el eje del ciclo menstrual debajo»):
  - Tarjeta «Cómo has estado» arriba, con 7D / 14D / 1M (`RangeTabs` admite `only`); las tarjetas de cada día siguen siendo 14.
  - `DaysChart.tsx` + `logic/dayChart.ts`: por defecto ánimo y energía (media de los check-ins del día, `MOOD_SCORE`). Debajo,
    una fila de chips en orden fijo para añadir o quitar: estrés, sueño (h), pasos, VFC, pulso en reposo, orina (veces),
    deposiciones (veces) y entreno (min). Hasta 4 a la vez (con 5 ya no se lee); siempre queda una. Lo elegido se guarda en
    user_flags `days_chart` ({ series }).
  - Cada medida en su escala (`seriesScale`): ánimo, energía y estrés de 1 a 5; las demás, de su mínimo a su máximo del periodo
    con un margen mínimo (pasos 6.000, sueño 3 h, VFC 30 ms, pulso 15 lpm, orina 6, deposiciones 3, entreno 60 min), sin bajar de
    0 (pulso, de 30) y redondeado. El chip elegido enseña su escala («Pasos 5–12 mil»). Los días sin dato cortan la línea (un
    trazo discontinuo tenue une los tramos). Tocar: fecha, fase del ciclo y el valor de cada una en su unidad.
  - Mujeres (`sex === 'female'`): franja de la fase de cada día bajo la gráfica (`cycleByDay`: con las reglas apuntadas hasta ese
    día; antes de la primera, nada) y su leyenda. Sin reglas apuntadas, «Apunta tu regla y verás las fases…» (→ `/log-cycle`);
    en la demo, el ejemplo de Hoy (la última, hace 11 días).
  - Demo sin check-ins: ánimo y energía de ejemplo (`sampleCheckInSeries`), dicho en la nota.
- **Pruebas:** tsc limpio y 557 tests (`dayChart.test.ts` nuevo: escalas, guardado, añadir/quitar, tramos, fases; `metas.test.ts`
  sin tope y orden estable; `notasFundador1106Es.test.ts` cubre `DaysScreen` y `DaysChart`). Comprobado en la demo web a 375 px:
  gráfica con ánimo y energía, añadir pasos y VFC, tocar un día, 1M, franja del ciclo (con perfil de mujer puesto a mano y
  quitado) y en español; metas: cuarta en Hábitos con el aviso arriba, en «Tus objetivos» y el donut con 4. localStorage de la
  demo y tamaño, como estaban. Sin probar en un móvil.
- **Publicado solo en pruebas** (OK del fundador, «Sí, OTA a pruebas»): OTA al canal `pruebas`, grupo
  `14744197-b994-4e56-8294-0ce023dedafb` (Android e iOS, runtime `exposdk:57.0.0`). No hace falta APK nuevo. Producción, sin tocar.

### Modo gratis y códigos para compartir la app (2026-11-06, misma rama, sin commit; OTA a `pruebas`)

- **Qué pidió el fundador:** «modo gratis y luego yo les envío código», en Android y en iPhone. Ya existía casi todo (migración
  `20261017100000_plan_access.sql`, aplicada el 2026-10-17): una cuenta nueva es `free`; el admin crea códigos en Más →
  Suscripciones (admin) → «Códigos de invitación» (nivel Basic o Premium, días de acceso, usos máx., nota) y quien lo canjea en
  `/redeem-code` (Mi suscripción → «¿Tienes un código de invitación?», o «Tengo un código» en cualquier candado) recibe ese nivel.
  Comprobado en producción (solo lectura, `supabase db query --remote --read-only`): `my_access`, `redeem_access_code` y
  `has_feature` existen; `app_config` no tiene `plan_features` guardado (valen las filas por defecto de `access.ts`) y aún no hay
  ningún código creado.
- **Nuevo, Entrenamientos con candado en gratis** (el fundador eligió «Además, Entrenamientos», como en el prototipo de Más):
  - Fila `workouts` en `GATED_FEATURES` y `DEFAULT_PLAN_FEATURES` (gratis no; Basic y Premium sí). Sale en «Comparar
    suscripciones». Si el admin guardó la tabla sin esa fila, `featureValue` la deja bloqueada en gratis (como cualquier fila
    que falte).
  - `components/FeatureGate.tsx`: `gated('workouts', Pantalla)` en las rutas `workouts`, `workout-new`, `workout-session`,
    `workout-custom` y `workout-history`. Sin acceso: «Los entrenamientos vienen con la suscripción», «Ver suscripciones» y «Tengo
    un código». La biblioteca y la ficha de cada ejercicio y «Apuntar un entreno» (`/log-workout`) siguen abiertos.
  - Más: Entrenamientos y Plan de comidas llevan un candado en vez de la flecha cuando no hay acceso.
  - Siguen bloqueados en gratis, como antes: escanear informes y el menú semanal. Lo demás, abierto (check-in, metas, historial,
    tarjeta de emergencia, wearables, ciclo, baño, medicación…). La demo, los admins y quien tenga código o suscripción lo ven todo.
  - Ojo: el pago sigue simulado (sin claves de Revolut). «Simular pago correcto» solo cambia la pantalla, no da acceso.
- **Pruebas:** tsc limpio y 562 tests (`modoGratis.test.ts` nuevo; `notasFundador1106Es.test.ts` cubre `FeatureGate` y Más).
  Comprobado en la demo web a 375 px: Entrenamientos abre (la demo lo tiene todo), la pantalla del candado (forzada un momento a
  mano y quitado) y la fila nueva en «Comparar suscripciones». localStorage de la demo, como estaba.
- **Publicado solo en pruebas:** OTA al canal `pruebas`, grupo `281a75f1-bf3a-4dd9-9b31-c5c3dd688440` (Android e iOS).
- **Para compartir:** Android, el APK de pruebas b3972691 se baja sin cuenta de Expo desde
  https://expo.dev/artifacts/eas/C_q7E8Ua5Wu3Oltwy56lqh35y-yXsFDWOVU0q-xW5YY.apk (hay que permitir instalar apps de fuera de
  Play; recibe los OTA de `pruebas`). iPhone: hoy la compilación 1.1.0 (4) solo está en el grupo interno de TestFlight (usuarios
  de App Store Connect). Para gente de fuera hace falta un grupo externo con enlace público, que pide la revisión beta de Apple
  (información de prueba, contacto y una cuenta de prueba con contraseña que crea el fundador). **Sin hacer.**

### «Tu historial» se pliega en vez de ocultarse (2026-11-06, misma rama, sin commit; OTA a `pruebas`)

- **Qué pidió el fundador:** «Ahora mismo si lo ocultas, desaparece. Prefiero que se colapse… que no tengas que ajustarlo en
  otro sitio», en Android y en iPhone.
- `components/historial/HistorialBlock.tsx`: el botón «Ocultar» (que quitaba la sección y había que volver a ponerla en Configura
  tu experiencia) ya no está. Tocar la cabecera «Tu historial» (con una flecha arriba/abajo) lo pliega y lo despliega; plegado
  solo queda el título y «Alergias, grupo sanguíneo, vacunas y más. Tócalo para abrirlo.» Se recuerda en user_flags
  `mydata_history_open` (abierto por defecto). Quitarlo del todo sigue en Configura tu experiencia (sección `history`); quien lo
  ocultó antes con el botón lo vuelve a poner allí.
- **Pruebas:** tsc limpio y 562 tests. Comprobado en la demo web a 375 px y en español: se pliega, sigue plegado al recargar y se
  vuelve a abrir. localStorage de la demo, como estaba.
- **Publicado solo en pruebas:** OTA al canal `pruebas`, grupo `58463ea0-b395-4576-95da-72fca8592e4f` (Android e iOS).

### Entrenamientos con varias rutinas y sus días, y cinco arreglos (2026-11-06, misma rama, sin commit; OTA a `pruebas`)

- **Qué pidió el fundador:** el valor centrado en «Ajustar tu meta»; en «Tus últimos días», solo curvas, sin puntos; que el
  teclado no tape los ejercicios al buscar y que se marque la tarjeta entera al elegir; la papelera de «Otros programas» se
  salía del recuadro; «hay un lío con rutina, día y nombres»; y «crear un entrenamiento con varias rutinas que pueden repetirse
  varios días cada una… hazlo bien, con cabeza».
- **Arreglos pequeños:**
  - `components/metas/MetaParts.tsx` `TargetStepper`: el «− # +» centrado; la rueda sigue a todo el ancho.
  - `components/DaysChart.tsx`: sin puntos; solo lleva punto un día suelto sin vecinos (si no, no se vería). El círculo al
    tocar un día sigue.
  - `components/workouts/WorkoutModal.tsx`: con el teclado fuera, la hoja encoge hasta encima del teclado (Android de borde a
    borde no encoge la ventana) y deslizar la lista lo esconde. `ExerciseLibrary.tsx`: mientras se escribe en el buscador se
    esconden los filtros, «Intro» cierra el teclado, y la tarjeta elegida se marca entera (borde y fondo dorados, borde en la
    foto y un ✓).
  - `screens/workouts/WorkoutsScreen.tsx`: lápiz y papelera arriba a la derecha de la tarjeta, dentro; los botones de abajo
    pueden bajar de línea.
- **Entrenamiento → rutinas → días** (antes «rutina» era el todo y «día A» cada rutina):
  - Datos: `weekdays?: number[]` en cada `WorkoutSession` (0 = domingo … 6 = sábado, como getDay() y la medicación), en el jsonb
    `sessions`: **sin migración**. Un día es de una sola rutina. Sin días en ninguna rutina, todo como antes (van en orden).
  - `logic/workoutWeek.ts` (nuevo): `normWeekdays`, `toggleWeekday` (si el día era de otra rutina, pasa a esta), `daysText`
    («Lun, Jue»), `sessionsPerWeek`, `nextUp` (con días: la de hoy si hoy no has entrenado; si no, la del siguiente día con
    rutina; sin días, la siguiente en orden) y `whenText` («Hoy», «Mañana», «El jueves»).
  - `logic/customRoutine.ts`: al guardar, las letras vuelven a ir en orden (A, B, C…) y **lo ya hecho se va con su rutina**
    (`routineIdMap`; antes, quitar un día volvía a poner letras y el historial y «lo siguiente» apuntaban a otra rutina). Las
    quitadas pasan a `xB` (siguen en el historial con el nombre del programa). Una rutina con nombre o días pero sin ejercicios
    no se guarda sin avisar (`firstEmptyRoutine`). El entreno a medias sigue a su rutina (`moveActiveWorkout`). Título por
    defecto «Mi entrenamiento».
  - Editor (`CustomRoutineScreen.tsx`): «Crear mi propio entrenamiento» / «Editar entrenamiento»; nombre; «Tu semana» (qué
    rutina toca cada día, tocar abre la rutina); las rutinas como fichas con letra, nombre y días a la vista (se actualizan al
    escribir); la abierta con su nombre, sus 7 días y sus ejercicios; «Añadir ejercicios a Push».
  - Entrenamientos: «Hoy / Mañana / El lunes» en vez de «Siguiente sesión», cada rutina con sus días, «4 días a la semana · 2
    rutinas», «Esta semana: 0 de 4». La sesión: pestañas con letra y nombre, y sus días junto a los minutos.
  - `labels.ts`: una rutina sin nombre es «Rutina A»; en lo hecho a mano los nombres no se traducen (antes «Push» salía
    «Empuje» y se guardaba así al editar en español).
  - El portal del entrenador no se ha tocado: conserva `weekdays` al editar (copia la sesión entera) pero no los enseña.
- **Pruebas:** tsc limpio y 577 tests (`workoutWeek.test.ts` nuevo; `notasFundador1106Es.test.ts` cubre los ficheros tocados).
  En la demo a 375 px, en inglés y en español: el editor con dos rutinas (Push lun y vie, Legs mar y jue, el jueves pasando de
  una a otra), el aviso de rutina vacía, la tarjeta elegida, los filtros escondidos al escribir, la tarjeta del programa, la
  sesión, el valor centrado y la papelera dentro. **No se pudo ver la gráfica sin puntos** (con el panel oculto no se dibuja) ni
  el teclado (no hay teclado en la web). localStorage de la demo, como estaba.
- **Publicado solo en pruebas:** OTA al canal `pruebas`, grupo `0465590d-2aae-4208-a562-26e6c6f88d7a` (Android e iOS). Sin commit.
- **Después (OTA `pruebas` `e1c39eaf-3c4d-46a0-a713-a8ad935986bf`):** al desmarcar un ejercicio en la biblioteca la foto se
  quedaba en blanco (fundador, en el móvil). Era el borde que se ponía y se quitaba en el propio marco de la foto (redondeado y
  recortando lo de dentro). Ahora la foto no cambia nunca: el marco dorado y el ✓ van en una capa encima, siempre puesta, que
  solo cambia su opacidad. Test en `workoutWeek.test.ts`; comprobado en la demo marcando y desmarcando cuatro veces (la foto
  sigue con sus dos imágenes). 578 tests. Sin commit.
- **Después (OTA `pruebas` `89e3d391-3ff4-4518-8272-bd74623a7972`):** tres notas del fundador sobre «Ver las sesiones» y «Editar rutina».
  1. Las pestañas de las rutinas (A · nombre, B · nombre…) se cortaban por arriba: la tira horizontal encogía con la lista
     larga debajo. Ahora no encoge (`tabsScroll: flexGrow 0, flexShrink 0` en `WorkoutSessionScreen.tsx`).
  2. El lápiz de cada ejercicio en «Ver las sesiones» abría `DoseEditor`, una sola dosis para todas las series (4 × 6 ·
     100 kg), sin pesos distintos por serie. Ahora abre el mismo editor que «Editar rutina» (`RoutineExerciseCard`): serie a
     serie, con su peso y sus repeticiones o segundos, el descanso y la nota, con «Cancelar» y «Guardar». Se guarda con
     `fromDraft` en el programa; cerrar o cancelar no cambia nada. Título de la hoja: «Cambiar {ejercicio}». Con programa
     del entrenador sigue el aviso «{nombre} verá el cambio». `DoseEditor.tsx` ya no lo usa nadie; se ha dejado.
  3. «Más condensados, a modo lista… no que aparezca todo desplegado de un principio»: en «Editar rutina» cada ejercicio
     sale cerrado en una línea (foto, nombre y el resumen `doseText` + descanso, p. ej. «3 × 8–12 · 12–16 kg · descanso
     1 min») con su ⋮ (subir, bajar, cambiar, quitar) para ordenar sin abrir nada. Tocarlo lo abre (tabla serie a serie);
     solo uno abierto a la vez, y sigue abierto si se mueve. `RoutineExerciseCard` tiene `open` y `onToggle`; sin
     `onToggle` está siempre abierto (la hoja de «Ver las sesiones»).
  Tests en `workoutWeek.test.ts` (resumen con pesos distintos, ida y vuelta serie a serie, la lista empieza cerrada, el lápiz
  usa el editor serie a serie, las pestañas no encogen) y `RoutineExerciseCard.tsx` en la prueba de textos en español.
  582 tests, tsc limpio. Comprobado en la demo a 375 px (panel oculto, sin capturas): pestañas enteras dentro de su tira;
  el lápiz de Goblet Squat abre la tabla, añadir una serie con 12/14/16 kg y 8 reps guarda «3 × 8–12 · 12–16 kg» y al
  reabrir cada serie conserva lo suyo; en «Editar rutina» la lista empieza cerrada, se abre uno a la vez y «Subir» lo
  mantiene abierto. localStorage de la demo, como estaba. Sin commit.

### «Calorías y macros» en tu menú semanal, con el panel del dietista (2026-11-06, misma rama, sin commit; OTA a `pruebas`)

Petición del fundador: «en el weekly menu quedamos que íbamos a poder editar los macros nosotros (como el dietista)».
- **Panel compartido** `src/components/diet/MacroTargetsPanel.tsx`: lo que tenía el portal en `ProDietScreen` (kcal,
  proteína, hidratos y grasa al día, vacío = lo calculado en gris; aviso si los macros no suman las kcal; reparto por
  comida con % de kcal y gramos de cada macro, «Reparto por defecto» y «Menú ahora» por comida), sacado tal cual. Lo usan el
  portal (mismo comportamiento: comprobado que las raciones se rehacen al escribir) y el paciente. `NumField` también sale
  de ahí (lo usa la hoja del día del portal). Las casillas llevan `accessibilityLabel` y `useRevealOnFocus`.
- **Pantalla nueva** `/diet-macros` (`src/screens/diet/DietMacrosScreen.tsx`), desde la tarjeta de arriba del menú:
  «Ajustar calorías y macros» (o «Tus calorías y macros» si ya hay alguno puesto, `ownMacros`). Arriba, el donut y
  «Objetivo» frente a «Tu menú» con las raciones ya rehechas a tus números; luego el panel. «Guardar»: mismos platos,
  raciones a tus números (`fitPortions`) y objetivos y razones recalculados. «Guardar y elegir otros platos»: pregunta y
  rehace el menú para esos números (se pierde lo cambiado a mano). «Usar los calculados» lo vacía todo. Salir con cambios
  sin guardar pregunta antes.
- **Límites**: solo en tus menús (el de un dietista no enseña el enlace y la pantalla dice que lo cambia él). Por debajo
  de `selfKcalFloor` (1200 kcal, 1500 en hombres: el suelo del propio generador al perder peso) no se guarda y sugiere un
  dietista. Si el menú tiene «Para comentar con tu médico», un aviso neutro encima. **Supuestos para el backlog
  clínico**: el suelo y que el paciente pueda subir la proteína con un aviso de riñón (el generador la limita; lo que
  pone el paciente manda, como lo del dietista).
- Al cambiar las respuestas del cuestionario, los números propios se quedan (el cuestionario parte de los `prefs` del
  último menú propio).
- Tests: `src/logic/__tests__/dietMacros.test.ts` (6) y las tres pantallas en la prueba de textos en español. 588 tests,
  tsc limpio. Comprobado en la demo a 375 px (panel oculto; creé un menú con el cuestionario): sin desbordar a lo ancho,
  900 kcal → aviso y «Guardar» desactivado, 2600 kcal + 140 g → «Tu menú: 2570 kcal · 137 g» con los mismos 4 platos;
  guardado, el menú dice «Unas 2600 kcal y 137 g de proteína» y el día pasa de 2144 a 2660 kcal; al reabrir siguen los
  números; con hidratos y grasa sale «Tus macros suman 2295 kcal (objetivo 2600)» y «Guardar y elegir otros platos»
  pregunta y cambia los platos. El portal (`/pro-diet?patient=p-laura`) se ve igual y rehace raciones al escribir.
  localStorage de la demo, como estaba (sin menú). Sin commit.
- **Publicado solo en pruebas:** OTA al canal `pruebas`, grupo `d304132e-6dee-463c-9889-1b4eef71a2b4`.
- **Después (OTA `pruebas` `dfcc89a3`):** tres notas del fundador.
  1. «Se ve muy mal: un espacio tremendo y luego la rueda»: la tarjeta de arriba iba en una fila (donut con su leyenda +
     el texto «Objetivo / Tu menú»), y en el móvil el texto quedaba en una columna estrechísima, la tarjeta muy alta y el
     donut en medio. Ahora en columna: el donut con su leyenda y debajo una tablita (Objetivo / Tu menú × kcal, P, H, G).
  2. «Poder editar por día de la semana» y, tras una primera versión con solo kcal y macros por día, «no permite ese
     detalle para cada día: configurar arriba lo de breakfast, lunch… para cada día, y arriba a la derecha algo rollo
     aplicar a todos los días». La pantalla es ahora día a día: arriba los 7 días (pestañas con sus kcal; en naranja si
     quedan por debajo del suelo; parte de hoy), el resumen del día elegido (donut + Objetivo / Tu menú) y el panel
     entero de ese día (kcal, P, H, G y el reparto por comida: el mismo `MacroTargetsPanel`, con «Menú ahora» de ese día)
     con su nombre y, arriba a la derecha, «Aplicar a todos los días» (copia ese día a los 7; gris si ya son iguales;
     «Hecho: todos los días tienen ahora estos números.»). «Usar los calculados para este día» lo vacía.
     - Modelo (`src/logic/dietDayMacros.ts`): en el editor cada día lleva su borrador completo (`dayDrafts`: lo suyo y,
       lo que no tenga, lo de la semana). Al guardar (`saveDrafts`): si los 7 son iguales, los números van a `prefs` y los
       días no llevan nada propio; si no, `prefs` sin números y cada día los suyos en `days[].targets` (el campo del
       dietista, sin migración), que ahora admite también `meals` (el reparto por comida de ese día; `prefsForDay` lo
       mezcla con la semana). Lo que se ve en el editor es lo que se guarda (test).
     - «Guardar y elegir otros platos» genera con los números que más se repiten (`commonDraft`) y ajusta cada día.
       «Otra versión» del menú conserva los números del día (`fitDay`). En el menú, «Unas N kcal al día» es la media de
       la semana (`weekKcalTarget`) y el «Objetivo» de cada día, el suyo (`dayKcalTarget`). Helpers en `dietPlanner.ts`:
       `cleanDayTargets` (también `meals`), `cleanMeals`, `dayKcalTarget`.
  Tests: `dietMacros.test.ts` con 16; 598 tests, tsc limpio. En la demo a 375 px: jueves a 3000 kcal y 45 % en la comida
  → su pestaña dice 3000 y «Menú ahora» de la comida pasa a 1204 kcal, el lunes sigue igual; «Aplicar a todos los días»
  → los 7 a 3000 y el domingo con 3000 y 45 %; sábado a 2200 y guardar → cada día con sus números y la semana sin
  ninguno; el menú dice «Unas 2890 kcal» (la media), el viernes «Objetivo: 3000 kcal» y el sábado 2200; al reabrir, el
  sábado sigue con 2200 y 45 %. localStorage de la demo devuelto como estaba (sin menú). Sin commit.
- **Publicado solo en pruebas:** OTA al canal `pruebas`, grupo `dfcc89a3-416a-4d79-8a38-d3f81307be1e`.
- **Después (OTA `pruebas` `6e8d7168`): que el día y el reparto por comida siempre cuadren.** Fundador: «si pongo
  proteínas en el día y luego per meal las edito… deja de ser coherente; algún guardrail, que una cosa bloquee a la
  otra». Antes, lo puesto en una comida se sumaba encima: las demás seguían cogiendo su parte de todo el día. Ahora una
  sola regla, en el día y en cada comida, con el mismo panel para el paciente y el portal (`MacroTargetsPanel`):
  - **El día** (kcal, P, H, G; 4, 4 y 9 kcal/g): con tres casillas puestas, la cuarta sale de ellas y no se escribe
    (`dayLock`): con los tres macros, las kcal; con las kcal y dos macros, el tercero. En `dietTargets`, lo libre que
    falta sale como resto (con hidratos puestos, la grasa es lo que queda; con hidratos y grasa sin kcal, las kcal
    salen de los tres). Si los macros pasan de las kcal: «Tus macros suman 2600 kcal, más que las 2400 kcal del día…»
    (`dayIssue`). Sin nada puesto, el generador hace lo mismo que antes.
  - **Cada columna** (% kcal, P, H, G por comida; `mealSplit` en `dietPlanner.ts`, que ahora usa `mealTargets`): las
    comidas suman lo del día. Lo puesto se queda y las vacías se reparten lo que queda (el % en proporción a su parte
    de siempre, los gramos a su %). La última vacía de una columna es justo lo que queda: borde discontinuo y no se
    escribe; para cambiarla, vacía otra. Si lo puesto se pasa (o deja menos de un 5 % a cada comida vacía), la columna
    sale en naranja, la casilla que queda dice cuánto (p. ej. −20) y «Repartir automáticamente» la vacía.
  - **Cada comida**: con tres casillas puestas, la cuarta sale de ellas (con sus tres gramos, su %; con su % y dos
    gramos, el tercero). Sus gramos no pueden pasar de sus kcal («Tentempié: sus gramos suman 320 kcal, más que sus
    200 kcal (10 %)», con «Vaciar esta comida»). Las kcal de cada comida van siempre por su %.
  - Con algo que no cuadre no se guarda: en «Calorías y macros» los dos botones quedan desactivados, ese día en
    naranja y «Hay números que no cuadran en: viernes»; en el portal, «Enviar» desactivado con un aviso, y la hoja de
    un día también bloquea su cuarta casilla y dice qué no cuadra. El generador, si le llega un menú así de antes, lo
    reparte todo en proporción para que sume lo del día.
  Tests: 10 más en `dietMacros.test.ts` (26) y `ProDietScreen.tsx` en la prueba de textos en español; 608 tests, tsc
  limpio. En la demo a 375 px (menú hecho con el cuestionario): proteína del día 150, desayuno 40 y comida 50 → cena y
  tentempié se reparten los 60 g (45 + 15); con la cena a 40, el tentempié queda en 20 con borde discontinuo; desayuno
  a 80 → «Las comidas suman 170 g de proteína y el día tiene 150 g», el tentempié dice −20, «Guardar» desactivado y el
  viernes en naranja; «Repartir automáticamente» lo vuelve a automático; 2400 kcal + 150 g + 250 g de hidratos → la
  grasa queda en 89 g bloqueada; proteína 400 → «Tus macros suman 2600 kcal…»; guardado y reabierto, sigue igual. En
  el portal (`/pro-diet?patient=p-laura`), 90 + 90 g con 86 g en el día → «Enviar» desactivado. localStorage de la
  demo devuelto como estaba. Sin commit.
- **Publicado solo en pruebas:** OTA al canal `pruebas`, grupo `6e8d7168-a188-4f91-8cb4-584eb45d8f47`.

### TestFlight externo para amigos (2026-11-06, App Store Connect; sin cambios en el código)

- **Qué pidió el fundador:** la invitación de iPhone para una persona concreta y el APK para amigos. Eligió grupo externo
  (sin acceso a la cuenta de desarrollador; revisión beta de Apple, ~1 día) frente a interno.
- **Hecho:** grupo externo «Probadores» (`f86fb346-00ec-45f6-beeb-aa9d6e21866e`) con 1 probador por correo (Apple no le
  escribe hasta que haya una compilación aprobada en el grupo). En Información de prueba, guardados la descripción de la beta
  (ES, la de `docs/testflight-externos.md`), el correo de comentarios support@kuovahealth.com, https://kuovahealth.com y
  https://kuovahealth.com/privacy. Las notas para la revisión no se guardan hasta que esté el contacto.
- **Enviado a revisión** (2026-11-06, por el propio fundador desde el diálogo): puso su contacto (el teléfono tiene que ir
  con +34 o Apple no guarda nada de la sección) y la cuenta de Kuova para Apple, y añadió la 1.1.0 (4) al grupo con su
  propio «Qué probar». Estado: «Waiting for Review». Cuando Apple la apruebe, TestFlight manda la invitación (está marcado
  «Automatically notify testers»); se puede activar también el enlace público del grupo («Create Public Link»). La cuenta
  nueva de quien pruebe empieza en gratis: el fundador le manda un código.
- **Android:** el APK de pruebas b3972691 (enlace en «Modo gratis y códigos…») caduca en EAS el 2026-11-20; después hará
  falta otro APK de pruebas.

## 2026-11-08 — Solicitar pruebas: la tienda enseña el catálogo real de paneles (rama `metas-fase1`, sin commit; OTA a `pruebas`)

- **Qué pidió el fundador:** que «Solicitar un test nuevo» enseñe el catálogo que hemos construido y no los productos de
  ejemplo, para enseñárselo a una endocrinóloga. Fuente: `0. CatalogoMarcadoresInterno.xlsx` (hoja Matriz_paneles), la
  guía de paneles y la «Solicitud v3» del 28/10. Toda extracción, en centro, en ayunas y por la mañana (decidido el 27/10).
- **Niveles en `/store`** (`src/data/testCatalog.ts`, textos en `src/i18n/testCatalogEs.ts`, guía «para qué / cada cuánto»
  en `testGuide.ts` + `testGuideEs.ts`):
  - Suscripción: análisis anual Kuova Baseline (31 pruebas, más la Lp(a) el primer año) + seguimiento fijo a los 6 meses
    (23 pruebas). Premium se queda como estaba (seguimiento cada 3 meses); el plan «Kuova Pro» del catálogo no está hecho.
  - **Añadir a tu seguimiento** (`withFollowUp`, solo con suscripción, en la misma extracción): vitamina D, B12 y fólico,
    magnesio, calcio, sodio y potasio, insulina (HOMA-IR), PSA (hombres).
  - **Confirmar y ampliar:** tiroides, testosterona baja (hombres), andrógenos (mujeres), albúmina en orina.
  - **Objetivos:** hormonas y fertilidad (reserva ovárica, salud hormonal de la mujer en 2 extracciones, del hombre, antes
    de buscar un embarazo), digestivo (celiaquía, aliento SIBO/lactosa/fructosa/H. pylori), ITS (6 por PCR y completa),
    otros (carga de entrenamiento, índice omega-3, alergias ALEX).
  - **A petición de un médico** (`orderable: false`, sin botón). Lo de «No ofrecemos» (microbiota, cortisol para el
    estrés, homocisteína…) no sale.
  - Cada grupo con una línea de cuándo tiene sentido; cada ficha con «Ten en cuenta» (`notes`). Campo `only` por sexo.
- **Precios:** solo los planes tienen precio (365 €, decidido en el business case; 700 € Premium, ya estaba en la app y no
  sale en el business case). **Las pruebas sueltas no tienen precio decidido**: la ficha dice «Precio por confirmar» y
  `/checkout` hace una **solicitud simulada** sin llamar a `create-checkout` (título «Tu solicitud», «Simular la
  solicitud»). La tabla del servidor `supabase/functions/_shared/products.ts` se queda en `membership` y `premium` para que
  ids reutilizados (thyroid, psa, coeliac, sibo, lactose, fructose, vitamin_d) no se puedan cobrar a precios viejos; solo
  cambia en producción al desplegar la función. `npm run check:prices` OK (2 productos). Cuando el fundador decida
  precios: `price` en `testCatalog.ts` y el mismo importe en céntimos en `products.ts`.
- **Costes de laboratorio y nombres de laboratorios/competidores:** nunca en textos ni en comentarios (el repo puede ser
  público). Lo vigila `src/logic/__tests__/catalogoPaneles.test.ts` (también tono sin diagnóstico, textos en español de las
  5 pantallas y que la composición del panel exista en `knowledge/`).
- **Cuestionario `/test-finder`:** `recommend(answers, sex, available)` devuelve `{picks, covered, flags}`; `covered` es lo
  que el análisis anual ya mide (texto «Tu análisis anual ya mide…»), `available` = lo que se puede pedir (lo de
  seguimiento, solo con suscripción). Andrógenos y testosterona baja se juntan con la salud hormonal; una sola ITS; aviso
  aparte para estrés y sueño (ningún análisis los mide) y para alergias (lleva a ALEX).
- **«Qué mide cada analítica» (`/panel-markers`):** composición en `src/data/subscriptionPanel.ts` (antes en
  `biomarkerLabels.ts`): `PANEL_BOTH` (anual y seguimiento, más la orina básica), `PANEL_YEARLY` (TSH, vitamina D,
  magnesio, sodio, potasio, calcio, insulina; + B12 y HOMA-IR), `PANEL_FIRST_YEAR` (Lp(a)); la microalbúmina en orina
  queda fuera (es el módulo «Albúmina en orina»). En la demo: 68 en el anual, 58 en el seguimiento.
- **Otros:** `gutPatterns.ts` manda H. pylori a su prueba de aliento y el intestino irritable a celiaquía.
- **Comprobado:** tsc limpio, 618 tests. En la demo web (8082, en español): tienda por grupos con «Precio por confirmar»,
  ficha de tiroides abierta, solicitud simulada de principio a fin, cuestionario (cansancio + digestión + entreno +
  embarazo + tiroides + poco sol → tiroides, antes de un embarazo, carga de entrenamiento y 7 más) y `/panel-markers`.
  Sin errores en consola. Sin probar en el móvil.
- **Mandado al canal `pruebas`** (OK del fundador «Sí, a pruebas»): EAS Update grupo `a1c75c63-b079-4e2c-80db-6360be2c0975`
  (android + ios), con los pasos a mano (`expo export --clear … --max-workers 1` y `eas-cli update --channel pruebas
  --environment preview --skip-bundler --input-dir dist`). Lleva también lo que había sin publicar en la carpeta. Nada a
  producción, sin build nueva ni cambios en la web.

### Sin médicos reales en la app (2026-11-09, misma rama, sin commit, sin publicar)

- Fundador: «Deja médicos aleatorios, pero quita a Gema, a Covadonga, a Alejandro Alonso...». Fuera de
  `src/data/servicesMock.ts` las cuatro fichas de profesionales reales que se añadieron el 2026-10-10 (endocrina,
  hematólogo, dermatóloga y asesora genética, `pro-gema-martinez`, `pro-alejandro-alonso`, `pro-covadonga-carrera`,
  `pro-andrea-otero`) y sus textos en `src/i18n/es.ts` (nombres, bios, especialidades y huecos que solo usaban ellas).
  Quedan los diez ficticios (`pro-1`…); genética sigue con dos (Sofía Llorente y Marta Ibáñez). El nombre del test de
  la agenda (`workoutTimer.test.ts`) y un comentario de `specialistTypes.ts` usan ahora «Laura Méndez», que es ficticio.
- 620 tests en verde, tsc limpio, `/professionals` revisado en la demo web: solo salen los ficticios.
- De paso: Marta Echeverría (matrona) y Marta Ibáñez (asesora genética) tenían las dos `id: 'pro-8'` (desde e986f5a):
  al tocar a Marta Ibáñez se abría la ficha de la matrona y la consola avisaba de claves repetidas. Marta Ibáñez pasa a
  `pro-10`.

### «Atrás» a saltos en Android: las pantallas de encima ya no sueltan la de pestañas (2026-11-09, misma rama, sin commit, sin publicar)

- Fundador, en el móvil: al volver atrás desde Historia clínica la transición era muy brusca. Causa (leída en el código
  de las librerías, sin Android a mano): react-native-screens (`ScreenStack.kt`, `visibleBottom`) quita del todo la
  pantalla de debajo cuando la tapa otra opaca, y react-native-svg (`SvgView.onDetachedFromWindow`) tira el dibujo de
  cada gráfica al soltarse. Al volver, las cinco pestañas (con todas sus gráficas de Mis datos, Hoy…) se pintan de cero
  en el primer fotograma de una animación de 200 ms (`config_shortAnimTime`), que se come el salto. Pasa al volver a
  las pestañas desde cualquier pantalla; en Historia clínica se nota porque Mis datos es la más cargada.
- Arreglo en `src/app/_layout.tsx`, solo Android: todas las pantallas van en `presentation: 'transparentModal'` (por
  fuera iguales: llevan el mismo fondo opaco de `contentStyle`), así la de debajo se queda puesta y ya pintada y
  «atrás» solo desliza la de arriba (sin el pequeño desplazamiento de la de debajo). Los modales de registro, igual
  (`MODAL`). Las de base (`index`, `login`, `(tabs)`, `onboarding`, `pro`, `resumen`) siguen en `card` para no dejar
  nada viejo debajo. iOS y web sin cambios. Coste: las pantallas abiertas siguen montadas y dibujadas debajo (más
  memoria y algo más de trabajo de GPU con varias apiladas); TalkBack las oculta (lo hace la librería).
- tsc limpio, 620 tests. **Sin probar en un Android**: hay que confirmarlo en el móvil (Historia clínica, una gráfica de
  Mis datos y un registro como el peso, y volver atrás). Si algo va raro, quitar `presentation: OVER` y los `...BASE`
  deja todo como estaba.
- «Compara suscripciones» (`src/data/access.ts`, fila `more_panels`, el id no cambia): en vez de «Más paneles y pruebas»
  dice «El anual añade tiroides completo, hormonas, ácido fólico y albúmina en orina», lo mismo que la ficha de Premium
  (ver la sección del catálogo). Revisado en la demo a ancho de móvil; 620 tests.

### 2026-11-09 — Premium: «Análisis anual Kuova Premium» y comparativa de marcadores Basic / Premium / seguimiento (misma rama, sin commit, sin publicar)

- **Qué pidió el fundador:** que en la ficha de Premium no diga «Kuova Baseline» sino «análisis Kuova Premium», y que al
  tocarlo se vea la comparativa entre el anual de Basic, el anual de Premium y el seguimiento: qué marcadores añade
  Premium, no solo que tenga más seguimientos.
- **Composición:** el anual de Premium es el «Kuova Pro (Complete)» del catálogo del 28/10 (estado «Propuesta: validar con
  el asesor»): todo el Baseline + T4 y T3 libres, ácido fólico, albúmina y creatinina en orina (cociente), SHBG,
  estradiol, FSH, LH y DHEA-S, más progesterona (mujeres) o PSA total (hombres): 42 pruebas, +11 por persona. El
  seguimiento es el mismo en los dos (23 pruebas; cada 6 meses en Basic, cada 3 en Premium). Precio de Premium, sin tocar.
- **Ficha de Premium** (`testCatalog.ts`, `testCatalogEs.ts`, `testGuide*.ts`): «Análisis anual Kuova Premium: 42 pruebas
  de laboratorio (más la Lp(a) el primer año)», «Además de lo de Basic: tiroides completo, tus hormonas, ácido fólico y
  albúmina en orina», «Seguimiento cada 3 meses (3 al año): 23 pruebas, siempre las mismas»; fuera «Más paneles y pruebas
  incluidos». Campo nuevo `markerLines` (Basic 2, Premium 3): esas primeras líneas de «Qué incluye» abren
  `/panel-markers?plan=<id>` (`TestCard.tsx`).
- **`/panel-markers`:** tres columnas (Basic, Premium en dorado, Seguimiento), tres cajas (68 anual Basic, 79 anual
  Premium, 58 seguimiento) y filtros «Todos los marcadores», «Lo que añade Premium» (por donde empieza si se abre desde
  Premium) y «Solo los del seguimiento». Datos en `subscriptionPanel.ts`: `when: 'premium'`, `only` por sexo,
  `PANEL_PREMIUM`/`PANEL_PREMIUM_MALE`, extras ácido fólico, progesterona y cociente albúmina/creatinina,
  `panelCounts()`; la microalbúmina en orina pasa de «fuera» a «solo Premium»; DHEA-S en Hormonas; nombres cortos
  (FSH, LH, DHEA-S, T4/T3 libre, PSA total) para que quepan a 375 px.
- **Comprobado:** tsc limpio, 620 tests (dos nuevos en `catalogoPaneles.test.ts`: +11 por persona, nada del Baseline como
  «solo Premium», la ficha no dice Baseline). En la demo en español a 375 px: ficha de Premium, tocar la línea → «Lo que
  añade Premium», y desde Basic → «Todos los marcadores». Sin errores en consola. No mandado a `pruebas` (pide el OK).
- **Pendiente:** la tabla «Compara suscripciones» (filas en `src/data/access.ts`, de la otra sesión) sigue diciendo «Más
  paneles y pruebas» para Premium; la composición la tiene que validar el asesor médico.

### 2026-11-09 (2) — Sin precio en las suscripciones, fuera «Cada cuánto repetirlo» y comparativa más limpia (misma rama, sin commit, sin publicar)

- **Qué pidió el fundador:** «quita también el precio de las suscripciones», «lo de Cada cuánto repetirlo, mejor quítalo» y
  que en la comparativa los colores sean coherentes y todo quede equidistante.
- **Sin precio en ningún sitio:** `MEMBERSHIP` y `PREMIUM` sin `price` (fuera el tipo `PricedTest`) y fuera «1 € al día»
  de la descripción de Basic. La ficha dice «Precio por confirmar» (sin «/año»), el botón «Pasar a Premium» va sin
  importe y `/checkout` de un plan es una solicitud simulada («Esta suscripción aún no tiene precio…», «Solicitud
  simulada»). `PlanComparison` y `SubscriptionCard` solo enseñan el precio si lo hay. La tabla del servidor
  (`supabase/functions/_shared/products.ts`) se queda vacía (eran 36500 y 70000 céntimos/año, anotado en el comentario):
  `npm run check:prices` → «OK: 0 products». Cuando haya precios: `price` en `testCatalog.ts` y el importe en `products.ts`.
- **«Cada cuánto repetirlo»:** fuera de las fichas (`TestCard.tsx`). Los textos `repeat` siguen en `testGuide*.ts`, sin
  usar, por si vuelven.
- **Comparativa `/panel-markers`:** un solo color para todas las marcas (el acento; nada de dorado mezclado), las tres
  columnas del mismo ancho (64) con su cabecera centrada encima y el relleno de la cabecera alineado con el de las tarjetas;
  los filtros son tres botones iguales que caben a 375 px: «Todo», «Solo Premium», «Seguimiento»; las tres cajas de
  totales iguales; SHBG también con nombre corto. Medido en la demo: la palabra más larga («aminotransferasa», 107 px)
  cabe en la columna de nombres (111 px) y «Seguimiento» cabe en una línea (cabecera a 10 px, y en iPhone encoge si hace
  falta).
- **Comprobado:** tsc limpio, 620 tests (el de precios ahora exige que nada tenga precio ni hable de €). En la demo en
  español a 375 px: tienda, ficha de Basic y Premium, comparativa desde los dos y la solicitud de Premium. No mandado a
  `pruebas`.

### 2026-11-09 (3) — Pruebas genéticas en el catálogo (misma rama, sin commit, sin publicar)

- **Qué pidió el fundador:** «añadir tests genéticos en el catálogo, también por validar precio e indicando dentro que una
  consulta con asesoramiento genético es necesaria».
- **Grupo nuevo «Pruebas genéticas»** (`TestCategory` `genetic`, icono `dna`, entre «Deporte, alergias y omega-3» y «Si
  te lo pide tu médico»), con las cinco del consentimiento informado de Kuova (`00 Empresa y legal/Consentimientos`):
  celiaquía genética (HLA-DQ2/DQ8), intolerancias genéticas (LCT/MCM6, ALDOB, AOC1, HLA), hemocromatosis (HFE C282Y y
  H63D), trombofilia (factor V Leiden y protrombina G20210A) y APOE (ε2/ε3/ε4). Se crean con `genetic({...})` en
  `testCatalog.ts`: sin `price` («Precio por confirmar»), `orderable: false` (no salen en el cuestionario ni se pueden
  pedir en `/checkout`) y `counselling: true`.
- **El aviso:** las fichas con `counselling` llevan «Con asesoramiento genético» debajo de la descripción y, al abrirlas,
  un recuadro «Necesita una consulta de asesoramiento genético» (un médico decide contigo si tiene sentido, la pide y te
  pide el consentimiento por escrito; una segunda consulta te explica el resultado). La primera línea de «Qué incluye» es
  la consulta antes y después; el plazo es «Después de la primera consulta · el resultado te lo explican en la segunda».
  Sin botón de pedir: no hay flujo de reserva de la consulta (no se construye sin preguntar).
- **Decisiones de contenido para validar con el asesor:** MTHFR fuera (la ficha de trombofilia dice por qué, como la guía:
  ACMG no la recomienda para trombosis); F12 fuera aunque el consentimiento lo nombra; APOE dentro con el aviso de
  Alzheimer, aunque el catálogo del 28/10 la tenía en «No ofrecemos» (necesita consejo genético y el laboratorio no la
  ofrece). Ojo: el encargo de la web en el vault dice «Kuova no ofrece pruebas genéticas»; la app ahora sí las enseña.
- **Test:** `catalogoPaneles.test.ts` exige que las genéticas no se puedan pedir, no tengan precio, lleven `counselling`
  y digan «asesoramiento genético», y que MTHFR solo aparezca para decir que no se incluye.
- **Comprobado:** tsc limpio, 621 tests. En la demo en español a 375 px: el grupo en la tienda, las fichas cerradas y
  abiertas de APOE y trombofilia. No mandado a `pruebas`.

### 2026-11-09 (4) — Test de portadores: catálogo, Aprende y Conoce tus raíces (misma rama, sin commit, sin publicar)

- **Qué pidió el fundador:** añadir el test de portadores a las genéticas, ponerlo en Aprende (salud reproductiva y
  genética, «no pasa nada porque esté en los dos, es muy importante») y que el resultado de Conoce tus raíces diga que,
  de cara a tener hijos, un test de portadores es muy recomendable, con la opción de contactar con un asesor genético.
- **Catálogo:** `gen_carrier` «Test de portadores», la primera de las genéticas: panel de enfermedades recesivas y
  ligadas al X (fibrosis quística, AME, X frágil como ejemplos; el panel depende del laboratorio), mejor los dos
  miembros de la pareja y antes del embarazo, «1 posibilidad entre 4» si los dos llevan la misma. Como las otras: sin
  precio, sin botón de pedir y con el aviso de asesoramiento genético.
- **Aprende (`src/data/learning.ts`):** lección «Si piensas tener hijos» en Salud reproductiva y «El test de
  portadores» en Genética. Cada tema tiene dos botones, «Ver el test de portadores» y «Hablar con un asesor genético»,
  y la fuente ACMG 2021.
- **Conoce tus raíces:** tarjeta «Si piensas tener hijos» en el resultado, para cualquier nivel de riesgo, con los
  mismos dos botones. «Hablar con un asesor genético» abre `/professionals?role=geneticist` (los dos asesores ficticios
  de `servicesMock.ts`).
- **Tienda:** acepta `?category=<grupo>` (abre con ese filtro) y `?open=<id>` (esa ficha abierta). «Ver el test de
  portadores» usa `/store?view=tests&category=genetic&open=gen_carrier`, sin las suscripciones delante.
- **Comprobado:** tsc limpio, 621 tests. El test de las pantallas de la tienda revisa ahora también las claves de
  `KnowYourRootsScreen.tsx`. En la demo en español a 375 px: las dos lecciones, los dos botones y la tarjeta en el
  resultado de riesgo poblacional, que lleva a los asesores. No mandado a `pruebas`.
- **Pendiente:** ningún asesor de `servicesMock.ts` habla de consejo genético reproductivo (es el fichero de la otra
  sesión). La web sigue diciendo que Kuova no ofrece pruebas genéticas.

- **OTA a `pruebas` (OK del fundador, «Sí, a pruebas»):** grupo `9bceb844-1ba6-41d0-8845-5532aed22bb2`, runtime
  exposdk:57.0.0, Android e iOS. Lleva las tandas (2), (3) y (4) de hoy (sin precios, comparativa limpia, pruebas
  genéticas y test de portadores) y todo lo que había sin commit en `metas-fase1`, también lo de las otras sesiones.
  Nada a producción.

## 2026-11-09 — Exportar el plan y el historial de entrenos (rama `metas-fase1`, sin commit, sin publicar)

- **Qué pidió el fundador:** exportar el plan y el histórico de entrenamiento para compartirlo con un entrenador
  personal o con una IA, sin APK nueva (que llegue con una actualización).
- **Dónde:** Entrenamientos → «Exportar» (debajo de Historial) y el botón de compartir arriba a la derecha del
  Historial (`ScreenHeader` tiene ahora la prop opcional `right`). Ruta `/workout-export` con el candado de
  Entrenamientos (`gated('workouts', …)`), pantalla `src/screens/workouts/WorkoutExportScreen.tsx`.
- **Qué se elige:** el plan (interruptor; si hay varios programas, cuál; por defecto el que sigues) y el historial
  (interruptor; 1 mes / 3 meses / 6 meses / Todo, por defecto 3 meses, con cuántos entrenos entran). «Lo que vas a
  compartir» enseña el texto tal cual (corta la vista a 60 líneas; lo compartido va entero).
- **Formatos:** «PDF para tu entrenador» (`src/utils/workoutPdf.ts`, mismo estilo que el PDF del menú, por
  `shareHtmlPdf`: en el móvil, fichero al menú de compartir; en la web, diálogo de imprimir) y «Texto para una IA o
  un mensaje» (`src/utils/shareText.ts`: `Share.share` de React Native en el móvil; en la web,
  `shareText.web.ts` lo copia al portapapeles y, si el navegador no deja, lo descarga como .txt). El texto es
  Markdown sencillo: cabecera con las unidades («+kg» = lastre), plan por rutina y bloque (dosis, descanso, serie a
  serie si cambian, nota), historial por meses con cada ejercicio y sus series, y «Progreso por ejercicio» (la serie
  más pesada la primera y la última vez del periodo, y la mejor si no es la última).
- **Lógica pura:** `src/logic/workoutExport.ts` (`buildWorkoutExport`, `workoutExportText`, `progressRows`,
  `historyPart`). La media por semana cuenta desde el primer entreno del periodo. En los lastrados el peso sale con
  «+» también en el historial (la pantalla de Historial no lo pone). No lleva nombre ni datos de la persona; el
  nombre del entrenador sí, si el programa es suyo.
- **Por qué basta con OTA:** solo JavaScript. `expo-print`, `expo-sharing` y `expo-file-system` van en las APK desde
  la del 2026-10-15 y en los TestFlight; si faltaran, `shareHtmlPdf` comparte el texto. `Share` es de React Native.
- **Comprobado:** tsc limpio, 630 tests (`workoutExport.test.ts` y `workoutExportEs.test.ts`, que revisa las
  traducciones de los archivos tocados; textos en `workoutsEs.ts`, «All history» = «Todo» porque «All» ya es «Todas»).
  En la web local (8085) en español a 375 px con un programa de prueba: pantalla, vista previa, copiar (portapapeles
  simulado: el panel no deja escribir en él), apagar plan e historial, botón del Historial; el PDF, pintado como
  página. Datos de prueba borrados del navegador. **Sin probar en un móvil:** el menú de compartir, el PDF real
  (expo-print) y pegar en una IA.

- **OTA a `pruebas` (OK del fundador, «Sí, a pruebas»):** grupo `bac1fd20-8fbe-4e1d-bc9a-5760a1e120d9`, runtime
  exposdk:57.0.0, Android e iOS, con los pasos a mano (`expo export --clear … --max-workers 1` y `eas-cli update --channel
  pruebas --environment preview --skip-bundler --input-dir dist`). Sobre la OTA `9bceb844` solo cambia la exportación
  (el export anterior, de las 13:03, ya llevaba los médicos ficticios y el `transparentModal` de Android). Nada a
  producción.
- **Probado por el fundador en el móvil (2026-11-09, tras la OTA `bac1fd20`):** «eso funciona perfe».

### Avisos del móvil, traídos de `entorno-pruebas` (2026-11-09, OK de Astor vía Curro: «Sí, júntalos»)

- **Qué:** los tres commits de avisos de la rama `entorno-pruebas` (c7a7aaf, a73aab7, 5e5888f), aplicados aquí como
  parche sin commit (`git diff 4ea2475 5e5888f`, 4ea2475 = padre de c7a7aaf; `git cherry-pick` no se puede con es.ts
  cambiado). No se trajo 083d18b, que es solo su HANDOFF; lo esencial va aquí.
- **Lo que hacen** (Astor, Xiaomi: «a veces sí, a veces no»; todo JS): las tomas dicen «Es la hora de tu toma» sin el
  nombre del medicamento, y peso/temperatura «Hora de apuntar tus datos en Kuova»; los dos canales pasan a PUBLIC con id
  nuevo (`tomas-v2`, `recordatorios-v2`; se borran los viejos) para que se vean con el móvil bloqueado, y un test vigila
  que ningún aviso diga un dato de salud. En Ajustes → Notificaciones, solo en Android y con los avisos activados, el
  bloque «Para que los avisos lleguen» (`src/components/DeliveryHelp.tsx`, `src/logic/deliveryHelp.ts`): botones a
  «Alarmas y recordatorios», Batería y las notificaciones de Kuova, pasos a mano para Xiaomi y Samsung, y un aviso de
  prueba en 1 minuto. Pendiente para el próximo lote nativo: pedir la alarma exacta desde la app y un servicio en
  primer plano para el descanso del entrenamiento.
- **Choque de textos resuelto:** el parche añade `'Lock screen': 'Pantalla de bloqueo'` a es.ts, que ganaba a la
  pestaña «Bloqueo» de la tarjeta de emergencia; esa pestaña usa ahora la clave `'Lock screen version'`.
- **Comprobado:** tsc limpio, 642 tests, es.ts sin claves repetidas; Notificaciones carga bien en la web (el bloque
  nuevo no sale en la web). **Sin probar en un móvil.**

### QR de la pantalla de bloqueo más pequeño, con «Datos médicos» (2026-11-09, por los probadores, vía Curro)

- **Tamaño:** 380 px de lado (antes 560; Astor pidió «más pequeño» dos veces: primero quedó en 440), acabando en el
  2130. Para que se lea a esa medida el texto del QR de bloqueo va más corto (`lockQr` en `src/logic/historial.ts`:
  solo «EMERGENCIA» arriba, el nombre sin «Nombre:», «Llamar a»; los demás QR no cambian). Si la tarjeta lleva mucho,
  el QR crece (`lockQrBox` en `EmergencyCard.tsx`: cada módulo ≥ 5,2 px, unos 500 px en la versión 18); pasada la
  versión 18 se queda fuera, por orden, lo de alimentos y otras alergias, los últimos avisos o alergias a
  medicamentos («y N más»), de quién es el teléfono (el número nunca) y se acorta el nombre; la pantalla de la tarjeta
  lo dice.
- **Lectura (simulada, no con móviles):** zxing-cpp sobre la pantalla fotografiada a 15-35 cm con desenfoque, reflejo y
  giro. Con la tarjeta de ejemplo (149 bytes, versión 12): se lee de 15 a 25 cm con fotogramas de 1080 de ancho (en
  fondo crema, seguro a 20 cm y a medias a 25) y hasta 35 cm con 4K; a 30 cm, con 1080, no. Antes (560 px) llegaba algo
  más lejos.
- **Encima del QR:** el asterisco rojo de seis brazos (redondeados) sobre un círculo blanco y «Datos médicos» (como se
  llama Medical ID en un iPhone en español); nada de cruz roja ni Estrella de la Vida. Se le enseñaron una píldora
  verde y una tarjeta crema; eligió la tarjeta y luego pidió sacarlo del cuadro, «fondo transparente para tapar
  cuanto menos el fondo». Queda así (`LockLabel`): el asterisco, «Datos médicos» y «Escanea con la cámara» sueltos
  encima del QR, cada texto con un contorno suave (oscuro sobre fotos y fondos oscuros, crema sobre los claros). Lo
  único que tapa es el cuadro crema del QR, que en los fondos claros lleva un filo verde; ya no hay halo alrededor.
- **Ojo para los probadores:** la imagen que ya tengan puesta no cambia sola; hay que volver a ponerla desde la tarjeta.

## 2026-11-09 — Entorno de pruebas, cuentas más seguras, doble factor y entrada con la marca (rama `entorno-pruebas`)

Carpeta `../hometest-app-staging` (worktree desde master; la carpeta principal sigue en `metas-fase1`). Nada de esto está en
producción: ni migración, ni funciones, ni ajustes del panel de `HomeTest00`, ni OTA a `preview`/`pruebas`.

- **Base de pruebas «Kuova pruebas»** (`bujbvrozmtcnnmhvkupj`, Frankfurt, organización gratuita aparte), creada con el OK
  de Astor: 36 migraciones, 9 Edge Functions, ajustes de Auth (contraseña 8+ con letras y números, confirmar email,
  código de 6 cifras, URLs de vuelta). Falta: SMTP de Brevo (lo pone Astor) y después la plantilla del correo; la clave
  de Gemini (pendiente de su OK). Cómo se trabaja con ella: `docs/entorno-de-pruebas.md`.
- **App «Kuova Pruebas»**: `APP_VARIANT=staging` (`app.config.js`), `com.kuovahealth.app.pruebas`, `kuovapruebas://`,
  icono naranja con «PRUEBAS». Perfiles `staging`/`staging-ios`, canal `staging`, entorno `development` de EAS.
  **Bloqueado:** las dos variables de Supabase de EAS son una sola para development, preview y production; antes
  del primer APK hay que separar `development` (OK de Astor). Aún sin APK.
- **Guardas**: `npm run release` se niega con `APP_VARIANT`, si `preview` de EAS no apunta a producción o si la web
  saldría con otra base; `release:staging` exige que `development` apunte a pruebas (`scripts/supabase-target.mjs`).
- **Cuentas**: reglas de contraseña en la app (`src/logic/password.ts`, lista al crearla), panel «Revisa tu correo» con
  código de 6 cifras, reenviar y «ya lo he confirmado» (`LoginScreen`), textos en `src/i18n/authEs.ts`.
- **Doble factor** obligatorio para admin, profesionales y soporte (opcional para pacientes), exigido por la base
  (migración `20261109180000_mfa_aal2`, política restrictiva en todas las tablas + `aal2` en las funciones
  `security definer`). Pantallas `MfaGuard`/`MfaScreen`, Ajustes → Verificación en dos pasos (`/security`), reseteo
  por un admin con registro (`admin-mfa-reset`, `mfa_resets`). Detalle y orden en producción: `docs/doble-factor.md`.
- **Probado en la base de pruebas**: 109/109 tests SQL (30 nuevos), `node scripts/staging-auth-check.mjs` 23/23 con
  sesiones reales, la web en local contra pruebas (aviso «entorno de pruebas», lista de la contraseña). 474 tests de la
  app, tsc limpio. **Sin probar en un móvil.** Correo real por Brevo probado el 2026-11-10
  (`node scripts/staging-email-check.mjs <email>`; plantilla subida con `config push`).
- **Variables de EAS separadas** (2026-11-09, OK de Astor): `development` → base de pruebas; preview y production
  → producción, sin cambios. `GEMINI_API_KEY` copiada a pruebas (`node scripts/staging-ai-check.mjs`: OK). Primer
  APK de «Kuova Pruebas»: build `16edc92f` (EAS), para instalar en el móvil de Astor.
- **Entrada al abrir la app** (petición de Astor: «me queda un poco triste»): `src/components/LaunchIntro.tsx`, montada en
  `index.js`. Tras la pantalla nativa, la K dorada metalizada con un destello y «KUOVA HEALTH» debajo (desde el 10/11 la
  K se queda quieta donde estaba la nativa y el nombre aparece debajo; OTA staging e3524231), ~1,5 s, solo en
  frío, se salta con un toque, sin movimiento con «reducir movimiento», no tras cambiar el tema; en la web solo con
  `?intro=1`. Es JS (llega por OTA). La K de la pantalla nativa (`splash-icon.png`, `python scripts/make-icons.py
  splash`) también es metalizada, pero esa solo cambia con una compilación nueva. No se puso el nombre en la pantalla
  nativa porque Android 12+ recorta lo que no quepa en un círculo.
- **Avisos del móvil** (Astor, Xiaomi: «a veces sí, a veces no»; c7a7aaf, a73aab7, 5e5888f, todo JS/OTA): las tomas dicen
  «Es la hora de tu toma» sin el medicamento y peso/temperatura «Hora de apuntar tus datos en Kuova»; los dos canales
  pasan a PUBLIC con id nuevo (`tomas-v2`, `recordatorios-v2`, se borran los viejos) para que salgan con el móvil
  bloqueado; el test «con el móvil bloqueado» vigila que ningún aviso diga un dato de salud. En Ajustes →
  Notificaciones (Android, avisos activados) el bloque «Para que los avisos lleguen» (`DeliveryHelp`,
  `src/logic/deliveryHelp.ts`): botones a «Alarmas y recordatorios», Batería y notificaciones de Kuova
  (`Linking.sendIntent`), pasos a mano para Xiaomi/Samsung y un aviso de prueba en 1 minuto. Pendiente para el lote
  nativo: pedir/comprobar la alarma exacta desde la app y un servicio en primer plano para el descanso del
  entrenamiento. Para publicarlo hay que juntarlo en `metas-fase1` (se aplica limpio) y OTA con el OK de Astor.
- **Idioma y orden de avisos** (2026-11-10, Astor al crear una cuenta de paciente en Kuova Pruebas: salía en inglés y
  «Discover your genetic profile» antes que «Before we start»). Idioma: `src/i18n/locale.ts` mira primero el idioma del
  sistema (`I18nManager…localeIdentifier`, antes solo `Intl`, que en Android daba inglés) y catalán/gallego/euskera van a
  español; selector «Español / English» arriba en la pantalla de entrar (`LanguagePicker`). Orden:
  `src/data/permissionsGate.ts`, los avisos de bienvenida esperan a que se cierre «Before we start» y 2 s más (b2eb4e4,
  d731fce, 7601562; parche para metas-fase1 en las notas compartidas). Solo el idioma fue a la app pública:
  **publicado 466f1b5** el 2026-11-10 (EAS 4ed9f8c2 y las dos webs, OK de Astor), con el selector arriba del todo y
  separado de la marca (aquí 2895f46).
- **Kuova Pruebas = la versión de la beta** (2026-11-10): `metas-fase1` (6cdb760) juntada en `entorno-pruebas` (37150ae),
  porque Kuova Pruebas tenía la app de master. 661 tests, tsc limpio, web contra pruebas OK (check-in nuevo, metas). Lleva
  el módulo nativo `kuova-wallpaper`, así que necesita APK nuevo: build `460d5261` (perfil staging).
- **Doble factor arreglado** (2026-11-11, Astor: «el QR aparecía un poco desplazado, el código no iba bien»; 1293e36,
  OTA staging a0e6066d). El SVG del QR de Supabase mide 219 px sin `viewBox`: a 190 px salía cortado y sin una esquina,
  imposible de escanear; ahora `TotpSetup` pinta su propio QR con `qrShape(uri)`. Y si Android cierra la app mientras
  se añade Kuova a la app de autenticación, al volver se retoma el alta sin verificar de menos de 15 min
  (`pendingTotpToResume`, `findPendingTotp`) en vez de crear otra clave que deja sin valor la guardada. Probado en la
  web contra pruebas con códigos TOTP calculados: alta, recarga a medias + retomar, y entrar con el código. Sin probar
  en el móvil.
- **Entrada + QR de la tarjeta para la app real** (2026-11-11, pedido por Astor desde la sesión de Curro): rama
  `pruebas-entrada` (worktree `hometest-app-pruebas-ota`) = 6cdb760 + idioma/avisos + selector arriba + la entrada
  (7f8b190), igual que la carpeta de `metas-fase1` (que lleva el mismo parche sin commit). `dist/` exportado (Android +
  iOS, Supabase de producción). OTA a `pruebas` **en espera**: Astor dijo «aún no»; la sesión de metas-fase1 no manda
  nada a `pruebas` mientras tanto.
- **«¿Has olvidado tu contraseña?»** (2026-11-11, Astor: «tenemos que incluir algo también de forgot your password»).
  Enlace bajo la contraseña → email → código de 6 cifras por correo (`recuperar-contrasena.html`, sin botón) → con el
  código se abre la sesión y `MfaGuard` enseña solo `NewPasswordScreen` (después del doble factor si la cuenta lo tiene:
  Supabase pide aal2 para cambiarla) → aviso «Tu contraseña de Kuova ha cambiado» (`contrasena-cambiada.html`). Marca en
  el móvil (`src/data/passwordReset.ts`) para seguir ahí si la app se cierra. Plantillas subidas a la base de pruebas.
  Probado en la web contra pruebas con cuentas inventadas, con y sin doble factor. Producción: plantillas (con Brevo)
  antes que la app, todo con OK de Astor (docs/doble-factor.md). La app pública tampoco tiene esto hoy. Commit 89eb7a6,
  OTA staging d5f88ce9.

- 2026-11-11: **tocar el aviso de la toma llevaba a «Notificaciones»** (Astor, en Kuova Pruebas, aviso real «Es la hora
  de tu toma»): la app se quedaba en la pantalla en la que estaba en vez de abrir Medicación. El aviso sí lleva
  `route: '/medications'`. Causa más probable (no reproducible aquí, sin Android): con la app en segundo plano el toque
  llega antes de que la app esté delante y la navegación de ese momento se pierde. Arreglo (15e898e, OTA staging
  94aa2854): `listenToReminderTaps` solo pasa la ruta (`reminderTapRoute`, con tests: no abre el aviso de prueba, otros
  botones ni el mismo toque dos veces) y vuelve a mirar el último toque al volver a la app; `PhoneReminders` abre la
  pantalla cuando la app está en primer plano, sin doble factor ni «Elige una contraseña nueva» delante, a los 600 ms.
  **Falta que Astor lo pruebe en el móvil.** Mismo código en `metas-fase1`/`pruebas-entrada` (beta) y en master
  (app pública): llevarlo allí cuando se confirme.
- 2026-11-11 (corrección): lo que vio Astor no era el aviso del móvil sino «¿Te has tomado Creatina?» en la lista de
  Más → Notificaciones (regla `medication_missed`, `route: '/medications'`), en la Kuova de la beta (su bandeja no está
  en la base de pruebas). Al tocarlo se quedaba en Notificaciones. En la web contra pruebas (cuenta inventada, borrada
  después) el mismo toque abre Medicación, y Medicación → Historial sí funciona en su Android. Código igual en
  `pruebas-entrada`, `entorno-pruebas` y la web; diferencias solo-Android de esa pantalla (bloque «En tu móvil»,
  `DeliveryHelp`, sincronizar avisos al cargar) revisadas sin encontrar la causa. **Sin causa:** falta que Astor lo
  repita en la beta tocando el texto (no la campana tachada, que abre «Silenciar…») y diga qué pasa. El arreglo de
  15e898e (toque en el aviso del móvil) cubre otro caso y se queda en Kuova Pruebas.
  Mismo día: Astor lo repitió y «ahora sí va bien»: «¿Te has tomado Creatina?» lleva a Medicación. Cerrado sin
  cambio de código (probablemente se tocó la campana o fue puntual).
- 2026-11-11: Hoy, la (i) de «Tu estado de hoy» iba al final de la línea (`justifyContent: 'space-between'`) y la de
  «Cumple tus objetivos» justo detrás del título: las dos detrás del título, a 6 px (95cc7a2, OTA staging 9c28f6b6;
  comprobado en la web a ancho de móvil). Llevar a la beta con lo demás.
- 2026-11-11: **casillas del código de 6 cifras** (Astor, Xiaomi con HyperOS, al activar el doble factor: «al escribir
  me saca el teclado y no me permite pegar»). Componente `src/components/CodeInput.tsx` en las 4 casillas (alta del
  doble factor en Seguridad, código al entrar, confirmar el email y «¿Has olvidado tu contraseña?»):
  - sin `maxLength` (Android cortaba lo pegado antes de limpiarlo); la casilla se queda con el código
    (`codeInText`/`codeFromInput` en `src/logic/mfa.ts`, con tests: «123 456», «123-456», texto de un correo; teléfonos,
    fechas o dos códigos no cuentan);
  - se envía solo al llegar a 6 cifras (una vez por código; los botones siguen);
  - botón «Pegar el código» (el teclado numérico de muchos Android no tiene portapapeles) y, solo en Android, al
    volver a Kuova con un código copiado y la casilla vacía, «Usar 123 456 (copiado)». No se lee al abrir la pantalla
    (Android 12+ avisa cada vez que una app lee lo copiado); en iPhone no se lee solo (pediría permiso), queda el botón;
  - el teclado no tapa: `KeyboardAvoidingView` con `padding` también en Android (SDK 57 es edge-to-edge) en entrar,
    código al entrar y Seguridad.
  Portapapeles sin librería nueva (`src/utils/clipboard.ts`): el módulo `Clipboard` que React Native 0.86 aún trae,
  pedido con `TurboModuleRegistry.get` (si falta, no sale el botón), así que va por OTA. **Lote nativo:** cuando se
  haga un APK nuevo, pasar ese archivo a `expo-clipboard` (no está instalado hoy; `npx expo install expo-clipboard`) y
  usar `hasStringAsync` antes de leer para no sacar el aviso de Android si no hay nada copiado.
  Probado en la web contra pruebas (cuenta inventada, borrada): pegar «Código: 111 222 (caduca pronto)» deja 111222 y
  lo envía; «Pegar el código» con «Tu código de Kuova: 176 526» activa el doble factor; al entrar, escribir el código
  con guion entra solo. Sin probar en Android (no hay emulador en este PC) ni las casillas del correo (mismo
  componente). **Falta que Astor lo pruebe en su Xiaomi.** Llevar a la beta y a la app pública con lo demás.
- 2026-11-11: **bloquear Kuova con Face ID / huella** (Astor: «quiero implementar huella y face ID»; punto 6 del lote
  nativo aprobado el 09/11, adelantado). Ajustes → Cuenta → «Bloquear Kuova con tu huella / Face ID…», apagado de
  serie, solo si la app lleva el módulo; sin huella ni cara configuradas, una línea lo explica. Al activarlo se pide
  una vez. `src/components/AppLock.tsx` (Modal por encima de todo) + reglas puras en `src/logic/appLock.ts` (tests):
  - bloquea al abrir en frío con la sesión guardada y al volver de segundo plano tras «Al momento / 1 min (de serie)
    / 5 min»; tras entrar con la contraseña no; desbloqueo con la cara o el dedo y, si fallan, el código/PIN/patrón
    del móvil (`disableDeviceFallback: false`); «Usar contraseña» cierra sesión → login (con doble factor si lo tiene);
  - no sustituye al doble factor: solo abre la sesión que ya está en el móvil. La preferencia es del móvil y de esa
    cuenta (`app_lock.v1` en AsyncStorage con el id): otra cuenta en el mismo móvil no la hereda;
  - al pasar a segundo plano, capa con la K dorada (miniatura de «apps recientes»); en Android 13+ además la
    miniatura sale en blanco con el módulo local nuevo `modules/kuova-privacy` (`setRecentsScreenshotEnabled`, no
    bloquea las capturas de pantalla como FLAG_SECURE);
  - mientras el sistema enseña la huella/cara/PIN se ignoran los cambios de AppState (`authenticating()` en
    `src/utils/biometrics.ts`), si no, el PIN de Android (otra actividad) volvía a bloquear.
  Nativo: `expo-local-authentication` 57.0.3 (plugin con `faceIDPermission`; español en `assets/locales/es.json`;
  `USE_BIOMETRIC` lo pone la librería) y `expo-clipboard` 57.0.2 (las casillas del código lo usan si está, con
  `hasStringAsync` para no sacar el aviso de Android; si no, el módulo de RN). Todo se carga con
  `requireOptionalNativeModule`: con una OTA sobre un APK anterior (beta verde, app publicada) no aparece nada.
  `runtimeVersion` es `sdkVersion`, así que las OTA de `staging` siguen llegando a los APK viejos y al nuevo.
  **Necesita un APK nuevo de Kuova Pruebas** (perfil `staging`) y el OK de Astor para compilarlo. Probado: tsc,
  675 tests, autolinking (expo-local-authentication, expo-clipboard, kuova-privacy) y la web (Ajustes sin la fila,
  sin errores). Sin probar en un móvil. iPhone: si hay una pantalla modal abierta al bloquear se cierran antes
  (`dismissAll`), y la capa de «apps recientes» puede no tapar una pantalla modal: revisar con la compilación de
  iPhone. Después va al lote nativo para todos.
  2026-11-12, con el OK de Astor: APK de Kuova Pruebas con todo esto, EAS 030ee462 (perfil `staging`, desde ca90e83).
  **Falta que Astor lo instale y lo pruebe en su Xiaomi.**
  Worktree: `hometest-app-staging/node_modules` ya no es un junction a `hometest-app/node_modules` (instalar paquetes
  aquí habría tocado la carpeta de la otra sesión): tiene los suyos (`npm ci`, 2026-11-11).

## 2026-11-18 — El rediseño de «Kuova Pruebas» pasa a la app pública (master 6918b39, PUBLICADO)

Astor: «guardar en GitHub cómo está Kuova ahora, pero ya actualizar al formato del de pruebas», para que la gente la
rellene con sus datos reales.

- **Punto de vuelta:** etiqueta `app-publica-antes-del-rediseno` en GitHub (= c6c1b98, la app pública hasta hoy). En
  Expo, el grupo anterior del canal `preview` es 9706e52b-efff-4283-a899-ebd9da1226ed (se puede volver a publicar con
  `eas update:republish --group …`); en Vercel, el despliegue anterior de cada web se puede promover desde el panel.
- **Qué se unió:** `entorno-pruebas` (670dc7e) en master, en una carpeta aparte (`hometest-app-publica`, rama
  `publica-rediseno` → master por fast-forward). Conflictos solo en idioma y «¿Has olvidado tu contraseña?» (hechos en
  las dos ramas): se queda la versión de entorno-pruebas. `PasswordResetGuard` desaparece (lo hace `MfaGuard`). `src`
  queda idéntico a entorno-pruebas; tsc 0, 920 tests.
- **Publicado:** `npm run release` en dos pasos (`--skip-web` y luego `--skip-app`), con unos 2 GB de RAM libres y sin
  fallos: EAS Update canal `preview`, grupo 96d41dd5 (Android + iOS, exposdk:57.0.0, commit limpio) y las dos webs.
  Comprobado en vivo: las dos webs cargan la pantalla de entrar sin errores de consola y sin la marca de pruebas,
  apuntan a la base real y mantienen `X-Robots-Tag: noindex`. No se ha entrado con una cuenta ni se ha probado en móvil.
- **Producción sin tocar:** ni migraciones, ni funciones, ni ajustes de Auth. Falta, con el OK de Astor
  (docs/doble-factor.md): migración `20261109180000_mfa_aal2`, función `admin-mfa-reset` y activar TOTP en Auth (hasta
  entonces, activar el doble factor desde la app dará error en producción); y la plantilla `confirmar-cuenta.html` con
  el código de 6 cifras (sin comprobar qué plantilla tiene producción: la pantalla admite el código o el botón del correo).
- **Lo que NO lleva esto:** el canal `pruebas` (beta de amigos: APK facf2926 y TestFlight 1.1.0 (5), también contra la
  base real) sigue con lo de `pruebas-entrada`. Los APK del canal `preview` ya han caducado en Expo (el último es de
  octubre) y no llevan los módulos nativos nuevos (bloqueo con huella, portapapeles, kuova-privacy), que la app trata
  como opcionales. En iPhone este código no se ha probado nunca.
- **Para lo siguiente:** `entorno-pruebas` ya está dentro de master. Cada tanda nueva se pasa uniendo `entorno-pruebas`
  en master (sin conflictos mientras master no cambie por su cuenta) y con `npm run release` desde
  `hometest-app-publica`, que tiene el `.env.local` de producción y los enlaces de Vercel en `deploy/`.
- **Beta de amigos, el mismo día (OK de Astor: «Sí, envíalo»):** el mismo código (master 25ad349) al canal `pruebas`,
  **solo Android**: grupo 88888240 (`eas-cli update --channel pruebas --environment preview --platform android`). El
  anterior del canal es d65ce897-f4c9-4550-a774-7b3aa7c9e2da (Android + iOS) y es lo que siguen viendo los iPhone de
  la beta. master incluye todo lo de `pruebas-entrada` (idioma, entrada con la K, bloqueo con huella, toque del aviso
  de la toma). El iPhone de la beta, cuando Astor haya visto este código en el iPhone de Kuova Pruebas.

## 2026-11-18 (tarde) — Peso con composición y Observaciones del informe en la app pública (master 82f1ff8, PUBLICADO)

Astor: «lo quiero en el release final» y, para el OK, «Sí, las dos cosas» (Kuova Pruebas y la app pública).

- **Punto de vuelta:** etiqueta `app-publica-antes-de-observaciones` en GitHub (= d4eb351). En Expo, el grupo
  anterior del canal `preview` es 96d41dd5 (`eas update:republish --group …`); en Vercel, el despliegue anterior de
  cada web.
- **Qué se unió:** `entorno-pruebas` (60d9ff8: 6702067, 98d5546, 4c2e209, 60d9ff8) en master con un merge sin
  conflictos; `src` idéntico a entorno-pruebas; sin cambios de dependencias, de `supabase/` ni de `app.config.js`;
  tsc 0, 928 tests.
  - Plan y Análisis tras probar en el iPhone (compromiso bajo los objetivos, informe con anillos, aviso de valores de
    más de un año); próximo análisis con el aspecto nuevo; carrusel de especialistas sin tarjetas ocultas al empezar.
  - Peso: medidas y composición al apuntar el peso (de las medidas o de la báscula), IMC en una línea con la franja
    de la OMS, anillo de composición (grasa, músculo, hueso, resto) con el agua en el anillo de dentro. Sin
    migración: la composición ya iba en `metric_readings`.
  - Análisis: el rosco del último informe muestra el total de marcadores; las áreas no se tocan; sin «Informe
    completo». «Tu informe» pasa a «Observaciones» (`src/logic/reportObservations.ts`): mejora = vuelve a su rango
    o se acerca; empeora = sale o se aleja; los cambios dentro del rango van aparte (17 mejoras en el ejemplo, no 39).
  - Kuova Pruebas: con la base de pruebas toda cuenta es de prueba (`amITester`), porque la base de pruebas no tiene
    admins y todas entraban como reales y vacías. En la app pública no cambia nada.
- **Publicado:** `npm run release` en dos pasos (`--skip-web`, luego `--skip-app`): EAS `preview` grupo
  0fdb4159-a081-4f54-88ed-72528431cdc1 (Android + iOS) y las dos webs (hometest-app y hometest-demo). Comprobado: las
  dos webs cargan la pantalla de entrar sin errores, sin la marca «Pruebas», con la base de producción y con el código
  nuevo en el bundle. Sin comprobar: pantallas con sesión iniciada en la web publicada, cualquier teléfono.
- **No tocado en la publicación:** la beta de amigos (canal `pruebas`; se envió después, ver el punto siguiente) ni la
  base de producción.
- **Beta de amigos, la misma tarde (OK de Astor: «sí, envía a la beta» y «Sí, a iPhone»):** el mismo código (master
  fed1143, código = 82f1ff8) al canal `pruebas`, con `--environment preview`, en dos envíos desde `hometest-app-publica`:
  - Android: grupo b9ceaaa3-3d05-4e81-ace1-b447027f49d4. El anterior es 88888240 (el rediseño de la mañana).
  - iPhone: grupo f0d3332b-75ac-43fa-b0dc-8516e94d9cda. Es la primera vez que los iPhone de la beta reciben el
    rediseño; el anterior es d65ce897-f4c9-4550-a774-7b3aa7c9e2da (Android + iOS, `pruebas-entrada`).
  - Para volver atrás: `eas update:republish --group …` con el grupo anterior de cada plataforma.
  - Comprobado: los dos grupos en el canal con runtime exposdk:57.0.0; el bundle de iOS lleva la base de producción y
    no la de pruebas. Sin comprobar: ningún teléfono de la beta. Los iPhone de la beta son las compilaciones de
    TestFlight 1.1.0 (4) y (5), anteriores a los módulos nativos nuevos, que la app trata como opcionales.

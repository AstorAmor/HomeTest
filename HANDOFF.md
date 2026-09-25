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

1. Abrir el proyecto en `C:\Users\Astor\proyectos\HomeTest`
2. Leer este archivo primero
3. Comprobar `git log --oneline -10` para ver los últimos commits reales
4. Comprobar si Docker/Windmill siguen corriendo antes de asumir que
   la funcionalidad de ciclo menstrual funciona
5. Primera decisión pendiente del usuario: dónde vive la sección de
   ciclo menstrual si no es en "My Data"

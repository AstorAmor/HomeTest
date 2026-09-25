# Prompts de producción — estado y convenciones

Plantillas de los prompts que usará el motor de recomendaciones en
producción. Viven aquí como markdown versionado (no hardcodeados en
TypeScript) para poder iterarlos sin tocar código, y para que sea fácil
sustituirlos cuando llegue el diseño definitivo de la investigación externa
(el research prompt que se lanzó a Claude/ChatGPT/Gemini).

**Estado actual: son esqueletos, no prompts de producción reales.** Cada
archivo tiene una sección "QUÉ FALTA (pendiente de investigación externa)"
con lo que hay que rellenar. Lo que SÍ está fijado es la estructura mecánica
(qué variables recibe, qué formato de salida produce) porque eso es
decisión de producto, no contenido médico — y así el resto del motor
(`src/types/recommendation.ts`, `src/logic/rulesEngine/`) se puede construir
ya contra un contrato estable.

## Los cuatro prompts

| Archivo | Cuándo se usa | Input | Output |
|---|---|---|---|
| `system-prompt.md` | Siempre, como system prompt del LLM de síntesis | — (estático) | — |
| `biomarker-synthesis.md` | Una vez por biomarcador fuera de rango | 1 `BiomarkerResult` + su `KnowledgeCard` | Texto para 1 `RecommendationItem` |
| `multi-marker-plan.md` | Una vez por informe, para la sección de plan de acción | `RecommendationInput` completo | Varios `RecommendationItem` priorizados |
| `safety-guardrails.md` | Como paso de validación tras generar cualquier output | El output ya generado | `escalateToPhysician` + motivo, o aprobación |

## Convención de variables

Las plantillas usan `{{variable}}` para valores que se interpolan en tiempo
de ejecución. Los nombres de variable coinciden 1:1 con campos de
`src/types/recommendation.ts` — si cambia un tipo, buscar y actualizar las
plantillas que lo usen.

## Cómo sustituir una plantilla cuando llegue el diseño definitivo

1. No borrar el archivo ni cambiar su nombre — otros módulos podrían
   referenciar la ruta.
2. Sustituir el contenido bajo "PROMPT" dejando la cabecera (`# Título`,
   tabla de variables si la hay).
3. Quitar la sección "QUÉ FALTA" cuando ya no aplique.
4. Actualizar `src/types/recommendation.ts` si el nuevo diseño necesita
   campos que no existen todavía (p.ej. un nuevo tipo de `EvidenceSourceType`).

## Regla de oro (viene de `knowledge/README.md`, aplica igual aquí)

Ningún prompt debe pedirle al LLM que invente un rango de referencia, una
interacción medicamentosa o una afirmación clínica sin fuente. Si el
`KnowledgeCard` de un biomarcador está vacío (`evidence_status:
"NOT_REVIEWED"`), el prompt tiene que poder decir "no tengo información
verificada sobre esto todavía" en vez de rellenar el hueco con conocimiento
paramétrico del modelo.

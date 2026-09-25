# Guardarraíles de seguridad — validación post-generación

Paso final antes de mostrar cualquier output generado al usuario. No genera
contenido nuevo: revisa lo que ya se generó (`biomarker-synthesis.md` o
`multi-marker-plan.md`) y decide si hace falta escalar a
`RecommendationOutput.escalateToPhysician`, o bloquear/reescribir algo.

Candidato razonable a NO ser un LLM en absoluto: parte de esto (afirmaciones
prohibidas, combinaciones de resultados que fuerzan escalado) es más fiable
como lista determinista (`clinical_rule` en `EvidenceSourceType`) que como
juicio de un LLM sobre su propio output. La investigación externa debería
decir qué parte tiene sentido que siga siendo LLM-as-judge y qué parte debe
bajar a `src/logic/rulesEngine/`.

## Variables

| Variable | Tipo | Notas |
|---|---|---|
| `{{generated_output}}` | El `RecommendationOutput` (o `RecommendationItem` individual) ya generado | |
| `{{source_input}}` | El `RecommendationInput` que lo originó | para poder verificar que no se inventó nada que no estuviera ahí |

## QUÉ FALTA (pendiente de investigación externa)

- Lista cerrada de combinaciones de resultados que deben forzar
  `escalateToPhysician: true` (sección 3 del research prompt — "reglas de
  escalado").
- Decidir si este paso es un LLM-as-judge o una lista de reglas
  deterministas (recomendación: empezar por reglas deterministas para lo
  que sea enumerable — marcadores tumorales muy fuera de rango,
  combinaciones de riesgo cardiovascular — y dejar el LLM solo para
  detectar afirmaciones no trazables a una fuente).

## PROMPT (borrador estructural)

```
Revisa el siguiente contenido generado para un informe de salud de
HomeTest, contra el input que lo originó.

Contenido generado:
{{generated_output}}

Input original (para verificar que nada se inventó):
{{source_input}}

Comprueba, en este orden:
1. ¿Alguna afirmación del contenido generado NO tiene una `evidence` que la
   respalde en el input original? -> señalarla.
2. ¿Alguna afirmación sugiere diagnóstico, cambio de medicación, o
   minimiza un resultado que ya venía marcado con `requiresMedicalConsult:
   true`? -> señalarla y forzar `escalateToPhysician: true`.
3. [PENDIENTE: lista cerrada de combinaciones de resultados que fuerzan
   escalado, de la investigación externa]

Devuelve: { "approved": boolean, "escalateToPhysician": boolean,
"escalationReason": string | null, "issues": string[] }.
```

# Síntesis multi-marcador — plan de acción

Genera la sección de plan de acción del informe: 3-5 `RecommendationItem`
priorizados, combinando todos los biomarcadores fuera de rango con el
objetivo del usuario, su medicación y el contexto de wearables reciente. Es
el prompt más importante del sistema — la lógica de priorización real
(sección 3 del research prompt) todavía no está diseñada.

## Variables

| Variable | Tipo | Notas |
|---|---|---|
| `{{goal}}` | `RecommendationInput.goal` | `manage_condition` / `performance` / `general_checkup` |
| `{{age}}` / `{{biological_sex}}` | `RecommendationInput.age` / `.biologicalSex` | |
| `{{out_of_range_biomarkers}}` | subconjunto de `RecommendationInput.biomarkers` con `flag !== 'en_rango'` | cada uno con su `knowledge_card` |
| `{{derived_metrics}}` | `RecommendationInput.derivedMetrics` | ratios calculados (LDL, HOMA-IR...) — ver `src/logic/rulesEngine/ratios.ts` |
| `{{medications}}` | `RecommendationInput.medications` | como filtro de seguridad, NUNCA como generador de nuevas recomendaciones médicas |
| `{{cycle_phase}}` | `RecommendationInput.cyclePhaseAtCollection` | puede ser `null` |
| `{{wearable_context}}` | `RecommendationInput.wearableContext` | puede ser `null` — sin integración real todavía |
| `{{biological_age}}` | `RecommendationInput.biologicalAge` | puede ser `null` mientras `biologicalAge.ts` esté sin implementar |

## QUÉ FALTA (pendiente de investigación externa) — esto es el núcleo, sección 3 del research prompt

- Árbol de decisión / pseudocódigo real para priorizar y reconciliar
  recomendaciones cuando hay varios objetivos o marcadores en conflicto.
- Lista concreta de interacciones medicamentosas a filtrar (no generar).
- Reglas de escalado exactas: qué combinaciones de resultados fuerzan
  `requiresMedicalConsult: true` a nivel de item, y cuáles fuerzan
  `escalateToPhysician: true` a nivel de informe completo (ver
  `safety-guardrails.md`).
- Cómo pesar una recomendación cuando está respaldada por sangre +
  wearable a la vez, frente a solo uno de los dos (sección 5 del research
  prompt).

## PROMPT (borrador estructural, SIN lógica de priorización todavía)

```
Objetivo declarado por el usuario: {{goal}}
Edad: {{age}} · Sexo biológico: {{biological_sex}}
Fase de ciclo en el momento de la extracción: {{cycle_phase}} (si aplica)

Biomarcadores fuera de rango (con su knowledge_card verificado):
{{out_of_range_biomarkers}}

Métricas calculadas (LDL, HOMA-IR, etc. — ya calculadas de forma
determinista, no las recalcules):
{{derived_metrics}}

Medicación actual (SOLO como filtro de seguridad — no generes ninguna
recomendación que interaccione con esto; no sugieras cambios de
medicación):
{{medications}}

Contexto reciente de wearables (últimos {{wearable_context.windowDays}}
días, si hay dispositivo conectado):
{{wearable_context}}

[PENDIENTE: instrucciones de priorización — árbol de decisión de la
investigación externa va aquí]

[PENDIENTE: reglas de escalado a consulta médica]

Devuelve entre 3 y 5 RecommendationItem (ver
src/types/recommendation.ts), ordenados por prioridad, cada uno con
evidence trazable a knowledge_card, PubMed, o una regla determinista
(clinical_rule) -- nunca sin evidence salvo que sourceType sea
'insufficient_data'.
```

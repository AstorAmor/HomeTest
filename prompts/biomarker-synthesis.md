# Síntesis por biomarcador individual

Genera la explicación en lenguaje llano de un único resultado. Se llama una
vez por cada `BiomarkerResult` que se vaya a mostrar con texto explicativo
(no necesariamente todos — los que están `en_rango` y sin cambios pueden no
necesitar redacción por LLM, ver QUÉ FALTA).

## Variables

| Variable | Tipo (`src/types/recommendation.ts`) | Notas |
|---|---|---|
| `{{canonical_name}}` | `CanonicalBiomarker.canonical_name` | |
| `{{value}}` / `{{unit}}` | `BiomarkerResult.value` / `.unit` | |
| `{{flag}}` | `BiomarkerResult.flag` | `en_rango` / `por_debajo` / `por_encima` / `sin_rango` |
| `{{reference_range}}` | `BiomarkerResult.referenceRange` | incluye `adjustedForCyclePhase` |
| `{{previous_value}}` | `BiomarkerResult.previousValue` | puede ser `null` (primer test) |
| `{{knowledge_card}}` | `CanonicalBiomarker.knowledge_card` | única fuente de contenido clínico permitida junto con `{{pubmed_context}}` |
| `{{pubmed_context}}` | — | fragmentos recuperados en tiempo real, con PMID; puede venir vacío |
| `{{cycle_advisory}}` | `CycleAwareRangeResult.advisory` | `null` si no aplica |

## QUÉ FALTA (pendiente de investigación externa)

- ¿Se genera texto por LLM para TODOS los biomarcadores o solo los que
  tienen `flag !== 'en_rango'` o cambiaron mucho respecto al test anterior?
  (Ahorra coste y ruido si no hace falta explicar los 100 marcadores en
  rango sin cambios).
- Longitud objetivo del texto generado.
- Cómo referenciar `{{cycle_advisory}}` sin sonar clínicamente inseguro
  cuando `wasAdjusted` es `false` pero `advisory` no es `null`.

## PROMPT (borrador estructural)

```
Biomarcador: {{canonical_name}}
Resultado: {{value}} {{unit}} ({{flag}})
Rango de referencia: {{reference_range.min}}–{{reference_range.max}} {{reference_range.unit}}
Resultado anterior: {{previous_value}} (si existe)
Aviso de ciclo: {{cycle_advisory}} (si aplica)

Contexto verificado sobre este biomarcador (única fuente permitida):
---
{{knowledge_card.biological_role}}
{{knowledge_card.clinical_relevance}}
{{knowledge_card.preanalytical_factors}}
{{knowledge_card.limitations}}
---
{{pubmed_context}}

Tarea: escribe una explicación en lenguaje llano de este resultado para el
usuario, en [PENDIENTE: nº de frases/palabras objetivo]. Si el contexto de
arriba está vacío o incompleto para alguna parte de la explicación, dilo
explícitamente en vez de inventar contenido.

Devuelve únicamente un objeto JSON con la forma de `RecommendationItem`
(ver src/types/recommendation.ts): { id, title, body, priority,
relatedBiomarkerIds, evidence, requiresMedicalConsult }.
```

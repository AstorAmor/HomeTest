# Motor de recomendaciones — estado y cómo continuar

Esqueleto del motor de recomendaciones personalizadas (edad biológica, plan
de acción, ajuste por ciclo, wearables). Ver `prompts/` en la raíz del repo
para el research que falta para completar las piezas marcadas como TODO
aquí abajo.

## Qué hay hecho (determinista, testeado, usable ya)

- **`flags.ts`** — calcula el flag de un resultado (`en_rango` / `por_debajo`
  / `por_encima`) reutilizando `src/utils/rangeStatus.ts`, y construye un
  `BiomarkerResult` completo con tendencia frente al resultado anterior.
- **`ratios.ts`** — 8 ratios/scores calculados a partir de biomarcadores
  medidos: LDL (Friedewald), Colesterol no-HDL, ratio CT/HDL, ratio
  BUN/Creatinina, Globulina, ratio Albúmina/Globulina, % saturación de
  hierro, y HOMA-IR. Todos con conversión de unidades y manejo explícito de
  "falta un input" o "unidad no soportada" — nunca calculan a ciegas.

## Qué está pendiente a propósito (esperando la investigación externa)

- **`biologicalAge.ts`** — `computeBiologicalAge()` lanza
  `BiologicalAgeNotImplementedError` siempre. Candidata más probable:
  PhenoAge (Levine 2018), porque sus 9 inputs ya existen todos en el
  catálogo. Falta decidir la fórmula exacta y el manejo de inputs faltantes.
- **`cycleAdjustment.ts`** — identifica qué biomarcadores son
  cycle-sensitive (`FSH`, `LH`, `ESTRADIOL`, `PROLACTIN` — lista
  conservadora, ver comentarios del archivo) pero **no ajusta el número**
  del rango todavía: faltan cutoffs por fase respaldados en literatura, y
  además HomeTest no tiene rangos de referencia propios de los que partir
  (ver más abajo). Hoy solo genera un aviso (`advisory`) para la UI.

## Limitación estructural a tener en cuenta

El rango de referencia de un resultado hoy **sale del propio informe de
laboratorio** (lo que trae impreso el PDF), no de
`knowledge/biomarcadores/*.json` — `KnowledgeCard` no tiene campos de
min/max. Esto es correcto para "¿está en rango según este laboratorio?",
pero es la razón de fondo por la que el ajuste por ciclo no puede cambiar
números todavía: no hay un rango "propio" de HomeTest que ajustar. Si se
decide en algún momento que HomeTest publique sus propios rangos de
referencia, ese campo habría que añadirlo a `CanonicalBiomarker`
(`src/types/knowledge.ts`) — no bloquea nada del resto del motor mientras
tanto.

## Qué falta que NO vive en este módulo

- Motor de recomendaciones propiamente dicho (el árbol de decisión que
  combina flags + objetivo + medicación + ciclo + wearables en
  `RecommendationOutput`) — depende del diseño que traiga la
  investigación externa (`prompts/`), no tiene sentido construirlo con una
  lógica inventada que luego hay que tirar.
- Integración real de PubMed/RAG y llamada al LLM de síntesis.
- Integración real de wearables (`src/types/wearable.ts` solo define la
  interfaz `WearableDataProvider`, sin ninguna implementación).

## Cómo probarlo

```
npm test
```

Ver `src/logic/rulesEngine/__tests__/` — casos con valores realistas para
cada ratio (incluyendo los de "falta un input" y "unidad no soportada").

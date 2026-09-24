# Base de conocimiento clínico — cómo editar esto

Esta carpeta es la fuente de verdad para todo el contenido médico/científico
de la app: qué biomarcadores conocemos, cómo se llaman en cada sitio, y qué
sabemos de cada uno. Es Fase 1a: son solo archivos JSON versionados en el
repo, sin base de datos todavía — cuando haga falta escalar (más usuarias,
pipeline de PubMed automático), esto migra a Supabase manteniendo la misma
forma.

## Qué archivo tocar según lo que quieras hacer

- **Añadir o editar un biomarcador canónico**: abre el archivo de categoría
  correspondiente en `knowledge/biomarcadores/` (ej. `metabolico.json`) y
  añade/edita un objeto en la lista `biomarcadores`. Campos obligatorios:
  `canonical_id` (código corto en mayúsculas, único, ej. `"GLUCOSE"`),
  `canonical_name`, `aliases`, `category`, `measurement_type`
  (`MEASURED` / `DERIVED` / `SCORE` / `UNKNOWN`), `sample_type`,
  `common_units`.
- **Redactar contenido médico** (qué es, por qué importa, límites...): rellena
  `knowledge_card` en el biomarcador correspondiente. Mientras un campo esté
  a `null`, la app usa un texto genérico de relleno — **no rellenes nada sin
  fuente real**, deja el campo en `null` y `evidence_status: "NOT_REVIEWED"`.
- **Vincular con un nombre que aparece en analíticas reales**: normalmente
  no hace falta tocar nada aparte — el mapeo se genera solo a partir de
  `canonical_name` + `aliases` de cada biomarcador (coincidencia exacta tras
  normalizar, no adivina por similitud). Si necesitas una variante de
  extracción muy concreta que no quieras meter en la lista "oficial" de
  aliases del biomarcador, añádela en
  `knowledge/mapping/extracted-name-aliases.json` — esa entrada manda por
  encima de los aliases automáticos si hay conflicto. Sin ningún match, ese
  parámetro extraído queda sin biomarcador canónico asociado (no se inventa).
- **Vincular con el catálogo de Function Health**: rellena el array
  `external_sources` del biomarcador con `{source: "FUNCTION_HEALTH",
  external_name, external_category, included_or_addon, testing_frequency,
  derived_or_measured, source_reference}`. Ya importado (ver abajo) para los
  118 biomarcadores incluidos en la membresía base de Function.
- **Afirmaciones respaldables (claims)**: se añaden al array `claims` de cada
  biomarcador, cada una con `claim_type` y su evidencia. Vacío hasta que
  exista investigación real (PubMed) o contenido médico validado por un
  profesional — no se generan con IA.

## Qué hay importado de Function Health ya mismo

`knowledge/external/function_health.json` es la transcripción fiel y completa
del catálogo público de Function (pegado por el usuario el 2026-09-23):
todas las categorías, lo incluido en membresía, los add-ons, y los paneles de
imaging. Es la fuente cruda — de ahí se han canonicalizado **118
biomarcadores** (solo los "incluidos en membresía", no los add-ons ni los
paneles/imaging, que se dejan sin canonicalizar por ahora) repartidos en
`knowledge/biomarcadores/*.json`:

`metabolico`, `lipidico` (incluye lo que Function llama "Heart"), `renal`,
`hepatico`, `electrolitos`, `hematologia`, `endocrino`, `vitales`,
`tiroides`, `autoinmunidad`, `regulacion_inmune`, `hormonas` (compartidas
entre Female/Male Health), `salud_femenina`, `salud_masculina`,
`toxinas_ambientales`, `nutrientes`, `pancreas`, `orina`, `edad_biologica`
(placeholder de score, sin modelo implementado — ver Sección 27 del prompt
original, no calcular con IA).

Cuando un mismo analito aparece en varias categorías de Function (ej.
Calcium en Nutrients/Kidneys/Electrolytes) solo se guarda un
`external_source`, para no duplicar el biomarcador canónico.

**Add-ons, paneles compuestos (GRAIL, MRI/CT, Sexual Health Panel...) e
imaging NO están canonicalizados** — viven solo en el JSON crudo de
referencia. Canonicalizarlos es trabajo futuro, no bloquea nada de esta fase.

## Reglas

- `category` es provisional (taxonomía propia) hasta importar la de Function
  Health, que se usará como referencia de agrupación.
- Nunca se inventa `knowledge_card`, `claims` ni contenido médico. Un campo
  vacío (`null` o `[]`) es información honesta, no un error.
- `data_quality: "VERIFIED"` se refiere a que el biomarcador está bien
  identificado (nombre/alias/categoría correctos), no a que su contenido
  clínico esté revisado — eso lo indica `evidence_status`.

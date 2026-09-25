// Explicaciones genéricas en inglés para los marcadores que aparecen en la lista
// "needs review" del prototipo. Contenido educativo general (qué mide el marcador,
// por qué se marca), no personalizado y no diagnóstico — ver prompts/system-prompt.md
// para las reglas que seguirá el contenido generado por LLM en producción.

export const MARKER_EXPLANATIONS: Record<string, string> = {
  ldl:
    'LDL carries cholesterol through your bloodstream. When it runs high, more of it can settle into artery walls over time, which is why labs flag it as a cardiovascular risk marker rather than a symptom on its own.',
  homa_ir:
    'HOMA-IR estimates how well your body responds to insulin, using your fasting glucose and insulin together. A higher value suggests your cells need more insulin than usual to keep blood sugar in check.',
  vitamin_d:
    'Vitamin D supports bone health, immune function, and mood regulation. Levels dip easily with low sun exposure or diet, and it is one of the most common insufficiencies in routine bloodwork.',
  ferritin:
    'Ferritin reflects your stored iron reserves. A low-normal result does not mean anemia yet, but it can signal that your reserves are thinner than they should be for sustained energy and recovery.',
  total_cholesterol:
    'Total cholesterol adds up HDL, LDL, and a portion of your triglycerides. It is a useful first glance, but the breakdown between LDL and HDL usually matters more than this single number.',
  non_hdl_cholesterol:
    'Non-HDL cholesterol is everything that is not HDL — the "protective" kind. Many clinicians consider it a more complete cardiovascular risk marker than LDL alone.',
  apob:
    'ApoB counts the actual number of cholesterol-carrying particles in your blood, including LDL. Some particles carry more cholesterol than others, so ApoB can flag risk that a plain LDL number misses.',
  ana:
    'ANA (antinuclear antibodies) is a broad screening marker used to flag immune activity worth keeping an eye on. A borderline result by itself is common and not a diagnosis of anything specific.',
};

export function getMarkerExplanation(markerId: string): string {
  return (
    MARKER_EXPLANATIONS[markerId] ??
    'A short explanation for this marker is not available yet in this prototype.'
  );
}

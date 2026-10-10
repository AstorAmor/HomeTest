// Traducciones al inglés del contenido de texto de los JSON dummy (que están en
// español a propósito, como placeholders — ver PROMPT_CLAUDE_CODE_lab_report_wow.md).
// Todo lo que el usuario ve debe estar en inglés; los campos del JSON se quedan
// en español como datos, y esta es la capa de copy que sí se muestra.

import { getLang, num } from '@/i18n';

export const MARKER_DISPLAY_NAMES_EN: Record<string, string> = {
  ferritin: 'Ferritin',
  hs_crp: 'hs-CRP (inflammation)',
  uric_acid: 'Uric acid',
  ast: 'AST (liver enzyme)',
  alt: 'ALT (liver enzyme)',
  hdl: 'HDL ("good" cholesterol)',
  glucose: 'Fasting glucose',
  homa_ir: 'HOMA-IR (insulin resistance)',
  ldl: 'LDL ("bad" cholesterol)',
  total_cholesterol: 'Total Cholesterol',
  non_hdl_cholesterol: 'Non-HDL Cholesterol',
  apob: 'Apolipoprotein B (ApoB)',
  vitamin_d: 'Vitamin D (25-OH)',
  ana: 'Antinuclear Antibodies (ANA)',
  hba1c: 'HbA1c',
  triglycerides: 'Triglycerides',
};

// En español el display_name del JSON ya vale; solo afinamos los que llevan aclaración.
const MARKER_DISPLAY_NAMES_ES: Record<string, string> = {
  ferritin: 'Ferritina',
  hs_crp: 'PCR ultrasensible (inflamación)',
  uric_acid: 'Ácido úrico',
  ast: 'AST (enzima hepática)',
  alt: 'ALT (enzima hepática)',
  hdl: 'HDL (colesterol «bueno»)',
  glucose: 'Glucosa en ayunas',
  homa_ir: 'HOMA-IR (resistencia a la insulina)',
  ldl: 'LDL (colesterol «malo»)',
  total_cholesterol: 'Colesterol total',
  non_hdl_cholesterol: 'Colesterol no HDL',
  apob: 'Apolipoproteína B (ApoB)',
  vitamin_d: 'Vitamina D (25-OH)',
  ana: 'Anticuerpos antinucleares (ANA)',
  hba1c: 'HbA1c',
  triglycerides: 'Triglicéridos',
};

// Nombre visible del marcador en el idioma activo (el nombre "En" se queda por compatibilidad).
export function getMarkerDisplayNameEn(markerId: string, fallback: string): string {
  if (getLang() === 'es') return MARKER_DISPLAY_NAMES_ES[markerId] ?? fallback;
  return MARKER_DISPLAY_NAMES_EN[markerId] ?? fallback;
}

// La mayoría de unidades ya son universales (mg/dL, ng/mL, %...) y se muestran tal
// cual. Solo un par de unidades "de palabra" vienen en español en el JSON dummy.
const UNIT_LABEL_EN: Record<string, string> = {
  índice: 'index',
  título: 'titer',
};

export function getMarkerValueTextEn(value: number | string, unit: string | null): string {
  if (getLang() === 'es') return unit ? `${num(value)} ${unit}` : num(value);
  if (unit && UNIT_LABEL_EN[unit]) return `${value} ${UNIT_LABEL_EN[unit]}`;
  return unit ? `${value} ${unit}` : `${value}`;
}

export function getUnitLabelEn(unit: string | null): string {
  if (!unit) return '';
  if (getLang() === 'es') return unit;
  return UNIT_LABEL_EN[unit] ?? unit;
}

export const PHENOAGE_EXPLANATION_EN =
  'Your estimated biological age has come down since your last report, in line with ' +
  'improvements in inflammation, insulin sensitivity, and your lipid profile.';

export const PROJECTION_UNCERTAINTY_NOTE_EN =
  "This range widens over time — it's an estimate, not a promise.";

export const RETEST_REASON_EN: Record<string, string> = {
  ldl: 'cardiovascular risk follow-up',
  vitamin_d: 'confirm response to supplementation',
};

interface ActionPlanContentEn {
  title: string;
  why: string[];
  how: string[];
  caveats: string[];
}

export const ACTION_PLAN_CONTENT_EN: Record<string, ActionPlanContentEn> = {
  'act.sueno.mantener_horario': {
    title: 'Keep your sleep schedule consistent',
    why: [
      "Your sleep regularity improved 35% in 6 months, tracking right alongside your drop in HbA1c and CRP.",
    ],
    how: ['Go to bed and wake up at the same time (±30 min), weekends included.'],
    caveats: [],
  },
  'act.actividad.fuerza_2x_semana': {
    title: 'Add 2 strength sessions per week',
    why: [
      "Your daily steps climbed from ~5,100 to ~8,600, but you're still not strength training — key for insulin sensitivity and body composition.",
    ],
    how: ['2 sessions of 30-40 min/week, full body, with progressive overload.'],
    caveats: ['If you have joint discomfort, start with bodyweight before adding external load.'],
  },
  'act.dieta.mas_omega3_pescado_azul': {
    title: 'Increase your omega-3 intake (oily fish 2-3x/week)',
    why: [
      "Your omega-3 index is still low (6.8%, target >8%), and your triglycerides — while improved — can still come down further.",
    ],
    how: [
      "2-3 servings/week of oily fish (salmon, sardines, mackerel), or an EPA/DHA supplement if you can't get there through diet.",
    ],
    caveats: [],
  },
  'act.suplemento.vitamina_d': {
    title: 'Supplement vitamin D and get regular sun exposure',
    why: [
      'Your vitamin D is still insufficient (26 ng/mL), though it has improved since your first test (18 ng/mL).',
    ],
    how: ['2,000 IU/day of vitamin D3 plus 15-20 min of sun on arms/legs, 3-4 times/week.'],
    caveats: ['Check with your doctor if you take anticoagulants or have hypercalcemia.'],
  },
  'act.dieta.hierro_hemo': {
    title: 'Add more easily-absorbed iron to your diet',
    why: [
      'Your ferritin is still borderline low (34 ng/mL); rebuilding your iron reserves supports energy and performance.',
    ],
    how: [
      '2-3 servings/week of lean red meat, or legumes paired with vitamin C in the same meal.',
    ],
    caveats: [],
  },
};

export function getActionPlanContentEn(
  actionId: string,
  fallback: ActionPlanContentEn
): ActionPlanContentEn {
  if (getLang() === 'es') return fallback; // el JSON ya viene en español
  return ACTION_PLAN_CONTENT_EN[actionId] ?? fallback;
}

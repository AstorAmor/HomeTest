// «Qué se ha asociado a mejorarlo» de un valor fuera de rango (fila de resultados, LabValueRow).
// Lenguaje prudente a propósito (el fundador, 2026-10-21): «se ha asociado», «los estudios sugieren»,
// nunca una orden ni una promesa. Por marcador y por dirección: lo que sirve para un valor bajo no
// sirve para uno alto (hierro, vitamina D…). Sin texto para ese caso → «háblalo con un médico».
// PENDIENTE de revisión médica (kuova-clinical-review-backlog).

type Direction = 'high' | 'low';

const TEXTS: { markers: string[]; high?: string; low?: string }[] = [
  {
    markers: ['ldl', 'apob', 'total_cholesterol', 'non_hdl_cholesterol'],
    high: 'Swapping saturated fat (butter, processed meat, pastries) for olive oil and nuts, and eating more fibre (legumes, oats, fruit), has been associated with lower LDL and total cholesterol in studies.',
  },
  {
    markers: ['triglycerides'],
    high: 'Studies link less sugar, refined flour and alcohol, and regular physical activity, with lower triglycerides.',
  },
  {
    markers: ['hdl'],
    low: 'Regular aerobic activity has been associated with a small, slow rise in HDL. Not smoking is also linked to higher HDL.',
  },
  {
    markers: ['ferritin', 'iron', 'transferrin_saturation', 'hemoglobin'],
    low: 'Iron-rich foods (red meat, legumes, leafy greens) eaten with vitamin C in the same meal have been associated with better iron absorption. Whether you need a supplement is usually decided with a doctor.',
  },
  {
    markers: ['vitamin_d'],
    low: 'A little midday sun and oily fish have been linked to higher vitamin D levels. Whether you need a supplement, and how much, is usually decided with a doctor.',
  },
  {
    markers: ['vitamin_b12', 'folate'],
    low: 'Eggs, fish and dairy (B12) and leafy greens and legumes (folate) are their main food sources. A low level is usually reviewed with a doctor, who decides on supplements.',
  },
  {
    markers: ['alt', 'ast', 'ggt'],
    high: 'Studies link drinking less alcohol, swapping sugary drinks for water and reaching a healthy weight with lower liver enzymes. Some medicines and recent hard exercise can also raise them.',
  },
  {
    markers: ['hs_crp'],
    high: 'Good sleep, regular physical activity and oily fish have been associated with lower inflammation markers. A recent cold or infection can raise CRP for a few weeks.',
  },
  {
    markers: ['uric_acid'],
    high: 'Drinking enough water and having less alcohol, sugary drinks and red meat or seafood have been associated with lower uric acid.',
  },
  {
    markers: ['glucose', 'hba1c'],
    high: 'Studies link regular physical activity, a short walk after meals and fewer sugary drinks and refined flour with better blood sugar.',
  },
];

export function labEvidence(markerId: string | null, direction: Direction): string | null {
  if (!markerId) return null;
  const entry = TEXTS.find((e) => e.markers.includes(markerId));
  return entry?.[direction] ?? null;
}

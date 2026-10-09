import { AgeBand, CancerType, Lineage, RelationId } from '@/types/familyHistory';

// Tablas de puntos de las herramientas de cribado de antecedentes familiares, cada número con su
// fuente. PENDIENTE DE REVISIÓN por el asesor médico antes de usarlo con usuarios reales.
//
// Comprobado el 2026-10-09 en:
// - USPSTF evidence review, Appendix C1 "Familial Risk Assessment Tools" (Nelson et al. 2019,
//   AHRQ, https://www.ncbi.nlm.nih.gov/books/NBK545866/): tablas completas de Ontario FHAT,
//   Manchester y PAT.
// - Health Education England, GeNotes "Manchester (Evans) score" (tabla BRCA1/BRCA2/combinada y
//   umbrales del NHS National Genomic Test Directory).
// - Tabla comparativa PAT / FHAT (Ashkenazi 4 puntos por rama, bilateral = 2 cánceres, umbral
//   ≥ 8 en cualquiera de las ramas): https://pmc.ncbi.nlm.nih.gov/articles/PMC3362189/
// - Revised Bethesda (Umar et al. 2004, tabla 2) y Amsterdam II (Vasen et al. 1999).
//
// Las simplificaciones propias (marcadas "SUPUESTO") se explican en la pantalla y en evidence.ts.

// ── Parentescos ────────────────────────────────────────────────────────────────────────────────
export interface RelationInfo {
  id: RelationId;
  label: string; // "Your mother's sister"
  short: string; // "Aunt (mother's side)"
  sex: 'F' | 'M' | 'self';
  degree: 0 | 1 | 2 | 3;
  lineage: Lineage;
  generation: number; // 0 = el usuario; -1 = padres, tíos; -2 = abuelos; +1 = hijos, sobrinos
  plural: boolean; // puede haber varios (hermanas, tías…)
  fhat: 'mother' | 'father' | 'sibling' | 'other'; // fila del Ontario FHAT que le toca
}

export const RELATIONS: Record<RelationId, RelationInfo> = {
  self: { id: 'self', label: 'You', short: 'You', sex: 'self', degree: 0, lineage: 'both', generation: 0, plural: false, fhat: 'other' },
  mother: { id: 'mother', label: 'Your mother', short: 'Mother', sex: 'F', degree: 1, lineage: 'maternal', generation: -1, plural: false, fhat: 'mother' },
  father: { id: 'father', label: 'Your father', short: 'Father', sex: 'M', degree: 1, lineage: 'paternal', generation: -1, plural: false, fhat: 'father' },
  sister: { id: 'sister', label: 'Your sister', short: 'Sister', sex: 'F', degree: 1, lineage: 'both', generation: 0, plural: true, fhat: 'sibling' },
  brother: { id: 'brother', label: 'Your brother', short: 'Brother', sex: 'M', degree: 1, lineage: 'both', generation: 0, plural: true, fhat: 'sibling' },
  // SUPUESTO: el FHAT solo nombra madre, padre y hermanos; a los hijos les damos la fila de hermanos
  // (también son de primer grado).
  daughter: { id: 'daughter', label: 'Your daughter', short: 'Daughter', sex: 'F', degree: 1, lineage: 'both', generation: 1, plural: true, fhat: 'sibling' },
  son: { id: 'son', label: 'Your son', short: 'Son', sex: 'M', degree: 1, lineage: 'both', generation: 1, plural: true, fhat: 'sibling' },
  niece: { id: 'niece', label: 'Your niece', short: 'Niece', sex: 'F', degree: 2, lineage: 'both', generation: 1, plural: true, fhat: 'other' },
  nephew: { id: 'nephew', label: 'Your nephew', short: 'Nephew', sex: 'M', degree: 2, lineage: 'both', generation: 1, plural: true, fhat: 'other' },
  grandmother_m: { id: 'grandmother_m', label: "Your mother's mother", short: 'Grandmother', sex: 'F', degree: 2, lineage: 'maternal', generation: -2, plural: false, fhat: 'other' },
  grandfather_m: { id: 'grandfather_m', label: "Your mother's father", short: 'Grandfather', sex: 'M', degree: 2, lineage: 'maternal', generation: -2, plural: false, fhat: 'other' },
  aunt_m: { id: 'aunt_m', label: "Your mother's sister", short: 'Aunt', sex: 'F', degree: 2, lineage: 'maternal', generation: -1, plural: true, fhat: 'other' },
  uncle_m: { id: 'uncle_m', label: "Your mother's brother", short: 'Uncle', sex: 'M', degree: 2, lineage: 'maternal', generation: -1, plural: true, fhat: 'other' },
  cousin_f_m: { id: 'cousin_f_m', label: 'A female cousin on your mother’s side', short: 'Cousin (she)', sex: 'F', degree: 3, lineage: 'maternal', generation: 0, plural: true, fhat: 'other' },
  cousin_m_m: { id: 'cousin_m_m', label: 'A male cousin on your mother’s side', short: 'Cousin (he)', sex: 'M', degree: 3, lineage: 'maternal', generation: 0, plural: true, fhat: 'other' },
  grandmother_p: { id: 'grandmother_p', label: "Your father's mother", short: 'Grandmother', sex: 'F', degree: 2, lineage: 'paternal', generation: -2, plural: false, fhat: 'other' },
  grandfather_p: { id: 'grandfather_p', label: "Your father's father", short: 'Grandfather', sex: 'M', degree: 2, lineage: 'paternal', generation: -2, plural: false, fhat: 'other' },
  aunt_p: { id: 'aunt_p', label: "Your father's sister", short: 'Aunt', sex: 'F', degree: 2, lineage: 'paternal', generation: -1, plural: true, fhat: 'other' },
  uncle_p: { id: 'uncle_p', label: "Your father's brother", short: 'Uncle', sex: 'M', degree: 2, lineage: 'paternal', generation: -1, plural: true, fhat: 'other' },
  cousin_f_p: { id: 'cousin_f_p', label: 'A female cousin on your father’s side', short: 'Cousin (she)', sex: 'F', degree: 3, lineage: 'paternal', generation: 0, plural: true, fhat: 'other' },
  cousin_m_p: { id: 'cousin_m_p', label: 'A male cousin on your father’s side', short: 'Cousin (he)', sex: 'M', degree: 3, lineage: 'paternal', generation: 0, plural: true, fhat: 'other' },
};

// Grupos para elegir familiares en pantalla
export const RELATION_GROUPS: { title: string; ids: RelationId[] }[] = [
  { title: 'Close family', ids: ['mother', 'father', 'sister', 'brother', 'daughter', 'son'] },
  { title: "Your mother's side", ids: ['grandmother_m', 'grandfather_m', 'aunt_m', 'uncle_m', 'cousin_f_m', 'cousin_m_m'] },
  { title: "Your father's side", ids: ['grandmother_p', 'grandfather_p', 'aunt_p', 'uncle_p', 'cousin_f_p', 'cousin_m_p'] },
  { title: 'Nieces and nephews', ids: ['niece', 'nephew'] },
];

// Parientes de primer grado entre sí (para "uno es familiar de primer grado del otro" de
// Bethesda/Amsterdam). Solo los pares que se pueden deducir sin ambigüedad.
const FIRST_DEGREE_PAIRS: [RelationId, RelationId][] = [
  ['self', 'mother'], ['self', 'father'], ['self', 'sister'], ['self', 'brother'], ['self', 'daughter'], ['self', 'son'],
  ['mother', 'sister'], ['mother', 'brother'], ['father', 'sister'], ['father', 'brother'],
  ['mother', 'grandmother_m'], ['mother', 'grandfather_m'], ['mother', 'aunt_m'], ['mother', 'uncle_m'],
  ['father', 'grandmother_p'], ['father', 'grandfather_p'], ['father', 'aunt_p'], ['father', 'uncle_p'],
  ['aunt_m', 'grandmother_m'], ['aunt_m', 'grandfather_m'], ['uncle_m', 'grandmother_m'], ['uncle_m', 'grandfather_m'],
  ['aunt_p', 'grandmother_p'], ['aunt_p', 'grandfather_p'], ['uncle_p', 'grandmother_p'], ['uncle_p', 'grandfather_p'],
  ['aunt_m', 'uncle_m'], ['aunt_p', 'uncle_p'], ['sister', 'brother'], ['daughter', 'son'],
  ['mother', 'daughter'], ['mother', 'son'], ['father', 'daughter'], ['father', 'son'],
];
export const areFirstDegree = (a: RelationId, b: RelationId) =>
  (a === b && RELATIONS[a].plural && a !== 'self') ||
  FIRST_DEGREE_PAIRS.some(([x, y]) => (x === a && y === b) || (x === b && y === a));

// ── Tipos de cáncer ────────────────────────────────────────────────────────────────────────────
export const CANCER_LABEL: Record<CancerType, string> = {
  breast: 'Breast cancer',
  ovarian: 'Ovarian cancer',
  colorectal: 'Bowel (colorectal) cancer',
  endometrial: 'Womb (endometrial) cancer',
  small_bowel: 'Small intestine cancer',
  urinary: 'Kidney pelvis or ureter cancer',
  stomach: 'Stomach cancer',
  pancreatic: 'Pancreatic cancer',
  prostate: 'Prostate cancer',
  other: 'Another cancer',
};

// Amsterdam II: tumores que cuentan (colorrectal, endometrio, intestino delgado, uréter o pelvis renal)
export const AMSTERDAM_TUMOURS: CancerType[] = ['colorectal', 'endometrial', 'small_bowel', 'urinary'];
// Revised Bethesda (Umar 2004, nota de la tabla 2): colorrectal, endometrio, estómago, ovario,
// páncreas, uréter y pelvis renal, vía biliar, cerebro, intestino delgado (y lesiones cutáneas de
// Muir-Torre). Aquí solo los que preguntamos.
export const BETHESDA_TUMOURS: CancerType[] = ['colorectal', 'endometrial', 'stomach', 'ovarian', 'pancreatic', 'urinary', 'small_bowel'];

export const AGE_LABEL: Record<AgeBand, string> = {
  u30: 'Under 30',
  '30s': '30–39',
  '40s': '40–49',
  '50s': '50–59',
  '60plus': '60 or older',
  unknown: 'Not sure',
};
export const under50 = (a: AgeBand) => a === 'u30' || a === '30s' || a === '40s';
export const under60 = (a: AgeBand) => under50(a) || a === '50s';

// ── PAT (Pedigree Assessment Tool, Hoskins et al. 2006) ────────────────────────────────────────
// Puntos por cada familiar con cáncer de mama u ovario, también de 2.º y 3.er grado; se suma cada
// rama (materna y paterna) por separado y se usa la mayor. Derivar si ≥ 8.
export const PAT = {
  breastUnder50: 4,
  breast50plus: 3,
  ovarianAnyAge: 5,
  maleBreastAnyAge: 8,
  ashkenaziPerLineage: 4,
  bilateralFactor: 2, // mama bilateral = 2 × el cáncer
  threshold: 8,
};

// ── Ontario FHAT (Gilpin et al. 2000) ──────────────────────────────────────────────────────────
// Suma de la familia (cada rama por separado, según la tabla comparativa de PMC3362189). Derivar si
// ≥ 10: corresponde a duplicar el riesgo de cáncer de mama a lo largo de la vida (22 %).
export const FHAT = {
  breastAndOvarian: { mother: 10, sibling: 7, other: 5 }, // la misma persona tuvo los dos
  breastRelative: { parent: 4, sibling: 3, other: 2, maleAdd: 2 },
  breastOnset: { u30: 6, '30s': 4, '40s': 2 } as Partial<Record<AgeBand, number>>, // 20-29, 30-39, 40-49
  // SUPUESTO: casi nadie sabe si su familiar era premenopáusica; usamos el diagnóstico antes de los
  // 50 (edad media de la menopausia ≈ 51) como aproximación de "pre (peri) menopausal".
  breastPremenopausal: 2,
  breastBilateralOrMultifocal: 3,
  ovarianRelative: { mother: 7, sibling: 4, other: 3 },
  ovarianOnset: (a: AgeBand) => (a === 'u30' || a === '30s' ? 6 : a === '40s' || a === '50s' ? 4 : a === '60plus' ? 2 : 0), // <40, 40-60, >60
  prostateUnder50: 1,
  colonUnder50: 1,
  threshold: 10,
};

// ── Manchester Scoring System (Evans et al. 2004; tabla del NHS y de la USPSTF) ────────────────
// Puntos por cada afectado (incluido el propio usuario) de una misma rama de la familia.
// ≥ 10 en un gen o ≥ 15 combinado ≈ 10 % de probabilidad de una variante en BRCA1/2 (umbral de
// test en el NHS). Para alguien sin cáncer cuyo familiar de primer grado afectado no puede
// hacerse el test, el NHS usa 20 puntos (actualización de 2017, Evans et al.).
export const MANCHESTER = {
  femaleBreast: { u30: [6, 5], '30s': [4, 4], '40s': [3, 3], '50s': [2, 2], '60plus': [1, 1], unknown: [1, 1] } as Record<AgeBand, [number, number]>,
  maleBreast: (a: AgeBand): [number, number] => (under60(a) ? [5, 8] : [5, 5]),
  ovarian: (a: AgeBand): [number, number] => (under60(a) ? [8, 5] : [5, 5]),
  pancreatic: [0, 1] as [number, number],
  prostate: (a: AgeBand): [number, number] => (under60(a) ? [0, 2] : [0, 1]),
  singleGeneThreshold: 10,
  combinedThreshold: 15,
  unaffectedRelativeThreshold: 20,
};

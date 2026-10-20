// PhenoAge (Levine ME et al., Aging 2018;10(4):573-91, tabla 1): la base de la Edad KUOVA. Mismos
// coeficientes que phenoage0 del paquete BioAge (github.com/dayoonkwon/BioAge, R/phenoage_calc.R).
// OJO: Liu 2018 (PLoS Med) trae erratas en algunos coeficientes; no copiar de ahí.
//
// Unidades del modelo: albúmina g/L, creatinina µmol/L, glucosa mmol/L, PCR mg/dL (en logaritmo),
// linfocitos %, VCM fL, ADE %, fosfatasa alcalina U/L, leucocitos 10^3/µL. En España la PCR suele
// venir en mg/L: sin pasarla a mg/dL la edad sale unos 2,4 años mayor.

export type PhenoInput = 'albumin' | 'creatinine' | 'glucose' | 'hs_crp' | 'lymphocytes_pct' | 'mcv' | 'rdw' | 'alp' | 'wbc';
export type PhenoValues = Record<PhenoInput, number>; // ya en las unidades del modelo

const COEF: PhenoValues = {
  albumin: -0.03359355,
  creatinine: 0.009506491,
  glucose: 0.1953192,
  hs_crp: 0.09536762, // sobre ln(PCR en mg/dL)
  lymphocytes_pct: -0.01199984,
  mcv: 0.02676401,
  rdw: 0.3306156,
  alp: 0.001868778,
  wbc: 0.05542406,
};
const INTERCEPT = -19.90667;
const COEF_AGE = 0.08035356;
const GAMMA = 0.007692696;

// Por debajo del límite de detección la PCR puede venir como 0: sin suelo, el logaritmo se dispara.
// 0,01 mg/dL (0,1 mg/L), del orden del límite de las PCR ultrasensibles.
export const CRP_FLOOR_MG_DL = 0.01;
// Con la PCR por encima de 10 mg/L (inflamación aguda: un catarro, una infección) no se calcula
export const CRP_ACUTE_MG_L = 10;
// Rango de edad en el que se desarrolló y validó (NHANES)
export const PHENO_MIN_AGE = 20;
export const PHENO_MAX_AGE = 84;

const linear = (v: PhenoValues) =>
  (Object.keys(COEF) as PhenoInput[]).reduce(
    (s, k) => s + COEF[k] * (k === 'hs_crp' ? Math.log(Math.max(v.hs_crp, CRP_FLOOR_MG_DL)) : v[k]),
    0,
  );

export function phenoAge(v: PhenoValues, age: number): number {
  const xb = INTERCEPT + linear(v) + COEF_AGE * age;
  const m = 1 - Math.exp((-Math.expm1(120 * GAMMA) * Math.exp(xb)) / GAMMA);
  return 141.50225 + Math.log(-0.0055305 * Math.log(1 - m)) / 0.090165;
}

// PhenoAge es lineal en xb: cada unidad de xb son 1/0,090165 = 11,09 años
const YEARS_PER_XB = 1 / 0.090165;

// Variación biológica intraindividual (CVi, %) de la base de la EFLM (biologicalvariation.eu,
// consultada el 2026-10-20, estimaciones de metaanálisis). SUPUESTO (pendiente del asesor): sin
// entrada propia en la base, % de linfocitos usa la de los linfocitos absolutos (10,9), ADE-CV la de
// ADE-SD (1,7) y la fosfatasa alcalina total la del tipo hepático (6,0). SUPUESTO: imprecisión
// analítica = la "deseable" de Fraser (la mitad del CVi), así que el CV total es CVi·√1,25. Es el
// mínimo exigible, no la de cada laboratorio: en el ADE y el % de linfocitos los contadores suelen
// tener más, y el margen puede quedarse algo corto. Si el laboratorio da su CVa, usar ese.
const CVI: PhenoValues = {
  albumin: 2.5,
  creatinine: 4.4,
  glucose: 4.9,
  hs_crp: 34.7,
  lymphocytes_pct: 10.9,
  mcv: 0.8,
  rdw: 1.7,
  alp: 6.0,
  wbc: 11.1,
};
const CV_TOTAL = (k: PhenoInput) => (CVI[k] / 100) * Math.sqrt(1.25);

// Margen (95 %) de una Edad KUOVA por la variación normal de la analítica, en años. Propagación de
// errores (exacta para los términos lineales; para la PCR, la DE de su logaritmo con distribución
// lognormal). Un cambio entre dos analíticas solo es real si supera √(m1² + m2²).
export function phenoAgeMargin(v: PhenoValues): number {
  let varXb = 0;
  for (const k of Object.keys(COEF) as PhenoInput[]) {
    const sd = k === 'hs_crp' ? Math.sqrt(Math.log(1 + CV_TOTAL(k) ** 2)) : v[k] * CV_TOTAL(k);
    varXb += (COEF[k] * sd) ** 2;
  }
  return 1.96 * Math.sqrt(varXb) * YEARS_PER_XB;
}

// Valores típicos de un adulto sano, solo para explicar qué valores suman o quitan años (no entran
// en el cálculo): años = coeficiente × (valor − típico) × 11,09
const TYPICAL: PhenoValues = {
  albumin: 45,
  creatinine: 80,
  glucose: 5.0,
  hs_crp: 0.1,
  lymphocytes_pct: 30,
  mcv: 90,
  rdw: 13,
  alp: 70,
  wbc: 6.5,
};

export function phenoAgeDrivers(v: PhenoValues, max = 3, minYears = 0.5): { marker_id: PhenoInput; direction: 'suma' | 'resta'; years: number }[] {
  return (Object.keys(COEF) as PhenoInput[])
    .map((k) => {
      const delta = k === 'hs_crp' ? Math.log(Math.max(v.hs_crp, CRP_FLOOR_MG_DL) / TYPICAL.hs_crp) : v[k] - TYPICAL[k];
      return { marker_id: k, years: COEF[k] * delta * YEARS_PER_XB };
    })
    .filter((d) => Math.abs(d.years) >= minYears)
    .sort((a, b) => Math.abs(b.years) - Math.abs(a.years))
    .slice(0, max)
    .map((d) => ({ ...d, direction: d.years < 0 ? ('resta' as const) : ('suma' as const) }));
}

const norm = (u?: string | null) => (u ?? '').toLowerCase().replace(/\s+/g, '').replace(/[µμ]/g, 'u').replace(/³/g, '3');

// De lo que trae la analítica a las unidades del modelo. null si la unidad no se puede usar (p. ej.
// ADE en fL, que es el ADE-SD, o una PCR sin unidad: mg/L y mg/dL no se distinguen por la cifra).
export function toPhenoUnits(id: PhenoInput, value: number, unit?: string | null): number | null {
  const u = norm(unit);
  switch (id) {
    case 'albumin':
      if (u === 'g/dl') return value * 10;
      if (u === 'g/l') return value;
      return value > 0 && value < 10 ? value * 10 : value >= 10 && value < 80 ? value : null;
    case 'creatinine':
      if (u === 'mg/dl') return value * 88.42;
      if (u === 'umol/l') return value;
      return value > 0 && value < 20 ? value * 88.42 : value >= 20 && value < 2000 ? value : null;
    case 'glucose':
      if (u === 'mg/dl') return value / 18.016;
      if (u === 'mmol/l') return value;
      return value > 30 ? value / 18.016 : value > 0 ? value : null;
    case 'hs_crp':
      if (u === 'mg/l') return value / 10;
      if (u === 'mg/dl') return value;
      return null;
    case 'lymphocytes_pct':
      return u === '%' || u === '' ? value : null;
    case 'mcv':
      return value >= 50 && value <= 150 ? value : null; // fL = µm³
    case 'rdw':
      if (u.includes('fl')) return null; // ADE-SD: el modelo usa el ADE-CV (%)
      return value > 0 && value < 40 ? value : null;
    case 'alp':
      if (u.includes('ukat')) return value * 60;
      return value > 0 ? value : null; // U/L = UI/L
    case 'wbc':
      // 10^3/µL = 10^9/L; si viene por µL (6100), se pasa a miles
      return value > 300 ? value / 1000 : value > 0 ? value : null;
  }
}

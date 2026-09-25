// Ratios y scores calculados a partir de biomarcadores medidos. Fórmulas
// publicadas y sin ambigüedad clínica (no interpretación, solo aritmética) --
// por eso viven aquí como código determinista en vez de esperar a la
// investigación externa. Lo que SÍ está pendiente de esa investigación es la
// INTERPRETACIÓN de cada ratio (umbrales de riesgo, qué recomendar) -- este
// módulo solo calcula el número.
//
// Estado por ratio frente al catálogo (knowledge/biomarcadores/*.json):
//   - LDL_C, NON_HDL_CHOLESTEROL, TC_HDL_RATIO, BUN_CREATININE_RATIO,
//     GLOBULIN, ALBUMIN_GLOBULIN_RATIO, IRON_SATURATION ya existen como
//     canonical_id con measurement_type "DERIVED" -- calculados aquí con
//     ese mismo id.
//   - HOMA_IR NO existe todavía en el catálogo (no está en el import de
//     Function Health). Se calcula igualmente porque el fundador lo pidió
//     explícitamente y es una fórmula estándar sin ambigüedad, pero hay que
//     añadirlo a knowledge/biomarcadores/metabolico.json (con su
//     knowledge_card) antes de mostrarlo en producción -- ver TODO_ADD_TO_CATALOG.
//   - EGFR, TESTOSTERONE_FREE, PSA_FREE_PERCENT y los ratios de Omega-3/6 SÍ
//     son canonical_id "DERIVED" pero NO están implementados todavía: eGFR
//     necesita la ecuación CKD-EPI 2021 (sin coeficiente de raza, con
//     constantes por sexo) y testosterona libre necesita la ecuación de
//     Vermeulen (con SHBG) -- ambas con más superficie de error que un
//     cociente simple. Quedan para una siguiente iteración, no bloquean el
//     resto del motor.

import { DerivedMetricResult } from '@/types/recommendation';

export const TODO_ADD_TO_CATALOG = ['HOMA_IR'] as const;

export const NOT_YET_IMPLEMENTED_RATIOS = [
  'EGFR',
  'TESTOSTERONE_FREE',
  'PSA_FREE_PERCENT',
  'OMEGA6_OMEGA3_RATIO',
  'ARACHIDONIC_EPA_RATIO',
] as const;

export interface AvailableBiomarker {
  value: number;
  unit: string;
}

// Lookup inyectado por el llamador (normalmente respaldado por los
// BiomarkerResult del test actual). Devuelve null si ese biomarcador no se
// midió en este test -- los ratios de abajo lo tratan como dato faltante,
// nunca asumen un valor.
export type BiomarkerLookup = (canonicalId: string) => AvailableBiomarker | null;

// Factores de conversión mínimos que necesitan estas fórmulas, indexados por
// canonical_id (no por nombre en español como src/utils/unitConversion.ts,
// que está pensado para mostrar unidades alternativas en la UI, no para
// alimentar cálculos). Mismos factores clínicos estándar en ambos sitios.
const CANONICAL_UNIT_FACTORS: Record<string, { from: string; to: string; factor: number }[]> = {
  TOTAL_CHOLESTEROL: [{ from: 'mmol/l', to: 'mg/dl', factor: 1 / 0.02586 }],
  HDL_C: [{ from: 'mmol/l', to: 'mg/dl', factor: 1 / 0.02586 }],
  LDL_C: [{ from: 'mmol/l', to: 'mg/dl', factor: 1 / 0.02586 }],
  TRIGLYCERIDES: [{ from: 'mmol/l', to: 'mg/dl', factor: 1 / 0.0113 }],
  CREATININE: [{ from: 'µmol/l', to: 'mg/dl', factor: 1 / 88.4 }],
  BUN: [{ from: 'mmol/l', to: 'mg/dl', factor: 1 / 0.357 }],
  ALBUMIN: [{ from: 'g/l', to: 'g/dl', factor: 1 / 10 }],
  TOTAL_PROTEIN: [{ from: 'g/l', to: 'g/dl', factor: 1 / 10 }],
  IRON: [{ from: 'µmol/l', to: 'µg/dl', factor: 1 / 0.1791 }],
  IRON_BINDING_CAPACITY: [{ from: 'µmol/l', to: 'µg/dl', factor: 1 / 0.1791 }],
  GLUCOSE: [{ from: 'mmol/l', to: 'mg/dl', factor: 1 / 0.0555 }],
};

function normalizeUnit(unit: string): string {
  return unit.toLowerCase().replace(/\s+/g, '');
}

// Convierte una lectura a la unidad que necesita la fórmula. Devuelve null
// si la unidad no se reconoce -- nunca calcula "a ojo" con una unidad no
// soportada.
function toUnit(canonicalId: string, reading: AvailableBiomarker, targetUnit: string): number | null {
  const target = normalizeUnit(targetUnit);
  const current = normalizeUnit(reading.unit);
  if (current === target) return reading.value;

  const factors = CANONICAL_UNIT_FACTORS[canonicalId] ?? [];
  const direct = factors.find((f) => normalizeUnit(f.from) === current && normalizeUnit(f.to) === target);
  if (direct) return reading.value * direct.factor;
  const inverse = factors.find((f) => normalizeUnit(f.to) === current && normalizeUnit(f.from) === target);
  if (inverse) return reading.value / inverse.factor;

  return null;
}

function missing(metricId: string, label: string, missingIds: string[]): DerivedMetricResult {
  return {
    metricId,
    label,
    value: null,
    unit: null,
    inputsUsed: [],
    unavailableReason: `Faltan biomarcadores requeridos: ${missingIds.join(', ')}`,
  };
}

// ---------------------------------------------------------------------------
// Colesterol LDL -- fórmula de Friedewald. Inválida cuando los triglicéridos
// son muy altos (la fórmula asume una relación fija VLDL = TG/5 que deja de
// sostenerse); el umbral de 400 mg/dL es el que usa la literatura original
// de Friedewald et al. 1972.
// ---------------------------------------------------------------------------
export function computeLdlFriedewald(lookup: BiomarkerLookup): DerivedMetricResult {
  const tc = lookup('TOTAL_CHOLESTEROL');
  const hdl = lookup('HDL_C');
  const tg = lookup('TRIGLYCERIDES');
  const missingIds = [
    !tc && 'TOTAL_CHOLESTEROL',
    !hdl && 'HDL_C',
    !tg && 'TRIGLYCERIDES',
  ].filter((x): x is string => !!x);
  if (missingIds.length > 0) return missing('LDL_C', 'Colesterol LDL (Friedewald)', missingIds);

  const tcMgdl = toUnit('TOTAL_CHOLESTEROL', tc!, 'mg/dl');
  const hdlMgdl = toUnit('HDL_C', hdl!, 'mg/dl');
  const tgMgdl = toUnit('TRIGLYCERIDES', tg!, 'mg/dl');
  if (tcMgdl === null || hdlMgdl === null || tgMgdl === null) {
    return {
      metricId: 'LDL_C',
      label: 'Colesterol LDL (Friedewald)',
      value: null,
      unit: null,
      inputsUsed: ['TOTAL_CHOLESTEROL', 'HDL_C', 'TRIGLYCERIDES'],
      unavailableReason: 'Unidad no soportada en alguno de los inputs',
    };
  }
  if (tgMgdl >= 400) {
    return {
      metricId: 'LDL_C',
      label: 'Colesterol LDL (Friedewald)',
      value: null,
      unit: 'mg/dL',
      inputsUsed: ['TOTAL_CHOLESTEROL', 'HDL_C', 'TRIGLYCERIDES'],
      unavailableReason: 'Fórmula de Friedewald no válida con triglicéridos ≥ 400 mg/dL',
    };
  }

  const value = tcMgdl - hdlMgdl - tgMgdl / 5;
  return {
    metricId: 'LDL_C',
    label: 'Colesterol LDL (Friedewald)',
    value: Math.round(value * 10) / 10,
    unit: 'mg/dL',
    inputsUsed: ['TOTAL_CHOLESTEROL', 'HDL_C', 'TRIGLYCERIDES'],
    unavailableReason: null,
  };
}

// ---------------------------------------------------------------------------
// Colesterol no-HDL y ratio Colesterol total / HDL
// ---------------------------------------------------------------------------
export function computeNonHdlCholesterol(lookup: BiomarkerLookup): DerivedMetricResult {
  const tc = lookup('TOTAL_CHOLESTEROL');
  const hdl = lookup('HDL_C');
  if (!tc || !hdl) {
    return missing('NON_HDL_CHOLESTEROL', 'Colesterol no-HDL', [!tc && 'TOTAL_CHOLESTEROL', !hdl && 'HDL_C'].filter((x): x is string => !!x));
  }
  const tcMgdl = toUnit('TOTAL_CHOLESTEROL', tc, 'mg/dl');
  const hdlMgdl = toUnit('HDL_C', hdl, 'mg/dl');
  if (tcMgdl === null || hdlMgdl === null) {
    return { metricId: 'NON_HDL_CHOLESTEROL', label: 'Colesterol no-HDL', value: null, unit: null, inputsUsed: ['TOTAL_CHOLESTEROL', 'HDL_C'], unavailableReason: 'Unidad no soportada' };
  }
  return {
    metricId: 'NON_HDL_CHOLESTEROL',
    label: 'Colesterol no-HDL',
    value: Math.round((tcMgdl - hdlMgdl) * 10) / 10,
    unit: 'mg/dL',
    inputsUsed: ['TOTAL_CHOLESTEROL', 'HDL_C'],
    unavailableReason: null,
  };
}

export function computeTcHdlRatio(lookup: BiomarkerLookup): DerivedMetricResult {
  const tc = lookup('TOTAL_CHOLESTEROL');
  const hdl = lookup('HDL_C');
  if (!tc || !hdl) {
    return missing('TC_HDL_RATIO', 'Ratio Colesterol Total / HDL', [!tc && 'TOTAL_CHOLESTEROL', !hdl && 'HDL_C'].filter((x): x is string => !!x));
  }
  const tcMgdl = toUnit('TOTAL_CHOLESTEROL', tc, 'mg/dl');
  const hdlMgdl = toUnit('HDL_C', hdl, 'mg/dl');
  if (tcMgdl === null || hdlMgdl === null || hdlMgdl === 0) {
    return { metricId: 'TC_HDL_RATIO', label: 'Ratio Colesterol Total / HDL', value: null, unit: null, inputsUsed: ['TOTAL_CHOLESTEROL', 'HDL_C'], unavailableReason: 'Unidad no soportada o HDL en cero' };
  }
  return {
    metricId: 'TC_HDL_RATIO',
    label: 'Ratio Colesterol Total / HDL',
    value: Math.round((tcMgdl / hdlMgdl) * 100) / 100,
    unit: null,
    inputsUsed: ['TOTAL_CHOLESTEROL', 'HDL_C'],
    unavailableReason: null,
  };
}

// ---------------------------------------------------------------------------
// Ratio BUN / Creatinina. Usa específicamente BUN (nitrógeno ureico), no
// UREA -- son biomarcadores distintos en el catálogo (UREA * 0.467 ≈ BUN) y
// mezclar uno por otro cambiaría el rango de referencia esperado del ratio.
// ---------------------------------------------------------------------------
export function computeBunCreatinineRatio(lookup: BiomarkerLookup): DerivedMetricResult {
  const bun = lookup('BUN');
  const creatinine = lookup('CREATININE');
  if (!bun || !creatinine) {
    return missing('BUN_CREATININE_RATIO', 'Ratio BUN / Creatinina', [!bun && 'BUN', !creatinine && 'CREATININE'].filter((x): x is string => !!x));
  }
  const bunMgdl = toUnit('BUN', bun, 'mg/dl');
  const creatMgdl = toUnit('CREATININE', creatinine, 'mg/dl');
  if (bunMgdl === null || creatMgdl === null || creatMgdl === 0) {
    return { metricId: 'BUN_CREATININE_RATIO', label: 'Ratio BUN / Creatinina', value: null, unit: null, inputsUsed: ['BUN', 'CREATININE'], unavailableReason: 'Unidad no soportada o creatinina en cero' };
  }
  return {
    metricId: 'BUN_CREATININE_RATIO',
    label: 'Ratio BUN / Creatinina',
    value: Math.round((bunMgdl / creatMgdl) * 10) / 10,
    unit: null,
    inputsUsed: ['BUN', 'CREATININE'],
    unavailableReason: null,
  };
}

// ---------------------------------------------------------------------------
// Globulina (Proteínas totales - Albúmina) y ratio Albúmina/Globulina
// ---------------------------------------------------------------------------
export function computeGlobulin(lookup: BiomarkerLookup): DerivedMetricResult {
  const totalProtein = lookup('TOTAL_PROTEIN');
  const albumin = lookup('ALBUMIN');
  if (!totalProtein || !albumin) {
    return missing('GLOBULIN', 'Globulina', [!totalProtein && 'TOTAL_PROTEIN', !albumin && 'ALBUMIN'].filter((x): x is string => !!x));
  }
  const tpGdl = toUnit('TOTAL_PROTEIN', totalProtein, 'g/dl');
  const albGdl = toUnit('ALBUMIN', albumin, 'g/dl');
  if (tpGdl === null || albGdl === null) {
    return { metricId: 'GLOBULIN', label: 'Globulina', value: null, unit: null, inputsUsed: ['TOTAL_PROTEIN', 'ALBUMIN'], unavailableReason: 'Unidad no soportada' };
  }
  return {
    metricId: 'GLOBULIN',
    label: 'Globulina',
    value: Math.round((tpGdl - albGdl) * 100) / 100,
    unit: 'g/dL',
    inputsUsed: ['TOTAL_PROTEIN', 'ALBUMIN'],
    unavailableReason: null,
  };
}

export function computeAlbuminGlobulinRatio(lookup: BiomarkerLookup): DerivedMetricResult {
  const albumin = lookup('ALBUMIN');
  const globulin = computeGlobulin(lookup);
  if (!albumin || globulin.value === null) {
    return missing('ALBUMIN_GLOBULIN_RATIO', 'Ratio Albúmina / Globulina', [!albumin && 'ALBUMIN', globulin.value === null && 'GLOBULIN (TOTAL_PROTEIN + ALBUMIN)'].filter((x): x is string => !!x));
  }
  const albGdl = toUnit('ALBUMIN', albumin, 'g/dl');
  if (albGdl === null || globulin.value === 0) {
    return { metricId: 'ALBUMIN_GLOBULIN_RATIO', label: 'Ratio Albúmina / Globulina', value: null, unit: null, inputsUsed: ['ALBUMIN', 'TOTAL_PROTEIN'], unavailableReason: 'Unidad no soportada o globulina en cero' };
  }
  return {
    metricId: 'ALBUMIN_GLOBULIN_RATIO',
    label: 'Ratio Albúmina / Globulina',
    value: Math.round((albGdl / globulin.value) * 100) / 100,
    unit: null,
    inputsUsed: ['ALBUMIN', 'TOTAL_PROTEIN'],
    unavailableReason: null,
  };
}

// ---------------------------------------------------------------------------
// Porcentaje de saturación de hierro = Hierro / TIBC × 100. Asume que
// IRON_BINDING_CAPACITY se mide en µg/dL cuando su unidad no está
// especificada (el catálogo trae common_units: [] para este biomarcador
// todavía) -- convención clínica estándar, pero queda como TODO confirmar
// cuando se rellene su knowledge_card.
// ---------------------------------------------------------------------------
export function computeIronSaturation(lookup: BiomarkerLookup): DerivedMetricResult {
  const iron = lookup('IRON');
  const tibc = lookup('IRON_BINDING_CAPACITY');
  if (!iron || !tibc) {
    return missing('IRON_SATURATION', 'Porcentaje de saturación de hierro', [!iron && 'IRON', !tibc && 'IRON_BINDING_CAPACITY'].filter((x): x is string => !!x));
  }
  const ironUgdl = toUnit('IRON', iron, 'µg/dl');
  const tibcUgdl = toUnit('IRON_BINDING_CAPACITY', tibc, 'µg/dl');
  if (ironUgdl === null || tibcUgdl === null || tibcUgdl === 0) {
    return { metricId: 'IRON_SATURATION', label: 'Porcentaje de saturación de hierro', value: null, unit: null, inputsUsed: ['IRON', 'IRON_BINDING_CAPACITY'], unavailableReason: 'Unidad no soportada o TIBC en cero' };
  }
  return {
    metricId: 'IRON_SATURATION',
    label: 'Porcentaje de saturación de hierro',
    value: Math.round((ironUgdl / tibcUgdl) * 1000) / 10,
    unit: '%',
    inputsUsed: ['IRON', 'IRON_BINDING_CAPACITY'],
    unavailableReason: null,
  };
}

// ---------------------------------------------------------------------------
// HOMA-IR -- (glucosa [mg/dL] × insulina [µU/mL]) / 405. Ver
// TODO_ADD_TO_CATALOG: no tiene canonical_id todavía. Solo se acepta
// insulina en µU/mL o mIU/L (numéricamente equivalentes); pmol/L necesitaría
// otro factor de conversión que no está confirmado aquí, así que se rechaza
// explícitamente en vez de asumir uno.
// ---------------------------------------------------------------------------
const INSULIN_EQUIVALENT_UNITS = ['µu/ml', 'uu/ml', 'miu/l', 'mu/l'];

export function computeHomaIr(lookup: BiomarkerLookup): DerivedMetricResult {
  const glucose = lookup('GLUCOSE');
  const insulin = lookup('INSULIN');
  if (!glucose || !insulin) {
    return missing('HOMA_IR', 'HOMA-IR (resistencia a la insulina)', [!glucose && 'GLUCOSE', !insulin && 'INSULIN'].filter((x): x is string => !!x));
  }
  const glucoseMgdl = toUnit('GLUCOSE', glucose, 'mg/dl');
  if (glucoseMgdl === null) {
    return { metricId: 'HOMA_IR', label: 'HOMA-IR (resistencia a la insulina)', value: null, unit: null, inputsUsed: ['GLUCOSE', 'INSULIN'], unavailableReason: 'Unidad de glucosa no soportada' };
  }
  if (!INSULIN_EQUIVALENT_UNITS.includes(normalizeUnit(insulin.unit))) {
    return {
      metricId: 'HOMA_IR',
      label: 'HOMA-IR (resistencia a la insulina)',
      value: null,
      unit: null,
      inputsUsed: ['GLUCOSE', 'INSULIN'],
      unavailableReason: `Unidad de insulina no soportada: ${insulin.unit} (se admite µU/mL o mIU/L)`,
    };
  }
  return {
    metricId: 'HOMA_IR',
    label: 'HOMA-IR (resistencia a la insulina)',
    value: Math.round(((glucoseMgdl * insulin.value) / 405) * 100) / 100,
    unit: null,
    inputsUsed: ['GLUCOSE', 'INSULIN'],
    unavailableReason: null,
  };
}

// ---------------------------------------------------------------------------
// Registro de todos los ratios implementados, para poder recorrerlos sin
// tener que acordarse de añadir cada llamada a mano en el motor principal.
// ---------------------------------------------------------------------------
export const DERIVED_METRIC_CALCULATORS: Record<string, (lookup: BiomarkerLookup) => DerivedMetricResult> = {
  LDL_C: computeLdlFriedewald,
  NON_HDL_CHOLESTEROL: computeNonHdlCholesterol,
  TC_HDL_RATIO: computeTcHdlRatio,
  BUN_CREATININE_RATIO: computeBunCreatinineRatio,
  GLOBULIN: computeGlobulin,
  ALBUMIN_GLOBULIN_RATIO: computeAlbuminGlobulinRatio,
  IRON_SATURATION: computeIronSaturation,
  HOMA_IR: computeHomaIr,
};

export function computeAllDerivedMetrics(lookup: BiomarkerLookup): DerivedMetricResult[] {
  return Object.values(DERIVED_METRIC_CALCULATORS).map((fn) => fn(lookup));
}

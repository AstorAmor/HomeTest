// Edad biológica para el motor: PhenoAge (Levine 2018), el mismo cálculo que la Edad KUOVA de la app
// (src/logic/phenoAge.ts y src/logic/kuovaAge.ts). Usa los 9 valores por canonical_id más la edad;
// si falta alguno, la unidad no sirve, la PCR pasa de 10 mg/L o la edad está fuera de 20-84 años,
// devuelve null (missingBiologicalAgeInputs dice qué valores faltan).

import { BiologicalAgeResult } from '@/types/recommendation';
import { BiomarkerLookup } from './ratios';
import {
  CRP_ACUTE_MG_L,
  PHENO_MAX_AGE,
  PHENO_MIN_AGE,
  PhenoInput,
  PhenoValues,
  phenoAge,
  phenoAgeMargin,
  toPhenoUnits,
} from '@/logic/phenoAge';

export interface BiologicalAgeInputs {
  chronologicalAge: number;
  lookup: BiomarkerLookup;
}

const CANONICAL: Record<PhenoInput, string> = {
  albumin: 'ALBUMIN',
  creatinine: 'CREATININE',
  glucose: 'GLUCOSE',
  hs_crp: 'HS_CRP',
  lymphocytes_pct: 'LYMPHOCYTES', // solo si viene en %
  mcv: 'MCV',
  rdw: 'RDW',
  alp: 'ALP',
  wbc: 'WBC_COUNT',
};

export function missingBiologicalAgeInputs(lookup: BiomarkerLookup): string[] {
  return (Object.keys(CANONICAL) as PhenoInput[])
    .filter((id) => {
      const b = lookup(CANONICAL[id]);
      return !b || toPhenoUnits(id, b.value, b.unit) == null;
    })
    .map((id) => CANONICAL[id]);
}

export function computeBiologicalAge({ chronologicalAge, lookup }: BiologicalAgeInputs): BiologicalAgeResult | null {
  if (chronologicalAge < PHENO_MIN_AGE || chronologicalAge >= PHENO_MAX_AGE + 1) return null;
  if (missingBiologicalAgeInputs(lookup).length) return null;
  const values = {} as PhenoValues;
  for (const id of Object.keys(CANONICAL) as PhenoInput[]) {
    const b = lookup(CANONICAL[id])!;
    values[id] = toPhenoUnits(id, b.value, b.unit)!;
  }
  if (values.hs_crp * 10 > CRP_ACUTE_MG_L) return null;
  const age = phenoAge(values, chronologicalAge);
  const margin = phenoAgeMargin(values);
  return {
    method: 'PhenoAge',
    chronologicalAge,
    biologicalAge: Math.round(age * 10) / 10,
    delta: Math.round((age - chronologicalAge) * 10) / 10,
    // Solo para el motor: margen (95 %) de hasta 3 años, alta; hasta 5, media; más, baja
    confidence: margin <= 3 ? 'high' : margin <= 5 ? 'medium' : 'low',
    missingInputs: [],
  };
}

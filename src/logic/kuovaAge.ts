// "Edad KUOVA": PhenoAge (src/logic/phenoAge.ts) con su margen por la variación normal de la
// analítica, en lugar de un intervalo. Solo decimos que ha cambiado entre dos analíticas cuando la
// diferencia supera ese margen. Con datos reales sale de las analíticas subidas (los 9 valores de
// una misma analítica más la fecha de nacimiento); las cuentas de prueba usan el informe de ejemplo.

import type { LabUpload } from '@/data/labUploads';
import { markerIdForExtractedName } from '@/data/markerMatching';
import {
  CRP_ACUTE_MG_L,
  PHENO_MAX_AGE,
  PHENO_MIN_AGE,
  PhenoInput,
  PhenoValues,
  phenoAge,
  phenoAgeDrivers,
  phenoAgeMargin,
  toPhenoUnits,
} from './phenoAge';

export interface KuovaAge {
  age: number; // años, con un decimal
  diff: number; // edad real - Edad KUOVA (positivo = más joven)
  margin: number; // ± años (95 %) por la variación normal de la analítica
}

const round1 = (v: number) => Math.round(v * 10) / 10;

// Informe de ejemplo: el intervalo es la Edad KUOVA ± su margen
export function kuovaAge(p: { low: number; high: number; chronological_age: number }): KuovaAge {
  const age = round1((p.low + p.high) / 2);
  return { age, diff: round1(p.chronological_age - age), margin: round1((p.high - p.low) / 2) };
}

// Cambio entre dos analíticas solo si supera el margen combinado de ambas; si no, null
export function realChange(now: KuovaAge, before: KuovaAge): number | null {
  const delta = round1(now.age - before.age);
  return Math.abs(delta) > Math.hypot(now.margin, before.margin) ? delta : null;
}

// Los 9 valores de una analítica normal que usa PhenoAge (Levine 2018), con el marker_id de los
// informes y el nombre corto que se enseña ("Mide tu albúmina y PCR…")
export const PHENOAGE_INPUTS: { id: PhenoInput; label: string }[] = [
  { id: 'albumin', label: 'albumin' },
  { id: 'creatinine', label: 'creatinine' },
  { id: 'glucose', label: 'glucose' },
  { id: 'hs_crp', label: 'CRP' },
  { id: 'lymphocytes_pct', label: '% lymphocytes' },
  { id: 'mcv', label: 'MCV' },
  { id: 'rdw', label: 'RDW' },
  { id: 'alp', label: 'alkaline phosphatase' },
  { id: 'wbc', label: 'white blood cells' },
];

// PhenoAge vale con la PCR normal, no solo la ultrasensible; los linfocitos, solo en %
function phenoInputId(nombre: string, unidad: string): PhenoInput | null {
  const id = markerIdForExtractedName(nombre);
  if (id === 'lymphocytes') return unidad.includes('%') || nombre.includes('%') ? 'lymphocytes_pct' : null;
  if (!id && /^(pcr|crp)\b|prote[ií]na c reactiva|c-reactive protein/i.test(nombre.trim())) return 'hs_crp';
  return PHENOAGE_INPUTS.find((i) => i.id === id)?.id ?? null;
}

// Un valor tal como viene en la analítica (para enseñarlo y para convertirlo)
export interface LabInput {
  value: number;
  unit: string;
  low: number | null;
  high: number | null;
}

function inputsOf(u: LabUpload): Partial<Record<PhenoInput, LabInput>> {
  const out: Partial<Record<PhenoInput, LabInput>> = {};
  for (const sec of u.data.secciones) {
    for (const p of sec.parametros) {
      if (typeof p.valor !== 'number') continue;
      const id = phenoInputId(p.nombre, p.unidad ?? '');
      if (id && !out[id]) out[id] = { value: p.valor, unit: p.unidad ?? '', low: p.rango_min, high: p.rango_max };
    }
  }
  return out;
}

const dayOf = (u: LabUpload) => u.testDate ?? u.createdAt.slice(0, 10);
const newestFirst = (uploads: LabUpload[]) => [...uploads].sort((a, b) => dayOf(b).localeCompare(dayOf(a)));

export interface PhenoAgeCoverage {
  have: PhenoInput[];
  missing: PhenoInput[];
}

// Qué valores de los 9 tiene ya la persona en sus analíticas subidas. Tienen que salir de la misma
// extracción, así que cuenta la analítica más completa (la más reciente si empatan).
export function phenoAgeCoverage(uploads: LabUpload[]): PhenoAgeCoverage {
  let best: Partial<Record<PhenoInput, LabInput>> = {};
  for (const u of newestFirst(uploads)) {
    const found = inputsOf(u);
    if (Object.keys(found).length > Object.keys(best).length) best = found;
  }
  return {
    have: PHENOAGE_INPUTS.filter((i) => best[i.id]).map((i) => i.id),
    missing: PHENOAGE_INPUTS.filter((i) => !best[i.id]).map((i) => i.id),
  };
}

export type KuovaAgeResult =
  | { status: 'missing' | 'no_dob' | 'age_range' | 'high_crp'; coverage: PhenoAgeCoverage }
  | { status: 'unit'; coverage: PhenoAgeCoverage; marker: PhenoInput }
  | {
      status: 'ok';
      coverage: PhenoAgeCoverage;
      k: KuovaAge;
      previous: KuovaAge | null; // de la analítica completa anterior, si la hay
      testDate: string;
      inputs: Record<PhenoInput, LabInput>;
      drivers: { marker_id: PhenoInput; direction: 'suma' | 'resta' }[];
    };

// Edad en años (con decimales) el día de la analítica
const ageAt = (dob: string, day: string) => (new Date(`${day}T12:00:00`).getTime() - new Date(`${dob}T12:00:00`).getTime()) / (365.25 * 86400000);

type Computed = { status: 'ok'; k: KuovaAge; values: PhenoValues } | { status: 'no_dob' | 'age_range' | 'high_crp' } | { status: 'unit'; marker: PhenoInput };

function compute(inputs: Record<PhenoInput, LabInput>, day: string, dob?: string | null): Computed {
  if (!dob) return { status: 'no_dob' };
  const age = ageAt(dob, day);
  if (age < PHENO_MIN_AGE || age >= PHENO_MAX_AGE + 1) return { status: 'age_range' };
  const values = {} as PhenoValues;
  for (const { id } of PHENOAGE_INPUTS) {
    const v = toPhenoUnits(id, inputs[id].value, inputs[id].unit);
    if (v == null) return { status: 'unit', marker: id };
    values[id] = v;
  }
  if (values.hs_crp * 10 > CRP_ACUTE_MG_L) return { status: 'high_crp' };
  const pa = phenoAge(values, age);
  return { status: 'ok', values, k: { age: round1(pa), diff: round1(age - pa), margin: round1(phenoAgeMargin(values)) } };
}

// La Edad KUOVA de una cuenta real con sus analíticas subidas: la de la analítica completa más
// reciente y, si hay otra completa antes, la de esa para comparar.
export function kuovaAgeFromUploads(uploads: LabUpload[], dob?: string | null): KuovaAgeResult {
  const coverage = phenoAgeCoverage(uploads);
  const complete = newestFirst(uploads)
    .map((u) => ({ u, inputs: inputsOf(u) }))
    .filter((x) => PHENOAGE_INPUTS.every((i) => x.inputs[i.id])) as { u: LabUpload; inputs: Record<PhenoInput, LabInput> }[];
  if (!complete.length) return { status: 'missing', coverage };
  const [latest, ...older] = complete;
  const r = compute(latest.inputs, dayOf(latest.u), dob);
  if (r.status === 'unit') return { status: 'unit', coverage, marker: r.marker };
  if (r.status !== 'ok') return { status: r.status, coverage };
  let previous: KuovaAge | null = null;
  for (const o of older) {
    const p = compute(o.inputs, dayOf(o.u), dob);
    if (p.status === 'ok') {
      previous = p.k;
      break;
    }
  }
  return {
    status: 'ok',
    coverage,
    k: r.k,
    previous,
    testDate: dayOf(latest.u),
    inputs: latest.inputs,
    drivers: phenoAgeDrivers(r.values).map(({ marker_id, direction }) => ({ marker_id, direction })),
  };
}

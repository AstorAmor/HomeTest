import { findCanonicalIdForExtractedName } from '@/knowledge/canonicalBiomarkers';

// De un nombre extraído de una analítica (texto libre, cualquier idioma) al marker_id
// de los informes HomeTest. Primero el catálogo canónico (alias curados, sin
// adivinar); después, las equivalencias canónico → marker_id que no coinciden por nombre.
// Si no hay coincidencia segura devuelve null: ese valor no se compara.

const CANONICAL_TO_MARKER: Record<string, string> = {
  LDL_C: 'ldl',
  HDL_C: 'hdl',
  WBC_COUNT: 'wbc',
  PLATELET_COUNT: 'platelets',
  IRON_BINDING_CAPACITY: 'tibc',
  IRON_SATURATION: 'transferrin_saturation',
  LIPOPROTEIN_A: 'lpa',
  T4_FREE: 'free_t4',
  TPO_AB: 'anti_tpo',
  TG_AB: 'anti_tg',
  TESTOSTERONE_TOTAL: 'total_testosterone',
  TESTOSTERONE_FREE: 'free_testosterone',
  CORTISOL: 'cortisol_am',
  RF: 'rheumatoid_factor',
  PSA_TOTAL: 'psa',
  ANA_SCREEN: 'ana',
};

export function markerIdForExtractedName(name: string): string | null {
  // "GPT (ALT)" → prueba el nombre entero, lo de dentro del paréntesis y lo de fuera.
  const inner = name.match(/\(([^)]+)\)/)?.[1];
  const outer = name.replace(/\([^)]*\)/g, '').trim();
  for (const candidate of [name, inner, outer]) {
    if (!candidate) continue;
    const canonical = findCanonicalIdForExtractedName(candidate);
    if (canonical) return CANONICAL_TO_MARKER[canonical] ?? canonical.toLowerCase();
  }
  return null;
}

// Las unidades solo se comparan si son la misma o una equivalencia exacta
// (µUI/mL = mUI/L, ng/mL = µg/L, pg/mL = ng/L, U/L = UI/L). mg/dL y mmol/L NO.
const EQUIVALENT_UNITS = [
  ['uiu/ml', 'uui/ml', 'miu/l', 'mui/l', 'mu/l'],
  ['ng/ml', 'ug/l'],
  ['pg/ml', 'ng/l'],
  ['u/l', 'ui/l', 'iu/l'],
  ['%', '%'],
];
const normUnit = (u?: string | null) => (u ?? '').toLowerCase().replace(/\s+/g, '').replace(/µ|μ/g, 'u');
export const sameUnit = (a?: string | null, b?: string | null) => {
  const x = normUnit(a);
  const y = normUnit(b);
  return x === y || EQUIVALENT_UNITS.some((g) => g.includes(x) && g.includes(y));
};

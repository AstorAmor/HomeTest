import { normalizeName } from './normalizeName';

interface ConversionEntry {
  unitA: string;
  unitB: string;
  factorAtoB: number; // valor_en_unitA * factorAtoB = valor_en_unitB
}

// Factores de conversión clínicos estándar (unidad convencional <-> unidad SI).
// Ampliar esta tabla según aparezcan nuevos parámetros en analíticas reales.
const CONVERSIONS: Record<string, ConversionEntry> = {
  glucosa: { unitA: 'mg/dL', unitB: 'mmol/L', factorAtoB: 0.0555 },
  colesterol_total: { unitA: 'mg/dL', unitB: 'mmol/L', factorAtoB: 0.02586 },
  colesterol_hdl: { unitA: 'mg/dL', unitB: 'mmol/L', factorAtoB: 0.02586 },
  colesterol_ldl: { unitA: 'mg/dL', unitB: 'mmol/L', factorAtoB: 0.02586 },
  trigliceridos: { unitA: 'mg/dL', unitB: 'mmol/L', factorAtoB: 0.0113 },
  creatinina: { unitA: 'mg/dL', unitB: 'µmol/L', factorAtoB: 88.4 },
  urea: { unitA: 'mg/dL', unitB: 'mmol/L', factorAtoB: 0.1665 },
  bun: { unitA: 'mg/dL', unitB: 'mmol/L', factorAtoB: 0.357 },
  bilirrubina_total: { unitA: 'mg/dL', unitB: 'µmol/L', factorAtoB: 17.1 },
  bilirrubina_directa: { unitA: 'mg/dL', unitB: 'µmol/L', factorAtoB: 17.1 },
  calcio: { unitA: 'mg/dL', unitB: 'mmol/L', factorAtoB: 0.2495 },
  acido_urico: { unitA: 'mg/dL', unitB: 'µmol/L', factorAtoB: 59.48 },
  hierro: { unitA: 'µg/dL', unitB: 'µmol/L', factorAtoB: 0.1791 },
  hemoglobina: { unitA: 'g/dL', unitB: 'g/L', factorAtoB: 10 },
  albumina: { unitA: 'g/dL', unitB: 'g/L', factorAtoB: 10 },
  proteinas_totales: { unitA: 'g/dL', unitB: 'g/L', factorAtoB: 10 },
  magnesio: { unitA: 'mg/dL', unitB: 'mmol/L', factorAtoB: 0.4114 },
  fosforo: { unitA: 'mg/dL', unitB: 'mmol/L', factorAtoB: 0.3229 },
  sodio: { unitA: 'mEq/L', unitB: 'mmol/L', factorAtoB: 1 },
  potasio: { unitA: 'mEq/L', unitB: 'mmol/L', factorAtoB: 1 },
  cloro: { unitA: 'mEq/L', unitB: 'mmol/L', factorAtoB: 1 },
};

function normalizeUnit(unit: string): string {
  return unit.toLowerCase().replace(/\s+/g, '');
}

interface AlternateUnitResult {
  unit: string;
  factor: number; // multiplicar el valor original por este factor da el valor en `unit`
}

export function getAlternateUnit(
  parametroNombre: string,
  unidadActual: string
): AlternateUnitResult | null {
  const entry = CONVERSIONS[normalizeName(parametroNombre)];
  if (!entry) return null;

  const current = normalizeUnit(unidadActual);
  if (current === normalizeUnit(entry.unitA)) {
    return { unit: entry.unitB, factor: entry.factorAtoB };
  }
  if (current === normalizeUnit(entry.unitB)) {
    return { unit: entry.unitA, factor: 1 / entry.factorAtoB };
  }
  return null;
}

export function convertValue(valor: number, factor: number): number {
  return valor * factor;
}

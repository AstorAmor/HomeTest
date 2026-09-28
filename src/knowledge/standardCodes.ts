import standardCodes from '../../knowledge/mapping/standard-codes.json';

// Códigos estándar para interoperabilidad (exportación HL7 FHIR hacia los sistemas
// de los profesionales): LOINC identifica la prueba y UCUM la unidad. Cada código
// se validó contra el servidor terminológico de HL7 (ver standard-codes.json).

export interface StandardCode {
  loinc: string | null;
  loinc_display: string | null;
  ucum: string | null;
  note?: string;
}

export const LOINC_SYSTEM = 'http://loinc.org';
export const UCUM_SYSTEM = 'http://unitsofmeasure.org';

const BIOMARKERS = standardCodes.biomarkers as Record<string, StandardCode>;
const APP_METRICS = standardCodes.app_metrics as Record<string, StandardCode>;
const UNITS = standardCodes.units_to_ucum as Record<string, string>;

// Códigos de un biomarcador del catálogo (canonical_id), o null si está pendiente.
export const getBiomarkerCodes = (canonicalId: string): StandardCode | null => BIOMARKERS[canonicalId] ?? null;

// Códigos de las métricas que registra la app (glucómetro, tensión, wearables...).
export const getAppMetricCodes = (metric: string): StandardCode | null => APP_METRICS[metric] ?? null;

// Unidad tal como aparece en un informe → código UCUM (null si no se reconoce).
export function toUcum(unit: string | null | undefined): string | null {
  if (!unit) return null;
  const trimmed = unit.trim();
  return UNITS[trimmed] ?? UNITS[trimmed.replace(/\s+/g, '')] ?? null;
}

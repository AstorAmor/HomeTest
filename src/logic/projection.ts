// Forma de la proyección de un marcador hasta la próxima analítica (6 meses).
//
// Un marcador no se mueve en línea recta cuando cambias un hábito: casi todos
// cambian rápido al principio y luego se estabilizan (curva exponencial que se
// aplana), y algunos tardan en arrancar porque el hábito necesita unas semanas
// para notarse (curva en S). Aquí se define, por marcador, qué forma sigue y en
// qué plazo, y se calcula la curva (valor esperado + banda de incertidumbre)
// que dibujan la pantalla del plan (ProjectionChart) y el PDF (planPdf).
//
// ⚠ Plazos orientativos sacados de la fisiología general de cada marcador
// (vida media, recambio de glóbulos rojos…). PENDIENTE DE VALIDACIÓN CLÍNICA,
// como el resto de rangos del motor de recomendaciones.

export type ResponseShape = 'linear' | 'exponential' | 'sigmoid';

export interface ResponseProfile {
  shape: ResponseShape;
  // exponential: constante de tiempo en meses (al cabo de tau se ha hecho ~63%
  // del cambio, a 3·tau ~95%). sigmoid: mes en el que va por la mitad.
  months: number;
  // sigmoid: pendiente de la S (por mes). Cuanto mayor, más brusco el arranque.
  steepness?: number;
  note?: string; // una línea para el usuario: cuándo se espera ver el cambio
}

export const HORIZON_MONTHS = 6;

const DEFAULT_PROFILE: ResponseProfile = { shape: 'exponential', months: 2 };

export const RESPONSE_PROFILES: Record<string, ResponseProfile> = {
  vitamin_d: {
    shape: 'exponential',
    months: 1,
    note: 'Vitamin D rises over the first 2–3 months of supplementation, then levels off.',
  },
  triglycerides: {
    shape: 'exponential',
    months: 0.7,
    note: 'Triglycerides respond within weeks: most of the change shows in the first 2 months.',
  },
  glucose: {
    shape: 'exponential',
    months: 0.7,
    note: 'Fasting glucose responds within weeks of a steady change in habits.',
  },
  hba1c: {
    shape: 'exponential',
    months: 1.5,
    note: 'HbA1c reflects about 3 months of blood sugar, so it shifts gradually and settles after 3–4 months.',
  },
  homa_ir: {
    shape: 'sigmoid',
    months: 2,
    steepness: 1.6,
    note: 'Insulin sensitivity improves once training is a routine (after 4–6 weeks), then levels off.',
  },
  insulin: { shape: 'sigmoid', months: 2, steepness: 1.6 },
  ferritin: {
    shape: 'exponential',
    months: 4,
    note: 'Iron stores refill slowly, so ferritin climbs steadily over several months.',
  },
  ldl: {
    shape: 'exponential',
    months: 1,
    note: 'LDL responds to diet within 4–6 weeks, then holds steady.',
  },
  total_cholesterol: { shape: 'exponential', months: 1 },
  non_hdl_cholesterol: { shape: 'exponential', months: 1 },
  apob: { shape: 'exponential', months: 1 },
  hdl: {
    shape: 'exponential',
    months: 3,
    note: 'HDL changes slowly with exercise, over several months.',
  },
  vitamin_b12: {
    shape: 'exponential',
    months: 1,
    note: 'B12 rises within weeks of supplementation, then levels off.',
  },
  hs_crp: {
    shape: 'exponential',
    months: 1,
    note: 'Inflammation markers can drop within weeks once the cause is addressed.',
  },
};

export function getResponseProfile(markerId: string): ResponseProfile {
  return RESPONSE_PROFILES[markerId] ?? DEFAULT_PROFILE;
}

// Fracción del cambio total ya ocurrida en el mes `month` (0 → 0, horizonte → 1).
export function responseFraction(month: number, profile: ResponseProfile, horizon = HORIZON_MONTHS): number {
  const t = Math.min(Math.max(month, 0), horizon);
  if (profile.shape === 'linear' || profile.months <= 0) return t / horizon;
  if (profile.shape === 'exponential') {
    const f = (x: number) => 1 - Math.exp(-x / profile.months);
    return f(t) / f(horizon);
  }
  const k = profile.steepness ?? 1.5;
  const logistic = (x: number) => 1 / (1 + Math.exp(-k * (x - profile.months)));
  return (logistic(t) - logistic(0)) / (logistic(horizon) - logistic(0));
}

export interface ProjectionPoint {
  month: number;
  expected: number;
  low: number;
  high: number;
}

export interface ProjectionInput {
  markerId: string;
  currentValue: number;
  expectedValue: number; // a los 6 meses
  rangeLow: number;
  rangeHigh: number;
}

// La banda sale del valor medido (sin incertidumbre en el mes 0) y se abre con la
// misma forma que la curva hasta [rangeLow, rangeHigh] en el horizonte.
export function projectionCurve(input: ProjectionInput, samples = 25): ProjectionPoint[] {
  const profile = getResponseProfile(input.markerId);
  const points: ProjectionPoint[] = [];
  for (let i = 0; i < samples; i++) {
    const month = (i / (samples - 1)) * HORIZON_MONTHS;
    const f = responseFraction(month, profile);
    const at = (target: number) => input.currentValue + (target - input.currentValue) * f;
    points.push({ month, expected: at(input.expectedValue), low: at(input.rangeLow), high: at(input.rangeHigh) });
  }
  return points;
}

// Margen vertical de la gráfica: proporcional al cambio, para que en marcadores de
// valores pequeños (HbA1c 5.4 → 5.2, HOMA-IR 2.2 → 1.7) la curva no salga plana.
export function axisPadding(min: number, max: number): number {
  const span = max - min;
  if (span > 0) return Math.max(span * 0.15, Math.abs(max) * 0.01);
  return Math.max(Math.abs(max) * 0.05, 0.5);
}

// Etiqueta del eje Y con los decimales justos para que se distingan los extremos.
export function axisLabel(value: number, span: number): string {
  const decimals = span >= 10 ? 0 : span >= 1 ? 1 : 2;
  return value.toFixed(decimals);
}

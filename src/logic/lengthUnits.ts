// Centímetros o pulgadas en las medidas con cinta (fundador, 2026-11-16: «quiero que puedas cambiar las unidades
// (inch - cm)»). Lógica pura para la app y los tests. Lo apuntado se guarda SIEMPRE en cm (metric_readings,
// `tape_<id>`): la unidad solo cambia cómo se escribe y cómo se enseña. Los pliegues siguen en mm (nunca en
// pulgadas) y cintura / altura no tiene unidad (se calcula siempre con los cm guardados).
import type { MeasureSite, SeriesPoint } from './bodyMeasures';

export type LengthUnit = 'cm' | 'in';
export const LENGTH_UNITS: readonly LengthUnit[] = ['cm', 'in'];
export const CM_PER_INCH = 2.54;

export const isLengthUnit = (v: unknown): v is LengthUnit => v === 'cm' || v === 'in';

// Un decimal, sin «−0» (que con el signo saldría «−0 in»)
const round1 = (v: number) => Math.round(v * 10) / 10 || 0;

// «82,5» o «82.5» → número (sin redondear ni comprobar nada); null si está vacío o no es un número
function readNumber(raw: string): number | null {
  const clean = raw.replace(',', '.').trim();
  if (!clean) return null;
  const v = Number(clean);
  return Number.isFinite(v) ? v : null;
}

// Los cm guardados, en la unidad elegida y con un decimal
export const lengthFromCm = (cm: number, unit: LengthUnit): number => round1(unit === 'in' ? cm / CM_PER_INCH : cm);

// Lo escrito en la unidad elegida → cm con un decimal (lo que se guarda), dentro de lo posible para ese sitio
// (sus min / max van en cm); null si está vacío o no cuadra. Con cm, igual que parseMeasure
export function parseLength(site: Pick<MeasureSite, 'min' | 'max'>, raw: string, unit: LengthUnit): number | null {
  const v = readNumber(raw);
  if (v == null) return null;
  if (unit === 'cm') return v < site.min || v > site.max ? null : round1(v);
  const cm = round1(v * CM_PER_INCH);
  return cm < site.min || cm > site.max ? null : cm;
}

// Lo escrito en una unidad, pasado a la otra con un decimal (al cambiar la unidad con medidas ya escritas);
// null si no es un número (entonces se deja el texto tal cual). No comprueba lo posible: un valor que no cuadra
// se pasa igual y sigue marcado
export function convertTyped(raw: string, from: LengthUnit, to: LengthUnit): number | null {
  const v = readNumber(raw);
  if (v == null) return null;
  if (from === to) return v;
  return round1(to === 'in' ? v / CM_PER_INCH : v * CM_PER_INCH);
}

// El cambio entre dos medidas guardadas (en cm) en la unidad elegida: la resta de las dos cifras que se enseñan,
// para que cuadre con ellas (en pulgadas, 34,6 → 33,3 es −1,3)
export const lengthDelta = (latestCm: number, previousCm: number, unit: LengthUnit): number =>
  round1(lengthFromCm(latestCm, unit) - lengthFromCm(previousCm, unit));

// Una serie en cm, en la unidad elegida (cada punto con un decimal, como se enseña)
export const seriesInUnit = (series: SeriesPoint[], unit: LengthUnit): SeriesPoint[] =>
  unit === 'cm' ? series : series.map((p) => ({ ...p, valor: lengthFromCm(p.valor, unit) }));

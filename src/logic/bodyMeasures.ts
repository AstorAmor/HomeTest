// Medidas del cuerpo en Peso (fundador, 2026-11-16: «además de composición corporal pongamos lo de "medidas" y
// ahí podemos incluir lo que hablábamos de la figura»): perímetros con cinta métrica y pliegues con pinza de
// grasa. Lógica pura (sin React Native) para la app y los tests: los sitios, el zoom a su zona, el resumen y la
// evolución de lo apuntado y las dos cuentas que salen de ahí (grasa estimada por pliegues y cintura / altura).
// Dónde va cada sitio en la figura (que es una imagen, de hombre o de mujer) está en src/logic/bodyFigure.ts.
// Cada sitio se guarda en metric_readings con su propio `kind` (columna de texto libre, sin check: no hace falta
// migración), como el peso y la composición corporal. Las medidas de una misma vez comparten fecha y el id
// base: `${sesión}-${kind}`.

export type MeasureTool = 'tape' | 'fold';
export type TapeId = 'neck' | 'chest' | 'waist' | 'hip' | 'arm' | 'thigh' | 'calf';
export type FoldId = 'chest' | 'triceps' | 'biceps' | 'subscapular' | 'suprailiac' | 'abdominal' | 'thigh';

// A dónde se acerca la figura: el punto que queda en el centro y cuánto se amplía
export interface Zone {
  x: number;
  y: number;
  zoom: number;
}
// Cinta: una vuelta horizontal alrededor del cuerpo (centro y media anchura)
export interface TapeMark {
  x: number;
  y: number;
  half: number;
}
// Pinza: el pliegue en un punto, con su dirección en grados (0 horizontal, 90 vertical). Los que se toman por
// detrás van en la figura de espaldas (sideOf). Las cifras de cada figura, en bodyFigure.ts
export interface FoldMark {
  x: number;
  y: number;
  angle: number;
}

interface SiteBase {
  kind: string; // metric_readings.kind
  label: string; // clave en inglés para t()
  hint: string; // cómo se mide
  min: number;
  max: number;
}
export interface TapeSite extends SiteBase {
  tool: 'tape';
  id: TapeId;
  unit: 'cm';
}
export interface FoldSite extends SiteBase {
  tool: 'fold';
  id: FoldId;
  unit: 'mm';
}
export type MeasureSite = TapeSite | FoldSite;

const tape = (id: TapeId, label: string, hint: string, min: number, max: number): TapeSite => ({
  tool: 'tape',
  id,
  kind: `tape_${id}`,
  label,
  hint,
  unit: 'cm',
  min,
  max,
});

const fold = (id: FoldId, label: string, hint: string): FoldSite => ({
  tool: 'fold',
  id,
  kind: `skinfold_${id}`,
  label,
  hint,
  unit: 'mm',
  min: 2,
  max: 80,
});

// Perímetros con cinta métrica. El brazo, el muslo y la pantorrilla se marcan en un lado de la figura
export const TAPE_SITES: TapeSite[] = [
  tape('neck', 'Neck', 'Just below the Adam’s apple, with the tape level all the way round.', 20, 70),
  tape('chest', 'Chest', 'Across the nipples, after breathing out normally.', 50, 200),
  tape('waist', 'Waist', 'Halfway between your lowest rib and the top of your hip bone, after breathing out.', 40, 200),
  tape('hip', 'Hips', 'Around the widest part of your buttocks, feet together.', 50, 200),
  tape('arm', 'Arm', 'Upper arm, halfway between shoulder and elbow, with the arm relaxed.', 15, 70),
  tape('thigh', 'Thigh', 'Halfway between the hip crease and the kneecap, standing.', 25, 110),
  tape('calf', 'Calf', 'Around the widest part of the calf, standing.', 20, 70),
];

// Pliegues con pinza (los de los protocolos habituales, p. ej. Jackson-Pollock). En la figura, el tríceps, el
// subescapular y el muslo van en el otro lado para que no se monten las marcas
export const FOLD_SITES: FoldSite[] = [
  fold('chest', 'Pectoral', 'Diagonal fold halfway between the armpit and the nipple (a third of the way from the armpit in women).'),
  fold('triceps', 'Triceps', 'Vertical fold on the back of the arm, halfway between shoulder and elbow.'),
  fold('biceps', 'Biceps', 'Vertical fold on the front of the arm, at the same height as the triceps one.'),
  fold('subscapular', 'Subscapular', 'Diagonal fold just below the tip of the shoulder blade. Someone else has to take it.'),
  fold('suprailiac', 'Suprailiac', 'Diagonal fold just above the front of the hip bone.'),
  fold('abdominal', 'Abdominal', 'Vertical fold about 2 cm to the side of the navel.'),
  fold('thigh', 'Thigh', 'Vertical fold on the front of the thigh, halfway between the hip crease and the knee.'),
];

export const MEASURE_SITES: MeasureSite[] = [...TAPE_SITES, ...FOLD_SITES];
export const sitesOf = (tool: MeasureTool): MeasureSite[] => (tool === 'tape' ? TAPE_SITES : FOLD_SITES);
export const siteByKind = (kind: string) => MEASURE_SITES.find((s) => s.kind === kind);

// Texto escrito («82,5» o «82.5») → número dentro de lo posible para ese sitio, con un decimal; null si está vacío
// o no cuadra
export function parseMeasure(site: Pick<MeasureSite, 'min' | 'max'>, raw: string): number | null {
  const clean = raw.replace(',', '.').trim();
  if (!clean) return null;
  const v = Number(clean);
  if (!Number.isFinite(v) || v < site.min || v > site.max) return null;
  return Math.round(v * 10) / 10;
}

// --- El zoom de la figura -------------------------------------------------------------------------------------
// La figura (`fig`, en sus píxeles) ocupa una caja de `w` × `h` px (ajustada sin deformar y centrada). Para acercarse a una zona se escala
// `scale` veces alrededor del centro de la caja y luego se desplaza (x, y) px, de modo que el punto de la zona
// quede en el centro: p' = centro + t + k·(p − centro) = centro  ⇒  t = k·(centro − p).
export interface FocusTransform {
  scale: number;
  x: number;
  y: number;
}

export function focusTransform(zone: Zone | null, box: { w: number; h: number }, fig: { w: number; h: number }): FocusTransform {
  if (!zone || box.w <= 0 || box.h <= 0) return { scale: 1, x: 0, y: 0 };
  const s0 = Math.min(box.w / fig.w, box.h / fig.h);
  const px = (box.w - fig.w * s0) / 2 + zone.x * s0;
  const py = (box.h - fig.h * s0) / 2 + zone.y * s0;
  const round = (v: number) => Math.round(v * 10) / 10;
  return { scale: zone.zoom, x: round(zone.zoom * (box.w / 2 - px)), y: round(zone.zoom * (box.h / 2 - py)) };
}

// --- Lo apuntado ------------------------------------------------------------------------------------------------
export interface MeasureReading {
  valor: number;
  fecha: string;
  createdAt?: string;
}
export type MeasureReadings = Partial<Record<string, MeasureReading[]>>; // por kind

const newestFirst = (a: MeasureReading, b: MeasureReading) => b.fecha.localeCompare(a.fecha) || (b.createdAt ?? '').localeCompare(a.createdAt ?? '');

export interface SiteSummary {
  site: MeasureSite;
  latest: MeasureReading;
  previous: MeasureReading | null;
  delta: number | null; // lo último menos lo anterior, con un decimal
}

// La última de cada sitio y cuánto ha cambiado desde la anterior, en el orden de los sitios
export function summarize(readings: MeasureReadings, tool?: MeasureTool): SiteSummary[] {
  const out: SiteSummary[] = [];
  for (const site of tool ? sitesOf(tool) : MEASURE_SITES) {
    const list = [...(readings[site.kind] ?? [])].sort(newestFirst);
    if (!list.length) continue;
    const [latest, previous = null] = list;
    out.push({ site, latest, previous, delta: previous ? Math.round((latest.valor - previous.valor) * 10) / 10 : null });
  }
  return out;
}

// La última vez en que se apuntaron todos estos sitios a la vez (misma fecha), con sus valores
export function latestComplete(readings: MeasureReadings, kinds: string[]): { fecha: string; values: Record<string, number> } | null {
  if (!kinds.length) return null;
  const dates = [...(readings[kinds[0]] ?? [])].sort(newestFirst).map((r) => r.fecha);
  for (const fecha of dates) {
    const values: Record<string, number> = {};
    for (const k of kinds) {
      const r = (readings[k] ?? []).find((x) => x.fecha === fecha);
      if (!r) break;
      values[k] = r.valor;
    }
    if (Object.keys(values).length === kinds.length) return { fecha, values };
  }
  return null;
}

// --- La evolución (Peso → Medidas → Ver evolución) ----------------------------------------------------------------
export interface SeriesPoint {
  fecha: string;
  valor: number;
}

const oldestFirst = (a: SeriesPoint, b: SeriesPoint) => a.fecha.localeCompare(b.fecha);

// Lo apuntado de un sitio, de lo más antiguo a lo más reciente (si hay dos el mismo día, la última que se apuntó)
export function siteSeries(readings: MeasureReadings, kind: string): SeriesPoint[] {
  const byDay = new Map<string, MeasureReading>();
  for (const r of [...(readings[kind] ?? [])].sort((a, b) => -newestFirst(a, b))) byDay.set(r.fecha.slice(0, 10), r);
  return [...byDay.values()].map((r) => ({ fecha: r.fecha, valor: r.valor })).sort(oldestFirst);
}

// El cambio entre la primera y la última, con los decimales que se pidan; null con menos de dos
export function seriesChange(series: SeriesPoint[], decimals = 1): { first: SeriesPoint; last: SeriesPoint; delta: number } | null {
  if (series.length < 2) return null;
  const first = series[0];
  const last = series[series.length - 1];
  const f = 10 ** decimals;
  return { first, last, delta: Math.round((last.valor - first.valor) * f) / f };
}

// Cada vez con su cambio respecto a la anterior (para la lista de la evolución, de lo más reciente a lo antiguo)
export function withSteps(series: SeriesPoint[], decimals = 1): (SeriesPoint & { step: number | null })[] {
  const f = 10 ** decimals;
  return series
    .map((p, i) => ({ ...p, step: i ? Math.round((p.valor - series[i - 1].valor) * f) / f : null }))
    .reverse();
}

// Grasa estimada en cada fecha en que se tomaron los tres pliegues de su sexo. Con la edad de ahora: para
// comparar unas semanas o meses entre sí, la diferencia de edad apenas mueve la cifra (SUPUESTO de abajo)
export function fatSeries(readings: MeasureReadings, sex: string | undefined, age: number | null | undefined): SeriesPoint[] {
  if (sex !== 'male' && sex !== 'female') return [];
  const sites = jp3Sites(sex);
  const series = sites.map((id) => siteSeries(readings, `skinfold_${id}`));
  const out: SeriesPoint[] = [];
  for (const p of series[0]) {
    const day = p.fecha.slice(0, 10);
    const others = series.slice(1).map((s) => s.find((x) => x.fecha.slice(0, 10) === day));
    if (others.some((x) => !x)) continue;
    const pct = jp3BodyFat(sex, age, p.valor + others.reduce((a, x) => a + x!.valor, 0));
    if (pct != null) out.push({ fecha: p.fecha, valor: pct });
  }
  return out;
}

// Cintura / altura en cada cintura apuntada, con la altura del perfil
export function whtrSeries(readings: MeasureReadings, heightCm: number | null | undefined): SeriesPoint[] {
  return siteSeries(readings, 'tape_waist')
    .map((p) => ({ fecha: p.fecha, valor: waistToHeight(p.valor, heightCm) }))
    .filter((p): p is SeriesPoint => p.valor != null);
}

// --- Grasa estimada por pliegues (Jackson-Pollock de 3 pliegues + Siri) ----------------------------------------
// SUPUESTO (pendiente de revisión clínica): ecuaciones de Jackson y Pollock (1978) y Jackson, Pollock y Ward
// (1980) para la densidad corporal con 3 pliegues, y Siri (1961) para pasarla a % de grasa. Validadas en adultos
// (aprox. 18-61 años hombres y 18-55 mujeres); dependen mucho de quién mide y cómo. Por eso se enseña como
// estimación para comparar entre mediciones hechas igual, no como un valor de referencia, y solo con sexo
// masculino o femenino en el perfil (son ecuaciones por sexo) y 18 años o más.
export type Jp3Sex = 'male' | 'female';

export const jp3Sites = (sex: Jp3Sex): FoldId[] => (sex === 'male' ? ['chest', 'abdominal', 'thigh'] : ['triceps', 'suprailiac', 'thigh']);
export const jp3Kinds = (sex: Jp3Sex): string[] => jp3Sites(sex).map((id) => `skinfold_${id}`);

export function bodyDensityJp3(sex: Jp3Sex, age: number, sumMm: number): number {
  const s = sumMm;
  return sex === 'male'
    ? 1.10938 - 0.0008267 * s + 0.0000016 * s * s - 0.0002574 * age
    : 1.0994921 - 0.0009929 * s + 0.0000023 * s * s - 0.0001392 * age;
}

// % de grasa (Siri) con un decimal, o null si falta algo o sale algo imposible
export function jp3BodyFat(sex: Jp3Sex, age: number | null | undefined, sumMm: number): number | null {
  if (age == null || !Number.isFinite(age) || age < 18 || !(sumMm > 0)) return null;
  const pct = 495 / bodyDensityJp3(sex, age, sumMm) - 450;
  if (!Number.isFinite(pct) || pct < 2 || pct > 60) return null;
  return Math.round(pct * 10) / 10;
}

export type FoldEstimate =
  | { kind: 'ok'; pct: number; sum: number }
  | { kind: 'missing'; sites: FoldId[] } // faltan pliegues de los 3
  | { kind: 'needs_profile' }; // sin sexo masculino/femenino o sin edad (o menor de 18)

// Con los pliegues de una vez (por id de sitio): la estimación, lo que falta o que hace falta el perfil
export function foldEstimate(sex: string | undefined, age: number | null | undefined, folds: Partial<Record<FoldId, number>>): FoldEstimate {
  if (sex !== 'male' && sex !== 'female') return { kind: 'needs_profile' };
  const sites = jp3Sites(sex);
  const missing = sites.filter((id) => !(folds[id]! > 0));
  if (missing.length) return { kind: 'missing', sites: missing };
  const sum = Math.round(sites.reduce((a, id) => a + folds[id]!, 0) * 10) / 10;
  const pct = jp3BodyFat(sex, age, sum);
  return pct == null ? { kind: 'needs_profile' } : { kind: 'ok', pct, sum };
}

// --- Cintura / altura ------------------------------------------------------------------------------------------
// SUPUESTO (pendiente de revisión clínica): se enseña el cociente con dos decimales y, como referencia, que se
// suele aconsejar una cintura de menos de la mitad de la altura (NICE 2022). Sin colores ni avisos.
export function waistToHeight(waistCm: number | null | undefined, heightCm: number | null | undefined): number | null {
  if (!waistCm || !heightCm || heightCm < 100 || heightCm > 250 || waistCm < 40 || waistCm > 200) return null;
  return Math.round((waistCm / heightCm) * 100) / 100;
}

// Composición corporal a partir de las medidas (fundador, 2026-11-16: «¿puedes incluir las dimensiones para
// calcular la composición corporal…? rollo que puedas sobreescribirla, pero que sirvan»). Lógica pura (sin React
// Native) para la app y los tests:
// - la grasa estimada con la cinta métrica (cuello, cintura, cadera en mujeres, y la altura del perfil);
// - cuál de las cifras de grasa manda: la que se escribe de la báscula, la de los pliegues o la de la cinta;
// - el reparto del peso en grasa y masa sin grasa para el donut de «Composición corporal»;
// - los datos de ejemplo de la demo (altura y persona) cuando el perfil está a medias.
// La grasa estimada por pliegues (Jackson-Pollock) y cintura / altura siguen en bodyMeasures.ts.
import { fatSeries, siteSeries, type MeasureReadings, type SeriesPoint, type TapeId } from './bodyMeasures';

const round1 = (v: number) => Math.round(v * 10) / 10;
const dayOf = (iso: string) => iso.slice(0, 10); // el día de calendario, como en bodyMeasures.ts

// --- Grasa estimada con la cinta métrica (método de la Marina de EE. UU.) ---------------------------------------
// SUPUESTO (pendiente de revisión clínica): ecuaciones de perímetros de Hodgdon y Beckett (1984, Naval Health
// Research Center), en centímetros y con logaritmos en base 10, que dan la densidad corporal y se pasan a % de
// grasa con Siri (495 / densidad − 450). Hombres: cintura − cuello y altura. Mujeres: cintura + cadera − cuello y
// altura. El protocolo de la Marina mide la cintura de los hombres a la altura del ombligo (y la de las mujeres
// en el punto más estrecho); la app la mide a medio camino entre la última costilla y el hueso de la cadera
// (TAPE_SITES), así que la cifra puede desviarse algo de la del protocolo. Por eso se enseña como estimación para
// comparar entre mediciones hechas igual, no como un valor de referencia, y solo con sexo masculino o femenino en
// el perfil (son ecuaciones por sexo). Se hicieron con adultos (personal de la Marina): no hay corrección por edad.
export type NavySex = 'male' | 'female';

export const navySites = (sex: NavySex): TapeId[] => (sex === 'male' ? ['neck', 'waist'] : ['neck', 'waist', 'hip']);
export const navyKinds = (sex: NavySex): string[] => navySites(sex).map((id) => `tape_${id}`);

const isNavySex = (sex: string | undefined): sex is NavySex => sex === 'male' || sex === 'female';
const heightOk = (cm: number | null | undefined): cm is number => cm != null && Number.isFinite(cm) && cm >= 100 && cm <= 250;

export type TapeValues = Partial<Record<TapeId, number | null>>;

// % de grasa con un decimal, o null si falta algo o sale algo imposible (cintura que no pasa del cuello, altura
// fuera de 100-250 cm, resultado fuera de 2-60 %)
export function navyBodyFat(sex: string | undefined, heightCm: number | null | undefined, tape: Pick<TapeValues, 'neck' | 'waist' | 'hip'>): number | null {
  if (!isNavySex(sex) || !heightOk(heightCm)) return null;
  const neck = tape.neck ?? 0;
  const waist = tape.waist ?? 0;
  const hip = tape.hip ?? 0;
  if (!(neck > 0) || !(waist > neck)) return null;
  if (sex === 'female' && !(hip > 0)) return null;
  const density =
    sex === 'male'
      ? 1.0324 - 0.19077 * Math.log10(waist - neck) + 0.15456 * Math.log10(heightCm)
      : 1.29579 - 0.35004 * Math.log10(waist + hip - neck) + 0.221 * Math.log10(heightCm);
  const pct = 495 / density - 450;
  if (!Number.isFinite(pct) || pct < 2 || pct > 60) return null;
  return round1(pct);
}

export type TapeFatEstimate =
  | { kind: 'ok'; pct: number }
  | { kind: 'missing'; sites: TapeId[] } // faltan medidas de cinta de las que usa la fórmula
  | { kind: 'needs_profile' } // sin sexo masculino/femenino o sin altura en el perfil
  | { kind: 'out_of_range' }; // con todo relleno, la fórmula no da una cifra posible

// Con las medidas de cinta de una vez (por id de sitio, en cm): la estimación, lo que falta o que hace falta el
// perfil. Como foldEstimate, pero mirando antes el perfil: sin altura no sirve de nada pedir más medidas
export function tapeFatEstimate(sex: string | undefined, heightCm: number | null | undefined, tape: TapeValues): TapeFatEstimate {
  if (!isNavySex(sex) || !heightOk(heightCm)) return { kind: 'needs_profile' };
  const missing = navySites(sex).filter((id) => !((tape[id] ?? 0) > 0));
  if (missing.length) return { kind: 'missing', sites: missing };
  const pct = navyBodyFat(sex, heightCm, tape);
  return pct == null ? { kind: 'out_of_range' } : { kind: 'ok', pct };
}

// Grasa estimada con la cinta en cada día en que se midieron todos los sitios que usa la fórmula, con la altura
// de ahora (como fatSeries con los pliegues)
export function tapeFatSeries(readings: MeasureReadings, sex: string | undefined, heightCm: number | null | undefined): SeriesPoint[] {
  if (!isNavySex(sex) || !heightOk(heightCm)) return [];
  const sites = navySites(sex);
  const series = sites.map((id) => siteSeries(readings, `tape_${id}`));
  const out: SeriesPoint[] = [];
  for (const p of series[0]) {
    const day = dayOf(p.fecha);
    const sameDay = series.map((s) => s.find((x) => dayOf(x.fecha) === day));
    if (sameDay.some((x) => !x)) continue;
    const pct = navyBodyFat(sex, heightCm, Object.fromEntries(sites.map((id, i) => [id, sameDay[i]!.valor])));
    if (pct != null) out.push({ fecha: p.fecha, valor: pct });
  }
  return out;
}

// --- Qué cifra de grasa manda -----------------------------------------------------------------------------------
// La regla de «sobreescribir» del fundador: gana la del día de calendario más reciente y, si son del mismo día,
// la que se escribe de la báscula antes que la de los pliegues, y la de los pliegues antes que la de la cinta.
// Así, lo que el usuario apunta de su báscula al pesarse sustituye a la estimación, y una medición nueva con
// pinza o cinta vuelve a contar cuando es posterior a esa pesada.
export type BodyFatSource = 'scale' | 'folds' | 'tape';
export interface BodyFatCandidate {
  pct: number;
  fecha: string; // ISO
  source: BodyFatSource;
}

const SOURCE_RANK: Record<BodyFatSource, number> = { scale: 3, folds: 2, tape: 1 };

export function pickBodyFat(candidates: (BodyFatCandidate | null | undefined)[]): BodyFatCandidate | null {
  let best: BodyFatCandidate | null = null;
  for (const c of candidates) {
    if (!c || !Number.isFinite(c.pct) || !c.fecha) continue;
    if (!best) {
      best = c;
      continue;
    }
    const byDay = dayOf(c.fecha).localeCompare(dayOf(best.fecha));
    const byRank = SOURCE_RANK[c.source] - SOURCE_RANK[best.source];
    // Mismo día y misma fuente: la de más tarde
    if (byDay > 0 || (byDay === 0 && (byRank > 0 || (byRank === 0 && c.fecha > best.fecha)))) best = c;
  }
  return best;
}

// Las estimaciones que salen de las medidas: la última de los pliegues y la última de la cinta
export function measureFatCandidates(
  readings: MeasureReadings,
  who: { sex?: string; age?: number | null; heightCm?: number | null },
): BodyFatCandidate[] {
  const out: BodyFatCandidate[] = [];
  const last = (s: SeriesPoint[]): SeriesPoint | undefined => s[s.length - 1];
  const folds = last(fatSeries(readings, who.sex, who.age));
  if (folds) out.push({ pct: folds.valor, fecha: folds.fecha, source: 'folds' });
  const tape = last(tapeFatSeries(readings, who.sex, who.heightCm));
  if (tape) out.push({ pct: tape.valor, fecha: tape.fecha, source: 'tape' });
  return out;
}

// --- Del % de grasa a kilos -------------------------------------------------------------------------------------
// Con el peso y el % de grasa elegido: kg de grasa y kg de masa sin grasa (todo lo demás: músculo, hueso, agua,
// órganos), con un decimal y sumando el peso. null si el peso o el % no cuadran
export interface FatSplit {
  fatKg: number;
  leanKg: number;
  fatPct: number;
  leanPct: number;
}

export function fatSplit(weightKg: number | null | undefined, fatPct: number | null | undefined): FatSplit | null {
  if (weightKg == null || fatPct == null || !Number.isFinite(weightKg) || !Number.isFinite(fatPct)) return null;
  if (weightKg < 25 || fatPct <= 0 || fatPct >= 100) return null;
  const fatKg = round1((weightKg * fatPct) / 100);
  return { fatKg, leanKg: round1(weightKg - fatKg), fatPct: round1(fatPct), leanPct: round1(100 - fatPct) };
}

// --- Datos de ejemplo de la demo --------------------------------------------------------------------------------
// En la demo y en las cuentas de prueba (showSamples), con el perfil a medias: una altura de ejemplo para que
// salga el IMC (fundador, 2026-11-16: «en la cuenta demo incluye el IMC con la altura») y una persona de ejemplo
// para las estimaciones (las medidas de ejemplo de measurementsRepository.ts son las de un hombre). Nunca se
// guardan en el perfil; una cuenta real ve exactamente lo que tiene en el suyo (src/data/bodyBasics.ts)
export const SAMPLE_HEIGHT_CM = 176;
export const SAMPLE_PERSON = { sex: 'male', age: 38 } as const;

export interface BodyBasics {
  sex?: string;
  age: number | null;
  heightCm?: number;
  weightKg?: number; // el del perfil, tal cual (no hay peso de ejemplo)
  sampleHeight: boolean;
  samplePerson: boolean;
}

export function withSampleBasics(
  own: { sex?: string; hasDateOfBirth: boolean; age: number | null; heightCm?: number; weightKg?: number },
  samples: boolean,
): BodyBasics {
  const sampleHeight = samples && !own.heightCm;
  const samplePerson = samples && !own.sex && !own.hasDateOfBirth;
  return {
    sex: samplePerson ? SAMPLE_PERSON.sex : own.sex,
    age: samplePerson ? SAMPLE_PERSON.age : own.age,
    heightCm: sampleHeight ? SAMPLE_HEIGHT_CM : own.heightCm,
    weightKg: own.weightKg,
    sampleHeight,
    samplePerson,
  };
}

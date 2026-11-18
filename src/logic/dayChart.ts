// La gráfica de «Tus últimos días» (fundador, 2026-11-06): por defecto, ánimo y energía del check-in; debajo,
// otras medidas para verlas en la misma gráfica y buscar relaciones (pasos, VFC, pulso en reposo, horas de
// sueño, veces al baño…). Cada una va en su propia escala, razonable para esa medida: ánimo, energía y estrés,
// siempre de 1 a 5; las demás, de lo más bajo a lo más alto de esos días, pero con un margen mínimo para que
// cuatro pasos de diferencia no parezcan una montaña. A las mujeres, debajo, la fase del ciclo de cada día.
// Lógica pura (tests en src/logic/__tests__/dayChart.test.ts).
import type { CycleEntry } from '@/types/cycle';
import { currentCyclePhase, type CyclePhaseId } from '@/utils/cyclePhase';

export type SeriesId = 'mood' | 'energy' | 'stress' | 'sleep' | 'steps' | 'hrv' | 'rhr' | 'urine' | 'bowel' | 'workout';

export interface SeriesDef {
  id: SeriesId;
  label: string; // en inglés, se pasa por t()
  fixed?: [number, number]; // escala fija (las de 1 a 5)
  minSpan: number; // margen mínimo de la escala, en su unidad
  floor: number; // la escala no baja de aquí
  step: number; // los extremos se redondean a esto
}

// Sueño en minutos (como llega del reloj); entreno, minutos del día
export const SERIES: SeriesDef[] = [
  { id: 'mood', label: 'Mood', fixed: [1, 5], minSpan: 4, floor: 1, step: 1 },
  { id: 'energy', label: 'Energy', fixed: [1, 5], minSpan: 4, floor: 1, step: 1 },
  { id: 'stress', label: 'Stress', fixed: [1, 5], minSpan: 4, floor: 1, step: 1 },
  { id: 'sleep', label: 'Sleep', minSpan: 180, floor: 0, step: 60 },
  { id: 'steps', label: 'Steps', minSpan: 6000, floor: 0, step: 1000 },
  { id: 'hrv', label: 'HRV', minSpan: 30, floor: 0, step: 10 },
  { id: 'rhr', label: 'Resting heart rate', minSpan: 15, floor: 30, step: 5 },
  { id: 'urine', label: 'Urine', minSpan: 6, floor: 0, step: 1 },
  { id: 'bowel', label: 'Bowel movements', minSpan: 3, floor: 0, step: 1 },
  { id: 'workout', label: 'Workout', minSpan: 60, floor: 0, step: 15 },
];
export const SERIES_BY_ID = Object.fromEntries(SERIES.map((s) => [s.id, s])) as Record<SeriesId, SeriesDef>;
export const DEFAULT_SERIES: SeriesId[] = ['mood', 'energy'];
// Más de 4 líneas a la vez ya no se leen
export const SERIES_MAX = 4;
// Se guarda en user_flags («days_chart», { series })
export const DAYS_CHART_FLAG = 'days_chart';

export type DayValues = Record<SeriesId, (number | null)[]>;

// La escala de una medida con los valores de esos días: fija, o de su mínimo a su máximo con el margen mínimo
// centrado, sin bajar del suelo y con los extremos redondeados
export function seriesScale(def: SeriesDef, values: (number | null)[]): [number, number] {
  if (def.fixed) return def.fixed;
  const vs = values.filter((v): v is number => v != null && Number.isFinite(v));
  if (!vs.length) return [def.floor, def.floor + def.minSpan];
  let lo = Math.min(...vs);
  let hi = Math.max(...vs);
  if (hi - lo < def.minSpan) {
    const mid = (lo + hi) / 2;
    lo = mid - def.minSpan / 2;
    hi = mid + def.minSpan / 2;
  }
  if (lo < def.floor) {
    hi += def.floor - lo;
    lo = def.floor;
  }
  lo = Math.floor(lo / def.step) * def.step;
  hi = Math.ceil(hi / def.step) * def.step;
  return [lo, hi];
}

// 0 abajo, 1 arriba
export const scaled = (v: number, [lo, hi]: [number, number]) => (hi === lo ? 0.5 : Math.max(0, Math.min(1, (v - lo) / (hi - lo))));

// Lo guardado, limpio: medidas que existen, sin repetir y hasta 4; si no queda ninguna, las de siempre
export function normalizeSeries(raw: unknown): SeriesId[] {
  const list = raw && typeof raw === 'object' && Array.isArray((raw as { series?: unknown }).series) ? (raw as { series: unknown[] }).series : [];
  const ok = [...new Set(list.filter((x): x is SeriesId => typeof x === 'string' && x in SERIES_BY_ID))].slice(0, SERIES_MAX);
  return ok.length ? ok : [...DEFAULT_SERIES];
}

// Añadir o quitar una medida. Con 4 no se añade otra (null); la última no se quita (se quedaría vacía).
export function toggleSeries(sel: SeriesId[], id: SeriesId): SeriesId[] | null {
  if (sel.includes(id)) return sel.length > 1 ? sel.filter((x) => x !== id) : sel;
  if (sel.length >= SERIES_MAX) return null;
  return [...sel, id];
}

// Día local YYYY-MM-DD
export const localKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export interface CycleDay {
  phase: CyclePhaseId;
  day: number;
}

// Fase del ciclo de cada día, con las reglas apuntadas hasta ese día (como se vería ese día). Antes de la
// primera regla apuntada no se sabe: null. `sample` (demo sin reglas): un ejemplo, como en Hoy.
export function cycleByDay(keys: string[], entries: CycleEntry[], typicalLength?: number | null, sample = false): (CycleDay | null)[] {
  let list = entries;
  if (!list.length && sample && keys.length) {
    // Como el ejemplo de Hoy: la última regla, hace 11 días; las de antes, cada 28
    const today = new Date(`${keys[keys.length - 1]}T12:00:00`);
    list = [11, 39, 67, 95, 123, 151, 179].map((n, i) => {
      const d = new Date(today);
      d.setDate(d.getDate() - n);
      return { id: `sample-${i}`, fecha: d.toISOString(), createdAt: d.toISOString() };
    });
  }
  const starts = list.map((e) => ({ e, key: localKey(new Date(e.fecha)) }));
  return keys.map((key) => {
    const before = starts.filter((s) => s.key <= key).map((s) => s.e);
    if (!before.length) return null;
    const info = currentCyclePhase(before, new Date(`${key}T12:00:00`), typicalLength);
    return { phase: info.phase, day: info.day };
  });
}

// Tramos seguidos de la misma fase, para pintar la franja de debajo con pocos rectángulos
export function cycleRuns(days: (CycleDay | null)[]): { from: number; to: number; phase: CyclePhaseId }[] {
  const out: { from: number; to: number; phase: CyclePhaseId }[] = [];
  days.forEach((d, i) => {
    if (!d) return;
    const last = out[out.length - 1];
    if (last && last.phase === d.phase && last.to === i - 1) last.to = i;
    else out.push({ from: i, to: i, phase: d.phase });
  });
  return out;
}

// Tramos seguidos con dato de una medida (una línea por tramo; un día suelto, un punto)
export function segments(values: (number | null)[]): number[][] {
  const out: number[][] = [];
  let cur: number[] = [];
  values.forEach((v, i) => {
    if (v == null || !Number.isFinite(v)) {
      if (cur.length) out.push(cur);
      cur = [];
    } else cur.push(i);
  });
  if (cur.length) out.push(cur);
  return out;
}

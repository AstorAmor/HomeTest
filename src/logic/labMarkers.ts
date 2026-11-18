import type { LabUpload } from '@/data/labUploads';
import type { HomeTestReport } from '@/types/report';
import { markerIdForExtractedName, sameUnit } from '@/data/markerMatching';
import { getRangeStatus, type RangeStatus } from '@/utils/rangeStatus';

// Los valores de las analíticas por marcador (2026-11-06, notas del fundador): «Analíticas» en Mis datos
// enseña el último valor de cada uno frente al rango de su laboratorio, y al tocar un valor dentro de una
// analítica se abre la ficha de ese marcador (/lab-marker) con todos sus valores. Junta las analíticas
// subidas (labUploads) y, en las cuentas de prueba, los dos informes de ejemplo. Lógica pura.

export type MarkerSource = { kind: 'upload'; id: string; lab: string | null } | { kind: 'report'; id: string; lab: string };

export interface MarkerPoint {
  key: string; // el marker_id si se reconoce; si no, «n:» + el nombre normalizado
  name: string; // como lo escribe el laboratorio
  value: number | null; // null si no es un número («Negativo»)
  text: string; // el valor tal cual, para los que no son números
  unit: string;
  low: number | null;
  high: number | null;
  date: string; // YYYY-MM-DD
  source: MarkerSource;
}

// Los que tienen su propia ficha en Mis datos (se apuntan también a mano): se abren allí
export const OWN_SCREEN: Record<string, string> = {
  glucose: '/glucose-detail',
  total_cholesterol: '/cholesterol-detail',
  cortisol_am: '/cortisol-detail',
};

const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

// Clave común entre analíticas de laboratorios distintos: el catálogo si reconoce el nombre; si no, el
// nombre sin tildes ni signos (así «Ácido úrico» y «ACIDO URICO» van juntos)
export function markerKey(name: string): string {
  return markerIdForExtractedName(name) ?? `n:${norm(name)}`;
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

export function pointsFromUploads(uploads: LabUpload[]): MarkerPoint[] {
  const out: MarkerPoint[] = [];
  for (const u of uploads) {
    const date = u.testDate ?? u.createdAt.slice(0, 10);
    const seen = new Set<string>();
    for (const sec of u.data.secciones) {
      for (const p of sec.parametros) {
        if (!p.nombre?.trim()) continue;
        const key = markerKey(p.nombre);
        if (seen.has(key)) continue; // un valor por marcador y analítica
        seen.add(key);
        out.push({
          key,
          name: p.nombre.trim(),
          value: isNum(p.valor) ? p.valor : null,
          text: String(p.valor ?? ''),
          unit: p.unidad ?? '',
          low: p.rango_min ?? null,
          high: p.rango_max ?? null,
          date,
          source: { kind: 'upload', id: u.id, lab: u.labName },
        });
      }
    }
  }
  return out;
}

export function pointsFromReports(reports: { id: string; lab: string; report: HomeTestReport }[]): MarkerPoint[] {
  return reports.flatMap((r) =>
    r.report.sections.flatMap((s) =>
      s.markers.map((m) => ({
        key: m.marker_id,
        name: m.display_name,
        value: isNum(m.value) ? m.value : null,
        text: m.value_text || String(m.value ?? ''),
        unit: m.unit ?? '',
        low: m.range.low,
        high: m.range.high,
        date: r.report.test_date.slice(0, 10),
        source: { kind: 'report' as const, id: r.id, lab: r.lab },
      })),
    ),
  );
}

export const pointState = (p: Pick<MarkerPoint, 'value' | 'low' | 'high'>): RangeStatus =>
  p.value == null ? 'sin_rango' : getRangeStatus(p.value, p.low, p.high);

export const isOut = (s: RangeStatus) => s === 'por_encima' || s === 'por_debajo';

// Del más reciente al más antiguo; el mismo día, lo subido antes que el informe de ejemplo
const newestFirst = (a: MarkerPoint, b: MarkerPoint) => b.date.localeCompare(a.date) || (a.source.kind === 'upload' ? -1 : 1) - (b.source.kind === 'upload' ? -1 : 1);

export interface MarkerSummary {
  key: string;
  latest: MarkerPoint;
  state: RangeStatus; // el del último valor
  count: number; // cuántas analíticas lo traen
}

const ORDER: RangeStatus[] = ['por_encima', 'por_debajo', 'en_rango', 'sin_rango'];

// El último valor de cada marcador: primero los que están fuera del rango, luego en rango y al final sin
// referencia; dentro de cada grupo, por nombre (displayName, si se da: el nombre del catálogo)
export function markerSummaries(points: MarkerPoint[], displayName: (p: MarkerPoint) => string = (p) => p.name): MarkerSummary[] {
  const by = new Map<string, MarkerPoint[]>();
  for (const p of points) by.set(p.key, [...(by.get(p.key) ?? []), p]);
  const out = [...by.entries()].map(([key, list]) => {
    const latest = [...list].sort(newestFirst)[0];
    return { key, latest, state: pointState(latest), count: list.length };
  });
  const order = (s: RangeStatus) => (isOut(s) ? 0 : ORDER.indexOf(s));
  return out.sort((a, b) => order(a.state) - order(b.state) || displayName(a.latest).localeCompare(displayName(b.latest), 'es'));
}

// Todos los valores de un marcador, del más antiguo al más reciente
export function markerHistory(points: MarkerPoint[], key: string): MarkerPoint[] {
  return points.filter((p) => p.key === key).sort((a, b) => -newestFirst(a, b));
}

// Lo que entra en la gráfica: los valores con número y la misma unidad que el último (mg/dL y mmol/L no
// se mezclan); cuántos se quedan fuera por venir en otra unidad
export function chartPoints(history: MarkerPoint[]): { points: MarkerPoint[]; otherUnits: number } {
  const withValue = history.filter((p) => p.value != null);
  const last = withValue[withValue.length - 1];
  if (!last) return { points: [], otherUnits: 0 };
  const points = withValue.filter((p) => sameUnit(p.unit, last.unit));
  return { points, otherUnits: withValue.length - points.length };
}

// La franja del rango en la gráfica, recortada cerca de los valores: con un rango ancho (ferritina 30–400) y
// valores de 24 y 34, la franja entera aplastaba la línea. Vale también con un solo límite (LDL < 130).
// Sin ningún límite, o si no queda nada que pintar, no hay franja.
export function chartBand(values: number[], low: number | null, high: number | null): { low: number; high: number } | undefined {
  if (!values.length || (low == null && high == null)) return undefined;
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = Math.max(hi - lo, Math.abs(hi) * 0.25) || 1;
  const band = { low: Math.max(low ?? -Infinity, lo - 2 * span), high: Math.min(high ?? Infinity, hi + 2 * span) };
  return band.high > band.low ? band : undefined;
}

// Qué gráficas se ven en «Analíticas» (fundador, 2026-11-06: «que se pueda seleccionar la gráfica que se quiere
// ver… como un ojo»): por defecto azúcar, colesterol total y cortisol; el ojo de cada valor la pone o la quita.
// Se guarda en user_flags («mydata_charts», { keys }), en el orden en que se eligieron.
export const DEFAULT_CHARTS = ['glucose', 'total_cholesterol', 'cortisol_am'];
const CHARTS_MAX = 20;

export function normalizeCharts(raw: unknown): string[] {
  const keys = raw && typeof raw === 'object' ? (raw as { keys?: unknown }).keys : undefined;
  if (!Array.isArray(keys)) return [...DEFAULT_CHARTS];
  return [...new Set(keys.filter((k): k is string => typeof k === 'string' && k.length > 0 && k.length <= 80))].slice(0, CHARTS_MAX);
}

export const toggleChart = (list: string[], key: string): string[] =>
  list.includes(key) ? list.filter((k) => k !== key) : [...list, key].slice(-CHARTS_MAX);

// La analítica más reciente de todas (para el pie de «Analíticas»)
export function latestAnalysis(points: MarkerPoint[]): MarkerPoint | null {
  return [...points].sort(newestFirst)[0] ?? null;
}

// Un valor «caducado»: de un análisis de hace más de un año (fundador, 2026-11-18: «una especie de "alarma de
// caducidad", máximo 1 año»). No dice nada de la salud; solo que el dato es antiguo
export const STALE_DAYS = 365;
export function isStale(date: string, today: Date = new Date()): boolean {
  const d = new Date(`${date.slice(0, 10)}T12:00:00`);
  return !Number.isNaN(d.getTime()) && today.getTime() - d.getTime() > STALE_DAYS * 86_400_000;
}

// Cuántos fuera, en rango y sin referencia
export function stateCounts(list: MarkerSummary[]): { out: number; in: number; none: number } {
  return {
    out: list.filter((s) => isOut(s.state)).length,
    in: list.filter((s) => s.state === 'en_rango').length,
    none: list.filter((s) => s.state === 'sin_rango').length,
  };
}

// La analítica de la que sale un valor, para el parámetro «from» de la ficha
export const sourceParam = (s: MarkerSource) => `${s.kind}:${s.id}`;

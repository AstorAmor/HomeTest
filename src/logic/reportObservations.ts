// Observaciones de un informe frente a la analítica anterior (fundador, 2026-11-18: «el informe completo sobra, es
// exactamente lo mismo que "Tu último informe". ¿Podríamos añadir alguna observación en su lugar? Me gusta lo de
// 39 marcadores han mejorado de forma significativa (poner cuáles), poner si alguno ha empeorado… y poner
// recomendación en lo que te podrías fijar… pero no repetirlo todo»). Lógica pura (sin React Native) para la
// pantalla del informe y Análisis, y para los tests.
//
// Qué es «mejorar» y «empeorar». Solo cuentan los cambios significativos (trend.significant: el cambio supera lo
// que varía un marcador por sí solo entre dos análisis) y se miden contra el rango del laboratorio, sin suponer qué
// dirección es buena para cada marcador (no hay todavía una tabla clínica de eso):
// - mejora: el valor vuelve a su rango o, fuera de él, se acerca;
// - empeora: sale de su rango o, fuera de él, se aleja;
// - un cambio significativo DENTRO del rango (estaba dentro y sigue dentro) no se cuenta como mejora ni como
//   empeoramiento: se dice aparte, como «han cambiado sin salir de su rango».
// Antes el informe contaba como mejora todo cambio significativo que acababa en rango (39 en la demo, incluidas
// bajadas y subidas dentro del rango); con esta regla salen 17, y los otros 29 van como cambios dentro del rango.
import type { HomeTestReport, MarkerFlag, ReportMarker } from '@/types/report';

export interface ObservedMarker extends ReportMarker {
  categoryId: string;
}

// Lo que se puede mirar: los que siguen fuera de su rango, con cuándo repetirlo y qué hay en el plan para ellos
export interface FocusItem {
  marker: ObservedMarker;
  side: 'above' | 'below';
  retest: { months: number; reason: string } | null;
  actions: { id: string; title: string }[]; // las acciones del plan que nombran este marcador
}

export interface ReportObservations {
  backInRange: ObservedMarker[]; // estaban fuera y vuelven a estar dentro
  closer: ObservedMarker[]; // siguen fuera, pero más cerca
  worse: ObservedMarker[]; // salen del rango o, fuera, se alejan
  changedInRange: ObservedMarker[]; // cambio significativo sin salir del rango
  focus: FocusItem[]; // como mucho 3, primero lo más lejos del rango
  nearLimit: ObservedMarker[]; // en rango, cerca del límite
  compared: boolean; // hay analítica anterior con la que comparar
}

const OUT: MarkerFlag[] = ['bajo', 'alto', 'critico'];
const FOCUS_MAX = 3;

const asNum = (v: number | string | null | undefined): number | null => {
  if (v == null) return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

// Cuánto se sale un valor de su rango, en proporción al límite que cruza (0 = dentro). null sin número
export function distanceToRange(value: number | string, low: number | null, high: number | null): number | null {
  const v = asNum(value);
  if (v == null) return null;
  if (low != null && v < low) return (low - v) / (Math.abs(low) || 1);
  if (high != null && v > high) return (v - high) / (Math.abs(high) || 1);
  return 0;
}

export function reportObservations(report: HomeTestReport, max = FOCUS_MAX): ReportObservations {
  const all: ObservedMarker[] = report.sections.flatMap((s) => s.markers.map((m) => ({ ...m, categoryId: s.category_id })));
  const out: ReportObservations = { backInRange: [], closer: [], worse: [], changedInRange: [], focus: [], nearLimit: [], compared: false };

  for (const m of all) {
    if (m.flag === 'limite_alto' || m.flag === 'limite_bajo') out.nearLimit.push(m);
    if (!m.trend) continue;
    out.compared = true;
    if (!m.trend.significant) continue;
    const before = distanceToRange(m.trend.previous_value, m.range.low, m.range.high);
    const now = distanceToRange(m.value, m.range.low, m.range.high);
    if (before == null || now == null) continue;
    if (before > 0 && now === 0) out.backInRange.push(m);
    else if (now < before) out.closer.push(m);
    else if (now > before) out.worse.push(m);
    else out.changedInRange.push(m);
  }

  // En qué fijarte: lo que sigue fuera de su rango, lo más lejos primero, con su repetición y su plan
  out.focus = all
    .filter((m) => OUT.includes(m.flag))
    .map((m) => ({ m, d: distanceToRange(m.value, m.range.low, m.range.high) ?? 0 }))
    .sort((a, b) => b.d - a.d)
    .slice(0, max)
    .map(({ m }) => {
      const v = asNum(m.value);
      const side: FocusItem['side'] = m.flag === 'bajo' || (v != null && m.range.low != null && v < m.range.low) ? 'below' : 'above';
      const r = report.retest?.find((x) => x.marker_id === m.marker_id);
      const actions = (report.action_plan ?? []).filter((a) => a.linked_markers.includes(m.marker_id)).map((a) => ({ id: a.action_id, title: a.title }));
      return { marker: m, side, retest: r ? { months: r.months, reason: r.reason } : null, actions };
    });

  return out;
}

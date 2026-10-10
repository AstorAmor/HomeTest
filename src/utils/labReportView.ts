import { dateLocale, getLang, t } from '@/i18n';
import { baselineReport, currentReport } from '@/data/reportRepository';
import { HomeTestReport, ReportMarker } from '@/types/report';
import { Colors } from '@/constants/colors';
import { getMarkerDisplayNameEn } from '@/data/reportContentEn';

// Informes disponibles en Lab → Lab Results (dummy: los dos del prototipo).
// `lab` = quién hizo la analítica (laboratorio socio o "User upload" si la subió el usuario).
export const LAB_REPORTS: { id: 'current' | 'baseline'; title: string; lab: string; report: HomeTestReport }[] = [
  { id: 'current', title: t('Follow-up blood analysis'), lab: 'Eurofins Megalab', report: currentReport },
  { id: 'baseline', title: t('Baseline blood analysis'), lab: 'Synlab', report: baselineReport },
];

export const findLabReport = (id?: string) => LAB_REPORTS.find((r) => r.id === id) ?? LAB_REPORTS[0];

export function reportCounts(report: HomeTestReport) {
  const all = report.sections.flatMap((s) => s.markers);
  const inRange = all.filter((m) => m.flag === 'en_rango').length;
  return { inRange, needsReview: all.length - inRange, total: all.length };
}

export function flaggedMarkers(report: HomeTestReport, limit = 3): ReportMarker[] {
  return report.sections.flatMap((s) => s.markers).filter((m) => m.flag !== 'en_rango').slice(0, limit);
}

// Posición 0..1 del valor en una barra donde el rango de referencia ocupa el 20-80 %.
export function rangePosition(m: ReportMarker): number | null {
  const v = typeof m.value === 'number' ? m.value : Number(m.value);
  const { low, high } = m.range;
  if (Number.isNaN(v) || (low == null && high == null)) return null;
  const lo = low ?? 0;
  const hi = high ?? lo * 2 + 1;
  if (hi === lo) return 0.5;
  return Math.max(0.02, Math.min(0.98, 0.2 + ((v - lo) / (hi - lo)) * 0.6));
}

export const flagColor = (m: ReportMarker) =>
  m.flag === 'en_rango' ? Colors.ok : m.flag.startsWith('limite') ? Colors.attention : Colors.danger;

export const formatReportDate = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short', year: 'numeric' });

// Siglas que se muestran en mayúsculas al derivar el nombre desde el id.
const ACRONYMS = new Set([
  'hdl', 'ldl', 'alt', 'ast', 'ggt', 'alp', 'ck', 'ldh', 'bun', 'egfr', 'crp', 'esr', 'tg', 'tibc',
  'lpa', 'apoa1', 'apob', 'coq10', 'ige', 'fib4', 'psa', 'igf1', 'tsh', 't3', 't4', 'hiv', 'inr', 'pt',
  'dhea', 'shbg', 'lh', 'fsh', 'rbc', 'wbc', 'mcv', 'mch', 'mchc', 'rdw', 'ana', 'gc', 'ct', 'pcr',
  'hbsag', 'hcv', 'nt', 'probnp', 'b12', 'b6', 'am', 'pm',
]);

// Nombre en inglés; si no hay traducción, se deriva del id (el display_name del JSON está en español).
export const markerNameEn = (m: ReportMarker) => {
  if (getLang() === 'es') return getMarkerDisplayNameEn(m.marker_id, m.display_name);
  const fromId = m.marker_id
    .split('_')
    .map((w, i) => (ACRONYMS.has(w) ? w.toUpperCase() : i === 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(' ')
    .replace(/^Hs /, 'hs-')
    .replace(/^Omega3/, 'Omega-3');
  return getMarkerDisplayNameEn(m.marker_id, fromId);
};

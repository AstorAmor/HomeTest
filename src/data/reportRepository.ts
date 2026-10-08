import baselineReportData from './seed/hometest/hometest_report_baseline.json';
import currentReportData from './seed/hometest/hometest_report_current.json';
import userProfileData from './seed/hometest/hometest_user_profile.json';
import wearableTimeseriesData from './seed/hometest/hometest_wearable_timeseries.json';
import {
  HomeTestReport,
  HomeTestUserProfile,
  WearableTimeseries,
  ReportMarker,
} from '@/types/report';

// Datos dummy estáticos para el prototipo "Lab Report Wow" — sin backend.
// provenance.note en cada informe ya deja claro que son datos ficticios.
export const baselineReport = baselineReportData as unknown as HomeTestReport;
export const currentReport = currentReportData as unknown as HomeTestReport;
export const userProfile = userProfileData as unknown as HomeTestUserProfile;
export const wearableTimeseries = wearableTimeseriesData as unknown as WearableTimeseries;

export function findMarkerInCurrentReport(markerId: string): ReportMarker | undefined {
  for (const section of currentReport.sections) {
    const found = section.markers.find((m) => m.marker_id === markerId);
    if (found) return found;
  }
  return undefined;
}

export interface MarkerWithCategory extends ReportMarker {
  categoryId: string;
  categoryTitle: string;
}

export function getMarkersNeedingReview(): MarkerWithCategory[] {
  const severityWeight: Record<string, number> = {
    critico: 0,
    alto: 1,
    bajo: 1,
    limite_alto: 2,
    limite_bajo: 2,
  };
  return currentReport.sections
    .flatMap((s) =>
      s.markers.map((m) => ({ ...m, categoryId: s.category_id, categoryTitle: s.title }))
    )
    .filter((m) => m.flag !== 'en_rango')
    .sort((a, b) => (severityWeight[a.flag] ?? 9) - (severityWeight[b.flag] ?? 9));
}

// El campo summary.counts del JSON dummy no está sincronizado con los flags reales
// por marcador (es un dato de ejemplo escrito a mano aparte) — para que el donut de
// cabecera y el desglose por categoría sumen lo mismo, se calcula aquí a partir de
// los marcadores reales en vez de leer summary.counts directamente.
export function getComputedSummaryCounts(): {
  enRango: number;
  needsReview: number;
  total: number;
} {
  const allMarkers = currentReport.sections.flatMap((s) => s.markers);
  const enRango = allMarkers.filter((m) => m.flag === 'en_rango').length;
  return { enRango, needsReview: allMarkers.length - enRango, total: allMarkers.length };
}

// Marcadores que estaban fuera de su rango en la analítica anterior y ahora están dentro: lo que
// de verdad merece celebración al llegar los resultados (recibir el informe por sí solo, no).
export function markersBackInRange(report: HomeTestReport): ReportMarker[] {
  const out: ReportMarker[] = [];
  for (const section of report.sections) {
    for (const m of section.markers) {
      const prev = m.trend?.previous_value;
      if (typeof prev !== 'number' || typeof m.value !== 'number' || !m.range) continue;
      const { low, high } = m.range;
      const wasOut = (low != null && prev < low) || (high != null && prev > high);
      const isIn = (low == null || m.value >= low) && (high == null || m.value <= high);
      if (wasOut && isIn) out.push(m);
    }
  }
  return out;
}

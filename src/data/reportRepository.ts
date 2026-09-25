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

export function getMarkersNeedingReview(): ReportMarker[] {
  const severityWeight: Record<string, number> = {
    critico: 0,
    alto: 1,
    bajo: 1,
    limite_alto: 2,
    limite_bajo: 2,
  };
  return currentReport.sections
    .flatMap((s) => s.markers)
    .filter((m) => m.flag !== 'en_rango')
    .sort((a, b) => (severityWeight[a.flag] ?? 9) - (severityWeight[b.flag] ?? 9));
}

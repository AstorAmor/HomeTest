import { baselineReport, currentReport } from './reportRepository';
import { getActionPlanContentEn } from './reportContentEn';
import { HomeTestReport, ReportMarker } from '@/types/report';
import { t } from '@/i18n';

// Historial de planes tras cada analítica. El último es el action_plan del informe
// actual (pantalla /report-plan). El anterior (marzo, tras la primera analítica) es
// DUMMY: el informe base del prototipo no trae plan propio. Cuando haya backend, cada
// informe guardará su plan y esta lista saldrá de ahí.

export interface PastPlanItem {
  title: string;
  why: string;
  markers: string[]; // marker_id vinculados: se enseña su valor entonces → ahora
}

export interface PlanEntry {
  id: string;
  date: string; // fecha de la analítica que lo generó
  label: string;
  latest: boolean;
  items: PastPlanItem[];
}

const PREVIOUS_PLAN: PastPlanItem[] = [
  {
    title: t('Walk 30 minutes a day and cut refined carbs'),
    why: t('Glucose, HbA1c and insulin resistance (HOMA-IR) were above range.'),
    markers: ['glucose', 'hba1c', 'homa_ir'],
  },
  {
    title: t('Swap saturated fats for olive oil, nuts and fibre'),
    why: t('LDL, ApoB and triglycerides were high and HDL low.'),
    markers: ['ldl', 'apob', 'triglycerides', 'hdl'],
  },
  {
    title: t('Get some sun and ask your doctor about vitamin D'),
    why: t('Vitamin D was low (18 ng/mL).'),
    markers: ['vitamin_d'],
  },
  {
    title: t('Cut back on alcohol and sugary drinks'),
    why: t('Liver enzymes (ALT, AST) and uric acid were raised.'),
    markers: ['alt', 'ast', 'uric_acid'],
  },
  {
    title: t('Go to bed at the same time every night'),
    why: t('Short, irregular sleep raises glucose and inflammation (hs-CRP was high).'),
    markers: ['hs_crp'],
  },
];

export function markerIn(report: HomeTestReport, markerId: string): ReportMarker | undefined {
  for (const s of report.sections) {
    const m = s.markers.find((x) => x.marker_id === markerId);
    if (m) return m;
  }
  return undefined;
}

export const reportsForProgress = { before: baselineReport, after: currentReport };

export function planHistory(): PlanEntry[] {
  return [
    {
      id: currentReport.report_id,
      date: currentReport.test_date,
      label: t('After your follow-up test'),
      latest: true,
      items: currentReport.action_plan.map((a) => {
        const en = getActionPlanContentEn(a.action_id, { title: a.title, why: a.why, how: a.how, caveats: a.caveats });
        return { title: en.title, why: en.why.join(' '), markers: a.linked_markers ?? [] };
      }),
    },
    {
      id: baselineReport.report_id,
      date: baselineReport.test_date,
      label: t('After your first test'),
      latest: false,
      items: PREVIOUS_PLAN,
    },
  ];
}

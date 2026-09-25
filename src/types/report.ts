// Tipos para el esquema HomeTestReport (ver Claude Docs: "HomeTest — Diseño de la
// inteligencia del informe", id 455a1c90-2629-4c98-ab80-4f4c7ae76483).
// Reflejan tal cual la forma de los JSON dummy en src/data/seed/hometest/.

export type MarkerFlag = 'bajo' | 'limite_bajo' | 'en_rango' | 'limite_alto' | 'alto' | 'critico';
export type EscalationTier = 'verde' | 'ambar' | 'rojo' | 'critico';
export type TrendDirection = 'sube' | 'baja' | 'estable';
export type RangeAdjustment = 'ninguno' | 'ciclo_menstrual';
export type RangeSource = 'laboratorio' | 'guia' | 'hometest';

export interface MarkerRange {
  low: number | null;
  high: number | null;
  source: RangeSource;
  adjustment: RangeAdjustment;
}

export interface MarkerTrend {
  previous_value: number | string;
  previous_date: string;
  significant: boolean;
  direction: TrendDirection;
  delta_pct: number;
}

export interface ReportMarker {
  marker_id: string;
  display_name: string;
  value: number | string;
  value_text: string;
  unit: string | null;
  range: MarkerRange;
  flag: MarkerFlag;
  tier: EscalationTier;
  trend?: MarkerTrend;
  preanalytic_flags: string[];
}

export interface ReportSection {
  category_id: string;
  title: string;
  expanded_by_default: boolean;
  markers: ReportMarker[];
}

export interface PhenoAgeDriver {
  marker_id: string;
  direction: 'suma' | 'resta';
}

export interface PhenoAgeSummary {
  available: boolean;
  low: number;
  high: number;
  chronological_age: number;
  drivers: PhenoAgeDriver[];
  explanation: string;
}

export interface ReportSummary {
  headline: string;
  paragraphs: string[];
  counts: {
    en_rango: number;
    a_vigilar: number;
    fuera_de_rango: number;
    total: number;
  };
  phenoage: PhenoAgeSummary;
}

export interface RetestRecommendation {
  marker_id: string;
  months: number;
  reason: string;
}

export interface GlossaryEntry {
  term: string;
  definition: string;
}

export interface ReportProvenance {
  ruleset_hash: string;
  kb_snapshot: string;
  prompt_version: string;
  model: string;
  ai_generated_text: boolean;
  note: string;
}

export interface ActionPlanProjection {
  marker_id: string;
  current_value: number;
  expected_value_in_6_months: number;
  expected_range_low: number;
  expected_range_high: number;
  uncertainty_note: string;
}

export interface ActionPlanItem {
  action_id: string;
  pinned: boolean;
  title: string;
  why: string[];
  how: string[];
  caveats: string[];
  provenance: 'sangre' | 'wearable' | 'sangre_y_wearable';
  confidence: 'alta' | 'media' | 'baja';
  linked_markers: string[];
  estimated_next_test: ActionPlanProjection;
}

export interface WearableContext {
  window: string;
  coverage_pct: number;
  sleep_avg_hours: number;
  sleep_regularity_score_pct: number;
  resting_heart_rate_bpm: number;
  hrv_rmssd_ms: number;
  steps_avg_daily: number;
  activity_vs_baseline_pct: number;
  notes: string[];
}

export interface EscalationInfo {
  tier: EscalationTier;
  escalated_markers: string[];
  physician_note: string | null;
  reviewed_at: string | null;
}

export interface HomeTestReport {
  report_id: string;
  version: number;
  status: string;
  test_date: string;
  escalation: EscalationInfo;
  summary: ReportSummary;
  sections: ReportSection[];
  retest: RetestRecommendation[];
  glossary: GlossaryEntry[];
  provenance: ReportProvenance;
  action_plan: ActionPlanItem[];
  wearable_context: WearableContext;
}

export interface UserProfileMetric<T = number> {
  baseline: T;
  current: T;
}

export interface HomeTestUserProfile {
  user_id: string;
  display_name: string;
  date_of_birth: string;
  biological_sex: 'male' | 'female';
  height_cm: number;
  primary_goal: 'general_health_improvement' | 'manage_condition' | 'performance';
  goal_declared_at: string;
  conditions_declared: string[];
  medications: string[];
  supplements_baseline: string[];
  supplements_current: string[];
  smoking: string;
  alcohol: string;
  weight_kg: UserProfileMetric;
  waist_cm: UserProfileMetric;
  resting_heart_rate_bpm: UserProfileMetric;
  hrv_rmssd_ms: UserProfileMetric;
  sleep_avg_hours: UserProfileMetric;
  sleep_regularity_score_pct: UserProfileMetric;
  typical_bedtime: UserProfileMetric<string>;
  typical_waketime: UserProfileMetric<string>;
  steps_avg_daily: UserProfileMetric;
  exercise_days_per_week: UserProfileMetric;
  vo2max_estimate: UserProfileMetric;
}

export interface WearableTimeseries {
  window_start: string;
  window_end: string;
  months: string[];
  series: {
    sleep_avg_hours: number[];
    hrv_rmssd_ms: number[];
    resting_heart_rate_bpm: number[];
    steps_avg_daily: number[];
    weight_kg: number[];
  };
}

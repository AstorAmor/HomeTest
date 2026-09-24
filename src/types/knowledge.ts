export type MeasurementType = 'MEASURED' | 'DERIVED' | 'SCORE' | 'UNKNOWN';

export type EvidenceStatus = 'NOT_REVIEWED' | 'REVIEWED' | 'CLINICAL_REVIEW_REQUIRED' | 'APPROVED';

export type DataQuality = 'VERIFIED' | 'INFERRED' | 'UNKNOWN' | 'REVIEW_REQUIRED';

export type ClaimType =
  | 'BIOLOGICAL_ROLE'
  | 'CLINICAL_ASSOCIATION'
  | 'LIMITATION'
  | 'PREANALYTICAL_FACTOR'
  | 'RISK_ASSOCIATION';

export interface Claim {
  claim_type: ClaimType;
  text: string;
  evidence_source_ids: string[];
}

export interface ExternalSource {
  source: 'FUNCTION_HEALTH';
  external_name: string;
  external_category: string | null;
  included_or_addon: 'INCLUDED' | 'ADDON' | null;
  testing_frequency: string | null;
  derived_or_measured: MeasurementType | null;
  source_reference: string | null;
}

export interface KnowledgeCard {
  biological_role: string | null;
  clinical_relevance: string | null;
  related_biomarkers: string[];
  preanalytical_factors: string | null;
  limitations: string | null;
  clinical_contexts: string | null;
}

export interface CanonicalBiomarker {
  canonical_id: string;
  canonical_name: string;
  aliases: string[];
  category: string;
  measurement_type: MeasurementType;
  sample_type: string;
  common_units: string[];
  external_sources: ExternalSource[];
  knowledge_card: KnowledgeCard;
  claims: Claim[];
  evidence_status: EvidenceStatus;
  data_quality: DataQuality;
  last_reviewed: string | null;
  version: number;
}

export interface BiomarcadoresFile {
  categoria: string;
  biomarcadores: CanonicalBiomarker[];
}

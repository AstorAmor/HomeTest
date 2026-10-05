// Tipos del motor de recomendaciones personalizadas. Ver
// src/logic/rulesEngine/README.md para el estado del diseño y qué falta
// decidir con la investigación externa (prompts/ en la raíz del repo).
//
// Composición deliberada: BiomarkerResult referencia un CanonicalBiomarker
// (knowledge/biomarcadores/*.json vía src/knowledge/canonicalBiomarkers.ts)
// en vez de duplicar su información -- la ficha de conocimiento es la única
// fuente de verdad clínica.

import { CanonicalBiomarker } from './knowledge';
import { RangeStatus } from '@/utils/rangeStatus';
import { CyclePhase } from './cycle';
import { WearableContext } from './wearable';

// ---------------------------------------------------------------------------
// Resultado de un biomarcador ya interpretado (flag calculado, rango
// resuelto -- ajustado por ciclo si aplica). Es el output del motor de
// reglas y el input que consume el LLM de síntesis, nunca al revés.
// ---------------------------------------------------------------------------

export interface ReferenceRange {
  min: number | null;
  max: number | null;
  unit: string;
  // Si el rango viene ajustado por fase de ciclo, de qué fase concreta.
  // null = rango general (sin ajuste), aplicable también a hombres y a
  // biomarcadores sin variación conocida por ciclo.
  adjustedForCyclePhase: CyclePhase | null;
}

export interface BiomarkerResult {
  canonicalId: string; // CanonicalBiomarker.canonical_id
  value: number;
  unit: string;
  measuredAt: string; // ISO timestamp de la extracción de muestra
  referenceRange: ReferenceRange;
  flag: RangeStatus; // 'en_rango' | 'por_debajo' | 'por_encima' | 'sin_rango'
  // Delta frente al valor anterior del mismo canonicalId, si existe --
  // null en el primer test o si no hay histórico. No es una tendencia
  // estadística, solo el último punto de comparación.
  previousValue: number | null;
  previousMeasuredAt: string | null;
}

// Ratio/score calculado a partir de otros BiomarkerResult (LDL, eGFR,
// HOMA-IR...). Separado de BiomarkerResult porque su "canonicalId" puede no
// existir todavía en knowledge/biomarcadores/*.json (ver ratios.ts) y porque
// necesita rastrear de qué inputs salió, para poder mostrar "calculado a
// partir de Glucosa + Insulina" en el informe.
export interface DerivedMetricResult {
  metricId: string; // p.ej. 'HOMA_IR', o canonical_id si ya existe en el catálogo
  label: string;
  value: number | null; // null si no se pudo calcular (input faltante o fuera de rango de validez de la fórmula)
  unit: string | null;
  inputsUsed: string[]; // canonicalId de los BiomarkerResult usados
  unavailableReason: string | null; // por qué value es null, cuando aplica
}

// ---------------------------------------------------------------------------
// Input al motor de recomendaciones
// ---------------------------------------------------------------------------

export type BiologicalSex = 'female' | 'male';

export type RecommendationGoal =
  | 'manage_condition' // Marta: controlar una condición/factor de riesgo diagnosticado
  | 'performance' // Diego: rendimiento deportivo / longevidad activa
  | 'general_checkup'; // Elena: chequeo general de conveniencia, sin objetivo específico

export interface MedicationEntry {
  name: string;
  // Texto libre tal como lo introduce el usuario -- normalizar/mapear a un
  // vocabulario controlado de interacciones es trabajo pendiente (ver
  // prompts/README.md, filtro de seguridad de medicación).
  dosage: string | null;
  startedAt: string | null;
}

export interface RecommendationInput {
  userId: string;
  age: number;
  biologicalSex: BiologicalSex;
  goal: RecommendationGoal;
  medications: MedicationEntry[];
  diagnosedConditions: string[]; // texto libre, mismo pendiente que MedicationEntry
  biomarkers: BiomarkerResult[];
  derivedMetrics: DerivedMetricResult[];
  // Fase de ciclo en el momento de la extracción de muestra, si aplica y el
  // usuario la registró. null también cubre: usuarios sin ciclo (hombres,
  // menopausia), anticoncepción hormonal, o dato no disponible.
  cyclePhaseAtCollection: CyclePhase | null;
  wearableContext: WearableContext | null;
  biologicalAge: BiologicalAgeResult | null;
}

// ---------------------------------------------------------------------------
// Edad biológica -- ver src/logic/rulesEngine/biologicalAge.ts. La fórmula
// concreta (PhenoAge / KDM / otra) está pendiente de la investigación
// externa; este tipo ya está cerrado para no tener que rehacer el resto del
// motor cuando se decida.
// ---------------------------------------------------------------------------

export interface BiologicalAgeResult {
  method: string; // p.ej. 'PhenoAge' -- se fija cuando se decida la fórmula
  chronologicalAge: number;
  biologicalAge: number;
  delta: number; // biologicalAge - chronologicalAge
  confidence: 'low' | 'medium' | 'high';
  missingInputs: string[]; // canonicalId que hicieron falta y no estaban disponibles
}

// ---------------------------------------------------------------------------
// Output del motor de recomendaciones -- lo que consume la UI de la app.
// Corresponde al JSON schema que generará el LLM de síntesis (ver
// prompts/multi-marker-plan.md); este tipo es el contrato, el prompt debe
// producir algo parseable como esto.
// ---------------------------------------------------------------------------

export type RecommendationPriority = 'high' | 'medium' | 'low';

// De dónde sale una afirmación del informe -- obligatorio para poder auditar
// qué dijo el sistema y por qué. Nunca debe haber una RecommendationItem sin
// al menos una EvidenceRef, salvo que sourceType sea 'insufficient_data'.
export type EvidenceSourceType =
  | 'knowledge_card' // knowledge/biomarcadores/*.json, campo knowledge_card
  | 'pubmed' // recuperado en tiempo real vía API, con PMID
  | 'clinical_rule' // regla determinista del motor (rango, ratio, escalado)
  | 'insufficient_data';

export interface EvidenceRef {
  sourceType: EvidenceSourceType;
  reference: string; // canonical_id, PMID, o id de la regla, según sourceType
  url: string | null;
}

export interface RecommendationItem {
  id: string;
  title: string;
  body: string;
  priority: RecommendationPriority;
  relatedBiomarkerIds: string[]; // canonicalId de BiomarkerResult/DerivedMetricResult relacionados
  evidence: EvidenceRef[];
  requiresMedicalConsult: boolean; // true fuerza "habla con tu médico colaborador" en la UI
}

export interface RecommendationSection {
  id: string; // p.ej. 'executive_summary', 'action_plan', 'category_lipidico'
  title: string;
  items: RecommendationItem[];
}

export interface RecommendationOutput {
  generatedAt: string;
  reportInputHash: string; // hash del RecommendationInput usado, para poder invalidar cache si cambia el input
  biologicalAge: BiologicalAgeResult | null;
  sections: RecommendationSection[];
  // Guardarraíl de nivel de informe: si es true, la UI debe mostrar un aviso
  // destacado antes que ninguna recomendación (ver prompts/safety-guardrails.md).
  escalateToPhysician: boolean;
  escalationReason: string | null;
}

// "Know your roots": antecedentes familiares (cáncer hereditario y corazón), como en la primera
// visita a un asesor genético. Son datos de salud de categoría especial (RGPD): solo los ve el
// usuario salvo que decida compartirlos.

export type Lineage = 'maternal' | 'paternal' | 'both'; // both = el propio usuario, hermanos, hijos, sobrinos

export type RelationId =
  | 'self'
  | 'mother'
  | 'father'
  | 'sister'
  | 'brother'
  | 'daughter'
  | 'son'
  | 'niece'
  | 'nephew'
  | 'grandmother_m'
  | 'grandfather_m'
  | 'aunt_m'
  | 'uncle_m'
  | 'cousin_f_m'
  | 'cousin_m_m'
  | 'grandmother_p'
  | 'grandfather_p'
  | 'aunt_p'
  | 'uncle_p'
  | 'cousin_f_p'
  | 'cousin_m_p';

// Tipos de cáncer que pesan en las herramientas (PAT, Ontario FHAT, Manchester, Amsterdam II /
// Bethesda). "urinary" = pelvis renal o uréter.
export type CancerType =
  | 'breast'
  | 'ovarian'
  | 'colorectal'
  | 'endometrial'
  | 'small_bowel'
  | 'urinary'
  | 'stomach'
  | 'pancreatic'
  | 'prostate'
  | 'other';

// Edad al diagnóstico por tramos: bastan para todos los cortes de las herramientas (<30, 30-39,
// 40-49, 50-59, 60+; <50 y <60). "unknown" puntúa en el tramo que menos suma y se avisa.
export type AgeBand = 'u30' | '30s' | '40s' | '50s' | '60plus' | 'unknown';

export interface CancerEntry {
  type: CancerType;
  age: AgeBand;
  bilateral?: boolean; // solo mama: en las dos mamas (o multifocal)
  ageGiven?: boolean; // ya eligió la edad (aunque sea "no lo sé"), para no darla por contestada
}

export interface Relative {
  id: string; // "aunt_m#2"
  relation: RelationId;
  cancers: CancerEntry[];
}

export type YesNo = 'yes' | 'no' | 'unsure';

// Nivel 1 (cribado rápido, inspirado en el PAT): sí / no / no lo sé
export type TriageId =
  | 'breast'
  | 'ovarian'
  | 'bowel'
  | 'pancreas_prostate'
  | 'variant'
  | 'self_cancer'
  | 'heart_early'
  | 'cholesterol'
  | 'sudden_death';

export type AshkenaziAnswer = 'maternal' | 'paternal' | 'both' | 'no' | 'unsure';

export type KnownGene = 'BRCA1' | 'BRCA2' | 'Lynch' | 'other';

export interface FamilyHistoryAnswers {
  triage: Partial<Record<TriageId, YesNo>>;
  ashkenazi?: AshkenaziAnswer;
  relatives: Relative[]; // con al menos un cáncer (incluye "self" si el usuario lo ha tenido)
  knownGenes?: KnownGene[];
  heartRelatives?: RelationId[]; // familiares de primer grado con enfermedad cardiovascular precoz
}

export type GeneticRiskLevel = 'population' | 'low' | 'moderate' | 'high';

export interface LineageScore {
  maternal: number;
  paternal: number;
}

export interface ManchesterScore {
  brca1: number;
  brca2: number;
  combined: number;
}

export interface GeneticsAssessment {
  level: GeneticRiskLevel;
  // Por qué ese nivel, en frases cortas que se enseñan tal cual
  reasons: string[];
  // Lo que el usuario debe recordarle al médico o al asesor genético
  keyPoints: string[];
  pat: LineageScore & { best: number; threshold: number; met: boolean };
  fhat: LineageScore & { best: number; threshold: number; met: boolean };
  manchester: { maternal: ManchesterScore; paternal: ManchesterScore; best: ManchesterScore; side: 'maternal' | 'paternal' };
  lynch: { amsterdamLike: boolean; bethesdaLike: boolean };
  heart: { flagged: boolean; points: string[] };
  unknownAges: boolean;
}

// Lo que se guarda (user_flags): el borrador para retomar en la misma pregunta y el resultado
export interface FamilyHistoryDraft {
  answers: FamilyHistoryAnswers;
  stepKey: string;
  updatedAt: string;
}

export interface FamilyHistoryRecord {
  answers: FamilyHistoryAnswers;
  level: GeneticRiskLevel;
  completedAt: string;
}

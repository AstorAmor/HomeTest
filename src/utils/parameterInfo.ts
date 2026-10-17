import { getCanonicalBiomarkerForExtractedName } from '@/knowledge/canonicalBiomarkers';
import { catalogCardEs } from '@/i18n/catalogEs';
import { getLang, t } from '@/i18n';

const DEFAULT_INFO = (nombre: string) =>
  t("{name} is one of the values measured in your lab report. A value outside the reference range doesn't necessarily mean a health problem, but it's worth discussing with your doctor.", { name: nombre });

export interface ParameterCard {
  role: string; // qué es
  relevance: string | null; // para qué sirve medirlo
  factors: string | null; // qué puede moverlo
}

// Ficha de un parámetro extraído de una analítica, en el idioma de la app: la base de conocimiento
// canónica (knowledge/biomarcadores/*.json, en inglés) y su traducción del catálogo (i18n/catalogEs).
// Si el parámetro no se reconoce o no tiene ficha, un texto genérico.
export function getParameterCard(nombre: string): ParameterCard & { canonicalId: string | null } {
  const biomarker = getCanonicalBiomarkerForExtractedName(nombre);
  if (!biomarker) return { canonicalId: null, role: DEFAULT_INFO(nombre), relevance: null, factors: null };
  const en = biomarker.knowledge_card;
  const es = getLang() === 'es' ? catalogCardEs[biomarker.canonical_id] : undefined;
  return {
    canonicalId: biomarker.canonical_id,
    role: es?.biological_role ?? en.biological_role ?? DEFAULT_INFO(nombre),
    relevance: es?.clinical_relevance ?? en.clinical_relevance ?? null,
    factors: es?.preanalytical_factors ?? en.preanalytical_factors ?? null,
  };
}

export function getParameterInfo(nombre: string): string {
  return getParameterCard(nombre).role;
}

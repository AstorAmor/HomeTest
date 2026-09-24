import { getCanonicalBiomarkerForExtractedName } from '@/knowledge/canonicalBiomarkers';

const DEFAULT_INFO = (nombre: string) =>
  `${nombre} is one of the parameters measured in your lab report. Values outside the reference range don't necessarily mean a health issue, but it's worth discussing with your doctor. (Sample content — verified medical information per parameter coming soon).`;

// Busca el parametro extraido en la base de conocimiento canonica
// (knowledge/biomarcadores/*.json via knowledge/mapping/extracted-name-aliases.json).
// Si no hay biomarcador canonico asociado, o su knowledge_card todavia no
// tiene biological_role redactado, cae al texto generico de siempre.
export function getParameterInfo(nombre: string): string {
  const biomarker = getCanonicalBiomarkerForExtractedName(nombre);
  return biomarker?.knowledge_card.biological_role ?? DEFAULT_INFO(nombre);
}

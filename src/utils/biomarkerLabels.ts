import { getAllCanonicalBiomarkers } from '@/knowledge/canonicalBiomarkers';
import { CanonicalBiomarker } from '@/types/knowledge';
import { getLang } from '@/i18n';

// Etiquetas legibles para las categorias provisionales de knowledge/biomarcadores/*.json.
export const BIOMARKER_CATEGORY_LABELS: Record<string, string> = {
  metabolico: 'Metabolic',
  lipidico: 'Heart & Lipids',
  renal: 'Kidneys',
  hepatico: 'Liver',
  electrolitos: 'Electrolytes',
  hematologia: 'Blood',
  endocrino: 'Stress & Aging',
  vitales: 'Vitals',
  tiroides: 'Thyroid',
  autoinmunidad: 'Autoimmunity',
  regulacion_inmune: 'Immune Regulation',
  hormonas: 'Hormones',
  salud_femenina: 'Female Health',
  salud_masculina: 'Male Health',
  toxinas_ambientales: 'Environmental Toxins',
  nutrientes: 'Nutrients',
  pancreas: 'Pancreas',
  orina: 'Urine',
  edad_biologica: 'Biological Age',
};

// knowledge/ trae el nombre en español (canonical_name) y en inglés (canonical_name_en).
export const biomarkerDisplayName = (b: CanonicalBiomarker) =>
  getLang() === 'es' ? b.canonical_name : b.canonical_name_en ?? b.canonical_name;

export interface PanelMarker {
  id: string;
  name: string;
  category: string;
  followUp: boolean; // se repite en el seguimiento de los 6 meses (y en los trimestrales de Premium)
  calculated: boolean; // índice o puntuación calculada a partir de otros valores
}

// Marcadores de la suscripción: el panel completo son los biomarcadores incluidos de la base
// de conocimiento y el seguimiento, los que se miden dos veces al año. Lista orientativa hasta
// cerrar el panel con el laboratorio (ver memoria: catálogo de paneles Vivolabs).
// Además de los que la base marca como 2 veces al año: decisión del fundador (2026-10-10).
const EXTRA_FOLLOW_UP = new Set(['VITAMIN_D']);

export function subscriptionPanelMarkers(): PanelMarker[] {
  return getAllCanonicalBiomarkers()
    // Las puntuaciones (edad biológica) no son marcadores de la analítica: se calculan en Mis datos
    .filter((b) => b.measurement_type !== 'SCORE' && b.external_sources.some((s) => s.included_or_addon === 'INCLUDED'))
    .map((b) => ({
      id: b.canonical_id,
      name: biomarkerDisplayName(b),
      category: b.category,
      followUp: EXTRA_FOLLOW_UP.has(b.canonical_id) || b.external_sources.some((s) => s.testing_frequency === '2x/year'),
      calculated: b.measurement_type === 'DERIVED',
    }));
}

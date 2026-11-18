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

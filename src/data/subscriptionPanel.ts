// Qué mide cada analítica de la suscripción, según el catálogo de Kuova del 28/10/2026 (opción 2,
// decidida): el análisis anual Kuova Baseline (31 pruebas de laboratorio, más la Lp(a) el primer año)
// y el seguimiento fijo a los 6 meses (23 pruebas: el chequeo básico del laboratorio más fosfatasa
// alcalina, ApoB y testosterona total). Siempre el mismo seguimiento, salga lo que salga.
// Premium cambia el análisis anual por el Kuova Premium (en el catálogo, «Kuova Pro (Complete)», 42 pruebas):
// todo el Baseline + T4 y T3 libres, ácido fólico, albúmina y creatinina en orina, SHBG, estradiol, FSH, LH y
// DHEA-S, más progesterona en mujeres o PSA total en hombres. Composición a validar con el asesor médico.
// Aquí cada valor del hemograma y de la orina y cada índice calculado cuentan como un marcador (así
// cuentan Lucis y Function). Lista orientativa hasta cerrar el panel con el laboratorio.

import { getAllCanonicalBiomarkers } from '@/knowledge/canonicalBiomarkers';
import { t } from '@/i18n';
import { biomarkerDisplayName } from '@/utils/biomarkerLabels';

// both: en el análisis anual y en el seguimiento; yearly: solo en el anual; firstYear: solo el primer año;
// premium: solo en el análisis anual de Premium
export type PanelWhen = 'both' | 'yearly' | 'firstYear' | 'premium';

export interface PanelMarker {
  id: string;
  name: string;
  category: string;
  when: PanelWhen;
  calculated: boolean; // índice calculado a partir de otros valores
  only?: 'female' | 'male';
}

const HEMOGRAM = ['HEMOGLOBIN', 'RBC', 'HEMATOCRIT', 'MCV', 'MCH', 'MCHC', 'RDW', 'PLATELET_COUNT', 'MPV', 'WBC_COUNT', 'NEUTROPHILS', 'LYMPHOCYTES', 'MONOCYTES', 'EOSINOPHILS', 'BASOPHILS'];
const URINE_PREFIX = 'URINE_';
// La orina del Baseline es la básica (tira y sedimento): la albúmina en orina va en Premium (y como módulo de la tienda)

// En el anual y en el seguimiento: el chequeo básico (hemograma, glucosa, HbA1c, lípidos, albúmina,
// transaminasas, GGT, bilirrubina, urea, creatinina con filtrado, úrico, PCR-us, hierro, ferritina,
// saturación de transferrina y orina) + fosfatasa alcalina, ApoB y testosterona total
export const PANEL_BOTH = [
  ...HEMOGRAM,
  'GLUCOSE',
  'HBA1C',
  'TOTAL_CHOLESTEROL',
  'HDL_C',
  'LDL_C',
  'TRIGLYCERIDES',
  'NON_HDL_CHOLESTEROL',
  'TC_HDL_RATIO',
  'APOB',
  'ALBUMIN',
  'AST',
  'ALT',
  'GGT',
  'ALP',
  'TOTAL_BILIRUBIN',
  'UREA',
  'CREATININE',
  'EGFR',
  'URIC_ACID',
  'HS_CRP',
  'IRON',
  'FERRITIN',
  'IRON_SATURATION',
  'TESTOSTERONE_TOTAL',
];
// Solo en el anual
export const PANEL_YEARLY = ['TSH', 'VITAMIN_D', 'MAGNESIUM', 'SODIUM', 'POTASSIUM', 'CALCIUM', 'INSULIN'];
export const PANEL_FIRST_YEAR = ['LIPOPROTEIN_A'];
// Solo en el anual de Premium (cada persona, según su sexo, suma la progesterona o el PSA)
export const PANEL_PREMIUM = ['T4_FREE', 'T3_FREE', 'URINE_MICROALBUMIN', 'SHBG', 'ESTRADIOL', 'FSH', 'LH', 'DHEA_S'];
export const PANEL_PREMIUM_MALE = ['PSA_TOTAL'];
// En esta lista, la DHEA-S va con las hormonas (en knowledge/ está en «endocrino»)
const CATEGORY: Record<string, string> = { DHEA_S: 'hormonas' };
// Nombre corto, el de la clínica, donde el de knowledge/ no cabe en la columna en el móvil (claves para t())
const SHORT_NAME: Record<string, string> = { T4_FREE: 'Free T4', T3_FREE: 'Free T3', FSH: 'FSH', LH: 'LH', DHEA_S: 'DHEA-S', PSA_TOTAL: 'Total PSA', SHBG: 'SHBG' };

// Lo que aún no está en knowledge/ (nombre en inglés, se traduce con t())
const EXTRAS: (Omit<PanelMarker, 'name'> & { label: string })[] = [
  { id: 'VITAMIN_B12', label: 'Vitamin B12', category: 'nutrientes', when: 'yearly', calculated: false },
  { id: 'HOMA_IR', label: 'HOMA-IR (insulin resistance)', category: 'metabolico', when: 'yearly', calculated: true },
  { id: 'FOLATE', label: 'Folic acid', category: 'nutrientes', when: 'premium', calculated: false },
  { id: 'URINE_ACR', label: 'Albumin-to-creatinine ratio (urine)', category: 'renal', when: 'premium', calculated: true },
  { id: 'PROGESTERONE', label: 'Progesterone', category: 'hormonas', when: 'premium', calculated: false, only: 'female' },
];

export function subscriptionPanelMarkers(): PanelMarker[] {
  const when = (id: string): PanelWhen | null =>
    PANEL_PREMIUM.includes(id) || PANEL_PREMIUM_MALE.includes(id)
      ? 'premium'
      : PANEL_BOTH.includes(id) || id.startsWith(URINE_PREFIX)
        ? 'both'
        : PANEL_YEARLY.includes(id)
          ? 'yearly'
          : PANEL_FIRST_YEAR.includes(id)
            ? 'firstYear'
            : null;
  const known: PanelMarker[] = getAllCanonicalBiomarkers().flatMap((b) => {
    const w = when(b.canonical_id);
    const only = PANEL_PREMIUM_MALE.includes(b.canonical_id) ? ('male' as const) : undefined;
    const category = CATEGORY[b.canonical_id] ?? b.category;
    const short = SHORT_NAME[b.canonical_id];
    const name = short ? t(short) : biomarkerDisplayName(b);
    return w ? [{ id: b.canonical_id, name, category, when: w, calculated: b.measurement_type === 'DERIVED', only }] : [];
  });
  return [...known, ...EXTRAS.map(({ label, ...m }) => ({ ...m, name: t(label) }))];
}

// Cuántos marcadores tiene cada analítica para una persona (en Premium, con la prueba de su sexo)
export const panelCounts = (markers: PanelMarker[]) => ({
  basic: markers.filter((m) => m.when !== 'premium').length,
  premium: markers.filter((m) => m.only !== 'male').length,
  followUp: markers.filter((m) => m.when === 'both').length,
});

import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { EscalationTier, MarkerFlag } from '@/types/report';

export const TIER_COLOR: Record<EscalationTier, string> = {
  verde: Colors.ok,
  ambar: Colors.attention,
  rojo: Colors.danger,
  critico: Colors.danger,
};

export const FLAG_LABEL: Record<MarkerFlag, string> = {
  alto: 'High',
  limite_alto: 'Borderline high',
  bajo: 'Low',
  limite_bajo: 'Borderline low',
  critico: 'Critical',
  en_rango: 'In range',
};

export const FLAG_ICON: Record<MarkerFlag, keyof typeof Ionicons.glyphMap> = {
  alto: 'arrow-up-circle',
  limite_alto: 'arrow-up-circle-outline',
  bajo: 'arrow-down-circle',
  limite_bajo: 'arrow-down-circle-outline',
  critico: 'alert-circle',
  en_rango: 'checkmark-circle-outline',
};

const CATEGORY_LABELS: Record<string, string> = {
  lipids: 'Lipids',
  metabolic: 'Metabolic',
  iron: 'Iron',
  vitamins: 'Vitamins',
  immune: 'Immune',
  cbc: 'Blood count',
  hormones: 'Sex hormones',
  hormones_growth: 'Growth hormone',
  cardio: 'Cardiovascular',
  tumor: 'Tumour markers',
  toxicology: 'Heavy metals',
  sti: 'STI screening',
};

export const categoryLabel = (categoryId: string) =>
  CATEGORY_LABELS[categoryId] ??
  categoryId.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

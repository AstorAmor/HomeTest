import type { ImageSourcePropType } from 'react-native';
import { ProfessionalRole, ROLE_INFO } from './servicesMock';
import { t } from '@/i18n';

// Ilustraciones de los especialistas. El plan ya no usa fotos (decisión del fundador, 2026-10-12):
// usa iconos sobre degradado (src/data/planCategories.ts). Las fotos siguen en assets/images/plan
// y assets/images/specialists por si vuelven.

export interface SpecialistCard {
  id: string;
  label: string;
  subtitle: string;
  image?: ImageSourcePropType;
  // Sin foto (o si se prefiere la ilustración): icono sobre degradado con manchas (BlobArt)
  icon?: string;
  palette?: [string, string, string];
}

// Especialistas del carrusel de Today: ilustración con el icono de su rol (ROLE_INFO), sin fotos
// (al fundador le parecían irreales). Las fotos siguen en assets/images/specialists por si vuelven.
const roleCard = (id: ProfessionalRole, label: string, subtitle: string): SpecialistCard => ({
  id,
  label,
  subtitle,
  icon: ROLE_INFO[id].icon,
  palette: ROLE_INFO[id].palette,
});

export const SPECIALISTS: SpecialistCard[] = [
  roleCard('doctor', t('Doctor'), t('Review your results')),
  roleCard('psychologist', t('Psychologist'), t('Stress, mood and sleep')),
  roleCard('midwife', t('Midwife'), t('Cycle, fertility, pregnancy')),
  roleCard('trainer', t('Personal trainer'), t('A plan for your goals')),
  roleCard('dietitian', t('Dietitian'), t('Eat for your markers')),
  roleCard('physio', t('Physiotherapist'), t('Move without pain')),
];

import type { ImageSourcePropType } from 'react-native';
import { ProfessionalRole, ROLE_INFO } from './servicesMock';
import type { PlanItemKind } from './planRepository';
import type { Sex } from './profileRepository';
import { t } from '@/i18n';

// Imágenes del plan y de los especialistas. Los archivos de assets/images/plan y
// assets/images/specialists son PROVISIONALES: se sustituyen por los definitivos
// con el mismo nombre (prompts en assets/images/IMAGE_PROMPTS.md).
const PLAN = {
  strength_female: require('../../assets/images/plan/strength_female.jpg'),
  strength_male: require('../../assets/images/plan/strength_male.jpg'),
  strength_mixed: require('../../assets/images/plan/strength_mixed.jpg'),
  walking_couple: require('../../assets/images/plan/walking_couple.jpg'),
  nutrition_salad_fish: require('../../assets/images/plan/nutrition_salad_fish.jpg'),
  sleep: require('../../assets/images/plan/sleep.jpg'),
  mindfulness: require('../../assets/images/plan/mindfulness.jpg'),
};

// Fuerza: mujer si el perfil es de mujer, hombre si es de hombre, y ambos en otro caso.
export function planImage(kind: PlanItemKind, sex?: Sex): ImageSourcePropType {
  switch (kind) {
    case 'strength':
      return sex === 'female' ? PLAN.strength_female : sex === 'male' ? PLAN.strength_male : PLAN.strength_mixed;
    case 'steps':
      return PLAN.walking_couple;
    case 'nutrition':
      return PLAN.nutrition_salad_fish;
    case 'sleep':
      return PLAN.sleep;
    case 'mindfulness':
      return PLAN.mindfulness;
  }
}

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

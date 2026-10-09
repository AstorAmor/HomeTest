import type { ImageSourcePropType } from 'react-native';
import type { PlanItemKind } from './planRepository';
import type { Sex } from './profileRepository';

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

export const SPECIALISTS: SpecialistCard[] = [
  { id: 'doctor', label: 'Doctor', subtitle: 'Review your results', image: require('../../assets/images/specialists/doctor.jpg') },
  { id: 'psychologist', label: 'Psychologist', subtitle: 'Stress, mood and sleep', icon: 'head-heart-outline', palette: ['#1E2A4A', '#4B5BA6', '#C7B6F2'] },
  { id: 'midwife', label: 'Midwife', subtitle: 'Cycle, fertility, pregnancy', image: require('../../assets/images/specialists/midwife.jpg') },
  { id: 'trainer', label: 'Personal trainer', subtitle: 'A plan for your goals', image: require('../../assets/images/specialists/personal_trainer.jpg') },
  { id: 'dietitian', label: 'Dietitian', subtitle: 'Eat for your markers', image: require('../../assets/images/specialists/dietitian.jpg') },
  { id: 'physio', label: 'Physiotherapist', subtitle: 'Move without pain', image: require('../../assets/images/specialists/physiotherapist.jpg') },
];

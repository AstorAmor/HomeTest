import type { FoodGroup } from '@/logic/foodGroups';
import type { Allergen, Budget, CookingSkill, DietGoal, DietType, ReferralReason } from './types';

// Opciones del cuestionario del menú (texto fuente en inglés; español en src/i18n/dietEs.ts)

export const DIET_GOALS: { id: DietGoal; label: string; hint: string }[] = [
  { id: 'health', label: 'Eat better', hint: 'Keep your weight and look after your results' },
  { id: 'lose', label: 'Lose weight', hint: 'A gentle deficit, without going hungry' },
  { id: 'gain', label: 'Build muscle', hint: 'A little more energy and protein' },
  { id: 'perform', label: 'Train better', hint: 'Fuel for your sport' },
];

export const DIET_TYPES: { id: DietType; label: string; hint: string }[] = [
  { id: 'omnivore', label: 'I eat everything', hint: 'Meat, fish, eggs and dairy' },
  { id: 'flexitarian', label: 'Mostly plants', hint: 'Meat once a week at most' },
  { id: 'pescatarian', label: 'Fish but no meat', hint: 'Fish, seafood, eggs and dairy' },
  { id: 'vegetarian', label: 'Vegetarian', hint: 'Eggs and dairy, no meat or fish' },
  { id: 'vegan', label: 'Vegan', hint: 'Nothing of animal origin' },
];

export const ALLERGENS: { id: Allergen; label: string }[] = [
  { id: 'gluten', label: 'Gluten (coeliac)' },
  { id: 'milk', label: 'Milk' },
  { id: 'egg', label: 'Egg' },
  { id: 'fish', label: 'Fish' },
  { id: 'crustaceans', label: 'Prawns and crustaceans' },
  { id: 'molluscs', label: 'Mussels, clams and squid' },
  { id: 'peanuts', label: 'Peanuts' },
  { id: 'nuts', label: 'Tree nuts' },
  { id: 'soy', label: 'Soy' },
  { id: 'sesame', label: 'Sesame' },
  { id: 'celery', label: 'Celery' },
];

// Lo que sienta mal: los mismos grupos que el diario de Digestión
export const AVOID_GROUPS: { id: FoodGroup; label: string }[] = [
  { id: 'lactose', label: 'Dairy with lactose' },
  { id: 'gluten', label: 'Gluten' },
  { id: 'legumes', label: 'Legumes' },
  { id: 'onion_garlic', label: 'Onion or garlic' },
  { id: 'fructose', label: 'Sweet fruit, juice or honey' },
  { id: 'polyols', label: 'Mushrooms, cauliflower, avocado, apple or pear' },
  { id: 'fatty', label: 'Fried or fatty' },
];

// "No me gusta": grupos de alimentos que se reconocen fácil
export const DISLIKES: { id: string; label: string; foods: string[] }[] = [
  { id: 'oily_fish', label: 'Oily fish', foods: ['salmon', 'sardines', 'mackerel', 'trout'] },
  { id: 'white_fish', label: 'White fish', foods: ['white_fish', 'tuna'] },
  { id: 'seafood', label: 'Seafood', foods: ['shrimp', 'mussels', 'squid'] },
  { id: 'red_meat', label: 'Red meat', foods: ['beef', 'beef_mince', 'pork_loin'] },
  { id: 'cold_cuts', label: 'Cold cuts', foods: ['cooked_ham', 'serrano_ham', 'turkey_slices'] },
  { id: 'eggs', label: 'Eggs', foods: ['egg'] },
  { id: 'cheese', label: 'Cheese', foods: ['fresh_cheese', 'cottage', 'mozzarella', 'parmesan', 'feta'] },
  { id: 'tofu', label: 'Tofu and tempeh', foods: ['tofu', 'tempeh'] },
  { id: 'mushrooms', label: 'Mushrooms', foods: ['mushrooms'] },
  { id: 'aubergine', label: 'Aubergine', foods: ['eggplant'] },
  { id: 'brassicas', label: 'Broccoli and cauliflower', foods: ['broccoli', 'cauliflower'] },
  { id: 'peppers', label: 'Peppers', foods: ['red_pepper', 'green_pepper'] },
  { id: 'avocado', label: 'Avocado', foods: ['avocado'] },
  { id: 'spinach', label: 'Spinach', foods: ['spinach'] },
  { id: 'olives', label: 'Olives', foods: ['olives'] },
  { id: 'quinoa_couscous', label: 'Quinoa and couscous', foods: ['quinoa', 'couscous'] },
];

export const BUDGETS: { id: Budget; label: string; hint: string }[] = [
  { id: 'low', label: 'Cheap', hint: 'Dishes under about €1.60' },
  { id: 'normal', label: 'Normal', hint: 'Dishes under about €3' },
  { id: 'any', label: 'No limit', hint: 'Whatever suits you best' },
];

export const SKILLS: { id: CookingSkill; label: string; hint: string }[] = [
  { id: 1, label: 'I hardly cook', hint: 'Assemble, toast, boil' },
  { id: 2, label: 'The basics', hint: 'Stews, grills and the oven' },
  { id: 3, label: 'I like cooking', hint: 'Rice dishes, risottos and more' },
];

export const SUPPLEMENTS: { id: string; label: string }[] = [
  { id: 'vitamin_d', label: 'Vitamin D' },
  { id: 'iron', label: 'Iron' },
  { id: 'b12', label: 'Vitamin B12' },
  { id: 'omega3', label: 'Omega-3' },
  { id: 'magnesium', label: 'Magnesium' },
  { id: 'multivitamin', label: 'Multivitamin' },
  { id: 'protein', label: 'Protein powder' },
  { id: 'creatine', label: 'Creatine' },
];

export const SAFETY: { id: ReferralReason; label: string }[] = [
  { id: 'pregnancy', label: 'I am pregnant or breastfeeding' },
  { id: 'kidney', label: 'I have kidney disease' },
  { id: 'eating_disorder', label: 'I have or had an eating disorder' },
  { id: 'insulin', label: 'I use insulin or diabetes pills that can cause low blood sugar' },
];

export const ACTIVITIES: { id: 'sedentary' | 'light' | 'active' | 'very_active'; label: string; hint: string }[] = [
  { id: 'sedentary', label: 'Little', hint: 'Desk job and little exercise' },
  { id: 'light', label: 'Some', hint: 'I walk or train 1-3 days' },
  { id: 'active', label: 'Quite a lot', hint: 'Training 3-5 days' },
  { id: 'very_active', label: 'A lot', hint: 'Hard training or a physical job' },
];

// Para el resumen de lo que se ha tenido en cuenta de las analíticas
export const MARKER_NAME: Record<string, string> = {
  ldl: 'LDL cholesterol',
  total_cholesterol: 'Total cholesterol',
  non_hdl_cholesterol: 'Non-HDL cholesterol',
  apob: 'ApoB',
  hdl: 'HDL cholesterol',
  triglycerides: 'Triglycerides',
  glucose: 'Glucose',
  hba1c: 'HbA1c',
  insulin: 'Insulin',
  homa_ir: 'HOMA-IR',
  uric_acid: 'Uric acid',
  alt: 'ALT',
  ast: 'AST',
  ggt: 'GGT',
  ferritin: 'Ferritin',
  iron: 'Iron',
  transferrin_saturation: 'Transferrin saturation',
  hemoglobin: 'Haemoglobin',
  vitamin_d: 'Vitamin D',
  vitamin_b12: 'Vitamin B12',
  homocysteine: 'Homocysteine',
  hs_crp: 'CRP',
  magnesium: 'Magnesium',
  omega3_total: 'Omega-3',
  egfr: 'Kidney filtration (eGFR)',
  creatinine: 'Creatinine',
  potassium: 'Potassium',
};

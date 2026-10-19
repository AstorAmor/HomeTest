import type { FoodGroup } from '@/logic/foodGroups';

// Menús: alimentos (composición de USDA), recetas, preferencias del cuestionario y el menú semanal.

export type Nutrients = {
  kcal: number;
  protein: number; // g
  fat: number;
  satFat: number;
  carbs: number;
  sugars: number;
  fiber: number;
  sodium: number; // mg
  potassium: number;
  calcium: number;
  iron: number;
  magnesium: number;
  vitC: number; // mg
  vitD: number; // µg
  b12: number; // µg
  folate: number; // µg
  cholesterol: number; // mg
  omega3: number; // g (ALA + EPA + DHA)
  epaDha: number; // g
};

export type FoodKind = 'plant' | 'dairy' | 'egg' | 'fish' | 'seafood' | 'meat';
export type Allergen = 'gluten' | 'milk' | 'egg' | 'fish' | 'crustaceans' | 'molluscs' | 'peanuts' | 'nuts' | 'soy' | 'sesame' | 'mustard' | 'celery';
export type FoodFlag = 'red_meat' | 'processed_meat' | 'oily_fish' | 'white_fish' | 'shellfish' | 'legume' | 'whole_grain' | 'nuts' | 'purine';
export type ShopSection = 'produce' | 'meat_fish' | 'chilled' | 'frozen' | 'bakery' | 'pantry';

export interface DietFood {
  id: string;
  fdc: number; // id en USDA FoodData Central
  name: { es: string; en: string };
  section: ShopSection;
  eurKg: number; // precio orientativo
  kind: FoodKind;
  allergens: Allergen[];
  groups: FoodGroup[];
  flags: FoodFlag[];
  piece?: { es: string; en: string; g: number }; // "2 huevos"
  per100: Nutrients;
}

export type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack';
export type DietType = 'omnivore' | 'flexitarian' | 'pescatarian' | 'vegetarian' | 'vegan';

export interface Recipe {
  id: string;
  meals: MealSlot[];
  minutes: number;
  skill: 1 | 2 | 3;
  tags: string[]; // batch (sirve para dos días), nocook
  name: { es: string; en: string };
  ingredients: { food: string; g: number }[]; // gramos por ración, en crudo
  steps: { es: string[]; en: string[] };
  diet: 'vegan' | 'vegetarian' | 'pescatarian' | 'omnivore'; // la dieta más estricta que lo admite
  allergens: Allergen[];
  groups: FoodGroup[];
  flags: FoodFlag[];
  cost: number; // € por ración
  nutrients: Nutrients; // por ración
}

export type DietGoal = 'health' | 'lose' | 'gain' | 'perform';
export type Budget = 'low' | 'normal' | 'any';
export type CookingSkill = 1 | 2 | 3;

// Situaciones en las que el menú automático no basta y lo hace un dietista
export type ReferralReason = 'pregnancy' | 'kidney' | 'eating_disorder' | 'insulin' | 'under_18' | 'low_kidney_lab' | 'high_potassium_lab';

export interface DietPrefs {
  goal: DietGoal;
  diet: DietType;
  allergies: Allergen[]; // fuera siempre
  avoidGroups: FoodGroup[]; // lo que le sienta mal (mismos grupos que Digestión)
  dislikes: string[]; // ids de alimentos que no quiere
  budget: Budget;
  skill: CookingSkill;
  minutes: number; // tiempo máximo para cocinar una comida (15, 30, 45, 60)
  batch: boolean; // cocinar una vez para dos días
  snacks: number; // 0, 1 o 2 tentempiés al día
  supplements: string[]; // vitamin_d, iron, b12, omega3, protein, creatine, multivitamin, magnesium
  // Para las calorías (del perfil si los hay)
  sex: 'female' | 'male' | null;
  age: number | null;
  heightCm: number | null;
  weightKg: number | null;
  activity: 'sedentary' | 'light' | 'active' | 'very_active';
  conditions: string[]; // diabetes (sin insulina), hypertension, high_cholesterol… (del perfil o del cuestionario)
  safety: ReferralReason[]; // respuestas del cuestionario de seguridad
  kcalTarget?: number | null; // los fija el dietista desde el portal (si no, se calculan)
  proteinTarget?: number | null;
  seed: number;
}

export interface PlannedMeal {
  slot: MealSlot;
  recipeId: string;
  portion: number; // raciones (0,75 a 1,5)
  leftover?: boolean; // sobras del día anterior (cocinar una vez para dos días)
  note?: string; // del dietista
}

export interface DietDay {
  day: number; // 0 = lunes
  meals: PlannedMeal[];
}

export interface DietTargets {
  kcal: number;
  protein: number; // g
  fiberMin: number;
  satFatMaxPct: number; // % de la energía
  sodiumMax: number; // mg
  sugarsMaxPct: number;
  oilyFishPerWeek: number;
  legumesPerWeek: number;
  redMeatMaxPerWeek: number;
  potassiumMax?: number; // mg, solo con el potasio alto
}

// Por qué el menú es así: lo que se ha tenido en cuenta de las analíticas y del cuestionario
export interface DietReason {
  id: string;
  title: string; // texto fuente en inglés
  detail: string;
  marker?: string;
  caution?: boolean; // "Para comentar con tu médico" (riñón, potasio, embarazo, insulina); sin diagnósticos
}

export interface DietPlan {
  id: string;
  title: string;
  createdAt: string;
  source: 'self' | 'professional';
  professionalId?: string | null;
  professionalName?: string | null;
  patientId?: string | null;
  prefs: DietPrefs;
  targets: DietTargets;
  reasons: DietReason[];
  days: DietDay[];
  note?: string;
  active: boolean;
}

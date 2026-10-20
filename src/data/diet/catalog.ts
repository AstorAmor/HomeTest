import { getLang, num, t } from '@/i18n';
import { FOOD_DATA, RECIPE_DATA } from './dietData';
import type { DietFood, MealSlot, Nutrients, Recipe, ShopSection } from './types';

// Alimentos y recetas de los menús. Composición: USDA FoodData Central (dominio público); recetas propias.

export const FOODS: Record<string, DietFood> = Object.fromEntries(FOOD_DATA.map((f) => [f.id, f]));
export const RECIPES: Record<string, Recipe> = Object.fromEntries(RECIPE_DATA.map((r) => [r.id, r]));
export const RECIPE_LIST: Recipe[] = RECIPE_DATA;

export const getRecipe = (id: string): Recipe | undefined => RECIPES[id];
export const getFood = (id: string): DietFood | undefined => FOODS[id];

export const recipeName = (r: Recipe | undefined) => (!r ? '' : getLang() === 'es' ? r.name.es : r.name.en);
export const recipeSteps = (r: Recipe) => (getLang() === 'es' ? r.steps.es : r.steps.en);
export const foodName = (f: DietFood | undefined) => (!f ? '' : getLang() === 'es' ? f.name.es : f.name.en);


export const SLOT_LABEL: Record<MealSlot, string> = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snack' };
export const slotLabel = (s: MealSlot, prefs?: { customs?: string[] }) =>
  prefs?.customs?.includes('ramadan') && (s === 'breakfast' || s === 'dinner') ? t(s === 'breakfast' ? 'Before dawn (suhoor)' : 'Breaking the fast (iftar)') : t(SLOT_LABEL[s]);
export const SLOT_ICON: Record<MealSlot, string> = { breakfast: 'coffee-outline', lunch: 'silverware-fork-knife', dinner: 'weather-night', snack: 'food-apple-outline' };

export const SECTION_LABEL: Record<ShopSection, string> = {
  produce: 'Fruit and vegetables',
  meat_fish: 'Meat and fish',
  chilled: 'Chilled and dairy',
  frozen: 'Frozen',
  bakery: 'Bread',
  pantry: 'Pantry',
};

// Líquidos: se muestran en ml (densidad ≈ 1)
const WHOLE_PIECES = new Set(['egg', 'yogurt', 'soy_yogurt', 'ww_tortilla', 'rice_cakes', 'dates', 'kiwi', 'banana', 'apple', 'pear', 'orange']);
const LIQUIDS = new Set(['milk', 'soy_milk', 'kefir', 'veg_broth', 'olive_oil', 'lemon', 'soy_sauce', 'vinegar']);

// "110 g · 2 huevos", "200 ml", "1 pizca". whole: piezas enteras hacia arriba (para la compra)
export function amountText(foodId: string, grams: number, opts: { whole?: boolean } = {}): string {
  const f = FOODS[foodId];
  if (grams < 1.5 && (foodId === 'salt' || foodId === 'cinnamon' || foodId === 'paprika' || foodId === 'cumin' || foodId === 'oregano')) return t('a pinch');
  const g = grams >= 100 ? Math.round(grams / 5) * 5 : Math.round(grams);
  const base = LIQUIDS.has(foodId) ? `${g} ml` : `${g} g`;
  if (f?.piece) {
    // Huevos, yogures, tortillas…: siempre enteros; tomate o cebolla admiten mitades
    const n = opts.whole ? Math.ceil(grams / f.piece.g - 0.15) : WHOLE_PIECES.has(foodId) ? Math.max(1, Math.round(grams / f.piece.g)) : Math.round((grams / f.piece.g) * 2) / 2;
    if (n >= 0.5) return `${base} · ${num(n)} ${pieceWord(f.piece, n > 1)}`;
  }
  return base;
}
// "huevo" → "huevos", "yogur" → "yogures", "egg" → "eggs"
const pieceWord = (p: { es: string; en: string }, plural: boolean) => {
  if (getLang() !== 'es') return plural ? `${p.en}s` : p.en;
  return plural ? `${p.es}${/[aeiouáéíóú]$/.test(p.es) ? 's' : 'es'}` : p.es;
};

export const scale = (n: Nutrients, k: number): Nutrients => Object.fromEntries(Object.entries(n).map(([key, v]) => [key, v * k])) as Nutrients;
export const addNutrients = (a: Nutrients, b: Nutrients): Nutrients => Object.fromEntries(Object.entries(a).map(([key, v]) => [key, v + (b as any)[key]])) as Nutrients;
export const ZERO: Nutrients = {
  kcal: 0, protein: 0, fat: 0, satFat: 0, carbs: 0, sugars: 0, fiber: 0, sodium: 0, potassium: 0, calcium: 0,
  iron: 0, magnesium: 0, vitC: 0, vitD: 0, b12: 0, folate: 0, cholesterol: 0, omega3: 0, epaDha: 0,
};

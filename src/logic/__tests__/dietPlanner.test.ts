import { describe, expect, it } from 'vitest';
import { FOODS, RECIPE_LIST, getRecipe } from '@/data/diet/catalog';
import type { DietPrefs } from '@/data/diet/types';
import { dietEs } from '@/i18n/dietEs';
import {
  DEFAULT_DIET_PREFS,
  LabFlag,
  alternativesForSlot,
  blockingReasons,
  CAUTION_TEXT,
  REFERRAL_TEXT,
  cautionReasons,
  dayTotals,
  dietTargets,
  generateDiet,
  referralReasons,
  shoppingList,
  weekSummary,
} from '@/logic/dietPlanner';

const prefs = (p: Partial<DietPrefs>): DietPrefs => ({ ...DEFAULT_DIET_PREFS, ...p });
const meals = (days: { meals: { recipeId: string }[] }[]) => days.flatMap((d) => d.meals.map((m) => getRecipe(m.recipeId)!));
const ADULT: Partial<DietPrefs> = { sex: 'female', age: 40, heightCm: 165, weightKg: 68, activity: 'light' };

describe('Recetario', () => {
  it('cada receta usa alimentos que existen, con nombre y pasos en los dos idiomas', () => {
    expect(RECIPE_LIST.length).toBeGreaterThan(80);
    for (const r of RECIPE_LIST) {
      for (const i of r.ingredients) expect(FOODS[i.food], `${r.id}: ${i.food}`).toBeTruthy();
      expect(r.steps.es.length, r.id).toBeGreaterThan(0);
      expect(r.steps.en.length, r.id).toBe(r.steps.es.length);
      expect(r.nutrients.kcal, r.id).toBeGreaterThan(80);
    }
  });
});

describe('Objetivos del día', () => {
  it('calorías con Mifflin-St Jeor y la actividad; perder peso baja un 20 % sin bajar del mínimo', () => {
    const keep = dietTargets(prefs(ADULT), []);
    // 10·68 + 6,25·165 − 5·40 − 161 = 1.350 kcal basales × 1,375 ≈ 1.850
    expect(keep.kcal).toBe(1850);
    const lose = dietTargets(prefs({ ...ADULT, goal: 'lose' }), []);
    expect(lose.kcal).toBe(1500);
    const tiny = dietTargets(prefs({ sex: 'female', age: 70, heightCm: 150, weightKg: 45, activity: 'sedentary', goal: 'lose' }), []);
    expect(tiny.kcal).toBeGreaterThanOrEqual(1200);
  });

  it('el LDL alto baja la grasa saturada al 7 % y sube la fibra; la tensión alta, el sodio a 1.500', () => {
    const t = dietTargets(prefs(ADULT), [{ marker: 'ldl', status: 'high' }]);
    expect(t.satFatMaxPct).toBe(7);
    expect(t.fiberMin).toBe(30);
    expect(t.redMeatMaxPerWeek).toBe(1);
    expect(dietTargets(prefs({ ...ADULT, conditions: ['hypertension'] }), []).sodiumMax).toBe(1500);
  });
});

describe('Cuándo lo hace un dietista y cuándo va con aviso', () => {
  it('detecta embarazo, riñón, potasio, menores y nada más', () => {
    expect(referralReasons(prefs({ safety: ['pregnancy'] }), [])).toContain('pregnancy');
    expect(referralReasons(prefs({}), [{ marker: 'egfr', status: 'low', value: 48 }])).toContain('low_kidney_lab');
    expect(referralReasons(prefs({}), [{ marker: 'potassium', status: 'high' }])).toContain('high_potassium_lab');
    expect(referralReasons(prefs({ age: 16 }), [])).toContain('under_18');
    expect(referralReasons(prefs(ADULT), [{ marker: 'ldl', status: 'high' }])).toEqual([]);
  });

  it('solo el trastorno alimentario y los menores se quedan sin menú; el resto va con aviso para el médico', () => {
    const all = referralReasons(prefs({ safety: ['pregnancy', 'eating_disorder', 'insulin'], age: 16 }), [{ marker: 'creatinine', status: 'high' }]);
    expect(blockingReasons(all).sort()).toEqual(['eating_disorder', 'under_18']);
    expect(cautionReasons(all).sort()).toEqual(['insulin', 'low_kidney_lab', 'pregnancy']);
  });

  it('creatinina alta: menú con proteína moderada, sin procesados y el aviso primero', () => {
    const p = prefs({ ...ADULT, sex: 'male', weightKg: 80, goal: 'gain', supplements: ['creatine'] });
    const labs: LabFlag[] = [{ marker: 'creatinine', status: 'high', value: 1.4 }];
    const g = generateDiet(p, labs);
    expect(g.targets.protein).toBeLessThanOrEqual(64); // 0,8 g/kg
    expect(dietTargets(p, []).protein).toBeGreaterThan(100); // sin el aviso, 1,6 g/kg
    expect(g.reasons[0]).toMatchObject({ id: 'caution_low_kidney_lab', caution: true });
    expect(g.reasons.some((r) => r.id === 'caution_creatine')).toBe(true);
    expect(meals(g.days).some((r) => r.flags.includes('processed_meat'))).toBe(false);
    expect(g.days.every((d) => d.meals.length >= 3)).toBe(true);
  });

  it('potasio alto: tope diario y menos potasio que sin el aviso', () => {
    const p = prefs({ ...ADULT, conditions: ['hypertension'] });
    const flagged = generateDiet(p, [{ marker: 'potassium', status: 'high' }]);
    const plain = generateDiet(p, []);
    expect(flagged.targets.potassiumMax).toBe(2500);
    const k = (days: typeof plain.days) => days.reduce((a, d) => a + dayTotals(d).potassium, 0) / days.length;
    expect(k(flagged.days)).toBeLessThan(k(plain.days));
    expect(k(flagged.days)).toBeLessThan(3000);
  });

  it('los avisos no diagnostican, no quitan importancia a un resultado ni hablan de dosis (prompts/system-prompt.md)', () => {
    const g = generateDiet(prefs({ ...ADULT, safety: ['kidney', 'pregnancy', 'insulin'], supplements: ['creatine'] }), [
      { marker: 'creatinine', status: 'high' },
      { marker: 'potassium', status: 'high' },
    ]);
    const texts = [
      ...g.reasons.flatMap((r) => [r.title, r.detail]),
      ...Object.values(CAUTION_TEXT).flatMap((c) => [c.title, c.detail]),
      ...Object.values(REFERRAL_TEXT),
    ];
    const all = [...texts, ...texts.map((x) => dietEs[x] ?? '')];
    const banned = [/(you have|you suffer|tienes|padeces|sufres) (a |an |una |un )?(kidney|renal|enfermedad|disease|insuficiencia)/i, /not always|no siempre es/i, /(dose|doses|dosis)/i, /kidney values|valores del riñón|función renal/i];
    for (const x of all) for (const re of banned) expect(x, x).not.toMatch(re);
    expect(texts.every((x) => dietEs[x]), 'todos traducidos').toBe(true);
  });

  it('embarazo: sin recorte de calorías aunque quiera perder peso, y sin jamón curado', () => {
    const g = generateDiet(prefs({ ...ADULT, goal: 'lose', safety: ['pregnancy'] }), []);
    expect(g.targets.kcal).toBe(dietTargets(prefs(ADULT), []).kcal);
    expect(meals(g.days).some((r) => r.ingredients.some((i) => i.food === 'serrano_ham'))).toBe(false);
    expect(g.reasons[0]).toMatchObject({ id: 'caution_pregnancy', caution: true });
  });
});

describe('Menú semanal', () => {
  it('7 días con desayuno, comida, cena y el tentempié pedido', () => {
    const g = generateDiet(prefs({ ...ADULT, snacks: 1 }), []);
    expect(g.days).toHaveLength(7);
    for (const d of g.days) expect(d.meals.map((m) => m.slot)).toEqual(['breakfast', 'lunch', 'snack', 'dinner']);
  });

  it('respeta la dieta, las alergias y lo que sienta mal', () => {
    const vegan = meals(generateDiet(prefs({ ...ADULT, diet: 'vegan' }), []).days);
    expect(vegan.every((r) => r.diet === 'vegan')).toBe(true);
    const noNuts = meals(generateDiet(prefs({ ...ADULT, allergies: ['nuts', 'peanuts'] }), []).days);
    expect(noNuts.some((r) => r.allergens.includes('nuts') || r.allergens.includes('peanuts'))).toBe(false);
    const lowFodmap = meals(generateDiet(prefs({ ...ADULT, avoidGroups: ['lactose', 'onion_garlic', 'gluten'] }), []).days);
    expect(lowFodmap.some((r) => r.groups.some((g) => ['lactose', 'onion_garlic', 'gluten'].includes(g)))).toBe(false);
    const noFish = meals(generateDiet(prefs({ ...ADULT, dislikes: ['salmon', 'sardines'] }), []).days);
    expect(noFish.some((r) => r.ingredients.some((i) => i.food === 'salmon' || i.food === 'sardines'))).toBe(false);
  });

  it('pescado azul al menos 2 veces, legumbres 3 y carne roja como mucho 2', () => {
    const s = weekSummary(generateDiet(prefs({ ...ADULT }), []).days);
    expect(s.oilyFish).toBeGreaterThanOrEqual(2);
    expect(s.legumes).toBeGreaterThanOrEqual(3);
    expect(s.redMeat).toBeLessThanOrEqual(2);
  });

  it('con el LDL alto: menos grasa saturada y nada de embutido', () => {
    const g = generateDiet(prefs({ ...ADULT }), [{ marker: 'ldl', status: 'high' }]);
    const s = weekSummary(g.days);
    expect(s.satFatPct).toBeLessThan(9);
    expect(meals(g.days).some((r) => r.flags.includes('processed_meat'))).toBe(false);
    expect(s.redMeat).toBeLessThanOrEqual(1);
    expect(g.reasons.map((r) => r.id)).toContain('ldl');
  });

  it('con el ácido úrico alto, casi sin platos ricos en purinas', () => {
    const g = generateDiet(prefs({ ...ADULT }), [{ marker: 'uric_acid', status: 'high' }]);
    expect(meals(g.days).filter((r) => r.flags.includes('purine')).length).toBeLessThanOrEqual(3);
  });

  it('las raciones acercan cada día a las calorías objetivo', () => {
    const g = generateDiet(prefs({ ...ADULT, goal: 'lose' }), []);
    for (const d of g.days) {
      const k = dayTotals(d).kcal;
      expect(k).toBeGreaterThan(g.targets.kcal * 0.75);
      expect(k).toBeLessThan(g.targets.kcal * 1.25);
    }
  });

  it('con poco dinero, el menú sale más barato', () => {
    const cheap = weekSummary(generateDiet(prefs({ ...ADULT, budget: 'low' }), []).days).cost;
    const any = weekSummary(generateDiet(prefs({ ...ADULT, budget: 'any' }), []).days).cost;
    expect(cheap).toBeLessThan(any);
  });

  it('cocinar una vez para dos días: la cena de ayer es la comida de hoy', () => {
    const g = generateDiet(prefs({ ...ADULT, batch: true }), []);
    const leftovers = g.days.flatMap((d) => d.meals.filter((m) => m.leftover).map((m) => ({ d: d.day, id: m.recipeId })));
    expect(leftovers.length).toBeGreaterThan(0);
    for (const l of leftovers) expect(g.days[l.d - 1].meals.find((m) => m.slot === 'dinner')!.recipeId).toBe(l.id);
  });

  it('sin mucho tiempo, platos rápidos', () => {
    const g = generateDiet(prefs({ ...ADULT, minutes: 15 }), []);
    expect(meals(g.days).every((r) => r.minutes <= 30)).toBe(true);
  });

  it('es determinista con la misma semilla', () => {
    expect(generateDiet(prefs({ ...ADULT, seed: 4 }), [])).toEqual(generateDiet(prefs({ ...ADULT, seed: 4 }), []));
    expect(JSON.stringify(generateDiet(prefs({ ...ADULT, seed: 4 }), []).days)).not.toEqual(JSON.stringify(generateDiet(prefs({ ...ADULT, seed: 5 }), []).days));
  });

  it('la lista de la compra suma todo lo de la semana', () => {
    const g = generateDiet(prefs({ ...ADULT }), []);
    const list = shoppingList(g.days);
    const oil = list.find((i) => i.food === 'olive_oil');
    expect(oil && oil.grams).toBeGreaterThan(30);
    expect(list.reduce((a, i) => a + i.cost, 0)).toBeCloseTo(weekSummary(g.days).cost, 0);
  });

  it('cambiar un plato ofrece alternativas que encajan, mejores primero', () => {
    const alts = alternativesForSlot(prefs({ ...ADULT, diet: 'vegetarian' }), [{ marker: 'ferritin', status: 'low' }], 'lunch');
    expect(alts.length).toBeGreaterThan(5);
    expect(alts.every((r) => r.diet === 'vegan' || r.diet === 'vegetarian')).toBe(true);
  });

  it('vegano sin suplemento de B12: se avisa', () => {
    const g = generateDiet(prefs({ ...ADULT, diet: 'vegan' }), []);
    expect(g.reasons.map((r) => r.id)).toContain('b12_vegan');
  });
});

void ({} as LabFlag);

describe('Soja y pautas religiosas o culturales', () => {
  const soy = (r: { ingredients: { food: string }[] }) => r.ingredients.some((i) => i.food === 'tofu' || i.food === 'tempeh');
  const isMeat = (r: { ingredients: { food: string }[] }) => r.ingredients.some((i) => FOODS[i.food]?.kind === 'meat');

  it('quien come carne o pescado no lleva tofu ni tempeh; en vegano, como mucho 3 a la semana y con nota', () => {
    for (const diet of ['omnivore', 'flexitarian', 'pescatarian'] as const)
      expect(meals(generateDiet(prefs({ ...ADULT, diet }), [{ marker: 'ldl', status: 'high' }]).days).some(soy), diet).toBe(false);
    const vegan = generateDiet(prefs({ ...ADULT, diet: 'vegan' }), []);
    expect(meals(vegan.days).filter(soy).length).toBeLessThanOrEqual(3);
    if (meals(vegan.days).some(soy)) expect(vegan.reasons.some((r) => r.id === 'soy')).toBe(true);
  });

  it('halal y kosher: sin cerdo; kosher, sin marisco ni carne con lácteos en el mismo plato', () => {
    const pork = ['pork_loin', 'cooked_ham', 'serrano_ham'];
    const halal = meals(generateDiet(prefs({ ...ADULT, customs: ['halal'] }), []).days);
    expect(halal.some((r) => r.ingredients.some((i) => pork.includes(i.food)))).toBe(false);
    const kosher = meals(generateDiet(prefs({ ...ADULT, customs: ['kosher'] }), []).days);
    expect(kosher.some((r) => r.ingredients.some((i) => [...pork, 'shrimp', 'mussels', 'squid'].includes(i.food)))).toBe(false);
    expect(kosher.some((r) => isMeat(r) && r.ingredients.some((i) => FOODS[i.food]?.kind === 'dairy'))).toBe(false);
  });

  it('viernes sin carne en Cuaresma', () => {
    const g = generateDiet(prefs({ ...ADULT, customs: ['lent_fridays'] }), []);
    expect(meals([g.days[4]]).some(isMeat)).toBe(false);
  });

  it('Ramadán: antes del amanecer y al romper el ayuno, sin comida de mediodía; aviso si usa insulina', () => {
    const g = generateDiet(prefs({ ...ADULT, snacks: 1, customs: ['ramadan'] }), []);
    for (const d of g.days) expect(d.meals.map((m) => m.slot)).toEqual(['breakfast', 'dinner', 'snack']);
    const kcal = g.days.reduce((a, d) => a + dayTotals(d).kcal, 0) / 7;
    expect(Math.abs(kcal - g.targets.kcal)).toBeLessThan(g.targets.kcal * 0.2);
    const ins = generateDiet(prefs({ ...ADULT, customs: ['ramadan'], safety: ['insulin'] }), []);
    expect(ins.reasons.some((r) => r.id === 'caution_ramadan' && r.caution)).toBe(true);
  });
});


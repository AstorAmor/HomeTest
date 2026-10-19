import { RECIPE_LIST, FOODS, addNutrients, getRecipe, scale, ZERO } from '@/data/diet/catalog';
import type {
  DietDay,
  DietPlan,
  DietPrefs,
  DietReason,
  DietTargets,
  MealSlot,
  Nutrients,
  PlannedMeal,
  Recipe,
  ReferralReason,
} from '@/data/diet/types';

// Generador de menús semanales. Sin IA: filtra las recetas por lo que no puede o no quiere comer,
// las puntúa según sus analíticas y su objetivo, reparte la semana (pescado azul, legumbres, carne roja,
// variedad) y ajusta las raciones a sus calorías.
//
// Referencias de las reglas (SUPUESTOS pendientes de revisión por un dietista-nutricionista):
// - Energía: Mifflin-St Jeor × actividad (1,2 / 1,375 / 1,55 / 1,725); perder peso −20 % sin bajar del
//   gasto basal ni de 1.200 (mujer) / 1.500 kcal (hombre); ganar +10 %.
// - Proteína: 1,0 g/kg (salud), 1,4 (perder peso, rendimiento), 1,6 (ganar músculo); +10 % si es vegano.
// - Fibra ≥ 25 g (mujer) / 30 g (hombre), ≥ 30 g con LDL, glucosa o hígado alterados (EFSA, ESC/EAS).
// - Grasa saturada < 10 % (OMS), < 7 % con el LDL alto (ESC/EAS 2019). Sodio < 2.000 mg (OMS), < 1.500
//   con la tensión alta (AHA/DASH). Azúcares totales < 18 % de la energía, < 12 % con glucosa,
//   triglicéridos o hígado alterados.
// - Semana: pescado azul 2 veces (3 con triglicéridos u omega-3 bajos), legumbres 3-4 (AESAN 2022),
//   carne roja ≤ 2 (≤ 1 con LDL, ácido úrico o PCR altos), procesada ≤ 1 (0 con LDL, tensión o PCR).
//
// Con estos se hace el menú igualmente, adaptado y con un aviso de "¡Atención!, ve a un médico" encima
// (decisión del fundador, 2026-10-19; antes se derivaba al dietista sin menú):
// - Riñón (enfermedad renal o filtrado bajo / creatinina alta en la analítica): objetivo de proteína 0,8 g/kg
//   (KDIGO 2024, ERC G3-G5; con el recetario sale ~0,9-1,1 g/kg, frente a ~1,7 sin el aviso), sal < 2.000 mg,
//   sin carne procesada (fosfatos añadidos) y sin premiar el potasio. El aviso enseña lo que lleva de verdad.
// - Potasio alto: objetivo de ~2.500 mg de potasio al día en la puntuación (SUPUESTO; con 2.000-2.700 kcal sale
//   ~2.500-3.500 mg, frente a ~5.000 sin el aviso) y sin premiar los alimentos ricos en él.
// - Embarazo o lactancia: sin recorte de calorías y sin jamón curado (AESAN: embutidos crudos curados).
// - Insulina o pastillas que bajan el azúcar: sin recorte de calorías.
// Siguen sin menú automático (se deriva al dietista): trastorno de la conducta alimentaria y menores de 18.

export interface LabFlag {
  marker: string; // marker_id (ldl, ferritin, vitamin_d…)
  status: 'high' | 'low';
  value?: number;
}

type Focus =
  | 'ldl'
  | 'tg'
  | 'glucose'
  | 'uric'
  | 'liver'
  | 'bp'
  | 'iron'
  | 'vitd'
  | 'b12'
  | 'folate'
  | 'crp'
  | 'omega3'
  | 'magnesium'
  | 'hdl';

const MARKERS: Record<Focus, { high?: string[]; low?: string[] }> = {
  ldl: { high: ['ldl', 'total_cholesterol', 'non_hdl_cholesterol', 'apob', 'tc_hdl_ratio'] },
  tg: { high: ['triglycerides'] },
  glucose: { high: ['glucose', 'hba1c', 'insulin', 'homa_ir'] },
  uric: { high: ['uric_acid'] },
  liver: { high: ['alt', 'ast', 'ggt'] },
  bp: { high: ['bp_systolic', 'bp_diastolic'] },
  iron: { low: ['ferritin', 'iron', 'transferrin_saturation', 'hemoglobin'] },
  vitd: { low: ['vitamin_d'] },
  b12: { low: ['vitamin_b12'], high: ['mma_b12'] },
  folate: { high: ['homocysteine'] },
  crp: { high: ['hs_crp'] },
  omega3: { low: ['omega3_total', 'omega3_epa', 'omega3_dha'] },
  magnesium: { low: ['magnesium'] },
  hdl: { low: ['hdl'] },
};

export function focusesFrom(prefs: Pick<DietPrefs, 'conditions' | 'diet'>, labs: LabFlag[]): Set<Focus> {
  const out = new Set<Focus>();
  for (const [focus, m] of Object.entries(MARKERS) as [Focus, { high?: string[]; low?: string[] }][]) {
    if (labs.some((l) => (l.status === 'high' && m.high?.includes(l.marker)) || (l.status === 'low' && m.low?.includes(l.marker)))) out.add(focus);
  }
  if (prefs.conditions.includes('high_cholesterol')) out.add('ldl');
  if (prefs.conditions.includes('diabetes') || prefs.conditions.includes('prediabetes') || prefs.conditions.includes('pcos')) out.add('glucose');
  if (prefs.conditions.includes('hypertension') || prefs.conditions.includes('heart_disease')) out.add('bp');
  if (prefs.conditions.includes('heart_disease')) out.add('ldl');
  if (prefs.conditions.includes('anaemia')) out.add('iron');
  if (prefs.diet === 'vegan') out.add('b12');
  return out;
}

// ¿Hace falta un dietista en vez del menú automático?
export function referralReasons(prefs: Pick<DietPrefs, 'safety' | 'age'>, labs: LabFlag[]): ReferralReason[] {
  const out = new Set<ReferralReason>(prefs.safety);
  if (prefs.age !== null && prefs.age < 18) out.add('under_18');
  if (labs.some((l) => (l.marker === 'egfr' && l.status === 'low') || (l.marker === 'creatinine' && l.status === 'high'))) out.add('low_kidney_lab');
  if (labs.some((l) => l.marker === 'potassium' && l.status === 'high')) out.add('high_potassium_lab');
  return [...out];
}

// Lo que sigue derivando al dietista sin menú; el resto se hace con aviso (ver la cabecera)
const BLOCKING: ReferralReason[] = ['eating_disorder', 'under_18'];
export const blockingReasons = (r: ReferralReason[]) => r.filter((x) => BLOCKING.includes(x));
export const cautionReasons = (r: ReferralReason[]) => r.filter((x) => !BLOCKING.includes(x));

interface Cautions {
  kidney: boolean;
  potassium: boolean;
  noDeficit: boolean; // embarazo o insulina: sin recorte de calorías
  pregnancy: boolean;
}
function cautionsFor(prefs: Pick<DietPrefs, 'safety' | 'age'>, labs: LabFlag[]): Cautions {
  const c = cautionReasons(referralReasons(prefs, labs));
  return {
    kidney: c.includes('kidney') || c.includes('low_kidney_lab'),
    potassium: c.includes('high_potassium_lab'),
    noDeficit: c.includes('pregnancy') || c.includes('insulin'),
    pregnancy: c.includes('pregnancy'),
  };
}
export const KIDNEY_PROTEIN_PER_KG = 0.8;
export const POTASSIUM_MAX_MG = 2500;
const PREGNANCY_AVOID = ['serrano_ham'];

const ACTIVITY = { sedentary: 1.2, light: 1.375, active: 1.55, very_active: 1.725 } as const;

export function dietTargets(prefs: DietPrefs, labs: LabFlag[]): DietTargets {
  const f = focusesFrom(prefs, labs);
  const c = cautionsFor(prefs, labs);
  const female = prefs.sex === 'female';
  const goal = c.noDeficit && prefs.goal === 'lose' ? 'health' : prefs.goal;
  let kcal: number;
  if (prefs.weightKg && prefs.heightCm && prefs.age && prefs.sex) {
    const bmr = 10 * prefs.weightKg + 6.25 * prefs.heightCm - 5 * prefs.age + (female ? -161 : 5);
    const tdee = bmr * ACTIVITY[prefs.activity];
    kcal = goal === 'lose' ? Math.max(tdee * 0.8, bmr * 1.05, female ? 1200 : 1500) : goal === 'gain' || goal === 'perform' ? tdee * 1.1 : tdee;
  } else {
    kcal = female ? 1900 : prefs.sex === 'male' ? 2400 : 2100;
    if (goal === 'lose') kcal *= 0.85;
    if (goal === 'gain' || goal === 'perform') kcal *= 1.1;
  }
  kcal = Math.round(kcal / 50) * 50;
  if (prefs.kcalTarget) kcal = prefs.kcalTarget;
  const perKg = prefs.goal === 'gain' ? 1.6 : prefs.goal === 'lose' || prefs.goal === 'perform' ? 1.4 : 1.0;
  let protein = prefs.weightKg ? prefs.weightKg * perKg : (kcal * 0.18) / 4;
  if (prefs.diet === 'vegan') protein *= 1.1;
  protein = Math.min(Math.round(protein), Math.round((kcal * 0.3) / 4));
  // Riñón: proteína moderada (sin peso, ~10 % de la energía). Lo que fije el dietista manda.
  if (c.kidney) protein = Math.min(protein, Math.round(prefs.weightKg ? prefs.weightKg * KIDNEY_PROTEIN_PER_KG : (kcal * 0.1) / 4));
  if (prefs.proteinTarget) protein = prefs.proteinTarget;
  return {
    kcal,
    protein,
    fiberMin: f.has('ldl') || f.has('glucose') || f.has('liver') ? 30 : female ? 25 : 30,
    satFatMaxPct: f.has('ldl') ? 7 : 10,
    sodiumMax: f.has('bp') ? 1500 : 2000,
    sugarsMaxPct: f.has('glucose') || f.has('tg') || f.has('liver') ? 12 : 18,
    oilyFishPerWeek: canEat(prefs, 'fish') ? (f.has('tg') || f.has('omega3') || f.has('crp') ? 3 : 2) : 0,
    legumesPerWeek: f.has('ldl') || f.has('glucose') || f.has('iron') ? 4 : 3,
    redMeatMaxPerWeek: !canEat(prefs, 'meat') ? 0 : prefs.diet === 'flexitarian' || f.has('ldl') || f.has('uric') || f.has('crp') ? 1 : 2,
    ...(c.potassium ? { potassiumMax: POTASSIUM_MAX_MG } : {}),
  };
}

const canEat = (prefs: Pick<DietPrefs, 'diet' | 'allergies'>, kind: 'fish' | 'meat') =>
  kind === 'fish' ? ['omnivore', 'flexitarian', 'pescatarian'].includes(prefs.diet) && !prefs.allergies.includes('fish') : ['omnivore', 'flexitarian'].includes(prefs.diet);

const DIET_ALLOWS: Record<DietPrefs['diet'], Recipe['diet'][]> = {
  omnivore: ['vegan', 'vegetarian', 'pescatarian', 'omnivore'],
  flexitarian: ['vegan', 'vegetarian', 'pescatarian', 'omnivore'],
  pescatarian: ['vegan', 'vegetarian', 'pescatarian'],
  vegetarian: ['vegan', 'vegetarian'],
  vegan: ['vegan'],
};

const BUDGET_MAX = { low: 1.6, normal: 3.0, any: Infinity } as const;

export interface FitOptions {
  extraMinutes?: number;
  ignoreBudget?: boolean;
  ignoreSkill?: boolean;
}

// Lo que nunca se relaja: dieta, alergias, lo que sienta mal y lo que no le gusta
export function recipeAllowed(r: Recipe, prefs: DietPrefs): boolean {
  if (!DIET_ALLOWS[prefs.diet].includes(r.diet)) return false;
  if (r.allergens.some((a) => prefs.allergies.includes(a))) return false;
  if (r.groups.some((g) => prefs.avoidGroups.includes(g))) return false;
  if (r.ingredients.some((i) => prefs.dislikes.includes(i.food))) return false;
  if (prefs.safety.includes('pregnancy') && r.ingredients.some((i) => PREGNANCY_AVOID.includes(i.food))) return false;
  return true;
}

export function recipeFits(r: Recipe, prefs: DietPrefs, slot: MealSlot, o: FitOptions = {}): boolean {
  if (!r.meals.includes(slot) || !recipeAllowed(r, prefs)) return false;
  const maxMin = (slot === 'breakfast' || slot === 'snack' ? Math.min(prefs.minutes, 15) : prefs.minutes) + (o.extraMinutes ?? 0);
  if (r.minutes > maxMin) return false;
  if (!o.ignoreSkill && r.skill > prefs.skill) return false;
  const budget = BUDGET_MAX[prefs.budget] * (slot === 'breakfast' || slot === 'snack' ? 0.6 : 1);
  if (!o.ignoreBudget && r.cost > budget) return false;
  return true;
}

// ── Puntuación de una receta para esta persona (por cada 500 kcal, para comparar platos de distinto tamaño) ──
export function recipeScore(
  r: Recipe,
  focuses: Set<Focus>,
  targets: DietTargets,
  prefs: DietPrefs,
  caution: Pick<Cautions, 'kidney' | 'potassium'> = { kidney: false, potassium: targets.potassiumMax !== undefined }
): number {
  const n = r.nutrients;
  const k = 500 / Math.max(n.kcal, 50);
  const per = (v: number) => v * k;
  let s = 0;
  const satPct = (n.satFat * 9 * 100) / Math.max(n.kcal, 1);
  const sugarPct = (n.sugars * 4 * 100) / Math.max(n.kcal, 1);
  const has = (f: string) => r.flags.includes(f as any);
  // Base: fibra, proteína, poca sal, poca grasa saturada
  s += Math.min(per(n.fiber) / 8, 1.5);
  // Con el riñón la proteína no suma: resta lo que pase de su parte (proteína del día por cada 500 kcal)
  if (!caution.kidney) s += Math.min(per(n.protein) / 30, 0.8);
  else s -= Math.max(0, per(n.protein) - (targets.protein * 500) / targets.kcal) / 3;
  s -= Math.max(0, satPct - targets.satFatMaxPct) / 4;
  s -= Math.max(0, per(n.sodium) - 600) / 350;
  s -= Math.max(0, sugarPct - targets.sugarsMaxPct) / 8;
  if (focuses.has('ldl')) {
    s += Math.min(per(n.fiber) / 6, 1.5) + (has('legume') ? 0.6 : 0) + (has('oily_fish') ? 0.6 : 0) + (has('nuts') ? 0.3 : 0);
    s -= (has('processed_meat') ? 1.5 : 0) + (has('red_meat') ? 0.6 : 0) + Math.max(0, satPct - 7) / 2;
  }
  if (focuses.has('tg')) s += (has('oily_fish') ? 1 : 0) - Math.max(0, sugarPct - 12) / 4;
  if (focuses.has('glucose')) s += Math.min(per(n.fiber) / 6, 1.2) + (has('whole_grain') || has('legume') ? 0.5 : 0) - Math.max(0, per(n.sugars) - 15) / 8;
  if (focuses.has('uric')) s -= has('purine') ? 1.5 : 0;
  if (focuses.has('liver')) s -= Math.max(0, sugarPct - 12) / 4 + (has('processed_meat') ? 0.8 : 0) + (r.groups.includes('fatty') ? 0.8 : 0);
  // Con el riñón o el potasio alto no se premia el potasio; con el potasio alto, además, se penaliza
  if (focuses.has('bp')) s += (caution.kidney || caution.potassium ? 0 : Math.min(per(n.potassium) / 1200, 1)) - Math.max(0, per(n.sodium) - 500) / 300 - (has('processed_meat') ? 1 : 0);
  if (targets.potassiumMax !== undefined) s -= Math.max(0, per(n.potassium) - (targets.potassiumMax * 500) / targets.kcal) / 150;
  if (focuses.has('iron')) s += Math.min(per(n.iron) / 4, 1.5) + (per(n.vitC) > 30 ? 0.3 : 0);
  if (focuses.has('vitd')) s += Math.min(per(n.vitD) / 3, 1.5);
  if (focuses.has('b12') && prefs.diet !== 'vegan') s += Math.min(per(n.b12) / 1.5, 1);
  if (focuses.has('folate')) s += Math.min(per(n.folate) / 150, 1);
  if (focuses.has('crp')) s += (has('oily_fish') ? 0.8 : 0) + (has('nuts') ? 0.3 : 0) - (has('processed_meat') ? 1 : 0);
  if (focuses.has('omega3')) s += Math.min(per(n.omega3) / 1.5, 1.2) + (has('oily_fish') ? 0.5 : 0);
  if (focuses.has('magnesium')) s += Math.min(per(n.magnesium) / 150, 1);
  if (focuses.has('hdl')) s += (has('oily_fish') ? 0.5 : 0) + (has('nuts') ? 0.3 : 0);
  if (prefs.diet === 'flexitarian') s -= has('red_meat') || has('processed_meat') ? 0.8 : 0;
  // Menos dinero, mejor, si lo ha pedido
  if (prefs.budget === 'low') s -= r.cost / 2;
  return s;
}

// Reparto de las calorías del día por comida
export function slotShares(snacks: number): Partial<Record<MealSlot, number>> {
  if (snacks >= 2) return { breakfast: 0.2, lunch: 0.3, dinner: 0.3, snack: 0.1 };
  if (snacks === 1) return { breakfast: 0.25, lunch: 0.35, dinner: 0.3, snack: 0.1 };
  return { breakfast: 0.25, lunch: 0.4, dinner: 0.35 };
}

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let x = s;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

const roundPortion = (p: number) => Math.min(1.75, Math.max(0.75, Math.round(p * 4) / 4));

export interface GeneratedDiet {
  days: DietDay[];
  targets: DietTargets;
  reasons: DietReason[];
  relaxed: ('time' | 'budget' | 'skill')[]; // lo que hubo que aflojar porque no había opciones
}

export function generateDiet(prefs: DietPrefs, labs: LabFlag[]): GeneratedDiet {
  const targets = dietTargets(prefs, labs);
  const focuses = focusesFrom(prefs, labs);
  const caution = cautionsFor(prefs, labs);
  const rand = rng(prefs.seed * 7919 + 17);
  const relaxed = new Set<'time' | 'budget' | 'skill'>();
  const shares = slotShares(prefs.snacks);
  const slots: MealSlot[] = ['breakfast', 'lunch', 'dinner', ...Array.from({ length: Math.min(2, prefs.snacks) }, () => 'snack' as MealSlot)];

  // Candidatos por comida; si hay muy pocos, se afloja tiempo, presupuesto y dificultad (nunca lo demás)
  const pool: Partial<Record<MealSlot, Recipe[]>> = {};
  for (const slot of new Set(slots)) {
    const attempts: [FitOptions, ('time' | 'budget' | 'skill')[]][] = [
      [{}, []],
      [{ extraMinutes: 15 }, ['time']],
      [{ extraMinutes: 15, ignoreBudget: true }, ['time', 'budget']],
      [{ extraMinutes: 45, ignoreBudget: true, ignoreSkill: true }, ['time', 'budget', 'skill']],
    ];
    const need = slot === 'lunch' || slot === 'dinner' ? 6 : 3;
    let list: Recipe[] = [];
    for (const [o, why] of attempts) {
      list = RECIPE_LIST.filter((r) => recipeFits(r, prefs, slot, o));
      if (list.length >= need) {
        why.forEach((w) => relaxed.add(w));
        break;
      }
    }
    // Sin gluten y sin lactosa quedan pocos desayunos: valen también los tentempiés que encajen
    if (slot === 'breakfast' && list.length < 4) {
      const extra = RECIPE_LIST.filter((r) => r.meals.includes('snack') && !list.includes(r) && recipeFits({ ...r, meals: ['breakfast'] }, prefs, 'breakfast', { extraMinutes: 15, ignoreBudget: true }));
      list = [...list, ...extra];
    }
    pool[slot] = list;
  }

  const base = new Map(RECIPE_LIST.map((r) => [r.id, recipeScore(r, focuses, targets, prefs, caution)]));
  const uses = new Map<string, number>();
  const lastDay = new Map<string, number>();
  const count = { oily: 0, legume: 0, red: 0, processed: 0 };
  const kinds = new Map<string, number>();
  const days: DietDay[] = Array.from({ length: 7 }, (_, day) => ({ day, meals: [] }));

  for (let day = 0; day < 7; day++) {
    const order: MealSlot[] = ['lunch', 'dinner', 'breakfast', ...slots.filter((s) => s === 'snack')];
    const chosen: PlannedMeal[] = [];
    for (const slot of order) {
      // Sobras de la cena de ayer (cocinar una vez para dos días)
      if (prefs.batch && slot === 'lunch' && day > 0) {
        const prevDinner = days[day - 1].meals.find((m) => m.slot === 'dinner' && !m.leftover);
        const r = prevDinner && getRecipe(prevDinner.recipeId);
        if (r && r.tags.includes('batch') && r.meals.includes('lunch')) {
          chosen.push({ slot, recipeId: r.id, portion: 1, leftover: true });
          bump(r);
          continue;
        }
      }
      const cands = pool[slot] ?? [];
      const daysLeft = 7 - day;
      // Sal que ya lleva el día (con la ración que tendrá cada plato)
      const est = (r: Recipe, sl: MealSlot) => roundPortion((targets.kcal * (shares[sl] ?? 0.1)) / r.nutrients.kcal);
      const sodiumSoFar = chosen.reduce((a, c) => a + getRecipe(c.recipeId)!.nutrients.sodium * est(getRecipe(c.recipeId)!, c.slot), 0);
      const sodiumLeft = targets.sodiumMax - sodiumSoFar;
      const potassiumSoFar = chosen.reduce((a, c) => a + getRecipe(c.recipeId)!.nutrients.potassium * est(getRecipe(c.recipeId)!, c.slot), 0);
      const potassiumLeft = (targets.potassiumMax ?? Infinity) - potassiumSoFar;
      const proteinLeft = targets.protein - chosen.reduce((a, c) => a + getRecipe(c.recipeId)!.nutrients.protein * est(getRecipe(c.recipeId)!, c.slot), 0);
      const slotsLeft = order.length - chosen.length;
      let best: Recipe | null = null;
      let bestScore = -Infinity;
      for (const r of cands) {
        if (chosen.some((c) => c.recipeId === r.id)) continue;
        const used = uses.get(r.id) ?? 0;
        if (used >= (cands.length < 6 ? 3 : 2)) continue;
        let s = (base.get(r.id) ?? 0) + rand() * 0.8 - used * 1.2;
        // Que el día no pase de la sal objetivo: cada plato, como mucho su parte de lo que queda
        s -= Math.max(0, r.nutrients.sodium * est(r, slot) - sodiumLeft / Math.max(1, slotsLeft)) / 300;
        if (targets.potassiumMax) s -= Math.max(0, r.nutrients.potassium * est(r, slot) - potassiumLeft / Math.max(1, slotsLeft)) / 150;
        if (caution.kidney) s -= Math.max(0, r.nutrients.protein * est(r, slot) - proteinLeft / Math.max(1, slotsLeft)) / 3;
        const last = lastDay.get(r.id);
        if (last !== undefined && day - last < 2) s -= 3;
        const has = (f: string) => r.flags.includes(f as any);
        if (slot === 'lunch' || slot === 'dinner') {
          // Cuotas de la semana: se empujan cuando quedan pocos días para cumplirlas
          if (has('oily_fish') && count.oily < targets.oilyFishPerWeek) s += 0.8 + (targets.oilyFishPerWeek - count.oily >= daysLeft / 2 ? 1 : 0);
          if (has('legume') && count.legume < targets.legumesPerWeek) s += 0.5 + (targets.legumesPerWeek - count.legume >= daysLeft / 1.5 ? 0.8 : 0);
          if (has('red_meat') && count.red >= targets.redMeatMaxPerWeek) s -= 10;
          if (has('processed_meat') && count.processed >= (focuses.has('ldl') || focuses.has('bp') || focuses.has('crp') || caution.kidney ? 0 : 1)) s -= 10;
          // Variedad en la semana: ni legumbre a diario ni pollo cada día
          const kind = mainKind(r);
          const capKind = KIND_CAP[prefs.diet][kind] ?? 3;
          s -= 0.7 * Math.max(0, (kinds.get(kind) ?? 0) + 1 - capKind);
          // Comida y cena del mismo día, distintas en lo principal
          const other = chosen.find((c) => c.slot === 'lunch' || c.slot === 'dinner');
          const o = other && getRecipe(other.recipeId);
          if (o && mainKind(o) === mainKind(r)) s -= 0.8;
        } else if (has('processed_meat') && count.processed >= (caution.kidney ? 0 : 1)) s -= 5;
        if (s > bestScore) {
          bestScore = s;
          best = r;
        }
      }
      if (best) {
        chosen.push({ slot, recipeId: best.id, portion: 1 });
        bump(best);
        lastDay.set(best.id, day);
      }
    }
    // Raciones: cada comida hacia su parte de las calorías del día
    for (const m of chosen) {
      const r = getRecipe(m.recipeId)!;
      m.portion = roundPortion((targets.kcal * (shares[m.slot] ?? 0.1)) / r.nutrients.kcal);
    }
    // Las sobras, con la misma ración que el día que se cocinó
    for (const m of chosen.filter((x) => x.leftover)) {
      const cooked = days[day - 1].meals.find((x) => x.slot === 'dinner' && x.recipeId === m.recipeId);
      if (cooked) m.portion = cooked.portion;
    }
    days[day].meals = orderMeals(chosen);
  }

  function bump(r: Recipe) {
    uses.set(r.id, (uses.get(r.id) ?? 0) + 1);
    if (r.meals.includes('lunch') || r.meals.includes('dinner')) kinds.set(mainKind(r), (kinds.get(mainKind(r)) ?? 0) + 1);
    if (r.flags.includes('oily_fish')) count.oily++;
    if (r.flags.includes('legume')) count.legume++;
    if (r.flags.includes('red_meat')) count.red++;
    if (r.flags.includes('processed_meat')) count.processed++;
  }

  return { days, targets, reasons: dietReasons(prefs, labs, targets), relaxed: [...relaxed] };
}

// Orden del día: desayuno, (media mañana), comida, merienda, cena. Con un solo tentempié, es la merienda.
export function orderMeals(meals: PlannedMeal[]): PlannedMeal[] {
  const snacks = meals.filter((m) => m.slot === 'snack');
  const pos = (m: PlannedMeal) =>
    m.slot === 'breakfast' ? 0 : m.slot === 'lunch' ? 2 : m.slot === 'dinner' ? 4 : snacks.length >= 2 && snacks.indexOf(m) === 0 ? 1 : 3;
  return [...meals].sort((a, b) => pos(a) - pos(b));
}

// Cuántas comidas y cenas a la semana (de 14) de cada cosa antes de penalizar por repetir
const KIND_CAP: Record<DietPrefs['diet'], Record<string, number>> = {
  omnivore: { legume: 5, fish: 5, poultry: 4, red: 2, egg: 3, other: 3 },
  flexitarian: { legume: 6, fish: 5, poultry: 3, red: 1, egg: 3, other: 4 },
  pescatarian: { legume: 6, fish: 6, egg: 3, other: 4 },
  vegetarian: { legume: 7, egg: 4, other: 6 },
  vegan: { legume: 10, other: 8 },
};

// Lo principal del plato, para no repetir en comida y cena (pescado y pescado, legumbre y legumbre…)
function mainKind(r: Recipe): string {
  if (r.flags.includes('oily_fish') || r.flags.includes('white_fish') || r.flags.includes('shellfish')) return 'fish';
  if (r.flags.includes('red_meat') || r.flags.includes('processed_meat')) return 'red';
  if (r.ingredients.some((i) => FOODS[i.food]?.kind === 'meat')) return 'poultry';
  if (r.flags.includes('legume')) return 'legume';
  if (r.ingredients.some((i) => i.food === 'egg')) return 'egg';
  return 'other';
}

// ── Totales y lista de la compra ──
export function dayTotals(day: Pick<DietDay, 'meals'>): Nutrients {
  return day.meals.reduce((acc, m) => {
    const r = getRecipe(m.recipeId);
    return r ? addNutrients(acc, scale(r.nutrients, m.portion)) : acc;
  }, ZERO);
}

export function weekSummary(days: DietDay[]) {
  const totals = days.map(dayTotals);
  const avg = (k: keyof Nutrients) => totals.reduce((a, t) => a + t[k], 0) / Math.max(1, totals.length);
  const meals = days.flatMap((d) => d.meals.map((m) => getRecipe(m.recipeId)).filter(Boolean)) as Recipe[];
  const main = days.flatMap((d) => d.meals.filter((m) => m.slot === 'lunch' || m.slot === 'dinner').map((m) => getRecipe(m.recipeId)).filter(Boolean)) as Recipe[];
  return {
    kcal: avg('kcal'),
    protein: avg('protein'),
    carbs: avg('carbs'),
    fat: avg('fat'),
    fiber: avg('fiber'),
    satFatPct: (avg('satFat') * 9 * 100) / Math.max(avg('kcal'), 1),
    sodium: avg('sodium'),
    oilyFish: main.filter((r) => r.flags.includes('oily_fish')).length,
    legumes: main.filter((r) => r.flags.includes('legume')).length,
    redMeat: main.filter((r) => r.flags.includes('red_meat')).length,
    cost: days.reduce((a, d) => a + d.meals.reduce((b, m) => b + (getRecipe(m.recipeId)?.cost ?? 0) * m.portion, 0), 0),
    recipes: new Set(meals.map((r) => r.id)).size,
  };
}

export interface ShoppingItem {
  food: string;
  grams: number;
  cost: number;
}

// Todo lo que se come en la semana (las sobras ya se cocinaron, pero cuentan igual en la compra)
export function shoppingList(days: DietDay[]): ShoppingItem[] {
  const map = new Map<string, number>();
  for (const d of days)
    for (const m of d.meals) {
      const r = getRecipe(m.recipeId);
      if (!r) continue;
      for (const i of r.ingredients) map.set(i.food, (map.get(i.food) ?? 0) + i.g * m.portion);
    }
  return [...map.entries()]
    .map(([food, grams]) => ({ food, grams, cost: ((FOODS[food]?.eurKg ?? 0) * grams) / 1000 }))
    .sort((a, b) => (FOODS[a.food]?.section ?? '').localeCompare(FOODS[b.food]?.section ?? '') || b.grams - a.grams);
}

// Otras recetas para una comida, de mejor a peor para esta persona
export function alternativesForSlot(prefs: DietPrefs, labs: LabFlag[], slot: MealSlot, exclude: string[] = []): Recipe[] {
  const targets = dietTargets(prefs, labs);
  const focuses = focusesFrom(prefs, labs);
  const fit = RECIPE_LIST.filter((r) => !exclude.includes(r.id) && recipeFits(r, prefs, slot, { extraMinutes: 15 }));
  const list = fit.length >= 4 ? fit : RECIPE_LIST.filter((r) => !exclude.includes(r.id) && r.meals.includes(slot) && recipeAllowed(r, prefs));
  const c = cautionsFor(prefs, labs);
  return list.map((r) => ({ r, s: recipeScore(r, focuses, targets, prefs, c) })).sort((a, b) => b.s - a.s).map((x) => x.r);
}

export function portionFor(recipeId: string, slot: MealSlot, prefs: DietPrefs, labs: LabFlag[]): number {
  const r = getRecipe(recipeId);
  if (!r) return 1;
  return roundPortion((dietTargets(prefs, labs).kcal * (slotShares(prefs.snacks)[slot] ?? 0.1)) / r.nutrients.kcal);
}

// ── Por qué el menú es así (texto fuente en inglés; el español en dietEs.ts) ──
export const CAUTION_TEXT: Record<Exclude<ReferralReason, 'eating_disorder' | 'under_18'>, { title: string; detail: string }> = {
  low_kidney_lab: {
    title: 'Your kidney values are out of range',
    detail:
      'See a doctor with this blood test before you change how you eat. Meanwhile this menu keeps protein moderate (about {protein} g a day), salt low and no processed meat. A high creatinine is not always the kidney: a lot of muscle, hard exercise in the days before the test, a lot of meat the day before or creatine supplements raise it too.',
  },
  kidney: {
    title: 'You have kidney disease',
    detail: 'Check this menu with your nephrologist or a dietitian: protein, potassium and phosphorus depend on your stage. This menu keeps protein moderate (about {protein} g a day), salt low and no processed meat.',
  },
  high_potassium_lab: {
    title: 'Your potassium came out high',
    detail: 'See a doctor soon with this blood test: high potassium can affect the heart. This menu leaves out the dishes with the most potassium (about {potassium} mg a day, much less than a usual menu), but it does not replace medical advice.',
  },
  pregnancy: {
    title: 'Pregnancy or breastfeeding',
    detail: 'Check this menu with your midwife or doctor. It has no calorie cut and leaves out cured ham; from the second trimester you need a little more energy. Cook meat, fish and eggs well, wash fruit and vegetables, and no alcohol.',
  },
  insulin: {
    title: 'Insulin or pills that lower your blood sugar',
    detail: 'Talk to your doctor before you start this menu: eating differently can change the dose you need. This menu has no calorie cut and keeps regular meals.',
  },
};

export function dietReasons(prefs: DietPrefs, labs: LabFlag[], targets: DietTargets): DietReason[] {
  const f = focusesFrom(prefs, labs);
  const out: DietReason[] = [];
  // Primero, lo que hay que mirar con un médico (sale como "¡Atención!" encima del menú)
  const cautions = cautionReasons(referralReasons(prefs, labs)) as (keyof typeof CAUTION_TEXT)[];
  for (const c of cautions) out.push({ id: `caution_${c}`, caution: true, ...CAUTION_TEXT[c] });
  if (cautions.includes('low_kidney_lab') && prefs.supplements.includes('creatine'))
    out.push({
      id: 'caution_creatine',
      caution: true,
      title: 'You take creatine',
      detail: 'Creatine raises creatinine in blood tests even when the kidneys are fine. Tell your doctor: sometimes the test is repeated after a few weeks without it.',
    });
  const goalTitle =
    prefs.goal === 'lose' ? 'To lose weight' : prefs.goal === 'gain' ? 'To build muscle' : prefs.goal === 'perform' ? 'For your training' : 'To eat well';
  out.push({
    id: 'energy',
    title: goalTitle,
    detail: 'About {kcal} kcal and {protein} g of protein a day, spread over your meals.',
  });
  if (f.has('ldl'))
    out.push({ id: 'ldl', title: 'Your cholesterol came out high', detail: 'Less saturated fat, more fibre (oats, legumes, fruit), nuts and oily fish. Hardly any cured meat or fatty cheese.' });
  if (f.has('tg')) out.push({ id: 'tg', title: 'Your triglycerides came out high', detail: 'Oily fish three times a week and fewer sugars and sweet drinks. Alcohol raises them too.' });
  if (f.has('glucose'))
    out.push({ id: 'glucose', title: 'Your blood sugar needs care', detail: 'Wholegrain carbs and legumes, protein at breakfast, little added sugar. If you take medication for diabetes, tell your doctor before changing how you eat.' });
  if (f.has('uric')) out.push({ id: 'uric', title: 'Your uric acid came out high', detail: 'Less red meat, shellfish and small oily fish; dairy and plenty of water help.' });
  if (f.has('liver')) out.push({ id: 'liver', title: 'Your liver enzymes came out high', detail: 'Fewer sugars, fried food and cured meats; more vegetables and fibre. Avoid alcohol.' });
  if (f.has('bp')) out.push({ id: 'bp', title: 'For your blood pressure', detail: 'Under 1,500 mg of sodium a day: little salt and cured food, more fruit, vegetables and legumes (potassium).' });
  if (f.has('iron'))
    out.push({ id: 'iron', title: 'Your iron came out low', detail: 'Legumes, clams, mussels and some red meat, with vitamin C (pepper, citrus). Keep coffee and tea away from meals.' });
  if (f.has('vitd')) out.push({ id: 'vitd', title: 'Your vitamin D came out low', detail: 'Oily fish and eggs help, but food alone rarely fixes it: sunlight, and a supplement if your doctor says so.' });
  if (f.has('b12') && prefs.diet === 'vegan' && !prefs.supplements.includes('b12'))
    out.push({ id: 'b12_vegan', title: 'B12 if you eat vegan', detail: 'A vegan diet needs a B12 supplement: no plant food provides enough.' });
  else if (f.has('b12')) out.push({ id: 'b12', title: 'Your B12 came out low', detail: 'Eggs, dairy, fish and meat have it. Ask your doctor whether you need a supplement.' });
  if (f.has('folate')) out.push({ id: 'folate', title: 'Your homocysteine came out high', detail: 'More folate: legumes, leafy greens and wholegrains.' });
  if (f.has('crp')) out.push({ id: 'crp', title: 'Your inflammation marker (CRP) came out high', detail: 'A Mediterranean pattern: olive oil, oily fish, nuts, vegetables and legumes; few processed foods.' });
  if (f.has('omega3')) out.push({ id: 'omega3', title: 'Your omega-3 came out low', detail: 'Oily fish three times a week, plus walnuts and chia.' });
  if (f.has('magnesium')) out.push({ id: 'magnesium', title: 'Your magnesium came out low', detail: 'Nuts, seeds, legumes and wholegrains.' });
  if (prefs.supplements.includes('iron')) out.push({ id: 'supp_iron', title: 'Your iron supplement', detail: 'Take it away from coffee, tea and dairy, ideally with some vitamin C.' });
  if (prefs.supplements.includes('vitamin_d')) out.push({ id: 'supp_vitd', title: 'Your vitamin D supplement', detail: 'Take it with a meal that has some fat.' });
  void targets;
  return out;
}

export const REFERRAL_TEXT: Record<ReferralReason, string> = {
  pregnancy: 'During pregnancy or breastfeeding, your needs change week by week.',
  kidney: 'With kidney disease, protein, potassium and phosphorus need to be adjusted by a professional.',
  eating_disorder: 'If you have or had an eating disorder, a meal plan with calories is best done with a professional.',
  insulin: 'With insulin or medication that can cause low blood sugar, changing your diet changes your doses.',
  under_18: 'Under 18, energy and nutrient needs are different.',
  low_kidney_lab: 'Your kidney function in your last test (filtration or creatinine) needs a professional to adjust protein and potassium.',
  high_potassium_lab: 'Your potassium came out high: many healthy foods have a lot of it, so it needs a professional.',
};

export function newDietPlan(prefs: DietPrefs, labs: LabFlag[], extra: Partial<DietPlan> = {}): DietPlan {
  const g = generateDiet(prefs, labs);
  return {
    id: `dp-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`,
    title: 'My weekly menu',
    createdAt: new Date().toISOString(),
    source: 'self',
    prefs,
    targets: g.targets,
    reasons: g.reasons,
    days: g.days,
    active: true,
    ...extra,
  };
}

export const DEFAULT_DIET_PREFS: DietPrefs = {
  goal: 'health',
  diet: 'omnivore',
  allergies: [],
  avoidGroups: [],
  dislikes: [],
  budget: 'normal',
  skill: 2,
  minutes: 30,
  batch: false,
  snacks: 1,
  supplements: [],
  sex: null,
  age: null,
  heightCm: null,
  weightKg: null,
  activity: 'light',
  conditions: [],
  safety: [],
  seed: 1,
};

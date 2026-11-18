// Cuestionario "¿Te sientes diferente y no sabes qué analítica pedir?" (Lab → Haz este breve
// cuestionario). Cuatro preguntas rápidas de opción múltiple. Cada respuesta dice qué mira ya el
// análisis anual de la suscripción (Kuova Baseline) y suma puntos a pruebas sueltas del catálogo
// (src/data/testCatalog.ts) cuando aportan algo más, con un motivo corto ("cansancio", "poco sol")
// que se enseña en la ficha. Orientativo: no diagnostica ni sustituye a un médico, y los pesos
// están en el backlog de revisión clínica.
// Criterio del catálogo (28/10): casi todo lo que explica el cansancio, el peso o el ánimo ya va en el
// Baseline; ningún análisis mide el estrés ni el sueño (no se vende cortisol «para el estrés»); las
// pruebas de «Añadir a tu seguimiento» solo se ofrecen a quien tiene la suscripción.

import type { Sex } from '@/data/profileRepository';

export type StepId = 'concerns' | 'changes' | 'taking' | 'surroundings';
export type Gender = 'f' | 'm' | 'n';
export type FinderFlag = 'mood' | 'allergy' | 'weight_loss' | 'stress_sleep';

export interface FinderOption {
  id: string;
  label: string; // texto fuente en inglés (t())
  es?: Record<Gender, string>; // en español depende del género: "cansado" / "cansada"
  icon: string; // Ionicons (contorno) o 'mci:<nombre>'
  why: string; // motivo corto que sale en la ficha (t())
  tests: Record<string, number>;
  female?: Record<string, number>; // sustituye a tests si el perfil es de mujer
  panel?: string[]; // lo que ya mide el análisis anual para esta respuesta (claves de PANEL_TEXT, t())
  only?: 'female'; // solo se pregunta a mujeres (o si no sabemos el sexo)
  none?: boolean; // "Nada de esto": desmarca el resto
  flag?: FinderFlag;
}

export interface FinderStep {
  id: StepId;
  title: string;
  subtitle: string;
  options: FinderOption[];
}

// Lo que mide el análisis anual Kuova Baseline, dicho en corto (claves para t())
const IRON = 'iron and ferritin';
const B12 = 'vitamin B12';
const TSH = 'TSH';
const VIT_D = 'vitamin D';
const SUGAR = 'glucose and HbA1c';
const INSULIN = 'insulin';
const CBC = 'blood count';
const MG = 'magnesium';
const TESTO = 'testosterone';
const LIPIDS = 'cholesterol and ApoB';
const LPA = 'Lp(a)';
const LIVER = 'liver enzymes';
const CREAT = 'creatinine';
const NA_K = 'sodium and potassium';
export const PANEL_TEXT = [IRON, B12, TSH, VIT_D, SUGAR, INSULIN, CBC, MG, TESTO, LIPIDS, LPA, LIVER, CREAT, NA_K];

export const FINDER_STEPS: FinderStep[] = [
  {
    id: 'concerns',
    title: 'Is something worrying you?',
    subtitle: 'Choose everything that sounds like you lately.',
    options: [
      { id: 'tired', label: 'I feel tired', es: { m: 'Me siento cansado', f: 'Me siento cansada', n: 'Siento cansancio a menudo' }, icon: 'battery-dead-outline', why: 'tiredness', tests: {}, panel: [IRON, B12, TSH, VIT_D] },
      { id: 'mornings', label: "It's hard to get up in the morning", icon: 'alarm-outline', why: 'hard mornings', tests: {}, panel: [TSH, VIT_D, IRON] },
      { id: 'stress', label: 'I feel stressed', es: { m: 'Me siento estresado', f: 'Me siento estresada', n: 'Tengo mucho estrés' }, icon: 'thunderstorm-outline', why: 'stress', tests: {}, flag: 'stress_sleep' },
      { id: 'low', label: "I'm sadder or feeling down", icon: 'rainy-outline', why: 'low mood', tests: {}, panel: [VIT_D, TSH, B12], flag: 'mood' },
      { id: 'sleep', label: 'I sleep badly', icon: 'moon-outline', why: 'poor sleep', tests: {}, flag: 'stress_sleep' },
      // Subir o bajar de peso apuntan a cosas distintas (tiroides lento o rápido, azúcar, celiaquía…)
      { id: 'weight_gain', label: "I'm gaining weight and I don't know why", icon: 'trending-up-outline', why: 'weight gain', tests: {}, panel: [TSH, SUGAR, INSULIN] },
      { id: 'weight_loss', label: "I'm losing weight without trying", icon: 'trending-down-outline', why: 'weight loss', tests: { coeliac: 2 }, panel: [TSH, SUGAR, CBC], flag: 'weight_loss' },
      { id: 'hair', label: "I'm losing more hair or my nails break", icon: 'cut-outline', why: 'hair and nails', tests: {}, panel: [IRON, TSH] },
      { id: 'cold', label: 'I feel the cold more than others', icon: 'snow-outline', why: 'feeling cold', tests: {}, panel: [TSH, IRON] },
      { id: 'thirst', label: "I'm thirstier or go to the toilet more", icon: 'water-outline', why: 'thirst', tests: {}, panel: [SUGAR, CREAT] },
      { id: 'digestion', label: 'I get bloated or food disagrees with me', icon: 'restaurant-outline', why: 'digestion', tests: { sibo: 2, lactose: 2, coeliac: 2, fructose: 1, hpylori: 1 } },
      { id: 'training', label: 'I perform or recover worse when I train', icon: 'barbell-outline', why: 'training', tests: { training_load: 3, omega3: 1 }, panel: [IRON, VIT_D, MG, TESTO] },
      { id: 'libido', label: 'I have less sexual desire', icon: 'heart-half-outline', why: 'sexual desire', tests: { hormones_m: 3 }, female: { hormones_f: 2 }, panel: [TESTO, TSH] },
      { id: 'period', label: 'My period has changed (heavier, irregular…)', icon: 'rose-outline', why: 'your period', tests: { hormones_f: 3, androgens: 2 }, panel: [IRON], only: 'female' },
      { id: 'family_heart', label: 'There is heart disease or diabetes in my family', icon: 'people-outline', why: 'family history', tests: {}, panel: [LIPIDS, LPA, SUGAR] },
      { id: 'family_thyroid', label: 'There are thyroid problems in my family', icon: 'people-outline', why: 'family history', tests: { thyroid: 2 }, panel: [TSH] },
      { id: 'prevent', label: "Nothing specific: I want to know how I'm doing", icon: 'shield-checkmark-outline', why: 'a general check-up', tests: {}, panel: [LIPIDS, SUGAR, LIVER, CREAT, IRON, VIT_D, TSH] },
    ],
  },
  {
    id: 'changes',
    title: 'Has anything changed in your life lately?',
    subtitle: 'Changes in routine often show up in your blood before you notice them.',
    options: [
      { id: 'less_sleep', label: 'I sleep less than before', icon: 'bed-outline', why: 'less sleep', tests: {}, flag: 'stress_sleep' },
      { id: 'work', label: 'More pressure at work', icon: 'briefcase-outline', why: 'work', tests: {}, flag: 'stress_sleep' },
      { id: 'personal', label: 'Things have happened in my personal life', icon: 'chatbubbles-outline', why: 'personal life', tests: {}, flag: 'stress_sleep' },
      { id: 'eat_worse', label: "I'm eating worse", icon: 'fast-food-outline', why: 'eating worse', tests: {}, panel: [LIPIDS, SUGAR, LIVER] },
      { id: 'little_meat', label: 'I eat little or no meat', icon: 'leaf-outline', why: 'little meat', tests: { b12_folate: 2 }, panel: [IRON, B12] },
      { id: 'diet', label: "I've started a diet or lost weight", icon: 'nutrition-outline', why: 'a new diet', tests: {}, panel: [IRON, B12, VIT_D] },
      { id: 'more_training', label: 'I train more than before', icon: 'bicycle-outline', why: 'more training', tests: { training_load: 3 }, panel: [IRON] },
      { id: 'move_less', label: 'I move less than before', icon: 'tv-outline', why: 'moving less', tests: {}, panel: [SUGAR, LIPIDS] },
      { id: 'alcohol', label: "I'm drinking more alcohol", icon: 'wine-outline', why: 'alcohol', tests: {}, panel: [LIVER] },
      { id: 'partner', label: 'I have a new sexual partner', icon: 'heart-outline', why: 'new partner', tests: { sti_basic: 3, sti_full: 2 } },
      { id: 'pregnancy', label: 'I want to get pregnant soon', icon: 'flower-outline', why: 'pregnancy plans', tests: { preconception: 3, ovarian_reserve: 2 }, only: 'female' },
      { id: 'none', label: 'Nothing in particular', icon: 'remove-circle-outline', why: '', tests: {}, none: true },
    ],
  },
  {
    id: 'taking',
    title: 'Are you taking any supplements or medication?',
    subtitle: 'A test shows whether what you take is working, or whether it affects something else.',
    options: [
      { id: 'iron_supp', label: 'Iron', icon: 'mci:pill', why: 'iron supplement', tests: {}, panel: [IRON] },
      { id: 'vitd_supp', label: 'Vitamin D', icon: 'sunny-outline', why: 'vitamin D supplement', tests: { vitamin_d: 2 }, panel: [VIT_D] },
      { id: 'b12_supp', label: 'Vitamin B12 or a multivitamin', icon: 'mci:pill', why: 'B12 or multivitamin', tests: { b12_folate: 1 }, panel: [B12] },
      { id: 'other_supp', label: 'Other supplements (magnesium, omega-3, protein…)', icon: 'flask-outline', why: 'supplements', tests: { omega3: 1, magnesium: 1 }, panel: [MG] },
      { id: 'thyroid_med', label: 'Thyroid medication', icon: 'medkit-outline', why: 'thyroid medication', tests: { thyroid: 3 }, panel: [TSH] },
      { id: 'pill', label: 'Hormonal contraceptives', icon: 'calendar-outline', why: 'contraceptives', tests: {}, panel: [B12], only: 'female' },
      { id: 'b12_meds', label: 'Metformin or omeprazole', icon: 'medkit-outline', why: 'metformin or omeprazole', tests: { b12_folate: 3 }, panel: [B12] },
      { id: 'heart_meds', label: 'Medication for cholesterol or blood pressure', icon: 'heart-outline', why: 'heart medication', tests: { sodium_potassium: 2, urine_albumin: 1 }, panel: [LIPIDS, NA_K, CREAT] },
      { id: 'other_med', label: 'Other regular medication', icon: 'bandage-outline', why: 'medication', tests: {}, panel: [LIVER, CREAT] },
      { id: 'none', label: 'Nothing', icon: 'remove-circle-outline', why: '', tests: {}, none: true },
    ],
  },
  {
    id: 'surroundings',
    title: 'And around you? Has the weather or your routine changed?',
    subtitle: 'Less sun, a new season or new hours also change your levels.',
    options: [
      { id: 'less_sun', label: 'I get less sun now (autumn, winter, office)', icon: 'partly-sunny-outline', why: 'little sun', tests: { vitamin_d: 2 }, panel: [VIT_D] },
      { id: 'season', label: 'The season has changed and I feel it', icon: 'leaf-outline', why: 'change of season', tests: { vitamin_d: 1 }, panel: [VIT_D] },
      { id: 'schedule', label: 'My hours have changed (night shifts, travel)', icon: 'time-outline', why: 'new hours', tests: {}, flag: 'stress_sleep' },
      { id: 'allergy', label: 'I sneeze more or my eyes or skin itch', icon: 'mci:flower-pollen-outline', why: 'allergy symptoms', tests: { allergy_alex: 2 }, flag: 'allergy' },
      { id: 'none', label: 'None of these', icon: 'remove-circle-outline', why: '', tests: {}, none: true },
    ],
  },
];

export type FinderAnswers = Partial<Record<StepId, string[]>>;

export interface FinderPick {
  id: string;
  score: number;
  reasons: string[]; // claves en inglés para t()
}

export interface FinderResult {
  picks: FinderPick[]; // ordenados: los primeros son los recomendados
  covered: string[]; // lo que ya mide el análisis anual (claves de PANEL_TEXT)
  flags: FinderFlag[];
}

const FEMALE_ONLY_TESTS = new Set(['ovarian_reserve', 'hormones_f', 'androgens']);
const MALE_ONLY_TESTS = new Set(['psa', 'hormones_m', 'low_testosterone']);
const STI_TESTS = ['sti_full', 'sti_basic'];

export const genderOf = (sex?: Sex): Gender => (sex === 'female' ? 'f' : sex === 'male' ? 'm' : 'n');

// Opciones que se enseñan según el perfil (las de mujer, también si no sabemos el sexo)
export const visibleOptions = (step: FinderStep, sex?: Sex) => step.options.filter((o) => o.only !== 'female' || sex !== 'male');

// Marcar "Nada de esto" desmarca el resto y al revés
export function toggleOption(step: FinderStep, current: string[], id: string): string[] {
  const opt = step.options.find((o) => o.id === id);
  if (current.includes(id)) return current.filter((x) => x !== id);
  if (opt?.none) return [id];
  return [...current.filter((x) => !step.options.find((o) => o.id === x)?.none), id];
}

// Junta una prueba dentro de otra que ya la incluye (p. ej. andrógenos dentro de la salud hormonal de la mujer)
function fold(scores: Map<string, FinderPick>, from: string, into: string) {
  const a = scores.get(from);
  if (!a) return;
  const b = scores.get(into) ?? { id: into, score: 0, reasons: [] };
  scores.set(into, { id: into, score: b.score + a.score, reasons: [...new Set([...b.reasons, ...a.reasons])] });
  scores.delete(from);
}

// available: las pruebas que esta persona puede pedir, en el orden del catálogo (desempata)
export function recommend(answers: FinderAnswers, sex: Sex | undefined, available: readonly string[]): FinderResult {
  const scores = new Map<string, FinderPick>();
  const covered = new Set<string>();
  const flags = new Set<FinderFlag>();
  let any = false;

  for (const step of FINDER_STEPS) {
    for (const id of answers[step.id] ?? []) {
      const opt = step.options.find((o) => o.id === id);
      if (!opt || opt.none) continue;
      any = true;
      if (opt.flag) flags.add(opt.flag);
      for (const p of opt.panel ?? []) covered.add(p);
      const tests = sex === 'female' && opt.female ? opt.female : opt.tests;
      for (const [test, pts] of Object.entries(tests)) {
        const cur = scores.get(test) ?? { id: test, score: 0, reasons: [] };
        cur.score += pts;
        if (opt.why && !cur.reasons.includes(opt.why)) cur.reasons.push(opt.why);
        scores.set(test, cur);
      }
    }
  }

  // Sin nada concreto: un chequeo general, que es justo el análisis anual
  if (!any) for (const p of FINDER_STEPS[0].options.find((o) => o.id === 'prevent')!.panel!) covered.add(p);

  // Evitar repetir lo mismo en dos fichas
  if (scores.has('hormones_f')) fold(scores, 'androgens', 'hormones_f');
  if (scores.has('hormones_m')) fold(scores, 'low_testosterone', 'hormones_m');
  const sti = STI_TESTS.filter((id) => scores.has(id)).sort((a, b) => scores.get(b)!.score - scores.get(a)!.score);
  for (const id of sti.slice(1)) scores.delete(id);

  for (const id of [...scores.keys()]) {
    if (!available.includes(id)) scores.delete(id);
    else if (sex === 'male' && FEMALE_ONLY_TESTS.has(id)) scores.delete(id);
    else if (sex === 'female' && MALE_ONLY_TESTS.has(id)) scores.delete(id);
  }

  const picks = [...scores.values()].sort((a, b) => b.score - a.score || available.indexOf(a.id) - available.indexOf(b.id));
  return { picks, covered: PANEL_TEXT.filter((p) => covered.has(p)), flags: [...flags] };
}

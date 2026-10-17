// Cuestionario "¿Te sientes diferente y no sabes qué analítica pedir?" (Lab → Haz este breve
// cuestionario). Cuatro preguntas rápidas de opción múltiple; cada respuesta suma puntos a
// tests del catálogo (src/data/testCatalog.ts) y deja un motivo corto ("cansancio", "poco sol")
// que se enseña en la ficha. Orientativo: no diagnostica ni sustituye a un médico, y los pesos
// están en el backlog de revisión clínica.
// Las preguntas del entorno (sol, estación, horarios) llevan a tests concretos a propósito.

import type { Sex } from '@/data/profileRepository';

export type StepId = 'concerns' | 'changes' | 'taking' | 'surroundings';
export type Gender = 'f' | 'm' | 'n';
export type FinderFlag = 'mood' | 'allergy' | 'weight_loss';

export interface FinderOption {
  id: string;
  label: string; // texto fuente en inglés (t())
  es?: Record<Gender, string>; // en español depende del género: "cansado" / "cansada"
  icon: string; // Ionicons (contorno) o 'mci:<nombre>'
  why: string; // motivo corto que sale en la ficha (t())
  tests: Record<string, number>;
  female?: Record<string, number>; // sustituye a tests si el perfil es de mujer
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

export const FINDER_STEPS: FinderStep[] = [
  {
    id: 'concerns',
    title: 'Is something worrying you?',
    subtitle: 'Choose everything that sounds like you lately.',
    options: [
      { id: 'tired', label: 'I feel tired', es: { m: 'Me siento cansado', f: 'Me siento cansada', n: 'Siento cansancio a menudo' }, icon: 'battery-dead-outline', why: 'tiredness', tests: { iron: 3, vitamins: 2, thyroid: 2, vitamin_d: 1, essential: 1 } },
      { id: 'mornings', label: "It's hard to get up in the morning", icon: 'alarm-outline', why: 'hard mornings', tests: { thyroid: 2, vitamin_d: 2, iron: 1, cortisol: 1 } },
      { id: 'stress', label: 'I feel stressed', es: { m: 'Me siento estresado', f: 'Me siento estresada', n: 'Tengo mucho estrés' }, icon: 'thunderstorm-outline', why: 'stress', tests: { stress: 3, cortisol: 2 } },
      { id: 'low', label: "I'm sadder or feeling down", icon: 'rainy-outline', why: 'low mood', tests: { vitamin_d: 2, thyroid: 2, vitamins: 1, stress: 1 }, flag: 'mood' },
      { id: 'sleep', label: 'I sleep badly', icon: 'moon-outline', why: 'poor sleep', tests: { stress: 2, cortisol: 2, iron: 1 } },
      // Subir o bajar de peso apuntan a cosas distintas (tiroides lento o rápido, azúcar, celiaquía…)
      { id: 'weight_gain', label: "I'm gaining weight and I don't know why", icon: 'trending-up-outline', why: 'weight gain', tests: { thyroid: 3, weight: 3, diabetes: 2, cortisol: 1 }, female: { thyroid: 3, weight: 3, diabetes: 2, cycle_hormones: 2 } },
      { id: 'weight_loss', label: "I'm losing weight without trying", icon: 'trending-down-outline', why: 'weight loss', tests: { thyroid: 3, diabetes: 2, essential: 2, coeliac: 2 }, flag: 'weight_loss' },
      { id: 'hair', label: "I'm losing more hair or my nails break", icon: 'cut-outline', why: 'hair and nails', tests: { iron: 3, thyroid: 2, vitamin_d: 1 } },
      { id: 'cold', label: 'I feel the cold more than others', icon: 'snow-outline', why: 'feeling cold', tests: { thyroid: 3, iron: 2 } },
      { id: 'thirst', label: "I'm thirstier or go to the toilet more", icon: 'water-outline', why: 'thirst', tests: { diabetes: 3, essential: 1 } },
      { id: 'digestion', label: 'I get bloated or food disagrees with me', icon: 'restaurant-outline', why: 'digestion', tests: { digestive_pack: 3, coeliac: 2 } },
      { id: 'training', label: 'I perform or recover worse when I train', icon: 'barbell-outline', why: 'training', tests: { performance: 3, iron: 1, vitamin_d: 1 } },
      { id: 'libido', label: 'I have less sexual desire', icon: 'heart-half-outline', why: 'sexual desire', tests: { testosterone: 3, stress: 1, thyroid: 1 }, female: { cycle_hormones: 2, thyroid: 1, stress: 1 } },
      { id: 'period', label: 'My period has changed (heavier, irregular…)', icon: 'rose-outline', why: 'your period', tests: { cycle_hormones: 3, iron: 2, thyroid: 1 }, only: 'female' },
      { id: 'family_heart', label: 'There is heart disease or diabetes in my family', icon: 'people-outline', why: 'family history', tests: { cardio: 2, lpa: 2, diabetes: 2 } },
      { id: 'family_thyroid', label: 'There are thyroid problems in my family', icon: 'people-outline', why: 'family history', tests: { thyroid_adv: 3 } },
      { id: 'prevent', label: "Nothing specific: I want to know how I'm doing", icon: 'shield-checkmark-outline', why: 'a general check-up', tests: { essential: 3, cardio: 1, diabetes: 1, vitamin_d: 1 } },
    ],
  },
  {
    id: 'changes',
    title: 'Has anything changed in your life lately?',
    subtitle: 'Changes in routine often show up in your blood before you notice them.',
    options: [
      { id: 'less_sleep', label: 'I sleep less than before', icon: 'bed-outline', why: 'less sleep', tests: { stress: 2, cortisol: 1 } },
      { id: 'work', label: 'More pressure at work', icon: 'briefcase-outline', why: 'work', tests: { stress: 2, cortisol: 2 } },
      { id: 'personal', label: 'Things have happened in my personal life', icon: 'chatbubbles-outline', why: 'personal life', tests: { stress: 2, cortisol: 1 } },
      { id: 'eat_worse', label: "I'm eating worse", icon: 'fast-food-outline', why: 'eating worse', tests: { essential: 2, vitamins: 2, diabetes: 1 } },
      { id: 'little_meat', label: 'I eat little or no meat', icon: 'leaf-outline', why: 'little meat', tests: { iron: 3, vitamin_b: 3 } },
      { id: 'diet', label: "I've started a diet or lost weight", icon: 'nutrition-outline', why: 'a new diet', tests: { vitamins: 2, iron: 2, essential: 1 } },
      { id: 'more_training', label: 'I train more than before', icon: 'bicycle-outline', why: 'more training', tests: { performance: 3, iron: 1 } },
      { id: 'move_less', label: 'I move less than before', icon: 'tv-outline', why: 'moving less', tests: { diabetes: 1, cardio: 1, vitamin_d: 1, weight: 1 } },
      { id: 'alcohol', label: "I'm drinking more alcohol", icon: 'wine-outline', why: 'alcohol', tests: { essential: 2 } },
      { id: 'partner', label: 'I have a new sexual partner', icon: 'heart-outline', why: 'new partner', tests: { sti_7: 3, sti_4: 2 } },
      { id: 'pregnancy', label: 'I want to get pregnant soon', icon: 'flower-outline', why: 'pregnancy plans', tests: { fertility_f: 3, amh: 2, vitamins: 1 }, only: 'female' },
      { id: 'none', label: 'Nothing in particular', icon: 'remove-circle-outline', why: '', tests: {}, none: true },
    ],
  },
  {
    id: 'taking',
    title: 'Are you taking any supplements or medication?',
    subtitle: 'A test shows whether what you take is working, or whether it affects something else.',
    options: [
      { id: 'iron_supp', label: 'Iron', icon: 'mci:pill', why: 'iron supplement', tests: { iron: 3 } },
      { id: 'vitd_supp', label: 'Vitamin D', icon: 'sunny-outline', why: 'vitamin D supplement', tests: { vitamin_d: 3 } },
      { id: 'b12_supp', label: 'Vitamin B12 or a multivitamin', icon: 'mci:pill', why: 'B12 or multivitamin', tests: { vitamin_b: 2, vitamins: 1 } },
      { id: 'other_supp', label: 'Other supplements (magnesium, omega-3, protein…)', icon: 'flask-outline', why: 'supplements', tests: { vitamins: 1, essential: 1 } },
      { id: 'thyroid_med', label: 'Thyroid medication', icon: 'medkit-outline', why: 'thyroid medication', tests: { thyroid: 3 } },
      { id: 'pill', label: 'Hormonal contraceptives', icon: 'calendar-outline', why: 'contraceptives', tests: { vitamin_b: 1, cycle_hormones: 1 }, only: 'female' },
      { id: 'b12_meds', label: 'Metformin or omeprazole', icon: 'medkit-outline', why: 'metformin or omeprazole', tests: { vitamin_b: 3 } },
      { id: 'heart_meds', label: 'Medication for cholesterol or blood pressure', icon: 'heart-outline', why: 'heart medication', tests: { cardio: 2, essential: 1 } },
      { id: 'other_med', label: 'Other regular medication', icon: 'bandage-outline', why: 'medication', tests: { essential: 1 } },
      { id: 'none', label: 'Nothing', icon: 'remove-circle-outline', why: '', tests: {}, none: true },
    ],
  },
  {
    id: 'surroundings',
    title: 'And around you? Has the weather or your routine changed?',
    subtitle: 'Less sun, a new season or new hours also change your levels.',
    options: [
      { id: 'less_sun', label: 'I get less sun now (autumn, winter, office)', icon: 'partly-sunny-outline', why: 'little sun', tests: { vitamin_d: 3 } },
      { id: 'season', label: 'The season has changed and I feel it', icon: 'leaf-outline', why: 'change of season', tests: { vitamin_d: 2, iron: 1, thyroid: 1 } },
      { id: 'schedule', label: 'My hours have changed (night shifts, travel)', icon: 'time-outline', why: 'new hours', tests: { cortisol: 2, stress: 1, vitamin_d: 1 } },
      { id: 'allergy', label: 'I sneeze more or my eyes or skin itch', icon: 'flower-outline', why: '', tests: {}, flag: 'allergy' },
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
  flags: FinderFlag[];
}

const FEMALE_ONLY_TESTS = new Set(['cycle_hormones', 'fertility_f', 'amh']);
const MALE_ONLY_TESTS = new Set(['psa']);
const STI_TESTS = ['sti_11', 'sti_7', 'sti_4'];

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

// Junta un test dentro de otro que ya lo incluye (p. ej. vitamina D dentro de "Vitaminas esenciales")
function fold(scores: Map<string, FinderPick>, from: string, into: string) {
  const a = scores.get(from);
  if (!a) return;
  const b = scores.get(into) ?? { id: into, score: 0, reasons: [] };
  scores.set(into, { id: into, score: b.score + a.score, reasons: [...new Set([...b.reasons, ...a.reasons])] });
  scores.delete(from);
}

export function recommend(answers: FinderAnswers, sex: Sex | undefined, prices: Record<string, number>): FinderResult {
  const scores = new Map<string, FinderPick>();
  const flags = new Set<FinderFlag>();
  let any = false;

  for (const step of FINDER_STEPS) {
    for (const id of answers[step.id] ?? []) {
      const opt = step.options.find((o) => o.id === id);
      if (!opt || opt.none) continue;
      any = true;
      if (opt.flag) flags.add(opt.flag);
      const tests = sex === 'female' && opt.female ? opt.female : opt.tests;
      for (const [test, pts] of Object.entries(tests)) {
        const cur = scores.get(test) ?? { id: test, score: 0, reasons: [] };
        cur.score += pts;
        if (opt.why && !cur.reasons.includes(opt.why)) cur.reasons.push(opt.why);
        scores.set(test, cur);
      }
    }
  }

  // Sin nada concreto: un chequeo general
  if (!any || scores.size === 0) {
    const prevent = FINDER_STEPS[0].options.find((o) => o.id === 'prevent')!;
    for (const [test, pts] of Object.entries(prevent.tests)) scores.set(test, { id: test, score: pts, reasons: [prevent.why] });
  }

  // Evitar repetir lo mismo en dos fichas
  if (scores.has('vitamins') || (scores.has('vitamin_d') && scores.has('vitamin_b'))) {
    fold(scores, 'vitamin_d', 'vitamins');
    fold(scores, 'vitamin_b', 'vitamins');
  }
  if (scores.has('stress')) fold(scores, 'cortisol', 'stress');
  if (scores.has('thyroid_adv')) fold(scores, 'thyroid', 'thyroid_adv');
  const sti = STI_TESTS.filter((id) => scores.has(id)).sort((a, b) => scores.get(b)!.score - scores.get(a)!.score);
  for (const id of sti.slice(1)) scores.delete(id);

  for (const id of [...scores.keys()]) {
    if (!(id in prices)) scores.delete(id);
    else if (sex === 'male' && FEMALE_ONLY_TESTS.has(id)) scores.delete(id);
    else if (sex === 'female' && MALE_ONLY_TESTS.has(id)) scores.delete(id);
  }

  const picks = [...scores.values()].sort((a, b) => b.score - a.score || prices[a.id] - prices[b.id]);
  return { picks, flags: [...flags] };
}

// Tests cuyo contenido va en el panel completo de la suscripción, con lo que mide dicho en corto
export const COVERED_BY_PANEL: Record<string, string> = {
  essential: 'cholesterol',
  iron: 'iron',
  vitamins: 'vitamins',
  vitamin_d: 'vitamin D',
  vitamin_b: 'vitamin B12',
  thyroid: 'thyroid',
  diabetes: 'blood sugar',
  cardio: 'cholesterol',
  lpa: 'Lp(a)',
  testosterone: 'testosterone',
};

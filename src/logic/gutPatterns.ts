import { FODMAP_GROUPS, FOOD_GROUPS, FoodGroup, isFodmap, mealGroups } from './foodGroups';
import type { DigestionEntry, GutSafetyAnswers, GutSymptom, SafetyQuestionId } from '@/types/digestion';
import type { BowelEntry } from '@/types/bathroom';
import { num, t } from '@/i18n';

// Lo que vemos en tu digestión: cruza por detrás tres registros que el usuario apunta por separado
// (comidas de "Tus nutrientes", molestias de Digestión y heces), solo con las horas. Lógica pura
// para la app y los tests. Es orientación, no diagnóstico (riesgo de producto sanitario, MDR regla
// 11): nunca dice qué tienes; dice lo que se repite en tus datos y qué prueba tiene sentido.
//
// Fuentes:
// - Síntomas: GSRS (Svedlund et al., Dig Dis Sci 1988) adaptada (src/types/digestion.ts).
// - Dispepsia y colon irritable: Roma IV (Stanghellini et al. y Lacy et al., Gastroenterology
//   2016): plenitud o saciedad precoz ≥ 3 días/semana; dolor ≥ 1 día/semana ligado a cambios en
//   las heces; 3 meses de síntomas. Reflujo: consenso de Montreal (Vakil et al., Am J
//   Gastroenterol 2006): molestias leves ≥ 2 días/semana o moderadas ≥ 1.
// - SIBO, lactosa y fructosa: test de aliento (consenso norteamericano, Rezaie et al., Am J
//   Gastroenterol 2017;112:775-784).
// - Celiaquía: anti-transglutaminasa IgA + IgA total comiendo gluten (NICE NG20, 2015: gluten en
//   más de una comida al día al menos 6 semanas antes). Sensibilidad al gluten no celíaca: sin
//   análisis, por exclusión (Catassi et al., Nutrients 2015); a menudo son los fructanos (Skodje
//   et al., Gastroenterology 2018).
// - Colon irritable: celiaquía y, con diarrea, calprotectina fecal (BSG, Vasant et al., Gut 2021).
// - Dispepsia: Helicobacter pylori "test and treat" (Maastricht VI/Florencia, Gut 2022).
// - Test IgG de "intolerancias": no (EAACI, Stapel et al., Allergy 2008; AAAAI Choosing Wisely).
// - Señales de alarma: NICE NG12 y CG184, ACG/CAG 2017 (dispepsia), BSG 2018 (diarrea crónica).
//
// SUPUESTOS (revisión clínica, memoria kuova-clinical-review-backlog): ventanas de tiempo,
// mínimos de comidas y días, cortes de seguridad estadística, qué cuenta como día "observado",
// la cena tardía a partir de las 22:00 y los textos de cada prueba.

export type Outcome = GutSymptom | 'diarrhoea';
export type Factor = FoodGroup | 'fodmap' | 'late_meal';
export type Confidence = 'clear' | 'probable' | 'hint';

export interface GutMeal {
  id: string;
  fecha: string;
  description: string;
  groups?: FoodGroup[] | null; // corregidos por el usuario; si no, se deducen del texto
}

// Cuánto después de comer suele notarse cada cosa (minutos desde que se apuntó la comida).
// Pesadez, reflujo y náuseas: durante la comida y hasta ~3 h (se aceptan 30 min antes porque la
// comida se suele apuntar al terminar). Hinchazón, gases y dolor: fermentación, de 30 min a 8 h.
// Heces sueltas o con urgencia: de 1 a 12 h (con 24 h se repartían a las comidas de la víspera).
// Lo de la noche puede venir de la cena (hasta 10 h).
export const WINDOWS: Record<Outcome, [number, number]> = {
  fullness: [-30, 180],
  reflux: [-30, 180],
  nausea: [-30, 180],
  bloating: [30, 480],
  gas: [30, 480],
  pain: [30, 480],
  diarrhoea: [60, 720],
};
const NIGHT_MAX = 600;

// Mínimos para enseñar patrones de comida (antes, solo alarmas y el progreso)
export const MIN_MEALS = 15;
export const MIN_DAYS = 7;
// Patrones de frecuencia: semanas (bloques de 7 días) con al menos 3 días observados
export const MIN_WEEKS = 4;
const ROME_WEEKS = 12;
const LOOKBACK_DAYS = 90;
const SAFETY_VALID_DAYS = 90;
const LATE_HOUR = 22;

const LOWER: Outcome[] = ['bloating', 'gas', 'pain', 'diarrhoea'];
const ALL: Outcome[] = ['fullness', 'bloating', 'reflux', 'gas', 'pain', 'nausea', 'diarrhoea'];

// Solo pares con sentido clínico, fijados de antemano: comparar todo con todo encontraría
// casualidades (con 12 pares, el corte de "bastante claro" es p < 0,005, ≈ Bonferroni)
export const PAIRS: { factor: Factor; outcomes: Outcome[] }[] = [
  { factor: 'lactose', outcomes: LOWER },
  { factor: 'gluten', outcomes: ALL },
  { factor: 'fructose', outcomes: ['bloating', 'gas', 'diarrhoea'] },
  { factor: 'legumes', outcomes: LOWER },
  { factor: 'onion_garlic', outcomes: LOWER },
  { factor: 'polyols', outcomes: ['bloating', 'gas', 'diarrhoea'] },
  { factor: 'fodmap', outcomes: LOWER },
  { factor: 'fatty', outcomes: ['fullness', 'nausea', 'reflux', 'diarrhoea'] },
  { factor: 'spicy', outcomes: ['reflux', 'pain'] },
  { factor: 'alcohol', outcomes: ['reflux', 'diarrhoea'] },
  { factor: 'coffee', outcomes: ['reflux', 'diarrhoea'] },
  { factor: 'late_meal', outcomes: ['reflux'] },
];

// ---------- Utilidades ----------

const MIN = 60 * 1000;
const DAY = 24 * 60 * MIN;

export const dayKeyOf = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const logFactCache = [0];
const logFact = (n: number) => {
  for (let i = logFactCache.length; i <= n; i++) logFactCache[i] = logFactCache[i - 1] + Math.log(i);
  return logFactCache[n];
};
const hyper = (a: number, b: number, c: number, d: number) =>
  Math.exp(
    logFact(a + b) + logFact(c + d) + logFact(a + c) + logFact(b + d) - logFact(a + b + c + d) - logFact(a) - logFact(b) - logFact(c) - logFact(d)
  );

// Test exacto de Fisher de una cola: ¿hay más molestias con el factor (a de a+b) que sin él (c de
// c+d) de lo que daría el azar?
export function fisherGreater(a: number, b: number, c: number, d: number): number {
  const row1 = a + b;
  const col1 = a + c;
  const row2 = c + d;
  let p = 0;
  for (let x = a; x <= Math.min(row1, col1); x++) {
    const cx = col1 - x;
    const dx = row2 - cx;
    if (cx < 0 || dx < 0) continue;
    p += hyper(x, row1 - x, cx, dx);
  }
  return Math.min(1, p);
}

// Riesgo relativo con corrección de Haldane (+0,5) para que un 0 no dé infinito
const relativeRisk = (a: number, n1: number, c: number, n0: number) => (a + 0.5) / (n1 + 1) / ((c + 0.5) / (n0 + 1));

export function grade(a: number, n1: number, c: number, n0: number): Confidence | null {
  if (!n1 || !n0) return null;
  const rr = relativeRisk(a, n1, c, n0);
  const p = fisherGreater(a, n1 - a, c, n0 - c);
  const diff = a / n1 - c / n0;
  if (n1 >= 8 && n0 >= 8 && a >= 3 && rr >= 2 && p < 0.005) return 'clear';
  if (n1 >= 5 && n0 >= 5 && a >= 3 && rr >= 1.5 && diff >= 0.2 && p < 0.05) return 'probable';
  if (n1 >= 3 && a >= 2 && rr >= 1.5 && diff > 0 && p < 0.2) return 'hint';
  return null;
}

// ---------- Eventos: cada molestia o deposición suelta, con su hora ----------

interface GutEvent {
  at: number;
  outcome: Outcome;
  intensity: number; // 1-3
  night: boolean; // entre las 0 y las 7: puede venir de la cena
  woke: boolean; // le despertó (alarma si es dolor o diarrea)
  wholeDay?: boolean; // apunte del día entero, sin hora
}

const isNightHour = (d: Date) => d.getHours() < 7;

export function gutEvents(digestion: DigestionEntry[], bowel: BowelEntry[]): GutEvent[] {
  const out: GutEvent[] = [];
  for (const e of digestion) {
    if (e.kind !== 'symptoms' || !e.symptoms) continue;
    const d = new Date(e.fecha);
    for (const [s, v] of Object.entries(e.symptoms)) {
      if (v) out.push({ at: d.getTime(), outcome: s as GutSymptom, intensity: v, night: !!e.wokeAtNight || isNightHour(d), woke: !!e.wokeAtNight });
    }
  }
  // Heces: Bristol 6 = moderado, 7 = fuerte; con urgencia, al menos moderado
  const looseLevel = (consistency?: number, urgent?: boolean) =>
    Math.max(consistency === 7 ? 3 : consistency === 6 ? 2 : 0, urgent ? 2 : 0);
  for (const b of bowel) {
    if (b.movements?.length) {
      for (const m of b.movements) {
        const level = looseLevel(m.consistency, m.urgent);
        const d = new Date(m.at);
        if (level) out.push({ at: d.getTime(), outcome: 'diarrhoea', intensity: level, night: isNightHour(d), woke: d.getHours() < 5 });
      }
    } else if (b.count > 0) {
      // Apunte del día entero, sin hora: se cuenta a las 21:00 de ese día y se relaciona con las
      // comidas de ese mismo día. SUPUESTO.
      const level = looseLevel(b.consistency);
      if (level) {
        const d = new Date(b.fecha);
        d.setHours(21, 0, 0, 0);
        out.push({ at: d.getTime(), outcome: 'diarrhoea', intensity: level, night: false, woke: false, wholeDay: true });
      }
    }
  }
  return out.sort((a, b) => a.at - b.at);
}

const inWindow = (mealAt: number, ev: GutEvent) => {
  if (ev.wholeDay) return mealAt <= ev.at && dayKeyOf(new Date(mealAt)) === dayKeyOf(new Date(ev.at));
  const [lo, hi] = WINDOWS[ev.outcome];
  const delta = (ev.at - mealAt) / MIN;
  return delta >= lo && delta <= (ev.night ? Math.max(hi, NIGHT_MAX) : hi);
};

// La comida con la que encaja una molestia: la más reciente dentro de su ventana
export function matchingMeal<M extends { fecha: string }>(at: number, outcome: Outcome, meals: M[], night = false): M | null {
  const ev: GutEvent = { at, outcome, intensity: 1, night, woke: false };
  return (
    meals
      .filter((m) => inWindow(new Date(m.fecha).getTime(), ev))
      .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())[0] ?? null
  );
}

// ---------- Comidas observadas ----------

interface ScoredMeal {
  id: string;
  at: number;
  day: string;
  factors: Set<Factor>;
  worst: Partial<Record<Outcome, number>>;
}

const symptomatic = (m: ScoredMeal, outcomes: Outcome[], min = 2) => outcomes.some((o) => (m.worst[o] ?? 0) >= min);

// Un día cuenta como observado si ese día hay algo en Digestión (molestias o "Hoy, bien"): si el
// usuario apunta, damos por hecho que apunta lo que nota. Las comidas de las últimas 8 h aún no
// cuentan (su ventana no ha terminado). SUPUESTO.
function scoreMeals(meals: GutMeal[], events: GutEvent[], observed: Set<string>, now: Date): ScoredMeal[] {
  const from = now.getTime() - LOOKBACK_DAYS * DAY;
  const until = now.getTime() - 8 * 60 * MIN;
  return meals
    .map((m) => {
      const d = new Date(m.fecha);
      const groups = mealGroups(m.description, m.groups);
      const factors = new Set<Factor>(groups);
      if (isFodmap(groups)) factors.add('fodmap');
      if (d.getHours() >= LATE_HOUR) factors.add('late_meal');
      const worst: Partial<Record<Outcome, number>> = {};
      for (const ev of events) {
        if (inWindow(d.getTime(), ev)) worst[ev.outcome] = Math.max(worst[ev.outcome] ?? 0, ev.intensity);
      }
      return { id: m.id, at: d.getTime(), day: dayKeyOf(d), factors, worst };
    })
    .filter((m) => m.at >= from && m.at <= until && observed.has(m.day));
}

// ---------- Resultado ----------

export interface TestSuggestion {
  id: 'lactose' | 'fructose' | 'coeliac' | 'sibo' | 'hpylori' | 'ibs' | 'reflux_advice' | 'fodmap_advice' | 'trigger_advice';
  title: string;
  body: string;
  prep?: string;
  warning?: string;
  storeIds: string[]; // pruebas de la tienda (src/data/testCatalog.ts)
}

export interface GutPattern {
  id: string;
  kind: 'food' | 'frequency';
  factor?: Factor;
  confidence: Confidence;
  title: string;
  numbers: string;
  body?: string;
  confoundedWith?: FoodGroup;
  suggestion?: TestSuggestion;
}

export type AlarmId = SafetyQuestionId | 'stool_blood' | 'stool_pale' | 'diarrhoea_4w' | 'night_logs';

export interface GutAlarm {
  id: AlarmId;
  title: string;
  body: string;
}

export interface GutAnalysis {
  observedMeals: number;
  observedDays: number;
  ready: boolean;
  weeksCovered: number;
  alarms: GutAlarm[];
  safety: 'needed' | 'ok';
  showTests: boolean; // solo con las preguntas de seguridad al día y ninguna alarma
  patterns: GutPattern[];
}

export interface GutContext {
  meals: GutMeal[];
  digestion: DigestionEntry[];
  bowel: BowelEntry[];
  safety: GutSafetyAnswers | null;
  age?: number | null;
  anaemia?: boolean; // en el perfil
  familyColorectal?: boolean; // de "Conoce tus raíces" (padres, hermanos o hijos)
  now?: Date;
}

const rank: Record<Confidence, number> = { clear: 3, probable: 2, hint: 1 };

export const CONFIDENCE_LABEL: Record<Confidence, string> = {
  clear: 'Quite clear',
  probable: 'Likely',
  hint: 'A hint',
};

const FACTOR_WITH: Record<Factor, string> = {
  gluten: 'with gluten',
  lactose: 'with dairy',
  dairy_low_lactose: 'with low-lactose dairy',
  legumes: 'with legumes',
  onion_garlic: 'with onion or garlic',
  fructose: 'with sweet fruit, juice or honey',
  polyols: 'with polyols (sugar-free sweets, plums, mushrooms…)',
  fatty: 'that were fried or fatty',
  spicy: 'that were spicy',
  alcohol: 'with alcohol',
  coffee: 'with coffee',
  fodmap: 'with fermentable foods (FODMAP)',
  late_meal: 'after 10 pm',
};

const FACTOR_TITLE: Record<Factor, string> = {
  lactose: 'Dairy with lactose seems to disagree with you',
  gluten: 'Symptoms come mostly with gluten',
  fructose: 'Sweet fruit, juice or honey seem to disagree with you',
  legumes: 'Legumes seem to disagree with you',
  onion_garlic: 'Onion and garlic seem to disagree with you',
  polyols: 'Polyols seem to disagree with you',
  fodmap: 'Fermentable foods (FODMAP) seem to disagree with you',
  fatty: 'Fried or fatty meals sit heavy',
  spicy: 'Spicy food brings heartburn or pain',
  alcohol: 'Alcohol brings reflux or loose stools',
  coffee: 'Coffee brings reflux or urgency',
  late_meal: 'Reflux when you have dinner late',
  dairy_low_lactose: 'Low-lactose dairy seems to disagree with you',
};

export const groupLabel = (g: FoodGroup) => t(FOOD_GROUPS.find((x) => x.id === g)!.label);

const BREATH_PREP = 'Follow the kit instructions: usually 8–12 hours fasting, a low-fibre dinner the night before and no antibiotics in the previous 4 weeks.';

export const SUGGESTIONS: Record<TestSuggestion['id'], () => TestSuggestion> = {
  lactose: () => ({
    id: 'lactose',
    title: t('Lactose breath test'),
    body: t('It shows whether your gut absorbs lactose: you drink a lactose solution and breathe into tubes for a few hours. There is also a genetic test (LCT) with no preparation: it shows whether your body stops making lactase with age, not whether milk disagrees with you. It is not in our store yet.'),
    prep: t(BREATH_PREP),
    storeIds: ['lactose'],
  }),
  fructose: () => ({
    id: 'fructose',
    title: t('Fructose breath test'),
    body: t('It shows whether your gut absorbs fructose, the sugar in fruit, juice and honey.'),
    prep: t(BREATH_PREP),
    storeIds: ['fructose'],
  }),
  sibo: () => ({
    id: 'sibo',
    title: t('SIBO breath test (glucose or lactulose)'),
    body: t('It measures the hydrogen and methane made by bacteria in the small intestine after a glucose or lactulose drink, as the 2017 North American consensus recommends.'),
    prep: t(BREATH_PREP),
    storeIds: ['sibo'],
  }),
  coeliac: () => ({
    id: 'coeliac',
    title: t('Coeliac disease blood test'),
    body: t('Anti-transglutaminase IgA antibodies with total IgA. If it comes back negative and gluten still seems to disagree with you, non-coeliac gluten sensitivity has no lab test: a doctor or dietitian diagnoses it by ruling out the rest. Often it is the fructans in wheat, not the gluten. If you have already cut out gluten, ask a doctor about the genetic test (HLA-DQ2/DQ8), which can rule coeliac disease out; it is not in our store yet.'),
    warning: t('Do not cut out gluten before the test: it only works if you keep eating it, in more than one meal a day, for at least 6 weeks before.'),
    storeIds: ['coeliac'],
  }),
  hpylori: () => ({
    id: 'hpylori',
    title: t('Helicobacter pylori test'),
    body: t('Heaviness and feeling full quickly can come from a stomach infection with Helicobacter pylori. A doctor or pharmacy can do the breath test (urea C13); it is not in our store yet.'),
    warning: t('For a reliable result: 2 weeks without omeprazole or similar, and 4 weeks without antibiotics.'),
    storeIds: [],
  }),
  ibs: () => ({
    id: 'ibs',
    title: t('See a digestive doctor first'),
    body: t('When nothing else explains it, tummy pain that comes with changes in your stools is what doctors call irritable bowel. The usual first steps are a doctor visit and a coeliac blood test; with diarrhoea, also a stool calprotectin test, which your doctor can order. A low-FODMAP diet can help, best guided by a dietitian.'),
    storeIds: ['coeliac', 'consult_digestive'],
  }),
  reflux_advice: () => ({
    id: 'reflux_advice',
    title: t('Reflux: habits first'),
    body: t('No test needed. What helps most: dinner 3 hours before bed, smaller meals, less alcohol, raising the head of the bed and, if needed, losing a little weight. If it keeps happening for weeks or you need antacids often, talk to your doctor or pharmacist.'),
    storeIds: [],
  }),
  fodmap_advice: () => ({
    id: 'fodmap_advice',
    title: t('No lab test for this'),
    body: t('There is no reliable lab test for these foods. A dietitian can guide a low-FODMAP diet for a few weeks and then bring foods back one by one to find your limit. If there is also pain with changes in your stools, talk to a doctor.'),
    storeIds: [],
  }),
  trigger_advice: () => ({
    id: 'trigger_advice',
    title: t('Try cutting down for two weeks'),
    body: t('No test needed. Cut down on it for two weeks and see whether the symptoms change.'),
    storeIds: [],
  }),
};

const FACTOR_SUGGESTION: Record<Factor, TestSuggestion['id']> = {
  lactose: 'lactose',
  fructose: 'fructose',
  gluten: 'coeliac',
  legumes: 'fodmap_advice',
  onion_garlic: 'fodmap_advice',
  polyols: 'fodmap_advice',
  fodmap: 'fodmap_advice',
  dairy_low_lactose: 'trigger_advice',
  fatty: 'trigger_advice',
  spicy: 'trigger_advice',
  alcohol: 'trigger_advice',
  coffee: 'trigger_advice',
  late_meal: 'reflux_advice',
};

const ALARM_TEXT: Record<AlarmId, { title: string; body: string }> = {
  weight_loss: { title: 'Weight loss without trying', body: 'Losing weight without trying, along with digestive symptoms, needs a doctor before any test.' },
  blood: { title: 'Blood in your stools or black stools', body: 'Blood or black stools need a doctor to look at them, not a test from home.' },
  anaemia: { title: 'Anaemia or low iron', body: 'With anaemia or low iron, a doctor should look for the cause, which can be in the gut (coeliac disease among others).' },
  night: { title: 'Symptoms that wake you up at night', body: 'Pain or diarrhoea that wakes you up is worth checking with a doctor rather than with a test.' },
  swallow_vomit: { title: 'Trouble swallowing or vomiting often', body: 'Food getting stuck or vomiting that keeps coming back needs a doctor.' },
  onset_after_50: { title: 'Symptoms that started after 50', body: 'New digestive symptoms after 50 should be checked by a doctor first.' },
  family: {
    title: 'Bowel cancer or coeliac disease in your close family',
    body: 'With a parent, brother, sister or child with bowel cancer or coeliac disease, a doctor should guide the next steps. With coeliac disease in the family, they usually order the coeliac blood test.',
  },
  stool_blood: { title: 'Reddish or very dark stools that nothing explains', body: 'You logged reddish or very dark stools without a food or medicine that explains them.' },
  stool_pale: { title: 'Pale stools more than once', body: 'Pale or clay-coloured stools are worth mentioning to a doctor.' },
  diarrhoea_4w: { title: 'Loose stools for more than 4 weeks', body: 'Diarrhoea that lasts more than 4 weeks needs a doctor.' },
  night_logs: { title: 'Symptoms at night', body: 'You logged pain or loose stools that woke you up on more than one night.' },
};

const alarm = (id: AlarmId): GutAlarm => ({ id, title: t(ALARM_TEXT[id].title), body: t(ALARM_TEXT[id].body) });

export const safetyIsCurrent = (s: GutSafetyAnswers | null, now = new Date()) =>
  !!s && now.getTime() - new Date(s.answeredAt).getTime() < SAFETY_VALID_DAYS * DAY;

// ---------- Análisis ----------

export function analyseGut(ctx: GutContext): GutAnalysis {
  const now = ctx.now ?? new Date();
  const events = gutEvents(ctx.digestion, ctx.bowel);
  const observed = new Set(
    ctx.digestion.filter((e) => now.getTime() - new Date(e.fecha).getTime() < LOOKBACK_DAYS * DAY).map((e) => dayKeyOf(new Date(e.fecha)))
  );
  const meals = scoreMeals(ctx.meals, events, observed, now);
  const observedMealDays = new Set(meals.map((m) => m.day)).size;
  const ready = meals.length >= MIN_MEALS && observedMealDays >= MIN_DAYS;

  // Semanas cubiertas (bloques de 7 días hacia atrás con ≥ 3 días observados)
  const dayBack = (n: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() - n);
    return dayKeyOf(d);
  };
  const blocks = Array.from({ length: ROME_WEEKS }, (_, k) => Array.from({ length: 7 }, (_, i) => dayBack(k * 7 + i)));
  const coveredBlocks = blocks.filter((b) => b.filter((d) => observed.has(d)).length >= 3);
  const weeksCovered = coveredBlocks.length;
  const coveredDays = coveredBlocks.flat().filter((d) => observed.has(d));

  const eventDays = (outcomes: Outcome[], min: number) =>
    new Set(events.filter((e) => outcomes.includes(e.outcome) && e.intensity >= min).map((e) => dayKeyOf(new Date(e.at))));
  const perWeek = (outcomes: Outcome[], min: number) => {
    if (!coveredDays.length) return 0;
    const days = eventDays(outcomes, min);
    return (coveredDays.filter((d) => days.has(d)).length / coveredDays.length) * 7;
  };

  // ---- Alarmas ----
  const alarms: GutAlarm[] = [];
  const answers = ctx.safety?.answers ?? {};
  (['weight_loss', 'blood', 'anaemia', 'night', 'swallow_vomit', 'onset_after_50', 'family'] as SafetyQuestionId[]).forEach((id) => {
    if (answers[id]) alarms.push(alarm(id));
  });
  if (ctx.anaemia && !answers.anaemia) alarms.push(alarm('anaemia'));
  if (ctx.familyColorectal && !answers.family) alarms.push(alarm('family'));
  const last30 = ctx.bowel.filter((b) => now.getTime() - new Date(b.fecha).getTime() < 30 * DAY);
  if (last30.some((b) => (b.color === 'red' || b.color === 'black') && !b.explainedBy)) alarms.push(alarm('stool_blood'));
  if (last30.filter((b) => b.color === 'pale').length >= 2) alarms.push(alarm('stool_pale'));
  // Diarrea crónica: en cada una de las últimas 4 semanas, 3 días o más con heces sueltas
  const looseDays = eventDays(['diarrhoea'], 2);
  const chronic = blocks.slice(0, 4).every((b) => b.filter((d) => looseDays.has(d)).length >= 3);
  if (chronic) alarms.push(alarm('diarrhoea_4w'));
  // Despertarse por la noche con dolor o heces sueltas (el reflujo nocturno es reflujo, no alarma)
  const nights = new Set(
    events
      .filter((e) => e.woke && (e.outcome === 'pain' || e.outcome === 'diarrhoea') && e.intensity >= 2 && now.getTime() - e.at < 30 * DAY)
      .map((e) => dayKeyOf(new Date(e.at)))
  );
  if (nights.size >= 2 && !answers.night) alarms.push(alarm('night_logs'));

  const safety = safetyIsCurrent(ctx.safety, now) ? 'ok' : 'needed';
  const showTests = safety === 'ok' && alarms.length === 0;

  // ---- Patrones de comida ----
  const patterns: GutPattern[] = [];
  if (ready) {
    // Primero los candidatos, del más fuerte al más débil
    const candidates = PAIRS.map(({ factor, outcomes }) => {
      const withF = meals.filter((m) => m.factors.has(factor));
      const without = meals.filter((m) => !m.factors.has(factor));
      const a = withF.filter((m) => symptomatic(m, outcomes)).length;
      const c = without.filter((m) => symptomatic(m, outcomes)).length;
      return { factor, outcomes, withF, without, a, c, confidence: grade(a, withF.length, c, without.length), p: fisherGreater(a, withF.length - a, c, without.length - c) };
    })
      .filter((x) => x.confidence)
      .sort((x, y) => rank[y.confidence!] - rank[x.confidence!] || x.p - y.p);
    const kept: Factor[] = [];
    const related = (f: Factor, g: Factor) =>
      (f === 'fodmap' && FODMAP_GROUPS.includes(g as FoodGroup)) || (g === 'fodmap' && FODMAP_GROUPS.includes(f as FoodGroup));
    for (const { factor, outcomes, withF, without, a, c, confidence: conf } of candidates) {
      const confidence = conf!;
      // ¿Lo explica un patrón más fuerte? (el gluten de la tostada del café con leche): sin las
      // comidas de ese otro factor, la diferencia desaparece. Entonces no se enseña.
      const explained = kept.some((g) => {
        if (related(factor, g)) return false;
        const w1 = withF.filter((m) => !m.factors.has(g));
        const w0 = without.filter((m) => !m.factors.has(g));
        if (w1.length < 3 || !w0.length) return false; // no se puede separar: lo dice el aviso de abajo
        const a1 = w1.filter((m) => symptomatic(m, outcomes)).length;
        const c1 = w0.filter((m) => symptomatic(m, outcomes)).length;
        return grade(a1, w1.length, c1, w0.length) === null; // sin el otro, ni una pista
      });
      if (explained) continue;
      kept.push(factor);
      const pattern: GutPattern = {
        id: `food_${factor}`,
        kind: 'food',
        factor,
        confidence,
        title: t(FACTOR_TITLE[factor]),
        numbers: t('Symptoms after {a} of {n1} meals {with}, against {c} of {n0} of the rest.', {
          a,
          n1: withF.length,
          with: t(FACTOR_WITH[factor]),
          c,
          n0: without.length,
        }),
      };
      // ¿Va siempre con otro grupo? (p. ej. gluten y lácteos en la pizza)
      if (confidence !== 'hint') {
        const others = FOOD_GROUPS.map((g) => g.id).filter(
          (g) => g !== factor && !(factor === 'fodmap' && FODMAP_GROUPS.includes(g))
        );
        let worstShare = 0;
        for (const g of others) {
          const share = withF.filter((m) => m.factors.has(g)).length / withF.length;
          if (share < 0.6 || share <= worstShare) continue;
          // ¿El factor se sostiene solo? (comidas con él y sin el otro)
          const w1 = withF.filter((m) => !m.factors.has(g));
          const w0 = without.filter((m) => !m.factors.has(g));
          const a1 = w1.filter((m) => symptomatic(m, outcomes)).length;
          const c1 = w0.filter((m) => symptomatic(m, outcomes)).length;
          const standsAlone = w1.length >= 3 && w0.length > 0 && grade(a1, w1.length, c1, w0.length) !== null;
          // ¿El otro queda descartado? (comidas con él y sin el factor que sientan bien)
          const gOnly = without.filter((m) => m.factors.has(g));
          const gRate = gOnly.filter((m) => symptomatic(m, outcomes)).length / Math.max(1, gOnly.length);
          const neitherRate = c1 / Math.max(1, w0.length);
          const otherCleared = gOnly.length >= 3 && gRate <= neitherRate + 0.15;
          if (!standsAlone && !otherCleared) {
            pattern.confoundedWith = g;
            worstShare = share;
          }
        }
        if (pattern.confoundedWith) {
          pattern.body = t('Many of those meals also had {other}: we cannot tell yet which of the two it is.', {
            other: groupLabel(pattern.confoundedWith).toLowerCase(),
          });
        }
      }
      if (factor === 'lactose') {
        // Los lácteos casi sin lactosa como comparación: si sientan bien, apunta a la lactosa
        const low = meals.filter((m) => m.factors.has('dairy_low_lactose') && !m.factors.has('lactose'));
        const lowSym = low.filter((m) => symptomatic(m, outcomes)).length;
        if (low.length >= 3 && lowSym / low.length <= c / Math.max(1, without.length) + 0.1) {
          pattern.body = [pattern.body, t('Aged cheese and lactose-free dairy sit better with you, which fits with lactose.')].filter(Boolean).join(' ');
        }
      }
      if (confidence === 'hint') pattern.body = [pattern.body, t('Not enough yet to be sure. Keep logging.')].filter(Boolean).join(' ');
      else pattern.suggestion = SUGGESTIONS[FACTOR_SUGGESTION[factor]]();
      patterns.push(pattern);
    }
    // El FODMAP conjunto solo si ningún grupo concreto lo explica igual o mejor
    const fodmap = patterns.find((p) => p.factor === 'fodmap');
    if (fodmap && patterns.some((p) => p.factor && FODMAP_GROUPS.includes(p.factor as FoodGroup) && rank[p.confidence] >= rank[fodmap.confidence])) {
      patterns.splice(patterns.indexOf(fodmap), 1);
    }
  }

  // ---- Patrones de frecuencia (Roma IV, Montreal) ----
  if (weeksCovered >= MIN_WEEKS) {
    const freqConfidence: Confidence = weeksCovered >= 8 ? 'clear' : 'probable';
    const romeNote =
      weeksCovered >= ROME_WEEKS
        ? t('It has been going on for about 3 months: worth seeing a doctor.')
        : t('If it carries on like this for 3 months, talk to a doctor.');
    const perWeekText = (n: number) => t('About {n} days a week, over {w} weeks of notes.', { n: num(Math.round(n * 10) / 10), w: weeksCovered });
    const foodExplainsBloating = patterns.some(
      (p) => p.kind === 'food' && p.confidence !== 'hint' && PAIRS.find((x) => x.factor === p.factor)!.outcomes.includes('bloating')
    );

    // Hinchazón con casi cualquier comida, sin un alimento que lo explique → SIBO
    const bloatWeek = perWeek(['bloating', 'gas'], 2);
    const bloatShare = meals.length ? meals.filter((m) => symptomatic(m, ['bloating', 'gas'])).length / meals.length : 0;
    if (ready && bloatWeek >= 3 && bloatShare >= 0.4 && !foodExplainsBloating) {
      patterns.push({
        id: 'freq_bloating',
        kind: 'frequency',
        confidence: freqConfidence,
        title: t('You bloat with almost any meal'),
        numbers: `${perWeekText(bloatWeek)} ${t('Bloating or gas after {p}% of your meals, whatever they had.', { p: Math.round(bloatShare * 100) })}`,
        body: romeNote,
        suggestion: SUGGESTIONS.sibo(),
      });
    }

    // Pesadez o saciedad precoz ≥ 3 días/semana (dispepsia posprandial, Roma IV)
    const fullWeek = perWeek(['fullness'], 2);
    if (fullWeek >= 3) {
      patterns.push({
        id: 'freq_fullness',
        kind: 'frequency',
        confidence: freqConfidence,
        title: t('Heaviness or feeling full too soon, often'),
        numbers: perWeekText(fullWeek),
        body: romeNote,
        suggestion: SUGGESTIONS.hpylori(),
      });
    }

    // Reflujo (Montreal): leve ≥ 2 días/semana o moderado ≥ 1
    const refluxMild = perWeek(['reflux'], 1);
    const refluxStrong = perWeek(['reflux'], 2);
    if (refluxMild >= 2 || refluxStrong >= 1) {
      const triggers = patterns
        .filter((p) => p.kind === 'food' && p.factor && ['late_meal', 'alcohol', 'fatty', 'spicy', 'coffee'].includes(p.factor))
        .map((p) => t(FACTOR_WITH[p.factor!]));
      patterns.push({
        id: 'freq_reflux',
        kind: 'frequency',
        confidence: freqConfidence,
        title: t('Frequent reflux'),
        numbers: perWeekText(refluxMild),
        body: triggers.length ? t('It shows up most with meals {list}.', { list: triggers.join(', ') }) : undefined,
        suggestion: SUGGESTIONS.reflux_advice(),
      });
    }

    // Dolor ≥ 1 día/semana que coincide con cambios en las heces (colon irritable, Roma IV)
    const painDays = [...eventDays(['pain'], 1)].filter((d) => coveredDays.includes(d));
    const painWeek = perWeek(['pain'], 1);
    const abnormalStoolDays = new Set<string>();
    for (const b of ctx.bowel) {
      const odd = b.consistency != null && (b.consistency <= 2 || b.consistency >= 6);
      const oddMove = b.movements?.some((m) => m.consistency != null && (m.consistency <= 2 || m.consistency >= 6));
      if (odd || oddMove) abnormalStoolDays.add(dayKeyOf(new Date(b.fecha)));
    }
    const nextDay = (d: string) => dayKeyOf(new Date(new Date(`${d}T12:00:00`).getTime() + DAY));
    const linked = painDays.filter((d) => abnormalStoolDays.has(d) || abnormalStoolDays.has(nextDay(d))).length;
    if (painWeek >= 1 && painDays.length >= 4 && linked / painDays.length >= 0.5) {
      const typed = ctx.bowel.filter((b) => b.consistency != null && now.getTime() - new Date(b.fecha).getTime() < LOOKBACK_DAYS * DAY);
      const loose = typed.filter((b) => b.consistency! >= 6).length / Math.max(1, typed.length);
      const hard = typed.filter((b) => b.consistency! <= 2).length / Math.max(1, typed.length);
      // Subtipo por la escala de Bristol (Roma IV): más del 25 % de días sueltos o duros
      const subtype =
        loose > 0.25 && hard > 0.25
          ? t('Your stools swing between hard and loose.')
          : loose > 0.25
            ? t('Your stools are mostly on the loose side.')
            : hard > 0.25
              ? t('Your stools are mostly on the hard side.')
              : '';
      patterns.push({
        id: 'freq_ibs',
        kind: 'frequency',
        confidence: freqConfidence,
        title: t('Tummy pain that comes with changes in your stools'),
        numbers: `${perWeekText(painWeek)} ${t('{p}% of pain days had harder or looser stools that day or the next.', { p: Math.round((linked / painDays.length) * 100) })}`,
        body: [subtype, romeNote].filter(Boolean).join(' '),
        suggestion: SUGGESTIONS.ibs(),
      });
    }
  }

  patterns.sort((x, y) => rank[y.confidence] - rank[x.confidence]);

  return {
    observedMeals: meals.length,
    observedDays: observedMealDays,
    ready,
    weeksCovered,
    alarms,
    safety,
    showTests,
    patterns,
  };
}

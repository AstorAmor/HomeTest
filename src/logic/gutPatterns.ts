import { FOOD_GROUPS, FoodGroup, mealGroups } from './foodGroups';
import type { DigestionEntry, GutSafetyAnswers, GutSymptom, SafetyQuestionId, UsualFoods, UsualFrequency } from '@/types/digestion';
import { USUAL_FREQUENCIES } from '@/types/digestion';
import type { BowelEntry } from '@/types/bathroom';
import { num, t } from '@/i18n';

// Lo que vemos en tu digestión. Cada vez que el usuario apunta una molestia en Digestión, le
// preguntamos qué comió antes (no se le pide nada antes de que pase algo, y no se usan las comidas
// de "Tus nutrientes"). Así no hay comidas "buenas" con las que comparar, de modo que la
// comparación es la frecuencia habitual: si los lácteos salen antes de 9 de 10 molestias y los
// tomas unas veces por semana, es mucho más de lo esperable. Es el diseño case-crossover con la
// frecuencia habitual de exposición (Maclure, Am J Epidemiol 1991;133:144-153). Las heces sueltas
// o con urgencia (Heces) se cruzan por la hora con esas comidas. Lógica pura para la app y los
// tests. Es orientación, no diagnóstico (riesgo de producto sanitario, MDR regla 11): nunca dice
// qué tienes; dice lo que se repite en tus datos y qué prueba tiene sentido.
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
// SUPUESTOS (revisión clínica, memoria kuova-clinical-review-backlog): ventanas de tiempo, la
// parte de las comidas que corresponde a cada respuesta de frecuencia, mínimos de apuntes, cortes
// de seguridad estadística, cuándo un alimento "explica" a otro que va con él, qué cuenta como día
// "observado", la cena tardía a partir de las 22:00 y los textos de cada prueba.

export type Outcome = GutSymptom | 'diarrhoea';
export type Factor = FoodGroup;
export type Confidence = 'clear' | 'probable' | 'hint';

// Cuánto después de comer suele notarse cada cosa (minutos desde la comida).
// Pesadez, reflujo y náuseas: durante la comida y hasta ~3 h (se aceptan 30 min antes por si la
// hora es aproximada). Hinchazón, gases y dolor: fermentación, de 30 min a 8 h.
// Heces sueltas o con urgencia: de 1 a 12 h. Lo de la noche puede venir de la cena (hasta 10 h).
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

// "¿Cada cuánto sueles tomarlo?" → parte de tus comidas que lo llevan, contando 3-4 comidas o
// picoteos al día (una vez al día ≈ 0,3; algunas veces por semana ≈ 3 de 28). SUPUESTO.
export const USUAL_SHARE: Record<UsualFrequency, number> = { most: 0.75, daily: 0.3, weekly: 0.1, rarely: 0.03 };

// Mínimo de veces con lo que comiste antes para enseñar patrones de comida (antes, solo alarmas
// y el progreso)
export const MIN_EPISODES = 5;
// Patrones de frecuencia: semanas (bloques de 7 días) con al menos 3 días observados
export const MIN_WEEKS = 4;
const ROME_WEEKS = 12;
const LOOKBACK_DAYS = 90;
const SAFETY_VALID_DAYS = 90;
const LATE_HOUR = 22;
const DEFAULT_MINUTES_BEFORE = 120; // si no dijo cuánto antes comió. SUPUESTO.
// Dos alimentos que van juntos: el que tomas más a menudo sin molestias queda explicado por el
// otro si este sale al menos 3 veces más por encima de lo esperable. SUPUESTO.
const DOMINANCE = 3;

const LOWER: Outcome[] = ['bloating', 'gas', 'pain', 'diarrhoea'];
const ALL: Outcome[] = ['fullness', 'bloating', 'reflux', 'gas', 'pain', 'nausea', 'diarrhoea'];

// Solo pares con sentido clínico, fijados de antemano: comparar todo con todo encontraría
// casualidades (con 10 pares, el corte de "bastante claro" es p < 0,005, ≈ Bonferroni)
export const PAIRS: { factor: Factor; outcomes: Outcome[] }[] = [
  { factor: 'lactose', outcomes: LOWER },
  { factor: 'gluten', outcomes: ALL },
  { factor: 'fructose', outcomes: ['bloating', 'gas', 'diarrhoea'] },
  { factor: 'legumes', outcomes: LOWER },
  { factor: 'onion_garlic', outcomes: LOWER },
  { factor: 'polyols', outcomes: ['bloating', 'gas', 'diarrhoea'] },
  { factor: 'fatty', outcomes: ['fullness', 'nausea', 'reflux', 'diarrhoea'] },
  { factor: 'spicy', outcomes: ['reflux', 'pain'] },
  { factor: 'alcohol', outcomes: ['reflux', 'diarrhoea'] },
  { factor: 'coffee', outcomes: ['reflux', 'diarrhoea'] },
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

// Binomial de una cola: si el alimento no tuviera nada que ver, saldría antes de cada molestia
// con su frecuencia habitual p. ¿Qué probabilidad hay de verlo a veces o más de n?
export function binomialGreater(a: number, n: number, p: number): number {
  if (a <= 0) return 1;
  if (a > n || p <= 0) return 0;
  if (p >= 1) return 1;
  let s = 0;
  for (let x = a; x <= n; x++) s += Math.exp(logFact(n) - logFact(x) - logFact(n - x) + x * Math.log(p) + (n - x) * Math.log(1 - p));
  return Math.min(1, s);
}

// Cuántas veces más de lo esperable (razón de odds frente a la frecuencia habitual, con +0,5 para
// que un 0 o un "todas" no den infinito)
export const oddsVsUsual = (a: number, n: number, p: number) => (a + 0.5) / (n - a + 0.5) / (p / (1 - p));

// a de n molestias con el alimento, que tomas en una parte p de tus comidas
export function grade(a: number, n: number, p: number): Confidence | null {
  if (!n || p <= 0 || p >= 1) return null;
  const or = oddsVsUsual(a, n, p);
  const pv = binomialGreater(a, n, p);
  const diff = a / n - p;
  if (n >= 8 && a >= 4 && or >= 3 && diff >= 0.3 && pv < 0.005) return 'clear';
  if (n >= 5 && a >= 3 && or >= 2 && diff >= 0.25 && pv < 0.05) return 'probable';
  if (n >= 3 && a >= 2 && or >= 1.5 && diff >= 0.1 && pv < 0.2) return 'hint';
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

// ---------- Veces con lo que comiste antes ----------

export interface FoodEpisode {
  id: string;
  mealAt: number;
  factors: Set<FoodGroup>;
  // Lo que encaja por la hora con esa comida: las molestias apuntadas y las heces sueltas de después
  outcomes: Partial<Record<Outcome, number>>;
  late: boolean; // comida a partir de las 22:00
  big: boolean; // "Mucho"
}

// Cada apunte de molestias con su comida de antes. Si no había comido, no cuenta (no hay comida
// que comparar). Una molestia fuera de la ventana de esa comida no se le atribuye.
export function foodEpisodes(digestion: DigestionEntry[], bowel: BowelEntry[], now = new Date()): FoodEpisode[] {
  const from = now.getTime() - LOOKBACK_DAYS * DAY;
  const loose = gutEvents([], bowel);
  const out: FoodEpisode[] = [];
  for (const e of digestion) {
    const f = e.food;
    if (e.kind !== 'symptoms' || !f || f.fasted || (!f.groups && !f.description?.trim())) continue;
    const start = new Date(e.fecha);
    if (start.getTime() < from) continue;
    const mealAt = start.getTime() - (f.minutesBefore ?? DEFAULT_MINUTES_BEFORE) * MIN;
    const night = !!e.wokeAtNight || isNightHour(start);
    const outcomes: Partial<Record<Outcome, number>> = {};
    for (const [s, v] of Object.entries(e.symptoms ?? {})) {
      if (v && inWindow(mealAt, { at: start.getTime(), outcome: s as Outcome, intensity: v, night, woke: false })) outcomes[s as Outcome] = v;
    }
    for (const ev of loose) {
      if (inWindow(mealAt, ev)) outcomes.diarrhoea = Math.max(outcomes.diarrhoea ?? 0, ev.intensity);
    }
    out.push({
      id: e.id,
      mealAt,
      factors: new Set(mealGroups(f.description ?? '', f.groups ?? null)),
      outcomes,
      late: new Date(mealAt).getHours() >= LATE_HOUR,
      big: f.amount === 'lot',
    });
  }
  return out;
}

const hasAny = (e: FoodEpisode, outcomes: Outcome[]) => outcomes.some((o) => e.outcomes[o]);

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
  foodEpisodes: number; // veces con lo que comiste antes
  ready: boolean;
  missingUsual: FoodGroup[]; // salen antes de molestias pero no sabemos cada cuánto los tomas
  weeksCovered: number;
  alarms: GutAlarm[];
  safety: 'needed' | 'ok';
  showTests: boolean; // solo con las preguntas de seguridad al día y ninguna alarma
  patterns: GutPattern[];
}

export interface GutContext {
  digestion: DigestionEntry[];
  bowel: BowelEntry[];
  usual: UsualFoods; // cada cuánto sueles tomar cada grupo
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

const FACTOR_TITLE: Record<Factor, string> = {
  lactose: 'Dairy with lactose seems to disagree with you',
  gluten: 'Symptoms come mostly with gluten',
  fructose: 'Sweet fruit, juice or honey seem to disagree with you',
  legumes: 'Legumes seem to disagree with you',
  onion_garlic: 'Onion and garlic seem to disagree with you',
  polyols: 'Polyols seem to disagree with you',
  fatty: 'Fried or fatty meals sit heavy',
  spicy: 'Spicy food brings heartburn or pain',
  alcohol: 'Alcohol brings reflux or loose stools',
  coffee: 'Coffee brings reflux or urgency',
  dairy_low_lactose: 'Low-lactose dairy seems to disagree with you',
};

// Para la lista de "Aparece sobre todo con las comidas…" del reflujo
const FACTOR_WITH: Partial<Record<Factor, string>> = {
  fatty: 'that were fried or fatty',
  spicy: 'that were spicy',
  alcohol: 'with alcohol',
  coffee: 'with coffee',
};

export const groupLabel = (g: FoodGroup) => t(FOOD_GROUPS.find((x) => x.id === g)!.label);
export const usualLabel = (f: UsualFrequency) => t(USUAL_FREQUENCIES.find((x) => x.id === f)!.label);

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
  dairy_low_lactose: 'trigger_advice',
  fatty: 'trigger_advice',
  spicy: 'trigger_advice',
  alcohol: 'trigger_advice',
  coffee: 'trigger_advice',
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
  const episodes = foodEpisodes(ctx.digestion, ctx.bowel, now);
  const ready = episodes.length >= MIN_EPISODES;
  const shareOf = (g: FoodGroup) => (ctx.usual[g] ? USUAL_SHARE[ctx.usual[g]!] : null);
  const missingUsual = FOOD_GROUPS.map((g) => g.id).filter((g) => !ctx.usual[g] && episodes.some((e) => e.factors.has(g)));

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

  // ---- Patrones de comida: lo que sale antes de las molestias más de lo que lo tomas ----
  const patterns: GutPattern[] = [];
  if (ready) {
    // Primero los candidatos, del más fuerte al más débil
    const candidates = PAIRS.flatMap(({ factor, outcomes }) => {
      const p = shareOf(factor);
      if (p == null) return [];
      const cases = episodes.filter((e) => hasAny(e, outcomes));
      const a = cases.filter((e) => e.factors.has(factor)).length;
      const confidence = grade(a, cases.length, p);
      return confidence
        ? [{ factor, outcomes, cases, a, p, confidence, pv: binomialGreater(a, cases.length, p) }]
        : [];
    }).sort((x, y) => rank[y.confidence] - rank[x.confidence] || x.pv - y.pv);
    // Cuánto por encima de lo esperable sale g en esas mismas molestias
    const oddsIn = (g: FoodGroup, cases: FoodEpisode[]) => {
      const p = shareOf(g);
      return p == null ? null : oddsVsUsual(cases.filter((e) => e.factors.has(g)).length, cases.length, p);
    };
    // ¿Lo explica otro alimento que va con él y que tomas menos a menudo? (la tostada del café con
    // leche: comes pan casi siempre y las molestias solo llegan con la leche)
    const dominatedBy = (f: Factor, g: Factor, cases: FoodEpisode[]) => {
      const withF = cases.filter((e) => e.factors.has(f));
      const together = withF.filter((e) => e.factors.has(g)).length / Math.max(1, withF.length);
      const of = oddsIn(f, cases);
      const og = oddsIn(g, cases);
      return together >= 0.8 && of != null && og != null && og >= DOMINANCE * of;
    };
    const kept: Factor[] = [];
    for (const { factor, cases, a, p, confidence } of candidates) {
      // Sin las molestias de un patrón más fuerte, ¿queda algo? Si no, o si el otro lo domina, no se enseña
      const explained = kept.some((g) => {
        if (dominatedBy(factor, g, cases)) return true;
        const rest = cases.filter((e) => !e.factors.has(g));
        const restWith = rest.filter((e) => e.factors.has(factor)).length;
        if (rest.length < 3 || cases.filter((e) => e.factors.has(factor) && !e.factors.has(g)).length < 3) return false; // no se puede separar: lo dice el aviso
        return grade(restWith, rest.length, p) === null;
      });
      if (explained) continue;
      kept.push(factor);
      const pattern: GutPattern = {
        id: `food_${factor}`,
        kind: 'food',
        factor,
        confidence,
        title: t(FACTOR_TITLE[factor]),
        numbers: t('{food}: before {a} of your {n} logs. You have it {usual}; normal would be around {e} of {n}.', {
          food: groupLabel(factor),
          a,
          n: cases.length,
          usual: usualLabel(ctx.usual[factor]!).toLowerCase(),
          e: Math.max(0, Math.round(cases.length * p)),
        }),
      };
      // ¿Va casi siempre con otro grupo? (p. ej. gluten y lácteos en la lasaña)
      if (confidence !== 'hint') {
        const withF = cases.filter((e) => e.factors.has(factor));
        // Solo cuenta como confusión lo que podría dar esas mismas molestias (el café no hincha)
        const couldCause = (g: FoodGroup) => {
          const outs = PAIRS.find((x) => x.factor === g)?.outcomes;
          return !outs || withF.some((e) => hasAny(e, outs));
        };
        let worstShare = 0;
        for (const g of FOOD_GROUPS.map((x) => x.id).filter((x) => x !== factor && couldCause(x))) {
          const share = withF.filter((e) => e.factors.has(g)).length / withF.length;
          if (share < 0.6 || share <= worstShare) continue;
          // ¿El factor se sostiene solo? (molestias sin el otro)
          const rest = cases.filter((e) => !e.factors.has(g));
          const standsAlone = rest.length >= 3 && grade(rest.filter((e) => e.factors.has(factor)).length, rest.length, p) !== null;
          // ¿El otro queda descartado? (lo tomas a menudo y no sale más de lo normal, o este lo domina)
          const pg = shareOf(g);
          const otherCleared = pg != null && (grade(cases.filter((e) => e.factors.has(g)).length, cases.length, pg) === null || dominatedBy(g, factor, cases));
          if (!standsAlone && !otherCleared) {
            pattern.confoundedWith = g;
            worstShare = share;
          }
        }
        if (pattern.confoundedWith) {
          pattern.body = [
            t('Many of those meals also had {other}: we cannot tell yet which of the two it is.', { other: groupLabel(pattern.confoundedWith).toLowerCase() }),
            t('To tell them apart, try one without the other for a few days and log how you feel.'),
          ].join(' ');
        }
      }
      if (factor === 'lactose') {
        // Los lácteos casi sin lactosa como comparación: si los tomas a menudo y no salen, apunta a la lactosa
        const pLow = shareOf('dairy_low_lactose');
        const lowOnly = cases.filter((e) => e.factors.has('dairy_low_lactose') && !e.factors.has('lactose')).length;
        if (pLow != null && pLow >= USUAL_SHARE.weekly && grade(lowOnly, cases.length, pLow) === null) {
          pattern.body = [pattern.body, t('Aged cheese and lactose-free dairy sit better with you, which fits with lactose.')].filter(Boolean).join(' ');
        }
      }
      if (confidence === 'hint') pattern.body = [pattern.body, t('Not enough yet to be sure. Keep logging.')].filter(Boolean).join(' ');
      else pattern.suggestion = SUGGESTIONS[FACTOR_SUGGESTION[factor]]();
      patterns.push(pattern);
    }
  }

  // Parte de las molestias de un tipo que llegaron tras una cena tardía o una comida abundante
  const shareAfter = (outcome: Outcome, pick: (e: FoodEpisode) => boolean) => {
    const cases = episodes.filter((e) => e.outcomes[outcome]);
    return cases.length >= 3 ? cases.filter(pick).length / cases.length : 0;
  };

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

    // Hinchazón casi a diario, con comidas de todo tipo, sin un alimento que lo explique → SIBO
    const bloatWeek = perWeek(['bloating', 'gas'], 2);
    const bloatCases = episodes.filter((e) => hasAny(e, ['bloating', 'gas'])).length;
    if (ready && bloatWeek >= 3 && bloatCases >= MIN_EPISODES && !foodExplainsBloating) {
      patterns.push({
        id: 'freq_bloating',
        kind: 'frequency',
        confidence: freqConfidence,
        title: t('You bloat with almost any meal'),
        numbers: `${perWeekText(bloatWeek)} ${t('After all kinds of meals: no food stands out.')}`,
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
        body: [shareAfter('fullness', (e) => e.big) >= 0.5 ? t('It comes mostly after big meals: smaller ones may help.') : '', romeNote]
          .filter(Boolean)
          .join(' '),
        suggestion: SUGGESTIONS.hpylori(),
      });
    }

    // Reflujo (Montreal): leve ≥ 2 días/semana o moderado ≥ 1
    const refluxMild = perWeek(['reflux'], 1);
    const refluxStrong = perWeek(['reflux'], 2);
    if (refluxMild >= 2 || refluxStrong >= 1) {
      const triggers = patterns
        .filter((p) => p.kind === 'food' && p.factor && FACTOR_WITH[p.factor])
        .map((p) => t(FACTOR_WITH[p.factor!]!));
      if (shareAfter('reflux', (e) => e.late) >= 0.5) triggers.push(t('after 10 pm'));
      if (shareAfter('reflux', (e) => e.big) >= 0.5) triggers.push(t('that were big'));
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
    foodEpisodes: episodes.length,
    ready,
    missingUsual,
    weeksCovered,
    alarms,
    safety,
    showTests,
    patterns,
  };
}

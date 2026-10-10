import AsyncStorage from '@react-native-async-storage/async-storage';
import { getCurrentUserId, supabase } from '@/lib/supabase';
import { isPortalDemo } from './specialistPortal';
import { SAMPLE_TEMPLATES_ES } from './proTemplatesEs';
import { getLang, t } from '@/i18n';

// Biblioteca de plantillas del especialista: textos que ya escribió (o escribe una vez) para
// las dudas que se repiten — regla, analíticas, hormonas, energía, colesterol, glucosa — y que
// reutiliza al contestar. Sin IA: se sugieren por palabras clave, se insertan y se rellenan
// los huecos [entre corchetes] antes de enviar.
//
// Dónde viven:
// - Demo del portal: en este dispositivo, con plantillas de ejemplo.
// - Cuenta real: tabla `pro_templates` (solo las ve su autor). Si la migración aún no se ha
//   aplicado, se guardan en este dispositivo y la pantalla lo avisa.

export type TemplateTopic = 'cycle' | 'blood_test' | 'hormones' | 'energy' | 'cholesterol' | 'glucose' | 'other';

export const TEMPLATE_TOPICS: { id: TemplateTopic; label: string; icon: string }[] = [
  { id: 'cycle', label: t('Menstrual cycle'), icon: 'rose-outline' },
  { id: 'blood_test', label: t('Blood test results'), icon: 'flask-outline' },
  { id: 'hormones', label: t('Hormones & thyroid'), icon: 'pulse-outline' },
  { id: 'energy', label: t('Energy, iron & vitamins'), icon: 'battery-half-outline' },
  { id: 'cholesterol', label: t('Cholesterol & heart'), icon: 'heart-outline' },
  { id: 'glucose', label: t('Blood sugar'), icon: 'water-outline' },
  { id: 'other', label: t('Other'), icon: 'ellipsis-horizontal-circle-outline' },
];

export const topicLabel = (id: TemplateTopic) => TEMPLATE_TOPICS.find((x) => x.id === id)?.label ?? t('Other');
export const topicIcon = (id: TemplateTopic) => TEMPLATE_TOPICS.find((t) => t.id === id)?.icon ?? 'document-text-outline';

export interface ProTemplate {
  id: string;
  title: string;
  topic: TemplateTopic;
  keywords: string[]; // palabras extra para sugerirla (ferritina, TSH, regla…)
  body: string;
  uses: number;
  lastUsedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type TemplateDraft = Pick<ProTemplate, 'title' | 'topic' | 'keywords' | 'body'> & { id?: string };

// ---------------------------------------------------------------------------
// Huecos: [name] y [doctor] se rellenan solos; cualquier otro [texto] lo rellena el médico
// y no se puede enviar la respuesta mientras quede alguno.
// ---------------------------------------------------------------------------
const GAP = /\[[^\]\n]{1,80}\]/g;

export const findGaps = (text: string): string[] => [...new Set(text.match(GAP) ?? [])];

export function fillTemplate(body: string, ctx: { patientName?: string; doctorName?: string }): string {
  const first = ctx.patientName?.trim().split(/\s+/)[0];
  let out = body;
  if (first) out = out.replace(/\[(name|nombre)\]/gi, first);
  if (ctx.doctorName) out = out.replace(/\[(doctor|doctora|médico|medico)\]/gi, ctx.doctorName);
  return out;
}

// Al guardar una respuesta enviada como plantilla, el nombre del paciente vuelve a ser [name]
export function toTemplateBody(answer: string, patientName: string, doctorName?: string): string {
  const first = patientName.trim().split(/\s+/)[0];
  let out = answer;
  // Solo la palabra entera (vale con tildes: "Álvaro", "Inés")
  if (first && first.length > 1) out = out.replace(new RegExp(`(^|[^A-Za-zÀ-ÿ])${escapeRe(first)}(?![A-Za-zÀ-ÿ])`, 'g'), '$1[name]');
  if (doctorName) out = out.replace(new RegExp(escapeRe(doctorName), 'g'), '[doctor]');
  return out;
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// ---------------------------------------------------------------------------
// Sugerencias: palabras de la pregunta (en inglés o español, sin tildes) contra el tema,
// el título y las palabras clave de cada plantilla. Nada sale del dispositivo.
// ---------------------------------------------------------------------------
const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

// Vocabulario de cada tema (raíces, para que "cansada", "cansancio" o "periods" coincidan)
const TOPIC_WORDS: Record<Exclude<TemplateTopic, 'other'>, string[]> = {
  cycle: ['period', 'menstru', 'regla', 'ciclo', 'cycle', 'ovula', 'bleed', 'sangrad', 'cramp', 'dolor menstrual', 'pms', 'premenstru', 'pill', 'pildora', 'anticoncep', 'contracept', 'fertil', 'embaraz', 'pregnan', 'spotting', 'manchado', 'amenorr'],
  blood_test: ['result', 'analisis', 'analitica', 'blood test', 'test', 'value', 'valor', 'range', 'rango', 'report', 'informe', 'retest', 'repetir', 'marker', 'marcador', 'out of range', 'fuera de rango'],
  hormones: ['hormon', 'thyroid', 'tiroid', 'tsh', 't4', 't3', 'cortisol', 'testosteron', 'estradiol', 'estrogen', 'estrogen', 'progesteron', 'prolactin', 'fsh', 'lh', 'amh', 'menopaus', 'perimenopaus', 'pcos', 'sop', 'ovario poliquist', 'dhea', 'shbg'],
  energy: ['tired', 'fatigue', 'cansad', 'cansancio', 'agotad', 'exhaust', 'energ', 'iron', 'hierro', 'ferritin', 'ferritina', 'b12', 'folat', 'folico', 'vitamin d', 'vitamina d', 'anaem', 'anem', 'hemoglobin', 'hemoglobina', 'sleep', 'sueno', 'dormir', 'magnes'],
  cholesterol: ['cholesterol', 'colesterol', 'ldl', 'hdl', 'triglycerid', 'triglicerid', 'apob', 'lp(a)', 'lipoprote', 'heart', 'corazon', 'cardio', 'statin', 'estatina', 'blood pressure', 'tension', 'presion arterial', 'hipertens', 'hypertens'],
  glucose: ['glucose', 'glucosa', 'sugar', 'azucar', 'hba1c', 'a1c', 'hemoglobina glicada', 'glycated', 'insulin', 'insulina', 'homa', 'prediabet', 'diabet'],
};

const STOP = new Set(
  'the a an and or of to in on for with my is it i me you your be can should could would what when how do does this that have has was are from at about el la los las un una y o de del en con mi mis es que me te tu se lo le por para como cuando hay he ha muy mas pero si no ya'.split(' ')
);

const tokensOf = (t: string) => new Set(t.split(/[^a-z0-9()]+/).filter(Boolean));

// Siglas cortas (TSH, LDL, B12…) solo como palabra entera: "lh" no debe coincidir con "health"
const hits = (words: string[], t: string, tokens: Set<string>) =>
  words.filter((w) => (w.length <= 3 ? tokens.has(w) : t.includes(w))).length;

export function guessTopic(text: string): TemplateTopic {
  const t = norm(text);
  const tokens = tokensOf(t);
  let best: TemplateTopic = 'other';
  let bestScore = 0;
  for (const [topic, words] of Object.entries(TOPIC_WORDS) as [TemplateTopic, string[]][]) {
    const score = hits(words, t, tokens);
    if (score > bestScore) {
      best = topic;
      bestScore = score;
    }
  }
  return best;
}

export function suggestTemplates(text: string, templates: ProTemplate[], limit = 3, extraTopic?: TemplateTopic): ProTemplate[] {
  const t = norm(text);
  const all = tokensOf(t);
  const tokens = new Set([...all].filter((w) => w.length > 2 && !STOP.has(w)));
  const topicHits = (Object.entries(TOPIC_WORDS) as [TemplateTopic, string[]][]).reduce<Partial<Record<TemplateTopic, number>>>(
    (acc, [topic, words]) => ({ ...acc, [topic]: hits(words, t, all) }),
    {}
  );
  const scored = templates.map((tpl) => {
    let score = (topicHits[tpl.topic] ?? 0) * 2 + (extraTopic === tpl.topic ? 1 : 0);
    for (const k of tpl.keywords) if (k.trim() && hits([norm(k.trim())], t, all)) score += 4;
    for (const w of norm(tpl.title).split(/[^a-z0-9()]+/)) if (w.length > 2 && tokens.has(w)) score += 2;
    score += Math.min(tpl.uses, 10) * 0.05; // a igualdad, las que más usa
    return { tpl, score };
  });
  return scored
    .filter((s) => s.score >= 2)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.tpl);
}

// ---------------------------------------------------------------------------
// Plantillas de ejemplo (demo, y botón "Start with sample templates" en cuentas reales).
// Escritas con la voz de una médica; los huecos [ ] son lo que cambia de un paciente a otro.
// ---------------------------------------------------------------------------
// Ejemplos en el idioma de la app (español: proTemplatesEs.ts)
export const samplesForLang = (): TemplateDraft[] => (getLang() === 'es' ? SAMPLE_TEMPLATES_ES : SAMPLE_TEMPLATES);

export const SAMPLE_TEMPLATES: TemplateDraft[] = [
  {
    title: 'Low ferritin and tiredness',
    topic: 'energy',
    keywords: ['ferritin', 'ferritina', 'iron', 'hierro', 'tired', 'cansancio'],
    body: `Hi [name],

Thanks for your message. Your ferritin is [value] ng/mL, which means your iron stores are low. That fits with the tiredness you describe.

What I suggest:
• Iron-rich foods most days (red meat 2–3 times a week, lentils, chickpeas, spinach), together with vitamin C (orange, pepper, kiwi).
• No tea or coffee in the hour around meals: they reduce how much iron you absorb.
• [Anything specific for this patient]

Let's repeat the test in [8–12 weeks]. If you notice shortness of breath, palpitations or very heavy periods before then, tell me.

Best wishes,
[doctor]`,
  },
  {
    title: 'Vitamin D below range',
    topic: 'energy',
    keywords: ['vitamin d', 'vitamina d', '25-oh'],
    body: `Hi [name],

Your vitamin D is [value] ng/mL; we aim for over 30. It's very common, especially after winter or if you spend most of the day indoors.

Most vitamin D comes from the sun: 15–20 minutes outdoors around midday with arms uncovered, most days, helps a lot in spring and summer. Food alone rarely fixes it (oily fish, eggs).

[Supplement advice, if any]

We'll check it again in [3 months].

Best wishes,
[doctor]`,
  },
  {
    title: 'LDL cholesterol a bit high',
    topic: 'cholesterol',
    keywords: ['ldl', 'colesterol', 'cholesterol', 'triglycerides'],
    body: `Hi [name],

Your LDL cholesterol is [value] mg/dL, a bit above where we'd like it. [Context: family history, other values]

The changes with the biggest effect:
• More fibre: oats, legumes, fruit and vegetables every day.
• Olive oil, nuts and fish instead of butter, cured meats and pastries.
• At least 150 minutes a week of activity (brisk walking counts).

These usually show in your results within about 3 months. Let's repeat the analysis in [3 months] and decide then whether anything else is needed.

Best wishes,
[doctor]`,
  },
  {
    title: 'Irregular cycle',
    topic: 'cycle',
    keywords: ['irregular', 'regla', 'period', 'late period', 'retraso'],
    body: `Hi [name],

Cycles between 21 and 35 days are considered normal, and an occasional longer one is common (stress, travel, intense training, changes in weight). Yours have been around [length] days for [how long].

[If pregnancy is possible: please do a pregnancy test first.]

I'd like to look at [tests, e.g. TSH, prolactin and hormones on day 2–5 of your cycle]. Meanwhile, keep logging your periods in Kuova: with three more cycles we'll see the pattern much better.

Best wishes,
[doctor]`,
  },
  {
    title: 'TSH slightly high (thyroid)',
    topic: 'hormones',
    keywords: ['tsh', 'thyroid', 'tiroides', 't4'],
    body: `Hi [name],

Your TSH is [value] mU/L, slightly above the range, with a free T4 of [value]. A single slightly high TSH is common and often goes back to normal on its own; it can rise after an illness, with poor sleep or with some supplements (biotin interferes with the test).

Let's repeat TSH and free T4 in [6–8 weeks], in the morning, and stop any biotin 2–3 days before. If it is still high, we'll add thyroid antibodies (anti-TPO).

If you are planning a pregnancy, tell me: in that case we act sooner.

Best wishes,
[doctor]`,
  },
  {
    title: 'HbA1c in the prediabetes range',
    topic: 'glucose',
    keywords: ['hba1c', 'glucose', 'glucosa', 'prediabetes', 'sugar'],
    body: `Hi [name],

Your HbA1c is [value] %. Between 5.7 and 6.4 % is called the prediabetes range: it's a warning, not a diagnosis, and it's the best moment to act because it often goes back to normal.

What helps most:
• A 10-minute walk after your main meals.
• Fewer sugary drinks and refined flour; more fibre, vegetables and protein.
• Sleeping 7 hours or more.
• [If overweight: losing 5–7 % of your weight makes a big difference.]

Let's repeat it in [3–6 months].

Best wishes,
[doctor]`,
  },
  {
    title: 'All results in range',
    topic: 'blood_test',
    keywords: ['all normal', 'todo bien', 'in range', 'results'],
    body: `Hi [name],

Good news: all your values are within range. [Anything worth mentioning]

Keep doing what you're doing. I'd repeat the analysis in [12 months], or sooner if you notice any change.

Best wishes,
[doctor]`,
  },
];

// ---------------------------------------------------------------------------
// Almacenamiento
// ---------------------------------------------------------------------------
const DEMO_KEY = 'proTemplates.demo.v1';
const deviceKey = () => `proTemplates.v1:${getCurrentUserId() ?? 'anon'}`;

export type TemplateStore = 'demo' | 'cloud' | 'device';
let cloudMissing = false; // la tabla aún no existe en Supabase → este dispositivo

const isMissingTable = (e: { code?: string; message?: string } | null) =>
  !!e && (e.code === 'PGRST205' || e.code === '42P01' || /pro_templates/.test(e.message ?? ''));

const newId = () => `t-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

const fromDraft = (d: TemplateDraft, now = new Date().toISOString()): ProTemplate => ({
  id: d.id ?? newId(),
  title: d.title.trim(),
  topic: d.topic,
  keywords: d.keywords.map((k) => k.trim()).filter(Boolean),
  body: d.body,
  uses: 0,
  lastUsedAt: null,
  createdAt: now,
  updatedAt: now,
});

async function readLocal(key: string, seed: boolean): Promise<ProTemplate[]> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (raw) return JSON.parse(raw);
  } catch {
    // sin almacenamiento: lista vacía (o ejemplos en demo)
  }
  return seed ? samplesForLang().map((d) => fromDraft(d)) : [];
}
async function writeLocal(key: string, list: ProTemplate[]) {
  await AsyncStorage.setItem(key, JSON.stringify(list)).catch(() => undefined);
}

const toTemplate = (r: any): ProTemplate => ({
  id: r.id,
  title: r.title,
  topic: r.topic,
  keywords: r.keywords ?? [],
  body: r.body,
  uses: r.uses ?? 0,
  lastUsedAt: r.last_used_at,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const byRecent = (a: ProTemplate, b: ProTemplate) => (b.lastUsedAt ?? b.updatedAt).localeCompare(a.lastUsedAt ?? a.updatedAt);

// La demo guarda una biblioteca por idioma: al cambiar a español salen los ejemplos en español
const localStore = (): { key: string; seed: boolean } | null =>
  isPortalDemo() ? { key: getLang() === 'en' ? DEMO_KEY : `${DEMO_KEY}:${getLang()}`, seed: true } : cloudMissing || !supabase ? { key: deviceKey(), seed: false } : null;

export const templates = {
  where(): TemplateStore {
    return isPortalDemo() ? 'demo' : cloudMissing || !supabase ? 'device' : 'cloud';
  },

  async list(): Promise<ProTemplate[]> {
    const local = localStore();
    if (local) return (await readLocal(local.key, local.seed)).sort(byRecent);
    const { data, error } = await supabase!.from('pro_templates').select('*').order('updated_at', { ascending: false });
    if (isMissingTable(error)) {
      cloudMissing = true;
      return templates.list();
    }
    if (error) throw new Error(error.message);
    return (data ?? []).map(toTemplate).sort(byRecent);
  },

  async save(d: TemplateDraft): Promise<ProTemplate> {
    const local = localStore();
    if (local) {
      const list = await readLocal(local.key, local.seed);
      const existing = d.id ? list.find((t) => t.id === d.id) : undefined;
      const saved: ProTemplate = existing
        ? { ...existing, title: d.title.trim(), topic: d.topic, keywords: d.keywords.map((k) => k.trim()).filter(Boolean), body: d.body, updatedAt: new Date().toISOString() }
        : fromDraft(d);
      await writeLocal(local.key, [saved, ...list.filter((t) => t.id !== saved.id)]);
      return saved;
    }
    const row = { title: d.title.trim(), topic: d.topic, keywords: d.keywords.map((k) => k.trim()).filter(Boolean), body: d.body };
    const q = d.id
      ? supabase!.from('pro_templates').update(row).eq('id', d.id).select('*').single()
      : supabase!.from('pro_templates').insert(row).select('*').single();
    const { data, error } = await q;
    if (isMissingTable(error)) {
      cloudMissing = true;
      return templates.save(d);
    }
    if (error) throw new Error(error.message);
    return toTemplate(data);
  },

  async remove(id: string) {
    const local = localStore();
    if (local) return writeLocal(local.key, (await readLocal(local.key, local.seed)).filter((t) => t.id !== id));
    const { error } = await supabase!.from('pro_templates').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },

  // Al insertarla en una respuesta: sube en la lista y pesa un poco más en las sugerencias
  async markUsed(t: ProTemplate) {
    const now = new Date().toISOString();
    const local = localStore();
    if (local) {
      const list = await readLocal(local.key, local.seed);
      return writeLocal(local.key, list.map((x) => (x.id === t.id ? { ...x, uses: x.uses + 1, lastUsedAt: now } : x)));
    }
    await supabase!.from('pro_templates').update({ uses: t.uses + 1, last_used_at: now }).eq('id', t.id);
  },

  // Cuenta real con la biblioteca vacía: empezar con los ejemplos y adaptarlos
  async addSamples() {
    for (const d of samplesForLang()) await templates.save(d);
  },
};

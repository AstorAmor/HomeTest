// Registro de síntomas (fundador, 2026-11-17): «Cuando pinchas la K quiero añadir al principio una opción que sea
// "Síntoma"… no será diagnóstico, sino que te servirá para tener registro de cómo te sientes». Se marcan varios y,
// de cada uno, la intensidad, cuándo empezó y, en los que toca (dolores, hormigueo, sarpullido), dónde; además, una
// nota libre para todo el apunte. Es un diario con fecha: puede solapar con Digestión, el ciclo o las etiquetas del
// check-in, pero tiene otra función.
// También: «un mapeo de cuándo tienes estas cosas con el ciclo o con dormir bien, mal» y un resumen de la semana
// sin IA. Aquí van las reglas (cuentas sencillas sobre sus propios registros): nunca dicen la causa de nada, solo
// con qué coincide lo apuntado.
// Lógica pura (sin React Native), con tests en src/logic/__tests__/symptoms.test.ts.
//
// Dónde se guarda (src/data/symptomRepository.ts): sin migración, en metric_readings con kind 'symptom', una fila
// por síntoma marcado: id 'sym:<apunte>:<síntoma>', value = intensidad (1 a 3), measured_at = cuándo empezó y, en
// `unit` (texto libre, la única columna de texto de esa tabla), un JSON corto con el resto (dónde, el nombre de
// «Otro» y la nota).
import type { CyclePhaseId } from '@/utils/cyclePhase';

export type SymptomId =
  | 'fatigue'
  | 'fever'
  | 'dizziness'
  | 'faint'
  | 'headache'
  | 'blurred_vision'
  | 'chest_pain'
  | 'palpitations'
  | 'breathless'
  | 'cough'
  | 'sore_throat'
  | 'congestion'
  | 'nausea'
  | 'abdominal_pain'
  | 'back_pain'
  | 'joint_muscle_pain'
  | 'tingling'
  | 'rash'
  | 'anxiety'
  | 'low_mood'
  | 'insomnia'
  | 'other';

export type SymptomGroupId = 'general' | 'head' | 'chest' | 'belly' | 'body' | 'mind';

// Zonas del cuerpo que se ofrecen en «¿Dónde?» (las etiquetas, en inglés: se pasan por t())
export const AREAS = {
  forehead: 'Forehead',
  temples: 'Temples',
  behind_eyes: 'Behind the eyes',
  nape: 'Back of the head',
  one_side: 'One side',
  whole_head: 'The whole head',
  chest_center: 'Centre of the chest',
  left_side: 'Left side',
  right_side: 'Right side',
  upper_back: 'Upper back',
  mid_back: 'Mid back',
  lower_back: 'Lower back',
  upper_abdomen: 'Upper abdomen',
  navel: 'Around the navel',
  lower_abdomen: 'Lower abdomen',
  whole_abdomen: 'The whole abdomen',
  neck: 'Neck',
  shoulder: 'Shoulder',
  arm: 'Arm',
  wrist_hand: 'Wrist or hand',
  hip: 'Hip',
  leg: 'Leg',
  knee: 'Knee',
  ankle_foot: 'Ankle or foot',
  face: 'Face',
  hand: 'Hand',
  foot: 'Foot',
  torso: 'Torso',
  arms: 'Arms',
  hands: 'Hands',
  legs: 'Legs',
  feet: 'Feet',
} as const;
export type AreaId = keyof typeof AREAS;

export interface SymptomDef {
  id: SymptomId;
  label: string; // en inglés, se pasa por t()
  group: SymptomGroupId;
  // Con zonas: se pregunta «¿Dónde?» (chips y texto libre)
  areas?: AreaId[];
  // Puede necesitar atención urgente: al marcarlo sale una línea neutra con el 112 (sin alarma ni diagnóstico)
  urgent?: boolean;
}

export const SYMPTOM_GROUPS: { id: SymptomGroupId; label: string }[] = [
  { id: 'general', label: 'General' },
  { id: 'head', label: 'Head' },
  { id: 'chest', label: 'Chest and breathing' },
  { id: 'belly', label: 'Stomach and gut' },
  { id: 'body', label: 'Muscles, joints and skin' },
  { id: 'mind', label: 'Mood and rest' },
];

// La lista, corta: lo que más se apunta en un diario de síntomas. «Otro» va aparte, con su nombre libre.
// SUPUESTO (revisión clínica): qué síntomas llevan la línea del 112 (dolor en el pecho, falta de aire y desmayo).
export const SYMPTOMS: SymptomDef[] = [
  { id: 'fatigue', label: 'Fatigue', group: 'general' },
  { id: 'fever', label: 'Fever or chills', group: 'general' },
  { id: 'dizziness', label: 'Dizziness', group: 'general' },
  { id: 'faint', label: 'Fainting or feeling faint', group: 'general', urgent: true },
  { id: 'headache', label: 'Headache', group: 'head', areas: ['forehead', 'temples', 'behind_eyes', 'nape', 'one_side', 'whole_head'] },
  { id: 'blurred_vision', label: 'Blurred vision', group: 'head' },
  { id: 'chest_pain', label: 'Chest pain', group: 'chest', urgent: true, areas: ['chest_center', 'left_side', 'right_side', 'upper_back'] },
  { id: 'palpitations', label: 'Palpitations', group: 'chest' },
  { id: 'breathless', label: 'Shortness of breath', group: 'chest', urgent: true },
  { id: 'cough', label: 'Cough', group: 'chest' },
  { id: 'sore_throat', label: 'Sore throat', group: 'chest' },
  { id: 'congestion', label: 'Blocked or runny nose', group: 'chest' },
  { id: 'nausea', label: 'Nausea', group: 'belly' },
  { id: 'abdominal_pain', label: 'Abdominal pain', group: 'belly', areas: ['upper_abdomen', 'navel', 'lower_abdomen', 'right_side', 'left_side', 'whole_abdomen'] },
  { id: 'back_pain', label: 'Back pain', group: 'body', areas: ['neck', 'upper_back', 'mid_back', 'lower_back'] },
  {
    id: 'joint_muscle_pain',
    label: 'Joint or muscle pain',
    group: 'body',
    areas: ['neck', 'shoulder', 'arm', 'wrist_hand', 'hip', 'leg', 'knee', 'ankle_foot', 'left_side', 'right_side'],
  },
  { id: 'tingling', label: 'Tingling or numbness', group: 'body', areas: ['face', 'arm', 'hand', 'leg', 'foot', 'left_side', 'right_side'] },
  { id: 'rash', label: 'Itching or rash', group: 'body', areas: ['face', 'neck', 'torso', 'arms', 'hands', 'legs', 'feet'] },
  { id: 'anxiety', label: 'Anxiety or nerves', group: 'mind' },
  { id: 'low_mood', label: 'Low mood', group: 'mind' },
  { id: 'insomnia', label: 'Difficulty sleeping', group: 'mind' },
];

// «Otro»: con su nombre libre y, si hace falta, dónde (solo texto)
export const OTHER_SYMPTOM: SymptomDef = { id: 'other', label: 'Other', group: 'general' };

const BY_ID = new Map<string, SymptomDef>([...SYMPTOMS, OTHER_SYMPTOM].map((s) => [s.id, s]));
export const symptomDef = (id: string): SymptomDef | undefined => BY_ID.get(id);
export const isUrgentSymptom = (id: string) => !!BY_ID.get(id)?.urgent;
// «¿Dónde?» se pregunta en los que tienen zonas y en «Otro» (ahí, solo texto libre)
export const asksWhere = (id: string) => id === 'other' || !!BY_ID.get(id)?.areas?.length;

// Intensidad: tres pasos con palabras tranquilas, como en Digestión. `phrase`: la línea del historial
export type Intensity = 1 | 2 | 3;
export const INTENSITIES: { id: Intensity; label: string; phrase: string }[] = [
  { id: 1, label: 'Mild', phrase: 'Mild intensity' },
  { id: 2, label: 'Moderate', phrase: 'Moderate intensity' },
  { id: 3, label: 'Strong', phrase: 'Strong intensity' },
];
export const intensityPhrase = (v: number) => INTENSITIES.find((x) => x.id === v)?.phrase ?? INTENSITIES[0].phrase;

// Lo que se puede escribir como mucho en cada casilla
export const NAME_MAX = 60;
export const WHERE_TEXT_MAX = 80;
export const NOTE_MAX = 500;

export interface SymptomEntry {
  id: string; // 'sym:<apunte>:<síntoma>'
  symptom: SymptomId;
  intensity: Intensity;
  fecha: string; // cuándo empezó (ISO)
  createdAt: string;
  where?: AreaId[];
  whereText?: string; // dónde, con sus palabras
  name?: string; // el nombre libre de «Otro»
  note?: string; // la nota del apunte entero (va en cada fila del apunte)
}

// ---------------------------------------------------------------------------
// Cómo se guarda en metric_readings
// ---------------------------------------------------------------------------
export const SYMPTOM_KIND = 'symptom';

export const symptomEntryId = (session: string, symptom: SymptomId) => `sym:${session}:${symptom}`;

// 'sym:<apunte>:<síntoma>' → sus partes (el síntoma va detrás de los últimos dos puntos)
export function parseSymptomEntryId(id: string): { session: string; symptom: SymptomId } | null {
  if (!id.startsWith('sym:')) return null;
  const rest = id.slice(4);
  const cut = rest.lastIndexOf(':');
  if (cut <= 0) return null;
  const symptom = rest.slice(cut + 1);
  if (!BY_ID.has(symptom)) return null;
  return { session: rest.slice(0, cut), symptom: symptom as SymptomId };
}

const clean = (s: unknown, max: number) => (typeof s === 'string' ? s.trim().slice(0, max) : '');

// Lo que no cabe en las columnas de la tabla, en un JSON corto para `unit`: w = zonas, wt = dónde (texto),
// o = nombre de «Otro», n = nota
export function packSymptomExtras(e: Pick<SymptomEntry, 'where' | 'whereText' | 'name' | 'note'>): string {
  const out: Record<string, unknown> = {};
  if (e.where?.length) out.w = e.where;
  if (e.whereText) out.wt = e.whereText;
  if (e.name) out.o = e.name;
  if (e.note) out.n = e.note;
  return JSON.stringify(out);
}

export function unpackSymptomExtras(unit: unknown): Pick<SymptomEntry, 'where' | 'whereText' | 'name' | 'note'> {
  let raw: Record<string, unknown> = {};
  try {
    const parsed: unknown = typeof unit === 'string' ? JSON.parse(unit) : null;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) raw = parsed as Record<string, unknown>;
  } catch {
    // no es JSON: una fila sin extras
  }
  const where = Array.isArray(raw.w) ? raw.w.filter((x): x is AreaId => typeof x === 'string' && x in AREAS) : [];
  const out: Pick<SymptomEntry, 'where' | 'whereText' | 'name' | 'note'> = {};
  if (where.length) out.where = where;
  const whereText = clean(raw.wt, WHERE_TEXT_MAX);
  if (whereText) out.whereText = whereText;
  const name = clean(raw.o, NAME_MAX);
  if (name) out.name = name;
  const note = clean(raw.n, NOTE_MAX);
  if (note) out.note = note;
  return out;
}

const toIntensity = (v: unknown): Intensity => Math.min(3, Math.max(1, Math.round(Number(v) || 1))) as Intensity;

export interface SymptomRow {
  id: string;
  value: number;
  unit: string;
  measured_at: string;
  created_at: string;
}

export const symptomToRow = (e: SymptomEntry): SymptomRow => ({
  id: e.id,
  value: e.intensity,
  unit: packSymptomExtras(e),
  measured_at: e.fecha,
  created_at: e.createdAt,
});

// Una fila de la tabla → el apunte. Una fila que no es de un síntoma conocido (p. ej. de una versión posterior de
// la app) sale como null y no se enseña.
export function symptomFromRow(r: { id: string; value: unknown; unit: unknown; measured_at: string; created_at: string }): SymptomEntry | null {
  const parts = parseSymptomEntryId(String(r.id));
  if (!parts) return null;
  return { id: String(r.id), symptom: parts.symptom, intensity: toIntensity(r.value), fecha: r.measured_at, createdAt: r.created_at, ...unpackSymptomExtras(r.unit) };
}

// Lo guardado (en la cuenta o en el móvil), limpio: solo síntomas conocidos, del más reciente al más antiguo
export function cleanSymptomEntries(list: unknown): SymptomEntry[] {
  if (!Array.isArray(list)) return [];
  const out: SymptomEntry[] = [];
  for (const x of list as Partial<SymptomEntry>[]) {
    if (!x || typeof x.id !== 'string' || typeof x.fecha !== 'string') continue;
    const parts = parseSymptomEntryId(x.id);
    if (!parts || Number.isNaN(new Date(x.fecha).getTime())) continue;
    out.push({ ...x, id: x.id, symptom: parts.symptom, intensity: toIntensity(x.intensity), fecha: x.fecha, createdAt: x.createdAt ?? x.fecha });
  }
  return out.sort((a, b) => b.fecha.localeCompare(a.fecha) || a.id.localeCompare(b.id));
}

// ---------------------------------------------------------------------------
// El formulario
// ---------------------------------------------------------------------------
export interface SymptomDraft {
  symptom: SymptomId;
  intensity?: Intensity;
  startedAt: string; // ISO
  where: AreaId[];
  whereText: string;
  name?: string; // solo «Otro»
}

// Lo que falta para poder guardar (el primero es el que se enseña)
export type DraftProblem = 'empty' | 'name' | 'intensity' | 'future';

// Lo que se dice debajo de «Guardar» cuando falta algo (en inglés, se pasa por t())
export const PROBLEM_TEXT = {
  name: 'Write what you notice in «Other».',
  intensity: 'Choose the intensity of each symptom you ticked.',
} as const;

// Unos minutos de margen: el reloj del móvil y el del selector no van al segundo
const FUTURE_SLACK_MS = 5 * 60 * 1000;

// Un síntoma no puede empezar después de ahora: lo elegido en el selector, como mucho, este momento
export const clampStart = (picked: Date, now: Date): Date => (picked.getTime() > now.getTime() ? new Date(now) : picked);

// Sin `now` no se mira la hora (la pantalla ya la limita al elegirla con clampStart; al guardar sí se comprueba)
export function draftProblems(drafts: SymptomDraft[], now?: Date): DraftProblem[] {
  if (!drafts.length) return ['empty'];
  const out: DraftProblem[] = [];
  if (drafts.some((d) => d.symptom === 'other' && !d.name?.trim())) out.push('name');
  if (drafts.some((d) => !d.intensity)) out.push('intensity');
  if (now && drafts.some((d) => !(new Date(d.startedAt).getTime() <= now.getTime() + FUTURE_SLACK_MS))) out.push('future');
  return out;
}

// Los apuntes de una vez (uno por síntoma marcado), con la nota en cada uno. Solo con el formulario completo
export function buildSymptomEntries(drafts: SymptomDraft[], note: string, now: Date): SymptomEntry[] {
  if (draftProblems(drafts, now).length) return [];
  const session = String(now.getTime());
  const createdAt = now.toISOString();
  const n = clean(note, NOTE_MAX);
  return drafts.map((d) => {
    const def = BY_ID.get(d.symptom)!;
    const where = [...new Set(d.where)].filter((a) => def.areas?.includes(a));
    const whereText = asksWhere(d.symptom) ? clean(d.whereText, WHERE_TEXT_MAX) : '';
    const name = d.symptom === 'other' ? clean(d.name, NAME_MAX) : '';
    const e: SymptomEntry = { id: symptomEntryId(session, d.symptom), symptom: d.symptom, intensity: d.intensity!, fecha: new Date(d.startedAt).toISOString(), createdAt };
    if (where.length) e.where = where;
    if (whereText) e.whereText = whereText;
    if (name) e.name = name;
    if (n) e.note = n;
    return e;
  });
}

// ---------------------------------------------------------------------------
// El historial
// ---------------------------------------------------------------------------
const pad2 = (n: number) => String(n).padStart(2, '0');
// Día local AAAA-MM-DD
export const symptomDayKey = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const dayOf = (e: { fecha: string }) => symptomDayKey(new Date(e.fecha));
const shiftDay = (key: string, days: number) => {
  const d = new Date(`${key}T12:00:00`);
  d.setDate(d.getDate() + days);
  return symptomDayKey(d);
};

// La noche que cuenta para un síntoma: la que acaba el día en que empezó. De madrugada (antes de las 4:00, como
// en el check-in) esa noche aún no ha pasado: cuenta la del día anterior.
const NIGHT_CUTOFF_HOUR = 4;
const nightDayOf = (e: { fecha: string }) => {
  const d = new Date(e.fecha);
  const key = symptomDayKey(d);
  return d.getHours() < NIGHT_CUTOFF_HOUR ? shiftDay(key, -1) : key;
};

// Con qué se agrupa un síntoma: el suyo; en «Otro», su nombre (sin mayúsculas)
export const symptomKey = (e: Pick<SymptomEntry, 'symptom' | 'name'>) => (e.symptom === 'other' ? `other:${(e.name ?? '').trim().toLowerCase()}` : e.symptom);

// El nombre que se enseña: el del catálogo (en inglés, hay que pasarlo por t()) o el que escribió en «Otro»
export function symptomName(e: Pick<SymptomEntry, 'symptom' | 'name'>): { text: string; translate: boolean } {
  if (e.symptom === 'other' && e.name?.trim()) return { text: e.name.trim(), translate: false };
  return { text: BY_ID.get(e.symptom)?.label ?? OTHER_SYMPTOM.label, translate: true };
}

export const sessionOf = (e: Pick<SymptomEntry, 'id'>) => parseSymptomEntryId(e.id)?.session ?? e.id;

export interface SymptomDay {
  day: string; // AAAA-MM-DD
  items: { entry: SymptomEntry; showNote: boolean }[];
}

// Por días, del más reciente al más antiguo, y dentro de cada día por hora (la más reciente arriba). La nota de
// un apunte con varios síntomas sale una sola vez: en el primero que se ve.
export function symptomsByDay(entries: SymptomEntry[]): SymptomDay[] {
  const sorted = [...entries].sort((a, b) => b.fecha.localeCompare(a.fecha) || a.id.localeCompare(b.id));
  const noted = new Set<string>();
  const days: SymptomDay[] = [];
  for (const entry of sorted) {
    const day = dayOf(entry);
    let group = days[days.length - 1];
    if (!group || group.day !== day) {
      group = { day, items: [] };
      days.push(group);
    }
    const session = sessionOf(entry);
    const showNote = !!entry.note && !noted.has(session);
    if (showNote) noted.add(session);
    group.items.push({ entry, showNote });
  }
  return days;
}

// ---------------------------------------------------------------------------
// Patrones: con qué coincide cada síntoma en sus registros (sueño y ciclo)
// ---------------------------------------------------------------------------
// Lo que se sabe de cada día (AAAA-MM-DD). Lo junta src/data/symptomRepository.ts
export interface SymptomContext {
  sleepMinutes: Record<string, number>; // minutos dormidos la noche que acaba ese día (reloj o pulsera)
  sleepRating: Record<string, number>; // «¿Cómo has dormido?» del check-in de la mañana, de 1 a 5
  phases: Record<string, CyclePhaseId>; // fase estimada del ciclo ese día (con las reglas apuntadas)
}
export const EMPTY_CONTEXT: SymptomContext = { sleepMinutes: {}, sleepRating: {}, phases: {} };

// Umbrales (SUPUESTO, a revisar con datos reales): un patrón solo sale con datos suficientes y cuando la
// coincidencia es claramente mayor de lo que tocaría por reparto (si casi todas tus noches son cortas, que el
// síntoma caiga tras una noche corta no dice nada).
export const PATTERN = {
  windowDays: 90, // se mira lo apuntado en los últimos 90 días
  minDays: 4, // el síntoma, apuntado al menos 4 días distintos (con dato de sueño o de ciclo esos días)
  minHits: 3, // y al menos 3 de ellos coinciden
  minShare: 0.5, // que son al menos la mitad
  minLift: 0.2, // y 20 puntos más de lo habitual en ese periodo
  minBaseDays: 14, // con al menos 14 días con ese dato para saber qué es lo habitual
  shortNightMinutes: 360, // noche corta: menos de 6 h (como en «Tus últimos días»)
  badSleepRating: 2, // dormir mal: 1 o 2 de 5 en el check-in de la mañana
} as const;

export type PatternKind = 'short_night' | 'bad_sleep' | 'cycle_phase';

export interface SymptomPattern {
  key: string; // symptomKey
  symptom: SymptomId;
  name?: string; // el de «Otro»
  kind: PatternKind;
  hits: number; // días con el síntoma que coinciden
  total: number; // días con el síntoma y con ese dato
  baseHits: number; // en el periodo, días así
  baseTotal: number; // en el periodo, días con ese dato
  phase?: CyclePhaseId; // en cycle_phase
}

interface Tally {
  hits: number;
  total: number;
  baseHits: number;
  baseTotal: number;
}

const tally = (days: string[], data: Record<string, unknown>, from: string, to: string, is: (day: string) => boolean): Tally => {
  const base = Object.keys(data).filter((k) => k >= from && k <= to);
  const withData = days.filter((d) => d in data);
  return { hits: withData.filter(is).length, total: withData.length, baseHits: base.filter(is).length, baseTotal: base.length };
};

const share = (x: Tally) => (x.total ? x.hits / x.total : 0);
const lift = (x: Tally) => share(x) - (x.baseTotal ? x.baseHits / x.baseTotal : 0);
const holds = (x: Tally) =>
  x.total >= PATTERN.minDays && x.hits >= PATTERN.minHits && x.baseTotal >= PATTERN.minBaseDays && share(x) >= PATTERN.minShare && lift(x) >= PATTERN.minLift;

const PHASES: CyclePhaseId[] = ['menstrual', 'follicular', 'ovulation', 'luteal'];

// Los textos de las observaciones (en inglés, se pasan por t() con sus cifras), debajo del nombre del síntoma.
// Siempre como una cuenta de lo que apuntó: «coincide con», nunca «se debe a». {k} de {n}: días con el síntoma (y
// con ese dato) que coinciden; {b} de {m}: lo habitual en el periodo, para poder compararlo.
export const PATTERN_TEXT = {
  short_night: '{k} of {n} days, after a night under 6 h.',
  short_night_base: 'Over that time, {b} of your {m} nights were under 6 h.',
  bad_sleep: '{k} of {n} days, after a night you said you slept badly.',
  bad_sleep_base: 'Over that time, you said so on {b} of {m} mornings.',
  cycle_phase: '{k} of {n} days, {phase}.',
  cycle_phase_base: 'Those days are about {p} % of your cycle.',
} as const;

// {phase} de las frases de arriba y de las del resumen
export const PHASE_PHRASE: Record<CyclePhaseId, string> = {
  menstrual: 'on your period days',
  follicular: 'in the days after your period',
  ovulation: 'around ovulation',
  luteal: 'in the second half of your cycle',
};

export const WEEK_TEXT = {
  short_night: 'This week, {k} of your {n} days with symptoms came after a night under 6 h.',
  bad_sleep: 'This week, on {k} of your {n} days with symptoms you had said you slept badly.',
  phase: 'This week, {k} of your {n} days with symptoms fell {phase}.',
} as const;

// Por cada síntoma apuntado varias veces: como mucho una observación de sueño (las horas del reloj antes que lo
// dicho en el check-in) y una del ciclo. Ordenadas por lo que más se aparta de lo habitual.
export function symptomPatterns(entries: SymptomEntry[], ctx: SymptomContext, now: Date): SymptomPattern[] {
  const to = symptomDayKey(now);
  const from = shiftDay(to, -(PATTERN.windowDays - 1));
  const groups = new Map<string, { entry: SymptomEntry; days: Set<string>; nights: Set<string> }>();
  for (const e of entries) {
    const day = dayOf(e);
    if (day < from || day > to) continue;
    const key = symptomKey(e);
    if (key === 'other:') continue; // «Otro» sin nombre no se puede agrupar
    const g = groups.get(key) ?? { entry: e, days: new Set<string>(), nights: new Set<string>() };
    g.days.add(day);
    g.nights.add(nightDayOf(e));
    groups.set(key, g);
  }

  const out: (SymptomPattern & { lift: number })[] = [];
  for (const [key, g] of groups) {
    const base = { key, symptom: g.entry.symptom, ...(g.entry.symptom === 'other' ? { name: g.entry.name?.trim() } : {}) };
    const nights = [...g.nights];
    const short = tally(nights, ctx.sleepMinutes, from, to, (d) => ctx.sleepMinutes[d] < PATTERN.shortNightMinutes);
    const bad = tally(nights, ctx.sleepRating, from, to, (d) => ctx.sleepRating[d] <= PATTERN.badSleepRating);
    if (holds(short)) out.push({ ...base, kind: 'short_night', ...short, lift: lift(short) });
    else if (holds(bad)) out.push({ ...base, kind: 'bad_sleep', ...bad, lift: lift(bad) });

    const days = [...g.days];
    const best = PHASES.map((phase) => ({ phase, x: tally(days, ctx.phases, from, to, (d) => ctx.phases[d] === phase) }))
      .filter((p) => holds(p.x))
      .sort((a, b) => lift(b.x) - lift(a.x))[0];
    if (best) out.push({ ...base, kind: 'cycle_phase', phase: best.phase, ...best.x, lift: lift(best.x) });
  }
  return out.sort((a, b) => b.lift - a.lift || b.hits - a.hits || a.key.localeCompare(b.key)).map(({ lift: _lift, ...p }) => p);
}

// ---------------------------------------------------------------------------
// Resumen de la semana (los últimos 7 días, hoy incluido)
// ---------------------------------------------------------------------------
export const WEEK = {
  topMax: 3, // los síntomas más frecuentes que se nombran
  minDays: 2, // una observación de la semana, con al menos 2 días con síntomas y ese dato
  minHits: 2, // de los que coinciden al menos 2
  minShare: 0.5, // que son al menos la mitad
} as const;

export interface WeekSummary {
  from: string;
  to: string;
  days: number; // días con algún síntoma, de 7
  prevDays: number | null; // en los 7 días anteriores; null si antes de esta semana no hay nada apuntado
  top: { key: string; symptom: SymptomId; name?: string; days: number }[];
  // De los días con síntomas, cuántos llegaron tras una noche corta (o tras decir que durmió mal)
  sleep: { kind: 'short_night' | 'bad_sleep'; hits: number; total: number } | null;
  // De los días con síntomas, en qué fase del ciclo cayeron más
  phase: { phase: CyclePhaseId; hits: number; total: number } | null;
}

export function weekSummary(entries: SymptomEntry[], ctx: SymptomContext, now: Date): WeekSummary {
  const to = symptomDayKey(now);
  const from = shiftDay(to, -6);
  const prevFrom = shiftDay(from, -7);
  const inWeek = entries.filter((e) => dayOf(e) >= from && dayOf(e) <= to);
  const days = [...new Set(inWeek.map(dayOf))];
  const before = entries.filter((e) => dayOf(e) < from);
  const prevDays = before.length ? new Set(before.filter((e) => dayOf(e) >= prevFrom).map(dayOf)).size : null;

  const order = (id: SymptomId) => [...SYMPTOMS, OTHER_SYMPTOM].findIndex((s) => s.id === id);
  const groups = new Map<string, { entry: SymptomEntry; days: Set<string>; count: number }>();
  for (const e of inWeek) {
    const key = symptomKey(e);
    const g = groups.get(key) ?? { entry: e, days: new Set<string>(), count: 0 };
    g.days.add(dayOf(e));
    g.count += 1;
    groups.set(key, g);
  }
  const top = [...groups.entries()]
    .sort(([ka, a], [kb, b]) => b.days.size - a.days.size || b.count - a.count || order(a.entry.symptom) - order(b.entry.symptom) || ka.localeCompare(kb))
    .slice(0, WEEK.topMax)
    .map(([key, g]) => ({ key, symptom: g.entry.symptom, ...(g.entry.symptom === 'other' && g.entry.name?.trim() ? { name: g.entry.name.trim() } : {}), days: g.days.size }));

  const enough = (hits: number, total: number) => total >= WEEK.minDays && hits >= WEEK.minHits && hits / total >= WEEK.minShare;
  const nights = [...new Set(inWeek.map(nightDayOf))];
  const withMinutes = nights.filter((d) => d in ctx.sleepMinutes);
  const shortNights = withMinutes.filter((d) => ctx.sleepMinutes[d] < PATTERN.shortNightMinutes).length;
  const withRating = nights.filter((d) => d in ctx.sleepRating);
  const badNights = withRating.filter((d) => ctx.sleepRating[d] <= PATTERN.badSleepRating).length;
  const sleep: WeekSummary['sleep'] = enough(shortNights, withMinutes.length)
    ? { kind: 'short_night', hits: shortNights, total: withMinutes.length }
    : enough(badNights, withRating.length)
      ? { kind: 'bad_sleep', hits: badNights, total: withRating.length }
      : null;

  const withPhase = days.filter((d) => d in ctx.phases);
  const best = PHASES.map((phase) => ({ phase, hits: withPhase.filter((d) => ctx.phases[d] === phase).length })).sort((a, b) => b.hits - a.hits)[0];
  const phase = best && enough(best.hits, withPhase.length) ? { phase: best.phase, hits: best.hits, total: withPhase.length } : null;

  return { from, to, days: days.length, prevDays, top, sleep, phase };
}

// ---------------------------------------------------------------------------
// Ejemplo para la demo y las cuentas de prueba (nunca se guarda)
// ---------------------------------------------------------------------------
// Unos dos meses de apuntes con su sueño de ejemplo, pensados para que se vea cómo quedan el historial, el
// resumen y los patrones: el dolor de cabeza cae casi siempre tras una noche corta y el dolor abdominal, en los
// días de regla del ciclo de ejemplo de la app (la última regla, hace 11 días; las de antes, cada 28).
const SAMPLE_SHORT_NIGHTS = [0, 3, 9, 16, 24, 31, 45];
// La nota del ejemplo (en inglés: la pantalla la pasa por t() solo cuando enseña el ejemplo)
export const SAMPLE_NOTE = 'I woke up with it after a short night.';
const SAMPLE_DAYS = 60;
const SAMPLE: { ago: number; h: number; m: number; symptom: SymptomId; intensity: Intensity; where?: AreaId[]; note?: string }[] = [
  { ago: 0, h: 8, m: 40, symptom: 'headache', intensity: 2, where: ['forehead', 'temples'], note: SAMPLE_NOTE },
  { ago: 1, h: 17, m: 30, symptom: 'fatigue', intensity: 1 },
  { ago: 3, h: 9, m: 15, symptom: 'headache', intensity: 2, where: ['behind_eyes'] },
  { ago: 5, h: 21, m: 0, symptom: 'anxiety', intensity: 1 },
  { ago: 9, h: 11, m: 0, symptom: 'headache', intensity: 3, where: ['one_side'] },
  { ago: 9, h: 16, m: 45, symptom: 'fatigue', intensity: 2 },
  { ago: 10, h: 10, m: 30, symptom: 'abdominal_pain', intensity: 1, where: ['lower_abdomen'] },
  { ago: 11, h: 7, m: 50, symptom: 'abdominal_pain', intensity: 2, where: ['lower_abdomen'] },
  { ago: 16, h: 13, m: 20, symptom: 'dizziness', intensity: 1 },
  { ago: 20, h: 18, m: 10, symptom: 'headache', intensity: 1, where: ['forehead'] },
  { ago: 24, h: 8, m: 5, symptom: 'headache', intensity: 2, where: ['temples'] },
  { ago: 30, h: 15, m: 0, symptom: 'fatigue', intensity: 1 },
  { ago: 38, h: 9, m: 40, symptom: 'abdominal_pain', intensity: 1, where: ['lower_abdomen'] },
  { ago: 39, h: 8, m: 20, symptom: 'abdominal_pain', intensity: 2, where: ['lower_abdomen'] },
];

export function sampleSymptoms(now: Date): { entries: SymptomEntry[]; sleepMinutes: Record<string, number> } {
  const at = (ago: number, h: number, m: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() - ago);
    d.setHours(h, m, 0, 0);
    // Lo de hoy, nunca en el futuro
    return d.getTime() > now.getTime() ? new Date(now) : d;
  };
  const entries = SAMPLE.map((s, i) => {
    const fecha = at(s.ago, s.h, s.m).toISOString();
    const e: SymptomEntry = { id: symptomEntryId(`sample${i}`, s.symptom), symptom: s.symptom, intensity: s.intensity, fecha, createdAt: fecha };
    if (s.where) e.where = s.where;
    if (s.note) e.note = s.note;
    return e;
  });
  const sleepMinutes: Record<string, number> = {};
  for (let ago = 0; ago < SAMPLE_DAYS; ago++) {
    // Entre 7 h y 7 h 50, y las noches cortas, entre 5 h 10 y 5 h 40
    sleepMinutes[symptomDayKey(at(ago, 12, 0))] = SAMPLE_SHORT_NIGHTS.includes(ago) ? 310 + ((ago * 7) % 31) : 420 + ((ago * 13) % 51);
  }
  return { entries: cleanSymptomEntries(entries), sleepMinutes };
}

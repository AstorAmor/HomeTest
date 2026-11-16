// Objetivos y metas de Hoy (fase 1 del rediseño de recomendaciones, prototipo v3 de 2026-11-04:
// borradores/recomendaciones-ux/v3-fuente.html). Lógica pura, sin React ni almacenamiento (tests en
// src/logic/__tests__/metas.test.ts):
// - Objetivos: los recomendados por la analítica (un valor fuera del rango del laboratorio) y los
//   tuyos, hasta 3. Solo sirven para recomendar metas: la app no dice para qué objetivo cuenta cada una.
// - Metas: las que quieras en cada área (Ejercicio, Alimentación, Hábitos), del catálogo o tuyas; con más de 3
//   en un área, un aviso: mejor consolidar unas pocas (fundador, 2026-11-06; antes, hasta 3). Sí / no o una
//   cantidad, al día o a la semana. Algunas pueden llegar solas (reloj, Entrenamientos, check-in).
// - Las semanas van de lunes a domingo, o de domingo a sábado (Ajustes). Si empiezas a mitad (el día que
//   firmas tu compromiso), tu primera semana cuenta desde ese día y las metas a la semana van en
//   proporción (fundador, 2026-11-05: «si empiezas un miércoles, la semana acaba el domingo»).
// - Cada área tiene su donut: la media de sus metas en la semana en curso (hasta hoy), cada una por la
//   parte que llevas hecha (fundador, 2026-11-05: 3 frutas no pueden ser el 100 % si falta la verdura, ni
//   marcar verdura bajar el %). Las que marcas tú cuentan desde el primer día, a 0; las del reloj, desde
//   que llegan datos.
// - Al cerrar cada semana: enhorabuena si la has cumplido o te han faltado 3 cosas o menos («Fallar es
//   solo parte del camino»), y ánimo si te han faltado más. Solo por lo que haces, nunca por un resultado.
// Las listas de qué meta ayuda a qué objetivo y los textos de la (i) están PENDIENTES de revisión médica.
import { getLang, t } from '@/i18n';
import { checkInDayKey } from './checkInDay';

export type Area = 'ej' | 'al' | 'ha';
export const AREAS: Area[] = ['ej', 'al', 'ha'];
export type Per = 'day' | 'week';
export type Kind = 'yesno' | 'amount';
export type AutoSource = 'watch' | 'workouts' | 'checkin';
export type TobaccoUnit = 'cig' | 'pack' | 'carton';
export type AlcoholKind = 'beer' | 'wine' | 'mixed' | 'any';

export const GOALS_MAX = 3;
// Ya no es un tope (fundador, 2026-11-06): se eligen las que quieras y, pasado este número en un área, la
// pantalla aconseja consolidar unas pocas antes de sumar más (tooMany)
export const METAS_MAX = 3;
export const tooMany = (s: MetasState, area: Area) => s.sel[area].length > METAS_MAX;
// Enhorabuena también si en la semana te han faltado esto o menos «cosas» (días, sesiones o metas de la semana)
export const FEW_MISSES = 3;

// «Nutrition» en vez de «Eating» (fundador, 2026-11-16); en español sale «Nutrición»
export const AREA_NAME: Record<Area, string> = { ej: 'Exercise', al: 'Nutrition', ha: 'Habits' };

interface UnitDef {
  one: string;
  many: string;
  of?: string; // « de fruta»: va detrás de la unidad en la frase de la meta
  step: number; // paso de la ruedita y del − / + de cada día
  max: number; // tope por día
}

export interface MetaDef {
  id: string;
  area: Area;
  short: string;
  kind: Kind;
  per: Per;
  tgt: number;
  limit?: boolean; // «menos de»
  tstep?: number; // paso de la meta, si no es el de la unidad
  unit?: UnitDef;
  auto?: AutoSource;
  fixedPer?: boolean; // solo al día (dormir)
  name?: string; // sí / no: «Paseo después de comer cada día»
  sessions?: [string, string]; // sí / no a la semana con nombre propio: «2 sesiones de fuerza a la semana»
  countWord?: [string, string]; // lo que falta de un sí / no a la semana: «1 sesión»
  doneLabels?: [string, string];
  phrase?: string; // «Dormir {n} o más»
  tobacco?: boolean; // se cuenta en cigarrillos, cajetillas o cartones (se guarda en cigarrillos)
  alcohol?: boolean; // cerveza, vino, copas o cualquier bebida
  only?: 'smoker' | 'drinker';
}

const SERVING = { one: 'serving', many: 'servings' };

export const CATALOG: Record<string, MetaDef> = {
  pasos: { id: 'pasos', area: 'ej', short: 'Steps', kind: 'amount', per: 'day', tgt: 7500, tstep: 500, unit: { one: 'step', many: 'steps', step: 500, max: 30000 }, auto: 'watch' },
  cardio: { id: 'cardio', area: 'ej', short: 'Cardio', kind: 'amount', per: 'week', tgt: 90, tstep: 15, unit: { one: 'min', many: 'min', of: ' of cardio', step: 5, max: 180 }, auto: 'workouts' },
  fuerza: { id: 'fuerza', area: 'ej', short: 'Strength', kind: 'yesno', per: 'week', tgt: 2, name: 'Strength', sessions: ['strength session', 'strength sessions'], countWord: ['session', 'sessions'], doneLabels: ['Session done', 'No session'], auto: 'workouts' },
  fruta: { id: 'fruta', area: 'al', short: 'Fruit', kind: 'amount', per: 'day', tgt: 3, unit: { one: 'piece', many: 'pieces', of: ' of fruit', step: 1, max: 10 } },
  verdura: { id: 'verdura', area: 'al', short: 'Vegetables', kind: 'amount', per: 'day', tgt: 2, unit: { ...SERVING, of: ' of vegetables', step: 1, max: 8 } },
  frutos: { id: 'frutos', area: 'al', short: 'Nuts', kind: 'amount', per: 'week', tgt: 4, unit: { ...SERVING, of: ' of nuts', step: 1, max: 4 } },
  legumbre: { id: 'legumbre', area: 'al', short: 'Pulses', kind: 'amount', per: 'week', tgt: 3, unit: { ...SERVING, of: ' of pulses', step: 1, max: 3 } },
  embutido: { id: 'embutido', area: 'al', short: 'Processed meat', kind: 'amount', per: 'week', limit: true, tgt: 2, unit: { ...SERVING, of: ' of processed meat', step: 1, max: 6 } },
  carne: { id: 'carne', area: 'al', short: 'Red meat', kind: 'amount', per: 'week', limit: true, tgt: 3, unit: { ...SERVING, of: ' of red meat', step: 1, max: 4 } },
  // Dejar de fumar, sí / no (fundador, 2026-11-06: «dejar de fumar, reducir el alcohol, reducir la cafeína»)
  sinhumo: { id: 'sinhumo', area: 'ha', short: 'Smoke-free', kind: 'yesno', per: 'day', tgt: 1, name: 'No smoking', doneLabels: ['Smoke-free', 'Smoked'], only: 'smoker' },
  tabaco: { id: 'tabaco', area: 'ha', short: 'Tobacco', kind: 'amount', per: 'day', limit: true, tgt: 5, tobacco: true, only: 'smoker' },
  alcohol: { id: 'alcohol', area: 'ha', short: 'Alcohol', kind: 'amount', per: 'week', limit: true, tgt: 4, alcohol: true, only: 'drinker' },
  cafeina: { id: 'cafeina', area: 'ha', short: 'Caffeine', kind: 'amount', per: 'day', limit: true, tgt: 3, unit: { one: 'coffee', many: 'coffees', step: 1, max: 10 } },
  paseo: { id: 'paseo', area: 'ha', short: 'Walk after meals', kind: 'yesno', per: 'day', tgt: 1, name: 'Walk after meals' },
  hora: { id: 'hora', area: 'ha', short: 'Same bedtime', kind: 'yesno', per: 'day', tgt: 1, name: 'Go to bed at the same time (±30 min)', doneLabels: ['At your time', 'Off your time'], auto: 'watch' },
  dormir: { id: 'dormir', area: 'ha', short: 'Sleep hours', kind: 'amount', per: 'day', fixedPer: true, tgt: 7, tstep: 0.5, unit: { one: 'h', many: 'h', step: 0.5, max: 12 }, phrase: 'Sleep {n} or more', auto: 'watch' },
  checkin: { id: 'checkin', area: 'ha', short: 'Check-in', kind: 'yesno', per: 'day', tgt: 1, name: 'Do your check-in', doneLabels: ['Check-in done', 'No check-in'], auto: 'checkin' },
};

export const ORDER: Record<Area, string[]> = {
  ej: ['pasos', 'cardio', 'fuerza'],
  al: ['fruta', 'verdura', 'frutos', 'legumbre', 'embutido', 'carne'],
  // La cafeína, al final: así no cambia lo que se recomienda con los empates (Dormir mejor sigue con paseo y hora)
  ha: ['sinhumo', 'tabaco', 'alcohol', 'paseo', 'hora', 'dormir', 'checkin', 'cafeina'],
};

export const TOBACCO: Record<TobaccoUnit, { label: string; one: string; many: string; f: number; step: number; max: number }> = {
  cig: { label: 'Cigarettes', one: 'cigarette', many: 'cigarettes', f: 1, step: 1, max: 40 },
  pack: { label: 'Packs', one: 'pack', many: 'packs', f: 20, step: 0.5, max: 3 },
  carton: { label: 'Cartons', one: 'carton', many: 'cartons', f: 200, step: 0.1, max: 1 },
};
export const ALCOHOL: Record<AlcoholKind, { label: string; one: string; many: string }> = {
  beer: { label: 'Beer', one: 'beer', many: 'beers' },
  wine: { label: 'Wine', one: 'glass of wine', many: 'glasses of wine' },
  mixed: { label: 'Mixed drinks', one: 'mixed drink', many: 'mixed drinks' },
  any: { label: 'Any drink', one: 'alcoholic drink', many: 'alcoholic drinks' },
};

// ===== Objetivos =====
export type GoalKey =
  | 'ldl' | 'tg' | 'glucosa' | 'hdl'
  | 'energia' | 'animo' | 'sueno' | 'peso' | 'estres' | 'forma' | 'tabaco' | 'alcohol' | 'salud' | 'longev';

export interface GoalDef {
  key: GoalKey;
  name: string;
  icon: string; // Ionicons
  items: string[] | 'all';
  track: string;
  lab?: boolean; // recomendado por la analítica
  only?: 'smoker' | 'drinker';
}

const LAB_TRACK = 'Checked in your follow-up blood test.';
export const GOALS: Record<GoalKey, GoalDef> = {
  ldl: { key: 'ldl', name: 'Lower your LDL', icon: 'flask-outline', lab: true, items: ['fruta', 'verdura', 'frutos', 'legumbre', 'embutido', 'carne', 'cardio', 'pasos', 'tabaco'], track: LAB_TRACK },
  tg: { key: 'tg', name: 'Lower your triglycerides', icon: 'flask-outline', lab: true, items: ['alcohol', 'cardio', 'pasos', 'paseo', 'fuerza', 'embutido'], track: LAB_TRACK },
  glucosa: { key: 'glucosa', name: 'Lower your glucose', icon: 'flask-outline', lab: true, items: ['paseo', 'pasos', 'cardio', 'fuerza', 'legumbre', 'verdura', 'dormir', 'alcohol'], track: LAB_TRACK },
  hdl: { key: 'hdl', name: 'Raise your HDL', icon: 'flask-outline', lab: true, items: ['cardio', 'pasos', 'fuerza', 'tabaco', 'frutos'], track: LAB_TRACK },
  energia: { key: 'energia', name: 'Feel more energy', icon: 'flash-outline', items: ['dormir', 'hora', 'pasos', 'fruta', 'verdura', 'alcohol', 'checkin', 'cardio'], track: 'Your energy in the check-in, from 1 to 5.' },
  animo: { key: 'animo', name: 'Improve your mood', icon: 'happy-outline', items: ['pasos', 'cardio', 'fuerza', 'dormir', 'hora', 'checkin', 'alcohol', 'paseo'], track: 'Your mood in the check-in, from 1 to 5.' },
  sueno: { key: 'sueno', name: 'Sleep better', icon: 'moon-outline', items: ['dormir', 'hora', 'cafeina', 'alcohol', 'paseo', 'cardio', 'checkin'], track: 'Your sleep with the watch: duration and regularity.' },
  peso: { key: 'peso', name: 'Lose weight', icon: 'scale-outline', items: ['pasos', 'cardio', 'fuerza', 'fruta', 'verdura', 'legumbre', 'embutido', 'carne', 'alcohol', 'paseo'], track: 'Your weight, once a week.' },
  estres: { key: 'estres', name: 'Less stress', icon: 'leaf-outline', items: ['checkin', 'dormir', 'hora', 'pasos', 'paseo', 'alcohol', 'tabaco'], track: 'Your stress in the check-in and your watch HRV.' },
  forma: { key: 'forma', name: 'Get fitter', icon: 'barbell-outline', items: ['cardio', 'fuerza', 'pasos', 'dormir'], track: 'Your VO2max and resting heart rate, with the watch.' },
  tabaco: { key: 'tabaco', name: 'Quit smoking', icon: 'ban-outline', only: 'smoker', items: ['sinhumo', 'tabaco', 'pasos', 'checkin'], track: 'What you smoke, in Habits.' },
  alcohol: { key: 'alcohol', name: 'Drink less alcohol', icon: 'wine-outline', only: 'drinker', items: ['alcohol', 'dormir', 'checkin'], track: 'What you drink, in Habits.' },
  salud: { key: 'salud', name: 'Improve your general health', icon: 'heart-outline', items: 'all', track: 'Your goals, and your KUOVA Age in each blood test.' },
  longev: { key: 'longev', name: 'Age better', icon: 'hourglass-outline', items: 'all', track: 'Your KUOVA Age in each blood test, and your VO2max.' },
};
export const LAB_GOALS: GoalKey[] = ['ldl', 'tg', 'glucosa', 'hdl'];
export const OWN_GOALS: GoalKey[] = ['energia', 'animo', 'sueno', 'peso', 'estres', 'forma', 'tabaco', 'alcohol', 'salud', 'longev'];
const GOAL_ORDER: GoalKey[] = [...LAB_GOALS, ...OWN_GOALS];

// Los objetivos del cuestionario de inicio que tienen su objetivo aquí (para la primera vez)
export const PROFILE_GOAL_MAP: Record<string, GoalKey> = {
  more_energy: 'energia',
  sleep_better: 'sueno',
  lose_weight: 'peso',
  performance: 'forma',
  reduce_stress: 'estres',
  longevity: 'longev',
  general_health: 'salud',
  prevent_disease: 'salud',
};

// Un valor de la analítica, con el rango del laboratorio
export interface LabReading {
  marker: string; // ldl, hdl, triglycerides, glucose, hba1c
  value: number;
  unit: string | null;
  low: number | null;
  high: number | null;
}
export interface LabGoal {
  key: GoalKey;
  reading: LabReading;
  side: 'high' | 'low';
}

const isHigh = (r: LabReading) => r.high != null && r.value > r.high;
const isLow = (r: LabReading) => r.low != null && r.low > 0 && r.value < r.low;

// Recomendados: LDL, triglicéridos o glucosa (o HbA1c) por encima del rango del laboratorio; HDL, por debajo
export function labGoals(readings: LabReading[]): LabGoal[] {
  const by = (m: string) => readings.find((r) => r.marker === m);
  const out: LabGoal[] = [];
  const ldl = by('ldl');
  if (ldl && isHigh(ldl)) out.push({ key: 'ldl', reading: ldl, side: 'high' });
  const tg = by('triglycerides');
  if (tg && isHigh(tg)) out.push({ key: 'tg', reading: tg, side: 'high' });
  const glu = [by('glucose'), by('hba1c')].find((r) => r && isHigh(r));
  if (glu) out.push({ key: 'glucosa', reading: glu, side: 'high' });
  const hdl = by('hdl');
  if (hdl && isLow(hdl)) out.push({ key: 'hdl', reading: hdl, side: 'low' });
  return out;
}

// El objetivo que recomienda un marcador fuera del rango del laboratorio (la misma regla que labGoals):
// para enlazarlo desde la ficha del marcador y la analítica
export function labGoalForMarker(marker: string, side: 'high' | 'low'): GoalKey | null {
  if (side === 'low') return marker === 'hdl' ? 'hdl' : null;
  if (marker === 'ldl') return 'ldl';
  if (marker === 'triglycerides') return 'tg';
  if (marker === 'glucose' || marker === 'hba1c') return 'glucosa';
  return null;
}

// «Por tu analítica: 158 mg/dL; rango del laboratorio, menos de 130.»
export function labGoalText(g: LabGoal): string {
  const r = g.reading;
  const v = `${fmtNum(r.value)}${r.unit ? ` ${r.unit}` : ''}`;
  const lowSet = r.low != null && r.low > 0;
  const range =
    lowSet && r.high != null
      ? t('{low} to {high}', { low: fmtNum(r.low!), high: fmtNum(r.high) })
      : r.high != null
        ? t('less than {n}', { n: fmtNum(r.high) })
        : t('more than {n}', { n: fmtNum(r.low ?? 0) });
  return t('From your blood test: {value}; lab range, {range}.', { value: v, range });
}

export interface Who {
  smoker: boolean;
  drinker: boolean;
}
const allowed = (only: 'smoker' | 'drinker' | undefined, who: Who) => !only || (only === 'smoker' ? who.smoker : who.drinker);
export const goalAllowed = (g: GoalKey, who: Who) => allowed(GOALS[g].only, who);
export const metaAllowed = (id: string, who: Who) => !CATALOG[id] || allowed(CATALOG[id].only, who);
export const sortGoals = (gs: GoalKey[]) => [...gs].sort((a, b) => GOAL_ORDER.indexOf(a) - GOAL_ORDER.indexOf(b));

// Las metas que se pueden elegir en un área, en orden. Las de fumar y beber salen a todo el mundo
// (fundador, 2026-11-06), pero a quien no marcó que fuma o bebe, al final; las tuyas, detrás.
export function pickList(area: Area, s: MetasState, who: Who): string[] {
  // Marcar una no la cambia de sitio (antes subía arriba y la lista saltaba)
  const first = ORDER[area].filter((id) => metaAllowed(id, who));
  const rest = ORDER[area].filter((id) => !first.includes(id));
  return [...first, ...rest, ...s.custom.filter((c) => c.area === area).map((c) => c.id)];
}

// Poner o quitar una meta de un área, en el orden de la lista (sin tope: pasadas 3, solo el aviso)
export function toggleSel(s: MetasState, area: Area, id: string, who: Who): MetasState {
  const sel = s.sel[area];
  if (sel.includes(id)) return { ...s, sel: { ...s.sel, [area]: sel.filter((x) => x !== id) } };
  const ids = pickList(area, s, who);
  const rank = (x: string) => (ids.indexOf(x) < 0 ? 999 : ids.indexOf(x));
  return { ...s, sel: { ...s.sel, [area]: [...sel, id].sort((x, y) => rank(x) - rank(y)) } };
}

// ===== Estado (lo que se guarda en user_flags 'metas.v1') =====
export interface MetaCfg {
  tgt: number;
  per: Per;
  unit?: TobaccoUnit;
  kind?: AlcoholKind;
  auto?: boolean; // llega sola (si se puede); si no, a mano
}
export interface CustomMeta {
  id: string; // own-<n>
  area: Area;
  name: string;
  kind: Kind;
  unit: string; // la que escribió (puede estar vacía)
  max: number; // tope por día de la ruedita
}
export interface MetasState {
  goals: GoalKey[];
  sel: Record<Area, string[]>;
  cfg: Record<string, MetaCfg>;
  custom: CustomMeta[];
  commit: { day: string; weeks: number } | null;
  closedWeek: string | null; // la semana cuya enhorabuena se cerró (su primer día)
  weekStart: WeekStart; // con qué día empieza la semana (Ajustes)
}

export const emptyState = (): MetasState => ({ goals: [], sel: { ej: [], al: [], ha: [] }, cfg: {}, custom: [], commit: null, closedWeek: null, weekStart: 1 });

// Lo guardado puede venir de otra versión o a medias: se completa sin romper
export function normalizeState(raw: unknown): MetasState {
  const s = emptyState();
  if (!raw || typeof raw !== 'object') return s;
  const r = raw as Partial<MetasState>;
  if (Array.isArray(r.goals)) s.goals = sortGoals(r.goals.filter((g): g is GoalKey => g in GOALS)).slice(0, GOALS_MAX);
  if (Array.isArray(r.custom))
    s.custom = r.custom.filter((c) => c && typeof c.id === 'string' && AREAS.includes(c.area) && typeof c.name === 'string');
  const known = (id: string) => id in CATALOG || s.custom.some((c) => c.id === id);
  if (r.sel && typeof r.sel === 'object')
    for (const a of AREAS) {
      const list = (r.sel as Record<string, unknown>)[a];
      if (Array.isArray(list)) s.sel[a] = list.filter((id): id is string => typeof id === 'string' && known(id) && areaOf(s, id) === a);
    }
  if (r.cfg && typeof r.cfg === 'object') s.cfg = { ...(r.cfg as Record<string, MetaCfg>) };
  if (r.commit && typeof r.commit.day === 'string' && typeof r.commit.weeks === 'number') s.commit = { day: r.commit.day, weeks: r.commit.weeks };
  if (typeof r.closedWeek === 'string') s.closedWeek = r.closedWeek;
  if (r.weekStart === 0) s.weekStart = 0;
  return s;
}

export const areaOf = (s: MetasState, id: string): Area | null => CATALOG[id]?.area ?? s.custom.find((c) => c.id === id)?.area ?? null;
export const selectedIds = (s: MetasState) => AREAS.flatMap((a) => s.sel[a]);

// ===== Una meta, con su configuración resuelta =====
export interface Meta {
  id: string;
  area: Area;
  kind: Kind;
  per: Per;
  tgt: number; // en la unidad elegida (cajetillas, horas…)
  limit: boolean;
  f: number; // cuánto vale una unidad en lo que se guarda (cigarrillos)
  step: number; // paso de cada día
  max: number; // tope por día, en la unidad elegida
  tstep: number; // paso de la meta
  one: string;
  many: string;
  of: string;
  rawUnit: boolean; // unidad escrita por el usuario (no se traduce)
  auto: AutoSource | null; // de dónde puede llegar sola
  autoOn: boolean;
  def?: MetaDef;
  custom?: CustomMeta;
}

export function defaultCfg(def: MetaDef): MetaCfg {
  return {
    tgt: def.tgt,
    per: def.per,
    unit: def.tobacco ? 'cig' : undefined,
    kind: def.alcohol ? 'beer' : undefined,
    // El cardio y la fuerza empiezan a mano: no todo el mundo apunta sus entrenos
    auto: def.auto ? def.auto !== 'workouts' : undefined,
  };
}

export function resolveMeta(s: MetasState, id: string): Meta | null {
  const def = CATALOG[id];
  if (def) {
    const c = { ...defaultCfg(def), ...s.cfg[id] };
    const per = def.fixedPer ? def.per : c.per;
    let u: { one: string; many: string; of: string; f: number; step: number; max: number };
    if (def.tobacco) u = { ...TOBACCO[c.unit ?? 'cig'], of: '' };
    else if (def.alcohol) u = { ...ALCOHOL[c.kind ?? 'beer'], of: '', f: 1, step: 1, max: 10 };
    else if (def.kind === 'yesno') u = { one: '', many: '', of: '', f: 1, step: 1, max: 1 };
    else u = { one: def.unit!.one, many: def.unit!.many, of: def.unit!.of ?? '', f: 1, step: def.unit!.step, max: def.unit!.max };
    return {
      id, area: def.area, kind: def.kind, per, tgt: c.tgt, limit: !!def.limit, f: u.f, step: u.step, max: u.max,
      tstep: def.tobacco || def.alcohol || !def.tstep ? u.step : def.tstep,
      one: u.one, many: u.many, of: u.of, rawUnit: false, auto: def.auto ?? null, autoOn: !!def.auto && c.auto !== false, def,
    };
  }
  const own = s.custom.find((x) => x.id === id);
  if (!own) return null;
  const c = s.cfg[id] ?? { tgt: 1, per: 'day' as Per };
  return {
    id, area: own.area, kind: own.kind, per: c.per, tgt: c.tgt, limit: false, f: 1, step: 1, max: own.kind === 'yesno' ? 1 : own.max,
    tstep: 1, one: own.unit, many: own.unit, of: '', rawUnit: true, auto: null, autoOn: false, custom: own,
  };
}

// Lo que se puede elegir como meta: de su mínimo a su máximo
export function bounds(m: Meta): [number, number] {
  if (m.kind === 'yesno') return [1, 7];
  return [m.limit ? 2 * m.tstep : m.tstep, r2(m.max * (m.per === 'week' ? 7 : 1))];
}
export function targetValues(m: Meta): number[] {
  const [lo, hi] = bounds(m);
  const n = Math.round((hi - lo) / m.tstep);
  return Array.from({ length: n + 1 }, (_, i) => r2(lo + i * m.tstep));
}
export const stepTarget = (m: Meta, by: number) => {
  const [lo, hi] = bounds(m);
  return clamp(r2(Math.round((m.tgt + by * m.tstep) / m.tstep) * m.tstep), lo, hi);
};
// Valores de la ruedita de un día (en la unidad elegida)
export function dayValues(m: Meta): number[] {
  const n = Math.round(m.max / m.step);
  return Array.from({ length: n + 1 }, (_, i) => r2(i * m.step));
}
// El − / + de hoy, sobre lo guardado (en cigarrillos, horas…)
export const stepDay = (m: Meta, stored: number | null, by: number) => clamp(r2((stored ?? 0) + by * m.step * m.f), 0, r2(m.max * m.f));

// Al pasar de día a semana se multiplica tal cual; al revés, se redondea a lo que se puede apuntar
export function cfgWithPer(m: Meta, cfg: MetaCfg, per: Per): MetaCfg {
  if (m.per === per) return cfg;
  let tgt = m.kind === 'yesno' ? (per === 'week' ? 5 : 1) : per === 'week' ? r2(m.tgt * 7) : Math.max(m.tstep, r2(Math.round(m.tgt / 7 / m.tstep) * m.tstep));
  tgt = Math.min(tgt, r2(m.max * (per === 'week' ? 7 : 1)));
  return { ...cfg, per, tgt };
}
export function cfgWithTobaccoUnit(m: Meta, cfg: MetaCfg, unit: TobaccoUnit): MetaCfg {
  // Lo mismo en la unidad nueva, dentro de lo que se puede elegir con ella (un límite, de 2 pasos para arriba)
  const k = TOBACCO[unit];
  return { ...cfg, unit, tgt: clamp(r2((m.tgt * m.f) / k.f), 2 * k.step, r2(k.max * (m.per === 'week' ? 7 : 1))) };
}

// ===== Evaluar una semana =====
// 'off': un día que no cuenta (antes de empezar, en tu primera semana, o aún por llegar)
export type DayState = 'ok' | 'no' | 'pend' | 'none' | 'mark' | 'off';
export interface MetaEval {
  st: DayState[];
  n: number; // días cumplidos (metas al día)
  days: number; // días que cuentan (con dato, y hoy)
  sum: number; // lo apuntado en los días que cuentan (en lo que se guarda)
  tgt: number; // la meta de esta semana (en la unidad elegida): en proporción si no cuenta entera
  score: number; // 0..1
  started: boolean;
  current: boolean; // la semana en curso
}

const dayOk = (m: Meta, v: number) => (m.kind === 'yesno' ? v === 1 : m.limit ? v < m.tgt * m.f : v >= m.tgt * m.f);

// Cuánto vale un día de una meta al día (fundador, 2026-11-05: el % se pondera por la parte hecha de cada
// meta): entero si se cumple; si no, la parte hecha (2 de 3 piezas de fruta = 2/3). En un límite, si te
// pasas, menos cuanto más te pases. Sin dato, nada.
export function dayScore(m: Meta, v: number | null): number {
  if (v == null) return 0;
  const goal = m.tgt * m.f;
  if (m.kind === 'yesno') return v === 1 ? 1 : 0;
  if (m.limit) return v < goal ? 1 : goal / (v + m.step * m.f);
  return goal > 0 ? Math.min(1, v / goal) : 1;
}

// La parte de una semana que se evalúa. Sin ella, todos los días que se pasan, y el último es hoy.
export type WeekPart = Pick<Week, 'from' | 'to' | 'current' | 'share'>;
const CLOSED_WEEK: WeekPart = { from: 0, to: 6, current: false, share: 1 };

// La meta a la semana de una semana que no cuenta entera: la parte que toca, a pasos de la meta y al
// menos uno. Un límite se redondea hacia arriba: con cantidades enteras, «menos de 1,4» es «menos de 2».
export function weekGoal(m: Meta, share = 1): number {
  if (m.per !== 'week' || share >= 1) return m.tgt;
  const x = (m.tgt * share) / m.tstep;
  let n = Math.max(1, m.limit ? Math.ceil(x - 1e-9) : Math.round(x));
  if (m.kind === 'yesno') n = Math.min(n, Math.round(share * 7)); // no más días de los que quedan
  return r2(n * m.tstep);
}

// vals: los días de la semana; null = sin dato. `known`: la meta ya tenía datos antes de esta semana
// (sigue contando aunque la semana empiece de cero).
export function evalMeta(m: Meta, vals: (number | null)[], w: WeekPart = { from: 0, to: vals.length - 1, current: true, share: 1 }, known = false): MetaEval {
  const on = (i: number) => i >= w.from && i <= w.to;
  const T = w.current ? w.to : -1; // hoy
  const tgt = weekGoal(m, w.share);
  const goal = tgt * m.f;
  const sum = vals.reduce<number>((a, v, i) => a + (on(i) ? (v ?? 0) : 0), 0);
  const started = known || vals.some((v, i) => on(i) && v != null);
  if (m.per === 'day') {
    const st = vals.map<DayState>((v, i) => {
      if (!on(i)) return 'off';
      if (v == null) return i === T ? 'pend' : 'none';
      if (dayOk(m, v)) return 'ok';
      return i === T && !m.limit ? 'pend' : 'no';
    });
    const n = st.filter((s) => s === 'ok').length;
    const counted = vals.map((v, i) => on(i) && (v != null || i === T));
    const days = counted.filter(Boolean).length;
    const got = vals.reduce<number>((a, v, i) => a + (counted[i] ? dayScore(m, v) : 0), 0);
    return { st, n, days, sum, tgt, score: days ? got / days : 0, started, current: w.current };
  }
  const st = vals.map<DayState>((v, i) => (!on(i) ? 'off' : v != null && v > 0 ? 'mark' : 'none'));
  const score = !m.limit ? Math.min(1, sum / goal) : sum < goal ? 1 : goal / (sum + m.step * m.f);
  return { st, n: 0, days: Math.max(0, w.to - w.from + 1), sum, tgt, score, started, current: w.current };
}

export type ValuesById = Record<string, (number | null)[]>;

// ¿Cuenta ya en el donut? Las que marcas tú, siempre en la semana en curso (a 0 hasta que marques algo):
// así marcar nunca baja el %. Las del reloj, desde que lleguen datos; en una semana pasada, las que tuvieron
// alguno (las demás las empezaste después).
export const countsInArea = (m: Meta, e: MetaEval) => e.started || (e.current && !m.autoOn);

// El donut de un área: la media de sus metas, cada una con la parte que llevas hecha (null si ninguna cuenta)
export function areaScore(s: MetasState, area: Area, vals: ValuesById, w?: WeekPart, known: Record<string, boolean> = {}): number | null {
  const scores = s.sel[area]
    .map((id) => {
      const m = resolveMeta(s, id);
      if (!m) return null;
      const e = evalMeta(m, vals[id] ?? Array(7).fill(null), w, known[id]);
      return countsInArea(m, e) ? e.score : null;
    })
    .filter((x): x is number => x != null);
  return scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
}

// Recomendadas: las metas del área que más se repiten entre tus objetivos (2 como mucho). «Mejorar tu
// salud general» y «Envejecer mejor» valen para todas, así que no deciden.
export function recommended(area: Area, goals: GoalKey[], who: Who): string[] {
  const scored = ORDER[area]
    .filter((id) => metaAllowed(id, who))
    .map((id) => [id, goals.filter((g) => GOALS[g].items !== 'all' && (GOALS[g].items as string[]).includes(id)).length] as const)
    .filter((x) => x[1] > 0);
  return scored
    .sort((a, b) => b[1] - a[1] || ORDER[area].indexOf(a[0]) - ORDER[area].indexOf(b[0]))
    .slice(0, 2)
    .map((x) => x[0]);
}

// La primera vez: los objetivos que recomienda la analítica y, hasta 3, los del cuestionario de inicio
export function initialGoals(lab: GoalKey[], profileGoals: string[], who: Who): GoalKey[] {
  const own = profileGoals.map((g) => PROFILE_GOAL_MAP[g]).filter((g): g is GoalKey => !!g && goalAllowed(g, who));
  return sortGoals([...new Set([...lab, ...own])]).slice(0, GOALS_MAX);
}

// ===== Semanas y enhorabuena =====
const DAY_MS = 86400000;
export const dayKeyOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const dateOfKey = (k: string) => new Date(`${k}T12:00:00`);
export const addDays = (k: string, n: number) => dayKeyOf(new Date(dateOfKey(k).getTime() + n * DAY_MS));
// Los 7 días que acaban en `today` (el último es hoy)
export const last7 = (today: string) => Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));

// Con qué día empieza la semana: 1 lunes, 0 domingo (como Date.getDay)
export type WeekStart = 0 | 1;
export const weekStartOf = (k: string, ws: WeekStart) => addDays(k, -((dateOfKey(k).getDay() - ws + 7) % 7));
export interface Week {
  days: string[]; // los 7 días, de lunes a domingo (o de domingo a sábado)
  from: number; // el primero que cuenta: el día en que empezaste, en tu primera semana (7: aún no habías empezado)
  to: number; // el último que cuenta: hoy en la semana en curso, el último en una ya pasada (−1: aún no ha llegado)
  current: boolean; // la semana en curso
  share: number; // la parte que cuenta para las metas a la semana: (7 − from) / 7
}

// La semana de `day`. Empezaste el día que firmaste tu compromiso; sin él, cuenta entera.
export function weekOf(day: string, s: Pick<MetasState, 'weekStart' | 'commit'>, today: string): Week {
  const first = weekStartOf(day, s.weekStart);
  const days = Array.from({ length: 7 }, (_, i) => addDays(first, i));
  const since = s.commit?.day;
  const from = !since || since <= days[0] ? 0 : since > days[6] ? 7 : days.indexOf(since);
  const to = today > days[6] ? 6 : today < days[0] ? -1 : days.indexOf(today);
  return { days, from, to, current: today >= days[0] && today <= days[6], share: (7 - from) / 7 };
}

// La semana que se acaba de cerrar (la anterior a la de hoy), si ya habías empezado en ella
export function closedWeek(s: Pick<MetasState, 'weekStart' | 'commit'>, today: string): Week | null {
  if (!s.commit) return null;
  const w = weekOf(addDays(weekStartOf(today, s.weekStart), -7), s, today);
  return w.from <= 6 ? w : null;
}

// Las metas con algún dato en las 4 semanas antes de `day`
export function knownBefore(s: MetasState, day: string, manual: DayMap, auto: DayMap, demoToday?: string): Record<string, boolean> {
  const days = Array.from({ length: 28 }, (_, i) => addDays(day, i - 28));
  const v = valuesFor(s, days, manual, auto, demoToday);
  return Object.fromEntries(Object.entries(v).map(([id, xs]) => [id, xs.some((x) => x != null)]));
}

export interface Miss {
  id: string;
  k: number; // cuántas «cosas»: días, sesiones o 1 por una meta de la semana
  text: string; // «fruta (2 días)»
}

// Lo que faltó en una semana cerrada (en tu primera, desde el día en que empezaste y con las metas a la
// semana en proporción). Una meta sin ningún dato esa semana no cuenta (la empezaste después).
export function weekMisses(s: MetasState, weekVals: ValuesById, w: WeekPart = CLOSED_WEEK): { misses: Miss[]; metas: number; n: number } {
  const misses: Miss[] = [];
  const on = (i: number) => i >= w.from && i <= w.to;
  let metas = 0;
  for (const id of selectedIds(s)) {
    const m = resolveMeta(s, id);
    const all = weekVals[id];
    const d = all?.map((v, i) => (on(i) ? v : null));
    if (!m || !d || !d.some((v) => v != null)) continue;
    metas++;
    const tgt = weekGoal(m, w.share);
    const goal = tgt * m.f;
    const name = m.custom ? t('“{name}”', { name: m.custom.name }) : lowerFirst(t(m.def!.short));
    const add = (k: number, x: string) => {
      if (k > 0) misses.push({ id, k, text: `${name} (${x})` });
    };
    if (m.per === 'day') {
      const k = d.filter((v) => v != null && !dayOk(m, v)).length;
      add(k, m.limit ? t(k === 1 ? '{n} day over your limit' : '{n} days over your limit', { n: k }) : t(k === 1 ? '{n} day' : '{n} days', { n: k }));
    } else if (m.kind === 'yesno') {
      const k = tgt - d.filter((v) => v === 1).length;
      add(k, `${k} ${unitWord(m, k)}`);
    } else {
      const sum = d.reduce<number>((a, v) => a + (v ?? 0), 0);
      if (!m.limit && sum < goal) {
        const x = r2((goal - sum) / m.f);
        add(1, `${fmtMeta(m, x)} ${unitWord(m, x)}`.trim());
      }
      if (m.limit && sum >= goal) {
        const x = r2((sum - goal) / m.f + m.step);
        add(1, t('{q} too many', { q: `${fmtMeta(m, x)} ${unitWord(m, x)}`.trim() }));
      }
    }
  }
  return { misses, metas, n: misses.reduce((a, x) => a + x.k, 0) };
}

export interface Congrats {
  week: string; // el primer día de la semana (para cerrarla)
  tone: 'done' | 'almost' | 'go';
  title: string;
  body: string;
}

// Al empezar cada semana, lo de la anterior. Si empezaste a mitad, se dice que contaba solo esa parte.
export function weeklyCongrats(s: MetasState, today: string, valuesFor: (days: string[]) => ValuesById): Congrats | null {
  const w = closedWeek(s, today);
  const week = w?.days[0];
  if (!w || !week || s.closedWeek === week) return null;
  const r = weekMisses(s, valuesFor(w.days), w);
  if (!r.metas) return null;
  const range = rangeText(w.days[w.from], w.days[6]);
  const part = w.from > 0 ? ` ${t('You started mid-week, so only that part counted.')}` : '';
  if (r.n > FEW_MISSES)
    return { week, tone: 'go', title: t('Go for this week!'), body: t("{Range} you didn't reach your targets, but let's go for them this time!", { Range: upperFirst(range) }) + part };
  if (!r.n)
    return {
      week,
      tone: 'done',
      title: t('Week done!'),
      body: t(r.metas === 1 ? 'You met your target {range}. Well done.' : 'You met your {n} targets {range}. Well done.', { n: r.metas, range }) + part,
    };
  return {
    week,
    tone: 'almost',
    title: t('Well done on your week!'),
    body: t('You were close {range}: {list}. Failing is just part of the journey: keep going.', { range, list: joinList(r.misses.map((x) => x.text)) }) + part,
  };
}

// Al tocar la enhorabuena de la semana (fundador, 2026-11-16): área por área, lo que te propusiste y lo que
// hiciste esa semana (en tu primera, desde el día en que empezaste y con las metas a la semana en
// proporción). El % del área es el de su donut; una meta sin datos esa semana no cuenta en él.
export interface ReviewRow {
  id: string;
  target: string; // «2 sesiones de fuerza a la semana»
  done: string; // «1 de 2 sesiones», «4 de 7 días», «Sin datos esa semana»
}
export interface ReviewArea {
  area: Area;
  score: number | null;
  rows: ReviewRow[];
}
export function weekReview(s: MetasState, weekVals: ValuesById, w: WeekPart = CLOSED_WEEK): ReviewArea[] {
  const part: WeekPart = { ...w, current: false };
  return AREAS.filter((a) => s.sel[a].length > 0).map((area) => ({
    area,
    score: areaScore(s, area, weekVals, part),
    rows: s.sel[area].flatMap((id) => {
      const m = resolveMeta(s, id);
      if (!m) return [];
      const e = evalMeta(m, weekVals[id] ?? Array(7).fill(null), part);
      return [{ id, target: metaText({ ...m, tgt: e.tgt }), done: progressText(m, e) }];
    }),
  }));
}

// La frase del final de ese resumen: cálida y sin culpa (queda una semana entera por delante)
export const reviewClosing = (tone: Congrats['tone']) =>
  tone === 'done'
    ? t('Same again this week? You know how.')
    : tone === 'almost'
      ? t('This week you have room to get there. Keep going, one step at a time.')
      : t('This week has just started, so there is plenty of room. Don’t give up: every small step counts.');

// ===== Textos =====
export const r2 = (x: number) => Math.round(x * 100) / 100;
export const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
const lowerFirst = (s: string) => (/^[A-ZÁÉÍÓÚ][a-záéíóúñ ]/.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : s);
export const upperFirst = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
export const joinList = (l: string[]) => (l.length > 1 ? `${l.slice(0, -1).join(', ')}${t(' and ')}${l[l.length - 1]}` : (l[0] ?? ''));

// 7500 → «7.500» (es) / «7,500» (en); 0.5 → «0,5» / «0.5»
export function fmtNum(x: number, group = false): string {
  const es = getLang() !== 'en';
  const [int, dec] = String(r2(Math.abs(x))).split('.');
  const g = group ? int.replace(/\B(?=(\d{3})+(?!\d))/g, es ? '.' : ',') : int;
  return `${x < 0 ? '−' : ''}${g}${dec ? (es ? ',' : '.') + dec : ''}`;
}
export const fmtMeta = (m: Meta, x: number) => fmtNum(x, m.id === 'pasos');
// En los puntos de los 7 días: 8200 pasos → «8,2k»
export const chipNum = (m: Meta, x: number) => (m.id === 'pasos' && x >= 1000 ? `${fmtNum(Math.round(x / 100) / 10)}k` : fmtNum(x));

const tr = (m: Meta, s: string) => (m.rawUnit ? s : t(s));
export function unitWord(m: Meta, x: number): string {
  if (m.kind === 'yesno') {
    const w = m.def?.countWord ?? ['day', 'days'];
    return t(x === 1 ? w[0] : w[1]);
  }
  return tr(m, x === 1 ? m.one : m.many);
}

// La frase de la meta: «Menos de 2 raciones de embutido a la semana», «Fuerza: 2 sesiones de fuerza a la semana»…
export function metaText(m: Meta): string {
  const name = m.custom ? m.custom.name : m.def!.name ? t(m.def!.name) : '';
  if (m.kind === 'yesno') {
    if (m.per === 'day') return t('{name} every day', { name });
    if (m.def?.sessions) return t('{n} {what} a week', { n: m.tgt, what: t(m.tgt === 1 ? m.def.sessions[0] : m.def.sessions[1]) });
    return t(m.tgt === 1 ? '{name}, {n} day a week' : '{name}, {n} days a week', { name, n: m.tgt });
  }
  const unit = unitWord(m, m.tgt);
  const q = `${fmtMeta(m, m.tgt)}${unit ? ` ${unit}` : ''}${m.of ? t(m.of) : ''}`;
  if (m.custom) return t(m.per === 'day' ? '{name}: {q} a day' : '{name}: {q} a week', { name, q });
  if (m.def?.phrase) return t(m.def.phrase, { n: q });
  return t(m.limit ? (m.per === 'day' ? 'Less than {q} a day' : 'Less than {q} a week') : m.per === 'day' ? '{q} a day' : '{q} a week', { q });
}

// Vista previa de una meta tuya, igual que quedará
export function customText(n: { name: string; kind: Kind; per: Per; q: number; days: number; unit: string }): string {
  const name = n.name.trim() || t('Your target');
  if (n.kind === 'yesno') return n.per === 'day' ? t('{name} every day', { name }) : t(n.days === 1 ? '{name}, {n} day a week' : '{name}, {n} days a week', { name, n: n.days });
  const q = `${fmtNum(n.q)}${n.unit.trim() ? ` ${n.unit.trim()}` : ''}`;
  return t(n.per === 'day' ? '{name}: {q} a day' : '{name}: {q} a week', { name, q });
}

// Cómo vas: «5 de 7 días», «45 de 90 min», «1 ración en 7 días · tu límite, menos de 2»
export function progressText(m: Meta, e: MetaEval): string {
  if (!e.started && m.autoOn) return t('Counts once data arrives');
  if (!e.started && !e.current) return t('No data that week');
  if (m.per === 'day') return t(e.days === 1 ? '{n} of {d} day' : '{n} of {d} days', { n: e.n, d: e.days });
  const sd = r2(e.sum / m.f);
  if (!m.limit) {
    const p = t('{sum} of {tgt} {unit}', { sum: fmtMeta(m, sd), tgt: fmtMeta(m, e.tgt), unit: unitWord(m, e.tgt) }).replace(/\s+$/, '');
    return sd >= e.tgt ? t('{progress} · done', { progress: p }) : p;
  }
  const q = { sum: fmtMeta(m, sd), unit: unitWord(m, sd), tgt: fmtMeta(m, e.tgt) };
  return t(e.current ? '{sum} {unit} this week · your limit, less than {tgt}' : '{sum} {unit} that week · your limit, less than {tgt}', q).replace(/\s{2,}/g, ' ');
}

// Lo de un día: «8.200 pasos», «Hecha», «Sin dato»
export function valueText(m: Meta, v: number | null): string {
  if (v == null) return t('No data');
  if (m.kind === 'yesno') {
    const l = m.def?.doneLabels ?? ['Done', 'Not done'];
    return t(v === 1 ? l[0] : l[1]);
  }
  const x = r2(v / m.f);
  const u = unitWord(m, x);
  return `${fmtMeta(m, x)}${u ? ` ${u}` : ''}`;
}

// De dónde llega: «Del reloj o a mano», «A mano»
export function sourceText(m: Meta): string {
  if (m.auto === 'watch') return t('From your watch or by hand');
  if (m.auto === 'workouts') return t('From Workouts or by hand');
  if (m.auto === 'checkin') return t('From the check-in or by hand');
  return t('By hand');
}
export const autoLabel = (a: AutoSource) => t(a === 'watch' ? 'Watch' : a === 'workouts' ? 'Workouts' : 'Check-in');
export const fromLabel = (a: AutoSource) => t(a === 'watch' ? 'from your watch' : a === 'workouts' ? 'from Workouts' : 'from the check-in');

// «4 de noviembre»
export function dayMonth(k: string): string {
  const d = dateOfKey(k);
  if (getLang() === 'en') return `${d.getDate()} ${EN_MONTHS[d.getMonth()]}`;
  return `${d.getDate()} de ${ES_MONTHS[d.getMonth()]}`;
}
// «del 2 al 8 de noviembre», «del 29 de octubre al 4 de noviembre», «el 8 de noviembre»
export function rangeText(a: string, b: string): string {
  if (a === b) return t('on {day}', { day: dayMonth(a) });
  const same = a.slice(0, 7) === b.slice(0, 7);
  return t('from {from} to {to}', { from: same ? String(dateOfKey(a).getDate()) : dayMonth(a), to: dayMonth(b) });
}
// «miércoles» / «Wednesday»
export const weekdayName = (k: string) => (getLang() === 'en' ? EN_WEEKDAYS : ES_WEEKDAYS)[dateOfKey(k).getDay()];
const EN_WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const ES_WEEKDAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const EN_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const ES_MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const EN_DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const ES_DAYS = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];
export const weekdayLetter = (k: string) => (getLang() === 'en' ? EN_DAYS : ES_DAYS)[dateOfKey(k).getDay()];

// ===== Fuentes automáticas =====
// La hora de acostarte cuenta si está a ±30 min de tu hora habitual (la mediana de las noches que hay, 3 como mínimo)
export function bedtimeOnTime(starts: { date: string; value: number }[]): Record<string, number> {
  const out: Record<string, number> = {};
  if (starts.length < 3) return out;
  const sorted = starts.map((p) => p.value).sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  for (const p of starts) out[p.date] = Math.abs(p.value - median) <= 30 ? 1 : 0;
  return out;
}

// Lo que llega solo, por meta y día: pasos y sueño del reloj, si te acostaste a tu hora, los entrenos de
// cardio (y deporte) y de fuerza que apuntas en Entrenamientos, y los check-ins que haces
export type DayMap = Record<string, Record<string, number>>;
export interface AutoInputs {
  steps?: { date: string; value: number }[];
  sleepMinutes?: { date: string; value: number }[];
  sleepStart?: { date: string; value: number }[];
  workouts: { fecha: string; type: string; minutes: number }[];
  checkIns: { fecha: string; moment?: string }[];
}
export function autoValues(inp: AutoInputs): DayMap {
  const out: DayMap = { pasos: {}, dormir: {}, hora: {}, cardio: {}, fuerza: {}, checkin: {} };
  for (const p of inp.steps ?? []) out.pasos[p.date] = Math.round(p.value);
  for (const p of inp.sleepMinutes ?? []) out.dormir[p.date] = r2(p.value / 60);
  out.hora = bedtimeOnTime(inp.sleepStart ?? []);
  for (const w of inp.workouts) {
    const day = dayKeyOf(new Date(w.fecha));
    if (w.type === 'strength') out.fuerza[day] = 1;
    else if (w.type === 'cardio' || w.type === 'sport') out.cardio[day] = (out.cardio[day] ?? 0) + (w.minutes || 0);
  }
  for (const c of inp.checkIns) out.checkin[checkInDayKey(c)] = 1;
  return out;
}

// Los valores de cada meta elegida en unos días: lo que llega solo si tiene el interruptor puesto y, si
// no, lo apuntado a mano. En la demo, los días anteriores a hoy sin apuntar salen del ejemplo.
export function valuesFor(s: MetasState, days: string[], manual: DayMap, auto: DayMap, demoToday?: string): ValuesById {
  const out: ValuesById = {};
  for (const id of selectedIds(s)) {
    const m = resolveMeta(s, id);
    if (!m) continue;
    // Lo apuntado a mano manda; con el reloj (o Entrenamientos, check-in) encendido, lo que llega solo
    // rellena los días que no se han corregido a mano (fundador, 2026-11-05)
    const man = manual[id];
    const au = m.autoOn ? auto[id] : undefined;
    out[id] = days.map((d) => man?.[d] ?? au?.[d] ?? (demoToday && !m.autoOn ? demoValue(m, d, demoToday) : null));
  }
  return out;
}

// ===== Prueba (modo demo) =====
// Los 6 días anteriores a hoy del prototipo, para que la demo no salga vacía. Hoy, sin marcar.
export const DEMO_DAYS: Record<string, (number | null)[]> = {
  cardio: [30, 0, 0, 25, 0, 30],
  fuerza: [0, 1, 0, 0, 0, 0],
  fruta: [3, 2, 1, 2, 3, 3],
  verdura: [2, 1, 1, 2, 2, 1],
  frutos: [1, 0, 1, 1, 1, 0],
  legumbre: [0, 1, 0, 0, 1, 0],
  embutido: [1, 0, 1, 1, 0, 0],
  carne: [0, 1, 0, 1, 0, 0],
  tabaco: [6, 4, 8, 5, 4, 3],
  alcohol: [0, 2, 3, 0, 0, 1],
  paseo: [1, 0, 1, 1, 0, 1],
};
function demoValue(m: Meta, day: string, today: string): number | null {
  const sample = DEMO_DAYS[m.id];
  const back = Math.round((dateOfKey(today).getTime() - dateOfKey(day).getTime()) / DAY_MS);
  if (!sample || back < 1 || back > sample.length) return null;
  const v = sample[sample.length - back];
  return v;
}
export function demoState(today: string): MetasState {
  return {
    ...emptyState(),
    goals: ['ldl', 'energia'],
    sel: { ej: ['pasos', 'cardio', 'fuerza'], al: ['fruta', 'frutos', 'embutido'], ha: ['paseo', 'hora', 'dormir'] },
    commit: { day: addDays(today, -7), weeks: 8 },
  };
}

import { EXERCISE_LIST, canDo, getExercise, levelAllows } from '@/data/workouts/catalog';
import type {
  CatalogExercise,
  Equipment,
  Level,
  MovementPattern,
  WorkoutExercise,
  WorkoutGoal,
  WorkoutPrefs,
  WorkoutProgram,
  WorkoutSession,
} from '@/data/workouts/types';

// Generador de entrenamientos: a partir del objetivo, el nivel, los días, los minutos y el material,
// arma un programa de 2 a 5 sesiones (cuerpo completo, torso/pierna, cardio o movilidad) rellenando
// huecos por patrón de movimiento con ejercicios del catálogo.
//
// Dosis: ACSM, "Progression models in resistance training for healthy adults" (2009) y guías de la
// OMS 2020 (fuerza ≥ 2 días por semana). Principiante: 2-3 series de 8-15; fuerza: 3-5 series de 3-6
// con descansos de 2-3 min; hipertrofia: 3-4 de 8-12 con 60-90 s; resistencia y pérdida de grasa:
// 12-15 o por tiempo con descansos cortos. Son SUPUESTOS de programación pendientes de revisar por un
// entrenador o fisioterapeuta (ver el backlog de revisión clínica); no sustituyen a un profesional.
//
// Determinista: misma configuración y misma semilla = mismo programa ("otra variación" cambia la semilla).

type Focus = WorkoutSession['focus'];

// mulberry32, el mismo PRNG que usan los scripts de la marca
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Qué sesiones hay según el objetivo y los días por semana
export function splitFor(goal: WorkoutGoal, days: number): Focus[] {
  const d = Math.max(2, Math.min(5, Math.round(days)));
  if (goal === 'mobility') return Array.from({ length: d }, () => 'mobility' as Focus);
  if (goal === 'fat_loss') return fatLossSplit(d);
  if (d <= 3) return Array.from({ length: d }, () => 'full' as Focus);
  return d === 4 ? ['upper', 'lower', 'upper', 'lower'] : ['upper', 'lower', 'full', 'upper', 'lower'];
}

// Pérdida de grasa: con 2-3 días todo cuerpo completo en circuito; con 4-5 se alternan con cardio y abdomen
function fatLossSplit(d: number): Focus[] {
  if (d <= 3) return Array.from({ length: d }, () => 'full' as Focus);
  return d === 4 ? ['full', 'conditioning', 'full', 'conditioning'] : ['full', 'conditioning', 'full', 'conditioning', 'full'];
}

// Huecos de la parte principal, por orden de prioridad: si no hay tiempo, se quitan los del final.
// Las variantes A/B/C reparten los patrones para que cada sesión de la semana sea distinta.
const SLOTS: Record<Focus, MovementPattern[][]> = {
  full: [
    ['squat', 'push_h', 'pull_h', 'hinge', 'core', 'lunge', 'push_v', 'pull_v', 'calves'],
    ['hinge', 'push_v', 'pull_v', 'lunge', 'core', 'squat', 'push_h', 'pull_h', 'glutes'],
    ['lunge', 'push_h', 'pull_v', 'hinge', 'core', 'squat', 'push_v', 'pull_h', 'carry'],
  ],
  upper: [
    ['push_h', 'pull_h', 'push_v', 'pull_v', 'core', 'shoulders', 'biceps', 'triceps'],
    ['pull_v', 'push_v', 'pull_h', 'push_h', 'core', 'chest', 'triceps', 'biceps'],
  ],
  lower: [
    ['squat', 'hinge', 'lunge', 'core', 'hamstrings', 'calves', 'glutes', 'quads'],
    ['hinge', 'lunge', 'squat', 'core', 'glutes', 'quads', 'calves', 'hamstrings'],
  ],
  conditioning: [
    ['conditioning', 'core', 'conditioning', 'hinge', 'conditioning', 'core', 'carry', 'conditioning'],
    ['conditioning', 'core', 'conditioning', 'carry', 'conditioning', 'core', 'hinge', 'conditioning'],
  ],
  mobility: [
    ['mobility', 'core', 'hinge', 'mobility', 'back', 'stretch', 'glutes', 'mobility'],
    ['mobility', 'back', 'core', 'mobility', 'glutes', 'stretch', 'hinge', 'mobility'],
  ],
};

// Si no hay ningún ejercicio de un patrón con ese material, se prueba con estos (en orden)
const FALLBACK: Partial<Record<MovementPattern, MovementPattern[]>> = {
  pull_v: ['pull_h', 'shoulders', 'back'],
  pull_h: ['pull_v', 'shoulders', 'back'],
  push_v: ['push_h', 'shoulders'],
  push_h: ['push_v'],
  hamstrings: ['hinge'],
  quads: ['squat', 'lunge'],
  glutes: ['hinge'],
  chest: ['push_h'],
  carry: ['conditioning', 'core'],
  biceps: ['pull_h'],
  triceps: ['push_h'],
  shoulders: ['push_v'],
  back: ['hinge'],
};

const PRIMARY: MovementPattern[] = ['squat', 'lunge', 'hinge', 'push_h', 'push_v', 'pull_h', 'pull_v'];
type Role = 'primary' | 'accessory' | 'core' | 'carry' | 'conditioning' | 'mobility';
const roleOf = (p: MovementPattern): Role =>
  PRIMARY.includes(p) ? 'primary' : p === 'core' ? 'core' : p === 'carry' ? 'carry' : p === 'conditioning' ? 'conditioning' : p === 'mobility' || p === 'stretch' ? 'mobility' : 'accessory';

const LV: Record<Level, 0 | 1 | 2> = { beginner: 0, intermediate: 1, advanced: 2 };

const usesKit = (ex: CatalogExercise) => ex.needs.length > 0 || (ex.anyOf?.length ?? 0) > 0;

interface Dose {
  sets: number;
  reps: string;
  restSec: number;
}

// Series, repeticiones y descanso por objetivo, nivel y tipo de ejercicio
export function doseFor(goal: WorkoutGoal, level: Level, ex: CatalogExercise, role: Role, focus: Focus): Dose {
  const l = LV[level];
  if (role === 'mobility') return { sets: goal === 'mobility' ? 2 : 1, reps: ex.timed ? '30 s' : '6–8', restSec: 0 };
  if (role === 'conditioning') {
    if (ex.needs.includes('cardio')) {
      // Máquina de cardio: intervalos en la sesión de cardio; un bloque seguido como remate
      return focus === 'conditioning' ? { sets: [5, 6, 8][l], reps: '1 min', restSec: 60 } : { sets: 1, reps: ['8 min', '10 min', '12 min'][l], restSec: 0 };
    }
    return { sets: [2, 3, 4][l], reps: ['20 s', '30 s', '40 s'][l], restSec: [40, 30, 20][l] };
  }
  if (role === 'carry') return { sets: [2, 3, 3][l], reps: ['30 s', '40 s', '45 s'][l], restSec: 60 };
  if (role === 'core') {
    const reps = ex.timed ? ['20–30 s', '30–45 s', '45–60 s'][l] : ['8–10', '10–12', '12–15'][l];
    return { sets: [2, 3, 3][l], reps, restSec: goal === 'fat_loss' ? 20 : 45 };
  }
  const timedReps = ['20–30 s', '30–40 s', '40–45 s'][l];
  const acc = role === 'accessory';
  // Con el peso corporal no se puede cargar: en fuerza se trabaja en rangos de hipertrofia
  const bodyweightStrength = goal === 'strength' && !usesKit(ex) && !ex.timed;
  switch (bodyweightStrength ? 'muscle' : goal) {
    case 'strength':
      return acc
        ? { sets: [2, 3, 3][l], reps: ex.timed ? timedReps : '8–12', restSec: 75 }
        : { sets: [3, 4, 5][l], reps: ex.timed ? timedReps : ['8–10', '5–6', '3–5'][l], restSec: [90, 150, 180][l] };
    case 'muscle':
      return acc
        ? { sets: [2, 3, 3][l], reps: ex.timed ? timedReps : '10–15', restSec: 60 }
        : { sets: [3, 3, 4][l], reps: ex.timed ? timedReps : '8–12', restSec: [75, 90, 90][l] };
    case 'fat_loss':
      return { sets: [2, 3, 3][l], reps: ex.timed ? timedReps : acc ? '15' : '12–15', restSec: [30, 20, 15][l] };
    case 'mobility':
      return { sets: 2, reps: ex.timed ? '30 s' : '8–10', restSec: 20 };
    case 'health':
    default:
      return acc
        ? { sets: [2, 2, 3][l], reps: ex.timed ? timedReps : '12–15', restSec: 45 }
        : { sets: [2, 3, 3][l], reps: ex.timed ? timedReps : '10–12', restSec: 60 };
  }
}

export function candidatesFor(pattern: MovementPattern, prefs: Pick<WorkoutPrefs, 'equipment' | 'level' | 'lowImpact'>) {
  return EXERCISE_LIST.filter(
    (ex) => ex.pattern === pattern && canDo(ex, prefs.equipment) && levelAllows(prefs.level, ex.level) && !(prefs.lowImpact && ex.impact),
  );
}

// Elige un ejercicio para el hueco: primero los no usados aún en el programa; si tiene material,
// preferimos usarlo (en fuerza e hipertrofia, sobre todo); un poco de azar para variar.
function pick(pattern: MovementPattern, prefs: WorkoutPrefs, used: Set<string>, rand: () => number, inSession: Set<string>): CatalogExercise | null {
  for (const p of [pattern, ...(FALLBACK[pattern] ?? [])]) {
    let pool = candidatesFor(p, prefs).filter((ex) => !inSession.has(ex.id));
    if (!pool.length) continue;
    // En los huecos principales, mejor un ejercicio multiarticular si lo hay
    if (PRIMARY.includes(p) && pool.some((ex) => ex.compound)) pool = pool.filter((ex) => ex.compound);
    const hasKit = prefs.equipment.some((e) => e !== 'bench');
    const loadMatters = prefs.goal === 'strength' || prefs.goal === 'muscle';
    let best: CatalogExercise | null = null;
    let bestScore = -Infinity;
    for (const ex of pool) {
      let score = rand();
      if (!used.has(ex.id)) score += 2;
      if (hasKit && usesKit(ex)) score += loadMatters ? 1.5 : 0.4;
      if (ex.level === prefs.level) score += 0.3;
      if (PRIMARY.includes(p) && ex.compound) score += 0.3;
      if (score > bestScore) {
        bestScore = score;
        best = ex;
      }
    }
    return best;
  }
  return null;
}

// ── Duración estimada ──
const repSeconds = (reps: string) => {
  const n = reps.match(/(\d+)(?!.*\d)/); // el número más alto del rango
  const v = n ? Number(n[1]) : 10;
  if (/min/.test(reps)) return v * 60;
  if (/s\b/.test(reps)) return v;
  return v * 3.5; // ~3-4 s por repetición
};

export function estimateMinutes(session: Pick<WorkoutSession, 'exercises'>): number {
  let sec = 0;
  for (const it of session.exercises) {
    const ex = getExercise(it.exerciseId);
    const work = repSeconds(it.reps) * (ex?.perSide ? 2 : 1);
    sec += it.sets * work + Math.max(0, it.sets - 1) * it.restSec + (it.block === 'main' || it.block === 'finisher' ? 30 + it.restSec : 10);
  }
  return Math.max(5, Math.round(sec / 60));
}

const LOWER_MUSCLES = ['hamstrings', 'quadriceps', 'calves', 'glutes', 'adductors', 'abductors', 'lower back'];

function warmupAndCooldown(focus: Focus, prefs: WorkoutPrefs, rand: () => number, inSession: Set<string>, used: Set<string>) {
  // Lo que encaja con la sesión y lo que aún no ha salido esta semana va primero
  const pickFrom = (pattern: 'mobility' | 'stretch', n: number, prefer?: (ex: CatalogExercise) => boolean) => {
    const pool = candidatesFor(pattern, prefs).filter((ex) => !inSession.has(ex.id));
    const scored = pool.map((ex) => ({ ex, s: rand() + (prefer?.(ex) ? 1 : 0) + (used.has(ex.id) ? 0 : 0.8) })).sort((a, b) => b.s - a.s);
    const out = scored.slice(0, n).map((x) => x.ex);
    out.forEach((ex) => {
      inSession.add(ex.id);
      used.add(ex.id);
    });
    return out;
  };
  const isLower = (ex: CatalogExercise) => ex.primary.some((m) => LOWER_MUSCLES.includes(m));
  const prefer = focus === 'lower' ? isLower : focus === 'upper' ? (ex: CatalogExercise) => !isLower(ex) : undefined;
  const short = prefs.minutes <= 20;
  const warm = pickFrom('mobility', focus === 'mobility' ? 3 : short ? 2 : 3);
  const cool = pickFrom('stretch', focus === 'mobility' ? 4 : short ? 2 : 3, prefer);
  const asItem = (ex: CatalogExercise, block: 'warmup' | 'cooldown'): WorkoutExercise => {
    const d = doseFor(prefs.goal, prefs.level, ex, 'mobility', focus);
    return { exerciseId: ex.id, block, sets: block === 'cooldown' ? 1 : d.sets, reps: block === 'cooldown' ? (prefs.goal === 'mobility' ? '45 s' : '30 s') : d.reps, restSec: 0 };
  };
  return { warmup: warm.map((ex) => asItem(ex, 'warmup')), cooldown: cool.map((ex) => asItem(ex, 'cooldown')) };
}

// Cuántos huecos de la parte principal caben, de partida, en los minutos de la sesión
const SLOTS_FOR_MINUTES = (minutes: number) => (minutes <= 20 ? 4 : minutes <= 30 ? 5 : minutes <= 45 ? 6 : 8);

const TITLES: Record<Focus, string> = {
  full: 'Full body',
  upper: 'Upper body',
  lower: 'Lower body',
  conditioning: 'Cardio and core',
  mobility: 'Mobility',
};

function buildSession(focus: Focus, variant: number, letter: string, prefs: WorkoutPrefs, used: Set<string>, rand: () => number): WorkoutSession {
  const variants = SLOTS[focus];
  const slots = variants[variant % variants.length];
  const inSession = new Set<string>();
  const { warmup, cooldown } = warmupAndCooldown(focus, prefs, rand, inSession, used);

  const main: WorkoutExercise[] = [];
  for (const pattern of slots) {
    const ex = pick(pattern, prefs, used, rand, inSession);
    if (!ex) continue;
    inSession.add(ex.id);
    used.add(ex.id);
    const d = doseFor(prefs.goal, prefs.level, ex, roleOf(pattern), focus);
    main.push({ exerciseId: ex.id, block: 'main', ...d });
  }

  // Remate de cardio en pérdida de grasa (máquina si hay; si no, uno de peso corporal)
  const finisher: WorkoutExercise[] = [];
  if (prefs.goal === 'fat_loss' && focus !== 'conditioning') {
    const ex = pick('conditioning', prefs, used, rand, inSession);
    if (ex) {
      inSession.add(ex.id);
      finisher.push({ exerciseId: ex.id, block: 'finisher', ...doseFor(prefs.goal, prefs.level, ex, 'conditioning', focus) });
    }
  }

  // Ajustar al tiempo: se empieza con los huecos que caben y se quitan los del final si se pasa
  let n = Math.min(main.length, SLOTS_FOR_MINUTES(prefs.minutes));
  let warm = warmup;
  let cool = cooldown;
  let body = main;
  const assemble = () => [...warm, ...body.slice(0, n), ...finisher, ...cool];
  const over = () => estimateMinutes({ exercises: assemble() }) > prefs.minutes + 3;
  // Se intenta conservar 4 ejercicios (pierna, empuje, tirón y otro) antes de recortar series o descansos
  const keep = Math.min(4, body.length);
  while (n > keep && over()) n--;
  while (n < body.length && estimateMinutes({ exercises: [...warm, ...body.slice(0, n + 1), ...finisher, ...cool] }) <= prefs.minutes) n++;
  // Si aun así no cabe (fuerza en 20-30 min): una serie menos, descansos más cortos, calentamiento y
  // estiramientos más breves y, en último caso, menos ejercicios
  const reducers = [
    () => {
      warm = warm.slice(0, 2);
      cool = cool.slice(0, 2);
    },
    () => (body = body.map((it) => ({ ...it, restSec: Math.min(it.restSec, 90) }))),
    () => (body = body.map((it) => (it.sets > 2 ? { ...it, sets: it.sets - 1 } : it))),
    () => (n = Math.max(3, n - 1)),
    () => (body = body.map((it) => ({ ...it, restSec: Math.min(it.restSec, 60) }))),
    () => (n = Math.max(2, n - 1)),
  ];
  for (const reduce of reducers) {
    if (!over()) break;
    reduce();
  }

  return { id: letter, title: TITLES[focus], focus, exercises: assemble() };
}

export function generateProgram(prefs: WorkoutPrefs): WorkoutSession[] {
  const rand = rng(prefs.seed * 7919 + prefs.minutes * 31 + prefs.daysPerWeek);
  const used = new Set<string>();
  const split = splitFor(prefs.goal, prefs.daysPerWeek);
  const count: Partial<Record<Focus, number>> = {};
  return split.map((focus, i) => {
    const variant = count[focus] ?? 0;
    count[focus] = variant + 1;
    return buildSession(focus, variant, String.fromCharCode(65 + i), prefs, used, rand);
  });
}

// Ejercicios con los que se puede cambiar uno (mismo patrón, que se puedan hacer con el material).
// En el portal el entrenador puede pedir todos los del patrón aunque el paciente no tenga el material.
export function alternativesFor(exerciseId: string, prefs: Pick<WorkoutPrefs, 'equipment' | 'level' | 'lowImpact'>, opts: { anyEquipment?: boolean } = {}) {
  const ex = getExercise(exerciseId);
  if (!ex) return [];
  return EXERCISE_LIST.filter(
    (o) =>
      o.id !== ex.id &&
      o.pattern === ex.pattern &&
      (opts.anyEquipment || (canDo(o, prefs.equipment) && levelAllows(prefs.level, o.level) && !(prefs.lowImpact && o.impact))),
  );
}

// La dosis de partida de un ejercicio añadido a mano o cambiado (misma lógica que el generador)
export function defaultDose(exerciseId: string, prefs: WorkoutPrefs, block: WorkoutExercise['block'] = 'main', focus: Focus = 'full'): Dose {
  const ex = getExercise(exerciseId);
  if (!ex) return { sets: 3, reps: '10', restSec: 60 };
  return doseFor(prefs.goal, prefs.level, ex, block === 'warmup' || block === 'cooldown' ? 'mobility' : roleOf(ex.pattern), focus);
}

// Material por sitio: en el gimnasio, todo; en casa sin material, nada
export function equipmentForPlace(place: WorkoutPrefs['place'], homeKit: Equipment[]): Equipment[] {
  if (place === 'gym') return ['dumbbells', 'kettlebell', 'bands', 'bench', 'bar', 'barbell', 'machines', 'cardio'];
  if (place === 'home') return [];
  return homeKit;
}

// Cómo progresar las próximas 4 semanas (texto fuente en inglés)
export function progressionText(goal: WorkoutGoal): string {
  switch (goal) {
    case 'strength':
      return 'Weeks 1–2: learn each move and stop every set with 2–3 reps left in the tank. From week 3: when you reach the top of the range in every set with good form, add a little weight (2.5–5%).';
    case 'mobility':
      return 'Move slowly and never into pain. Each week, try to go a little further in each position and breathe out as you go deeper.';
    case 'fat_loss':
      return 'Weeks 1–2: keep a pace you could hold while talking in short sentences. From week 3: add a round or shorten the rests by 5–10 seconds.';
    case 'muscle':
      return 'Weeks 1–2: learn each move and stop every set with 2–3 reps left in the tank. From week 3: add a rep each week; at the top of the range, add a little weight.';
    case 'health':
    default:
      return 'Weeks 1–2: learn each move and finish every set feeling you could do 2–3 more. From week 3: add a rep or a little weight when every set feels comfortable.';
  }
}

// Objetivo de partida para un paciente del portal, por sus objetivos en la app (en inglés o español)
export function goalFromPatientGoals(goals: string[] | undefined): WorkoutGoal {
  const s = (goals ?? []).join(' ').toLowerCase();
  if (/weight|peso|grasa|fat/.test(s)) return 'fat_loss';
  if (/sport|deporte|perform|rendimiento|strength|fuerza/.test(s)) return 'strength';
  if (/muscle|músculo|musculo/.test(s)) return 'muscle';
  return 'health';
}

export const DEFAULT_PREFS: WorkoutPrefs = {
  goal: 'health',
  level: 'beginner',
  daysPerWeek: 3,
  minutes: 30,
  place: 'home',
  equipment: [],
  lowImpact: false,
  seed: 1,
};

export function newProgram(prefs: WorkoutPrefs, extra: Partial<WorkoutProgram> = {}): WorkoutProgram {
  return {
    id: `wp-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`,
    title: extra.title ?? 'My workout',
    createdAt: new Date().toISOString(),
    source: 'self',
    prefs,
    sessions: generateProgram(prefs),
    active: true,
    completions: [],
    ...extra,
  };
}

// La siguiente sesión que toca: la que va después de la última hecha (o la primera)
export function nextSessionId(program: Pick<WorkoutProgram, 'sessions' | 'completions'>): string | null {
  if (!program.sessions.length) return null;
  const last = [...program.completions].sort((a, b) => b.at.localeCompare(a.at))[0];
  if (!last) return program.sessions[0].id;
  const i = program.sessions.findIndex((s) => s.id === last.sessionId);
  return program.sessions[(i + 1) % program.sessions.length].id;
}

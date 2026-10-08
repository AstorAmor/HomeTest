import { BowelEntry, BristolType, StoolColor, UrineColor, UrineEntry, VoidVolume } from '@/types/bathroom';
import { CycleGoalAnswers } from '@/types/cycleGoal';
import { DoseLog, MedicationItem, MedSchedule } from '@/types/medication';
import { evaluateNudges, muteUntil } from './engine';
import { MuteOption, NudgeContext, NudgeDecision, NudgeId, NudgeLogEntry, NudgePrefs, NudgeStatus } from './types';

// Usuarios simulados ("personas"): un JSON por usuario en simulation/personas/ con su perfil y lo
// que registra, en días relativos a "hoy" (día 0; negativos = pasado, positivos = futuro). Así los
// datos nunca caducan. El mismo JSON sirve para:
//   - npm run simulate: recorre los días y dice qué aviso sale cada día y por qué (y comprueba
//     los "expect" del JSON)
//   - la app (Developer mode → Simulated users): carga el usuario en el modo demo para verlo.

type Range = number | [number, number];
type Choice<T> = T | T[];

export interface PersonaEvent {
  day: number;
  time?: string; // "HH:MM", por defecto 09:00
  type:
    | 'check_in'
    | 'workout'
    | 'meal'
    | 'period_start'
    | 'temperature'
    | 'bowel'
    | 'urine'
    | 'mute'
    | 'unmute'
    | 'cycle_goal'
    | 'medication' // alta de una medicación o suplemento (id, name, schedule, courseDays...)
    | 'dose'; // marca una toma (med, at "HH:MM", status)
  [field: string]: unknown;
}

export interface PersonaSeries {
  type: 'check_in' | 'workout' | 'meal' | 'sleep' | 'temperature' | 'bowel' | 'urine' | 'period' | 'dose';
  fromDay: number;
  toDay: number;
  everyDays?: number; // 1 = todos los días
  skipChance?: number; // 0..1: días que se salta al azar (siempre los mismos: azar con semilla)
  [field: string]: unknown;
}

export interface PersonaExpect {
  day: number;
  nudge: NudgeId;
  status: NudgeStatus;
  note?: string;
}

export interface Persona {
  id: string;
  name: string;
  summary: string;
  tests?: string;
  profile: { sex?: 'female' | 'male' | 'other'; age?: number; conditions?: string[]; firstName?: string };
  cycleGoal?: Omit<CycleGoalAnswers, 'answeredAt'> | null;
  simulate: { fromDay: number; toDay: number };
  series?: PersonaSeries[];
  events?: PersonaEvent[];
  expect?: PersonaExpect[];
}

export interface ExpandedPersona {
  profile: Persona['profile'];
  cycleGoal: CycleGoalAnswers | null;
  checkIns: { id: string; fecha: string; createdAt: string; moment: string; energy?: number; mood?: string; sleep?: number; note?: string }[];
  workouts: { id: string; fecha: string; createdAt: string; type: string; minutes: number }[];
  meals: { id: string; fecha: string; createdAt: string }[];
  cycleStarts: { id: string; fecha: string; createdAt: string }[];
  temperatures: { id: string; fecha: string; createdAt: string; celsius: number; source: 'manual' | 'wearable' }[];
  bowel: BowelEntry[];
  urine: UrineEntry[];
  sleepNights: { date: string; minutes: number }[];
  medications: MedicationItem[];
  doses: DoseLog[];
  prefActions: { at: string; nudge: NudgeId; action: 'mute' | 'unmute'; option?: MuteOption }[];
  goalChanges: { at: string; answers: CycleGoalAnswers }[];
  eventsByDay: Map<number, string[]>; // resumen legible de lo registrado cada día
}

// --- azar con semilla: el mismo JSON da siempre los mismos datos --------------------------------
function seeded(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = <T>(rand: () => number, v: Choice<T> | undefined): T | undefined =>
  v === undefined ? undefined : Array.isArray(v) ? v[Math.floor(rand() * v.length)] : v;
const num = (rand: () => number, v: Range | undefined, decimals = 0): number | undefined => {
  if (v === undefined) return undefined;
  if (typeof v === 'number') return v;
  const x = v[0] + rand() * (v[1] - v[0]);
  const f = 10 ** decimals;
  return Math.round(x * f) / f;
};

const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function dateAt(start: Date, day: number, time = '09:00') {
  const [h, m] = time.split(':').map(Number);
  const d = new Date(start);
  d.setDate(d.getDate() + day);
  d.setHours(h, m, 0, 0);
  return d;
}

// Convierte el JSON en registros con fechas reales, siendo `start` el día 0 (medianoche local)
export function expandPersona(p: Persona, start: Date): ExpandedPersona {
  const out: ExpandedPersona = {
    profile: p.profile,
    cycleGoal: p.cycleGoal ? { ...p.cycleGoal, answeredAt: dateAt(start, p.simulate.fromDay).toISOString() } : null,
    checkIns: [],
    workouts: [],
    meals: [],
    cycleStarts: [],
    temperatures: [],
    bowel: [],
    urine: [],
    sleepNights: [],
    medications: [],
    doses: [],
    prefActions: [],
    goalChanges: [],
    eventsByDay: new Map(),
  };
  const note = (day: number, text: string) => out.eventsByDay.set(day, [...(out.eventsByDay.get(day) ?? []), text]);
  let n = 0;
  const id = (type: string, day: number) => `${p.id}-${type}-${day}-${n++}`;

  const add = (type: PersonaEvent['type'] | PersonaSeries['type'], day: number, f: Record<string, any>, rand: () => number, time?: string) => {
    const at = dateAt(start, day, time ?? (type === 'temperature' ? '07:00' : type === 'bowel' || type === 'urine' ? '12:00' : '09:00'));
    const fecha = at.toISOString();
    const base = { id: id(type, day), fecha, createdAt: fecha };
    switch (type) {
      case 'check_in': {
        const e = {
          ...base,
          moment: (pick(rand, f.moment) as string) ?? 'mid_day',
          energy: num(rand, f.energy),
          mood: pick(rand, f.mood) as string | undefined,
          sleep: num(rand, f.sleep),
          note: f.note as string | undefined,
        };
        out.checkIns.push(e);
        note(day, `check-in (energy ${e.energy ?? '–'}${e.mood ? `, ${e.mood}` : ''})`);
        break;
      }
      case 'workout':
        out.workouts.push({ ...base, type: (f.workout as string) ?? 'strength', minutes: num(rand, f.minutes) ?? 40 });
        note(day, 'workout');
        break;
      case 'meal':
        out.meals.push(base);
        note(day, 'meal photo');
        break;
      case 'period_start':
        out.cycleStarts.push(base);
        note(day, 'period starts');
        break;
      case 'temperature': {
        const source = (f.source as 'manual' | 'wearable') ?? 'manual';
        const rise = typeof f.riseFromDay === 'number' && day >= f.riseFromDay ? Number(f.rise ?? 0.3) : 0;
        const celsius = Math.round(((num(rand, f.celsius, 2) ?? 36.4) + rise) * 100) / 100;
        out.temperatures.push({ ...base, celsius, source });
        note(day, `${source} temp ${celsius} °C`);
        break;
      }
      case 'sleep': {
        const minutes = num(rand, f.minutes) ?? 420;
        out.sleepNights.push({ date: dayKey(at), minutes });
        break;
      }
      case 'bowel': {
        const e: BowelEntry = {
          ...base,
          count: num(rand, f.count) ?? 1,
          color: pick(rand, f.color) as StoolColor | undefined,
          consistency: num(rand, f.consistency) as BristolType | undefined,
          note: f.note as string | undefined,
          explainedBy: f.explainedBy as string | undefined,
        };
        if (e.count === 0) {
          delete e.color;
          delete e.consistency;
        }
        out.bowel.push(e);
        note(day, `bowel ×${e.count}${e.color ? ` ${e.color}` : ''}${e.consistency ? ` type ${e.consistency}` : ''}`);
        break;
      }
      case 'urine': {
        const e: UrineEntry = {
          ...base,
          count: num(rand, f.count),
          nightCount: num(rand, f.nightCount),
          color: pick(rand, f.color) as UrineColor | undefined,
          burning: f.burning as boolean | undefined,
          voidVolume: f.voidVolume as VoidVolume | undefined,
          volumeUsual: f.volumeUsual as UrineEntry['volumeUsual'],
          dailyTotalMl: f.dailyTotalMl as number | undefined,
          note: f.note as string | undefined,
          explainedBy: f.explainedBy as string | undefined,
        };
        out.urine.push(e);
        note(day, `urine${e.count != null ? ` ×${e.count}` : ''}${e.color ? ` ${e.color}` : ''}`);
        break;
      }
      case 'mute':
        out.prefActions.push({ at: fecha, nudge: f.nudge as NudgeId, action: 'mute', option: (f.for as MuteOption) ?? '7d' });
        note(day, `mutes "${f.nudge}" for ${f.for ?? '7d'}`);
        break;
      case 'unmute':
        out.prefActions.push({ at: fecha, nudge: f.nudge as NudgeId, action: 'unmute' });
        note(day, `unmutes "${f.nudge}"`);
        break;
      case 'medication': {
        const item: MedicationItem = {
          ...base,
          id: (f.id as string) ?? base.id,
          name: (f.name as string) ?? 'Medication',
          kind: (f.kind as MedicationItem['kind']) ?? 'medication',
          dose: f.dose as string | undefined,
          schedule: (f.schedule as MedSchedule) ?? { type: 'times', times: ['09:00'] },
          course: f.courseDays ? { type: 'short', startDate: dayKey(at), days: Number(f.courseDays) } : { type: 'ongoing' },
          reminders: f.reminders !== false,
          remindersMutedUntil: f.muteForDays ? dateAt(start, day + Number(f.muteForDays)).toISOString() : undefined,
        };
        out.medications.push(item);
        note(day, `starts ${item.name}${item.remindersMutedUntil ? ' (reminders muted)' : ''}`);
        break;
      }
      case 'dose': {
        const scheduled = dateAt(start, day, (f.at as string) ?? '09:00');
        const logged = new Date(scheduled.getTime() + 10 * 60 * 1000).toISOString();
        out.doses.push({ id: id('dose', day), fecha: logged, createdAt: logged, medId: f.med as string, scheduledFor: scheduled.toISOString(), status: (f.status as DoseLog['status']) ?? 'taken' });
        break;
      }
      case 'cycle_goal':
        out.goalChanges.push({ at: fecha, answers: { ...(f.answers as CycleGoalAnswers), answeredAt: fecha } });
        note(day, `cycle goal: ${(f.answers as CycleGoalAnswers)?.goal}`);
        break;
    }
  };

  for (const [i, s] of (p.series ?? []).entries()) {
    const rand = seeded(`${p.id}#${i}`);
    if (s.type === 'period') {
      const length = Number(s.length ?? 28);
      for (let d = s.fromDay; d <= s.toDay; d += length) add('period_start', d, s, rand);
      continue;
    }
    for (let d = s.fromDay; d <= s.toDay; d += s.everyDays ?? 1) {
      if (s.skipChance && rand() < s.skipChance) continue;
      add(s.type, d, s, rand, s.time as string | undefined);
    }
  }
  for (const [i, e] of (p.events ?? []).entries()) add(e.type, e.day, e, seeded(`${p.id}@${i}`), e.time);

  const byDate = <T extends { fecha: string }>(a: T, b: T) => b.fecha.localeCompare(a.fecha);
  for (const list of [out.checkIns, out.workouts, out.meals, out.cycleStarts, out.temperatures, out.bowel, out.urine]) {
    (list as { fecha: string }[]).sort(byDate);
  }
  out.prefActions.sort((a, b) => a.at.localeCompare(b.at));
  out.goalChanges.sort((a, b) => a.at.localeCompare(b.at));
  return out;
}

const upTo = <T extends { fecha: string }>(list: T[], now: Date) => list.filter((e) => new Date(e.fecha) <= now);

// Lo que sabe el motor ese día: todo lo registrado hasta `now` y las preferencias vigentes
export function contextAt(x: ExpandedPersona, now: Date): { ctx: NudgeContext; prefs: NudgePrefs } {
  const goal = [...x.goalChanges].reverse().find((g) => new Date(g.at) <= now)?.answers ?? x.cycleGoal;
  const prefs: NudgePrefs = { muted: {} };
  for (const a of x.prefActions) {
    if (new Date(a.at) > now) break;
    if (a.action === 'unmute') delete prefs.muted[a.nudge];
    else prefs.muted[a.nudge] = { until: muteUntil(a.option ?? '7d', new Date(a.at)), setAt: a.at };
  }
  return {
    ctx: {
      now,
      profile: { sex: x.profile.sex, age: x.profile.age ?? null, conditions: x.profile.conditions ?? [] },
      checkIns: upTo(x.checkIns, now),
      workouts: upTo(x.workouts, now),
      meals: upTo(x.meals, now),
      cycleStarts: upTo(x.cycleStarts, now),
      cycleGoal: goal,
      temperatures: upTo(x.temperatures, now),
      bowel: upTo(x.bowel, now),
      urine: upTo(x.urine, now),
      sleepNights: x.sleepNights.filter((s) => s.date <= dayKey(now)),
      medications: x.medications.filter((m) => new Date(m.createdAt) <= now),
      doses: upTo(x.doses, now),
    },
    prefs,
  };
}

export interface SimulationDay {
  day: number;
  date: string;
  events: string[];
  decisions: NudgeDecision[];
}

export interface ExpectResult extends PersonaExpect {
  actual: NudgeStatus | 'missing';
  pass: boolean;
}

// Recorre los días del JSON evaluando los avisos cada tarde (20:00), como haría la app
export function simulatePersona(p: Persona, start: Date): { days: SimulationDay[]; expectations: ExpectResult[] } {
  const x = expandPersona(p, start);
  const log: NudgeLogEntry[] = [];
  const days: SimulationDay[] = [];
  for (let d = p.simulate.fromDay; d <= p.simulate.toDay; d++) {
    const now = dateAt(start, d, '20:00');
    const { ctx, prefs } = contextAt(x, now);
    const decisions = evaluateNudges(ctx, prefs, log);
    for (const dec of decisions) if (dec.status === 'send') log.push({ id: dec.id, at: now.toISOString() });
    days.push({ day: d, date: dayKey(now), events: x.eventsByDay.get(d) ?? [], decisions });
  }
  const expectations = (p.expect ?? []).map((e): ExpectResult => {
    const actual = days.find((d) => d.day === e.day)?.decisions.find((dec) => dec.id === e.nudge)?.status ?? 'missing';
    return { ...e, actual, pass: actual === e.status };
  });
  return { days, expectations };
}

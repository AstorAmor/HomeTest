import type { Persona, PersonaEvent, PersonaSeries } from './simulate';

// Constructor de casos (Developer mode → Build a case). En vez de escribir un JSON a mano, se
// eligen sexo, edad, qué va mal, con qué intensidad, desde cuándo y cada cuánto registra; sale un
// usuario simulado igual que los de simulation/personas, que el motor de avisos recorre día a día.
// El caso empieza con 8 semanas normales, para que el cambio se vea en contraste.

export type CaseProblem =
  | 'bp_high'
  | 'bp_spike'
  | 'glucose_high'
  | 'low_energy'
  | 'short_sleep'
  | 'dark_urine'
  | 'stool_colour'
  | 'no_bowel'
  | 'period_late'
  | 'stops_logging';

export type CaseSeverity = 'mild' | 'moderate' | 'severe';
export type CaseLogging = 'daily' | 'few_weekly' | 'weekly';

export interface CaseInput {
  sex: 'female' | 'male' | 'other';
  age: number;
  problem: CaseProblem;
  severity: CaseSeverity;
  days: number; // desde hace cuántos días pasa (hasta hoy, día 0)
  logging: CaseLogging;
  daysAhead: number; // cuántos días más se simulan después de hoy, si sigue igual
}

type Range = [number, number];

export interface CaseProblemInfo {
  id: CaseProblem;
  label: string;
  // Qué significa cada intensidad, para enseñarlo al elegir
  severity: Record<CaseSeverity, string> | null;
  durationLabel: string; // qué mide la duración en este caso
  femaleOnly?: boolean;
  automatic?: boolean; // datos que llegan solos (wearable): la frecuencia de registro no aplica
}

export const CASE_PROBLEMS: CaseProblemInfo[] = [
  {
    id: 'bp_high',
    label: 'High blood pressure (home monitor)',
    severity: { mild: '136–146 / 84–90', moderate: '146–158 / 90–98', severe: '160–176 / 98–108' },
    durationLabel: 'High for',
  },
  {
    id: 'bp_spike',
    label: 'One very high blood pressure reading today',
    severity: { mild: '182/104', moderate: '188/112', severe: '200/118' },
    durationLabel: 'Normal readings before, for',
  },
  {
    id: 'glucose_high',
    label: 'High glucose (home meter)',
    severity: { mild: '165–200 mg/dL', moderate: '180–230 mg/dL', severe: '220–300 mg/dL' },
    durationLabel: 'High for',
  },
  {
    id: 'low_energy',
    label: 'Low energy in check-ins',
    severity: { mild: 'energy 2–3 / 5', moderate: 'energy 1–2 / 5', severe: 'energy 1 / 5' },
    durationLabel: 'Low for',
  },
  {
    id: 'short_sleep',
    label: 'Short sleep (wearable)',
    severity: { mild: '5 h 30 – 6 h 15', moderate: '4 h 50 – 5 h 45', severe: '3 h 50 – 5 h' },
    durationLabel: 'Short for',
    automatic: true,
  },
  {
    id: 'dark_urine',
    label: 'Dark urine',
    severity: { mild: 'yellow or dark', moderate: 'dark or amber', severe: 'amber' },
    durationLabel: 'Dark for',
  },
  {
    id: 'stool_colour',
    label: 'Unusual stool colour',
    severity: { mild: 'pale', moderate: 'red', severe: 'black' },
    durationLabel: 'Since',
  },
  {
    id: 'no_bowel',
    label: 'No bowel movements',
    severity: null,
    durationLabel: 'None for',
  },
  {
    id: 'period_late',
    label: 'Late period',
    severity: null,
    durationLabel: 'Late by',
    femaleOnly: true,
  },
  {
    id: 'stops_logging',
    label: 'Stops using the app',
    severity: null,
    durationLabel: 'Nothing logged for',
  },
];

export const CASE_DURATIONS = [3, 7, 14, 28, 56, 84];
export const LOGGING_LABEL: Record<CaseLogging, string> = {
  daily: 'Every day',
  few_weekly: '3–4 times a week',
  weekly: 'Once a week',
};

const EVERY: Record<CaseLogging, number> = { daily: 1, few_weekly: 2, weekly: 7 };
const NAMES = { female: 'Clara', male: 'Carlos', other: 'Alex' };
const BASELINE_DAYS = 56;

const VALUES: Partial<Record<CaseProblem, Record<CaseSeverity, Record<string, unknown>>>> = {
  bp_high: {
    mild: { systolic: [136, 146], diastolic: [84, 90] },
    moderate: { systolic: [146, 158], diastolic: [90, 98] },
    severe: { systolic: [160, 176], diastolic: [98, 108] },
  },
  bp_spike: {
    mild: { systolic: 182, diastolic: 104 },
    moderate: { systolic: 188, diastolic: 112 },
    severe: { systolic: 200, diastolic: 118 },
  },
  glucose_high: {
    mild: { mgdl: [165, 200] },
    moderate: { mgdl: [180, 230] },
    severe: { mgdl: [220, 300] },
  },
  low_energy: {
    mild: { energy: [2, 3], mood: ['neutral', 'sad'] },
    moderate: { energy: [1, 2.4], mood: ['sad', 'stressed'] },
    severe: { energy: 1, mood: ['sad', 'anxious'] },
  },
  short_sleep: {
    mild: { minutes: [330, 375] },
    moderate: { minutes: [290, 345] },
    severe: { minutes: [230, 300] },
  },
  dark_urine: {
    mild: { color: ['yellow', 'dark'] },
    moderate: { color: ['dark', 'amber'] },
    severe: { color: 'amber' },
  },
  stool_colour: {
    mild: { color: 'pale' },
    moderate: { color: 'red' },
    severe: { color: 'black' },
  },
};

const NORMAL: Record<string, Record<string, unknown>> = {
  blood_pressure: { systolic: [112, 128] as Range, diastolic: [70, 82] as Range, time: '08:00' },
  glucose: { mgdl: [85, 135] as Range, mealType: ['desayuno', 'comida', 'cena'], time: '13:00' },
  check_in: { energy: [3, 5] as Range, mood: ['happy', 'calm', 'neutral'] },
  sleep: { minutes: [410, 490] as Range },
  urine: { color: ['pale', 'yellow'], count: [5, 7] as Range },
  bowel: { count: 1, color: ['brown', 'light_brown'], consistency: [3, 4] as Range },
};

const SEX_EN = { female: 'Woman', male: 'Man', other: 'Person' };
export const durationText = (d: number) => (d < 7 ? `${d} days` : d === 7 ? '1 week' : d % 7 ? `${d} days` : `${d / 7} weeks`);

export function caseId(c: CaseInput) {
  return `caso-${c.problem}-${c.severity}-${c.days}d-${c.sex}-${c.age}-${c.logging}`.replace(/_/g, '-');
}

export function buildCase(c: CaseInput): Persona {
  const info = CASE_PROBLEMS.find((p) => p.id === c.problem)!;
  const every = info.automatic ? 1 : EVERY[c.logging];
  const start = -c.days + 1; // primer día del problema (el día 0 cuenta)
  const before = start - BASELINE_DAYS;
  const series: PersonaSeries[] = [];
  const events: PersonaEvent[] = [];
  const v = VALUES[c.problem]?.[c.severity] ?? {};
  const normal = (type: PersonaSeries['type'], fromDay: number, toDay: number, extra: Record<string, unknown> = {}) =>
    series.push({ type, fromDay, toDay, everyDays: type === 'sleep' ? 1 : every, ...NORMAL[type], ...extra });
  const bad = (type: PersonaSeries['type'], fromDay: number, toDay: number) =>
    series.push({ type, fromDay, toDay, everyDays: type === 'sleep' ? 1 : every, ...NORMAL[type], ...v });

  // El problema sigue igual en los días que se simulan después de hoy
  const end = c.daysAhead;
  switch (c.problem) {
    case 'bp_high':
      normal('blood_pressure', before, start - 1);
      bad('blood_pressure', start, end);
      break;
    case 'bp_spike':
      normal('blood_pressure', start, -1);
      events.push({ day: 0, time: '08:30', type: 'blood_pressure', ...v });
      normal('blood_pressure', 1, end);
      break;
    case 'glucose_high':
      normal('glucose', before, start - 1);
      bad('glucose', start, end);
      break;
    case 'low_energy':
      normal('check_in', before, start - 1);
      bad('check_in', start, end);
      break;
    case 'short_sleep':
      normal('sleep', before, start - 1);
      bad('sleep', start, end);
      break;
    case 'dark_urine':
      normal('urine', before, start - 1);
      bad('urine', start, end);
      break;
    case 'stool_colour':
      normal('bowel', before, start - 1);
      bad('bowel', start, end);
      break;
    case 'no_bowel':
      normal('bowel', before, start - 1);
      series.push({ type: 'bowel', fromDay: start, toDay: end, everyDays: every, count: 0 });
      break;
    case 'period_late': {
      // Ciclos regulares de 28 días; la última regla empezó hace 28 + días de retraso
      const last = -(28 + c.days);
      series.push({ type: 'period', fromDay: last - 28 * 6, toDay: last, length: 28 });
      series.push({ type: 'check_in', fromDay: last - 28 * 2, toDay: end, everyDays: every, ...NORMAL.check_in });
      break;
    }
    case 'stops_logging':
      series.push({ type: 'check_in', fromDay: start - 42, toDay: start - 1, everyDays: every, ...NORMAL.check_in });
      break;
  }

  const sev = info.severity ? ` (${info.severity[c.severity]})` : '';
  const sex = c.sex === 'other' ? 'other' : c.sex;
  const logs = info.automatic ? 'data from the wearable every night' : `logs ${LOGGING_LABEL[c.logging].toLowerCase()}`;
  return {
    id: caseId(c),
    name: NAMES[c.sex],
    summary: `${SEX_EN[c.sex]}, ${c.age}. ${info.label}${sev}: ${info.durationLabel.toLowerCase()} ${durationText(c.days)} up to today; ${logs}.`,
    tests: 'Generated case (no checks): see which notifications go out each day and why.',
    profile: { sex, age: c.age, firstName: NAMES[c.sex] },
    simulate: { fromDay: Math.max(start - 7, before), toDay: c.daysAhead },
    series,
    events,
  };
}

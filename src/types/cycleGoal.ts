import { SexFrequency, Timing, TryingFor } from '@/logic/fertility';

// Qué busca la usuaria con el seguimiento del ciclo y cómo son sus ciclos (encuesta de la primera vez,
// tipo Flo). Se guarda en user_flags, clave "cycle_goal". Todo lo añadido el 2026-10-21 es opcional:
// las respuestas guardadas antes siguen valiendo.

export type CycleGoal = 'track' | 'conceive' | 'symptoms' | 'perimenopause';

export type Flow = 'light' | 'medium' | 'heavy' | 'very_heavy' | 'unsure';
export type PeriodPain = 'none' | 'mild' | 'moderate' | 'severe';
export type Contraception =
  | 'none'
  | 'condom'
  | 'pill'
  | 'minipill'
  | 'hormonal_iud'
  | 'copper_iud'
  | 'implant'
  | 'ring'
  | 'patch'
  | 'injection'
  | 'other';

export interface CycleGoalAnswers {
  // La principal (la de embarazo si la eligió): la usan el panel del ciclo y los avisos
  goal: CycleGoal;
  goals?: CycleGoal[]; // todas las que eligió (varias a la vez)
  lastPeriodStart?: string | null; // YYYY-MM-DD; null = no lo recuerda
  cycleLength?: number | null; // días de un primer día de regla al siguiente; null = no lo sabe
  periodLength?: number | null; // días que suele durar la regla; null = no lo sabe
  regularCycles: 'yes' | 'no' | 'unsure';
  flow?: Flow;
  pain?: PeriodPain;
  symptoms?: string[]; // ids de SYMPTOM_OPTIONS
  contraception?: Contraception;
  // Lo que había antes (pill / hormonal_iud / other / none); se sigue rellenando a partir de `contraception`
  hormonalContraception?: 'none' | 'pill' | 'hormonal_iud' | 'other';
  conditions?: string[]; // diagnosticadas por un médico: ids de CONDITION_OPTIONS
  // Solo si busca embarazo (todas opcionales salvo el tiempo)
  tryingFor?: TryingFor;
  frequency?: SexFrequency;
  timing?: Timing;
  // Temperatura basal: si quiere registrarla y si se cruza con la del wearable
  logTemperature?: boolean;
  answeredAt: string;
}

export const CYCLE_GOAL_OPTIONS: { id: CycleGoal; title: string; subtitle: string; icon: string }[] = [
  { id: 'track', title: 'Track my period and cycle', subtitle: 'Know when it is coming and how it changes', icon: 'calendar-outline' },
  { id: 'conceive', title: 'Get pregnant', subtitle: 'Find my fertile days and know when to ask for help', icon: 'heart-outline' },
  { id: 'symptoms', title: 'Understand my symptoms', subtitle: 'Pain, PMS, mood, skin or energy through the month', icon: 'pulse-outline' },
  { id: 'perimenopause', title: 'Navigate perimenopause', subtitle: 'Changes in my cycle in my 40s and 50s', icon: 'leaf-outline' },
];

// La principal si eligió varias: embarazo, luego perimenopausia, síntomas y seguimiento
export const primaryGoal = (goals: CycleGoal[]): CycleGoal =>
  (['conceive', 'perimenopause', 'symptoms', 'track'] as CycleGoal[]).find((g) => goals.includes(g)) ?? 'track';

export const SYMPTOM_OPTIONS: { id: string; label: string }[] = [
  { id: 'cramps', label: 'Cramps' },
  { id: 'headache', label: 'Headache' },
  { id: 'bloating', label: 'Bloating' },
  { id: 'breasts', label: 'Tender breasts' },
  { id: 'acne', label: 'Acne' },
  { id: 'mood', label: 'Mood swings' },
  { id: 'fatigue', label: 'Tiredness' },
  { id: 'cravings', label: 'Cravings' },
  { id: 'backache', label: 'Back pain' },
  { id: 'sleep', label: 'Trouble sleeping' },
  { id: 'none', label: 'None of these' },
];

export const CONTRACEPTION_OPTIONS: { id: Contraception; label: string }[] = [
  { id: 'none', label: 'None' },
  { id: 'condom', label: 'Condoms' },
  { id: 'pill', label: 'Combined pill' },
  { id: 'minipill', label: 'Progestogen-only pill' },
  { id: 'hormonal_iud', label: 'Hormonal IUD' },
  { id: 'copper_iud', label: 'Copper IUD' },
  { id: 'implant', label: 'Implant' },
  { id: 'ring', label: 'Vaginal ring' },
  { id: 'patch', label: 'Patch' },
  { id: 'injection', label: 'Injection' },
  { id: 'other', label: 'Other' },
];

// Para lo que ya usaba la versión anterior (avisos, predicción): ¿hay hormonas de por medio?
export const hormonalFrom = (c?: Contraception): CycleGoalAnswers['hormonalContraception'] =>
  !c ? undefined : c === 'none' || c === 'condom' || c === 'copper_iud' ? 'none' : c === 'pill' ? 'pill' : c === 'hormonal_iud' ? 'hormonal_iud' : 'other';

export const CONDITION_OPTIONS: { id: string; label: string }[] = [
  { id: 'pcos', label: 'PCOS (polycystic ovary syndrome)' },
  { id: 'endometriosis', label: 'Endometriosis' },
  { id: 'thyroid', label: 'Thyroid problems' },
  { id: 'fibroids', label: 'Fibroids' },
  { id: 'anaemia', label: 'Anaemia' },
  { id: 'none', label: 'None of these' },
];

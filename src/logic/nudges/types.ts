import { BowelEntry, UrineEntry } from '@/types/bathroom';
import { CycleGoalAnswers } from '@/types/cycleGoal';
import { DoseLog, MedicationItem } from '@/types/medication';

// Avisos (notificaciones) que la app decide mandar según lo que el usuario registra o deja de
// registrar. Lógica pura: la misma en la app, en el simulador de usuarios y en los tests.

export type NudgeId =
  | 'inactive_7d'
  | 'checkin_missed_3d'
  | 'low_energy_3d'
  | 'short_sleep_3n'
  | 'period_late'
  | 'fertility_doctor'
  | 'temperature_reminder'
  | 'bowel_none_3d'
  | 'stool_colour'
  | 'urine_dark'
  | 'bathroom_weekly'
  | 'medication_missed';

export type NudgeCategory = 'engagement' | 'wellbeing' | 'cycle' | 'digestive' | 'urinary' | 'medication';

// Lo que sabe el motor en un momento dado (todo con fechas ISO)
export interface NudgeContext {
  now: Date;
  profile: { sex?: string; age?: number | null; conditions?: string[] };
  checkIns: { fecha: string; energy?: number; mood?: string; sleep?: number }[];
  workouts: { fecha: string }[];
  meals: { fecha: string }[];
  cycleStarts: { fecha: string }[];
  cycleGoal?: CycleGoalAnswers | null;
  temperatures: { fecha: string; celsius: number; source: 'manual' | 'wearable' }[];
  bowel: BowelEntry[];
  urine: UrineEntry[];
  sleepNights: { date: string; minutes: number }[]; // solo datos reales de wearable
  medications?: MedicationItem[]; // solo si ha activado el seguimiento de medicación
  doses?: DoseLog[];
}

export interface NudgeCheck {
  due: boolean;
  reason: string; // por qué sí o por qué no: es lo que se enseña al supervisar
  title?: string;
  body?: string;
  route?: string; // pantalla que abre el aviso
}

export interface NudgeRule {
  id: NudgeId;
  category: NudgeCategory;
  label: string; // nombre corto para los ajustes ("Inactivity reminder")
  cooldownDays: number; // mínimo entre dos avisos iguales
  evaluate: (ctx: NudgeContext) => NudgeCheck;
}

export type MuteOption = '7d' | '1m' | '3m' | 'forever';

export const MUTE_OPTIONS: { id: MuteOption; label: string }[] = [
  { id: '7d', label: '7 days' },
  { id: '1m', label: '1 month' },
  { id: '3m', label: '3 months' },
  { id: 'forever', label: "Don't send this again" },
];

export interface NudgePrefs {
  // until = null → silenciado para siempre (hasta que lo reactive)
  muted: Partial<Record<NudgeId, { until: string | null; setAt: string }>>;
}

export interface NudgeLogEntry {
  id: NudgeId;
  at: string;
}

export type NudgeStatus = 'send' | 'muted' | 'cooldown' | 'daily_limit' | 'not_due';

export interface NudgeDecision {
  id: NudgeId;
  category: NudgeCategory;
  label: string;
  status: NudgeStatus;
  reason: string;
  title?: string;
  body?: string;
  route?: string;
}

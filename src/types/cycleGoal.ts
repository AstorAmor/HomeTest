import { SexFrequency, Timing, TryingFor } from '@/logic/fertility';

// Qué busca la usuaria con el seguimiento del ciclo (encuesta de la primera vez, tipo Flo).
// Se guarda en user_flags, clave "cycle_goal".

export type CycleGoal = 'track' | 'conceive' | 'symptoms' | 'perimenopause';

export interface CycleGoalAnswers {
  goal: CycleGoal;
  regularCycles: 'yes' | 'no' | 'unsure';
  hormonalContraception?: 'none' | 'pill' | 'hormonal_iud' | 'other';
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

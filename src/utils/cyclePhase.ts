import { CycleEntry } from '@/types/cycle';

export type CyclePhaseId = 'menstrual' | 'follicular' | 'ovulation' | 'luteal';

export interface CyclePhaseInfo {
  day: number; // día del ciclo (1 = primer día de regla)
  length: number;
  phase: CyclePhaseId;
  label: string;
  hint: string;
  isSample: boolean;
}

export const PHASE_COLORS: Record<CyclePhaseId, string> = {
  menstrual: '#E06B9E',
  follicular: '#9B8CFF',
  ovulation: '#3ECDB8',
  luteal: '#F0B84D',
};

const PHASE_TEXT: Record<CyclePhaseId, { label: string; hint: string }> = {
  menstrual: { label: 'Menstrual phase', hint: 'Energy can be lower. Be kind to yourself.' },
  follicular: { label: 'Follicular phase', hint: 'Energy usually rises. Good moment for harder training.' },
  ovulation: { label: 'Ovulation window', hint: 'Often peak energy and mood.' },
  luteal: { label: 'Luteal phase', hint: 'Sleep and mood can dip. Prioritise recovery.' },
};

// Límites de fase para un ciclo de longitud L (aproximación estándar:
// ovulación ~14 días antes del siguiente periodo).
export function phaseBoundaries(length: number) {
  const ovulationDay = Math.max(10, length - 14);
  return { menstrualEnd: 5, ovulationStart: ovulationDay - 1, ovulationEnd: ovulationDay + 1 };
}

// Día y fase del ciclo a partir de los registros de inicio de regla. Longitud =
// mediana de los últimos ciclos (28 si no hay suficientes). Sin registros, se usa
// un ejemplo para la demo.
export function currentCyclePhase(entries: CycleEntry[], today = new Date()): CyclePhaseInfo {
  const starts = entries.map((e) => new Date(e.fecha).getTime()).sort((a, b) => a - b);
  const isSample = starts.length === 0;
  const lastStart = isSample ? today.getTime() - 11 * 24 * 3600 * 1000 : starts[starts.length - 1];

  let length = 28;
  if (starts.length >= 2) {
    const gaps = starts.slice(1).map((s, i) => Math.round((s - starts[i]) / (24 * 3600 * 1000)));
    const sorted = gaps.slice(-6).sort((a, b) => a - b);
    length = sorted[Math.floor(sorted.length / 2)];
  }

  const day = Math.floor((today.getTime() - lastStart) / (24 * 3600 * 1000)) % length + 1;
  const { menstrualEnd, ovulationStart, ovulationEnd } = phaseBoundaries(length);
  const phase: CyclePhaseId =
    day <= menstrualEnd
      ? 'menstrual'
      : day < ovulationStart
        ? 'follicular'
        : day <= ovulationEnd
          ? 'ovulation'
          : 'luteal';

  return { day, length, phase, ...PHASE_TEXT[phase], isSample };
}

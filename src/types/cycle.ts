// Fase de ciclo relevante para ajustar rangos de referencia hormonales (ver
// src/logic/rulesEngine/cycleAdjustment.ts). 'none' cubre explícitamente a
// usuarios sin ciclo con relevancia clínica para el ajuste: hombres,
// menopausia confirmada, o anticoncepción hormonal (que aplana el ciclo
// natural) -- no es lo mismo que "sin dato", que se representa como `null`
// en el resto del motor.
export type CyclePhase = 'menstrual' | 'follicular' | 'ovulation' | 'luteal' | 'none';

export interface CycleEntry {
  id: string;
  fecha: string; // ISO date del primer día de sangrado (inicio de ciclo)
  endFecha?: string | null; // ISO date del último día de sangrado (duración del periodo)
  createdAt: string;
}

export interface CyclePrediction {
  predicted_next_start: string;
  window_days: number;
  median_cycle_length: number;
  avg_cycle_length: number;
  std_dev_days: number;
  cycles_used: number;
  cycles_logged: number;
  confidence: 'low' | 'medium' | 'high';
  is_late: boolean;
  days_late: number;
  error?: string;
}

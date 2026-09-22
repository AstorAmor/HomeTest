export interface CycleEntry {
  id: string;
  fecha: string; // ISO date del primer día de sangrado (inicio de ciclo)
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

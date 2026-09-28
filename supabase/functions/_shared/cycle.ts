// Predicción del próximo periodo (antes: script Python en Windmill). Mismo método:
// mediana de los últimos 6 ciclos + ventana de incertidumbre por desviación
// estándar (acotada 2-7 días). Determinista, sin ML; mejora con más datos.
// Más adelante, un modelo poblacional (con consentimiento) iría aquí.

const DAY_MS = 24 * 3600 * 1000;

export interface CyclePredictionResult {
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
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

// Redondeo "del banquero" como round() de Python, para dar los mismos resultados.
const pyRound = (x: number) => {
  const r = Math.round(x);
  return Math.abs(x % 1) === 0.5 && r % 2 !== 0 ? r - 1 : r;
};

const toUtcDay = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));

export function predictCycle(
  cycleStarts: string[],
  today = new Date()
): CyclePredictionResult | { error: string; cycles_logged: number } {
  if (cycleStarts.length < 2) {
    return {
      error: 'At least 2 logged cycles are needed to predict',
      cycles_logged: cycleStarts.length,
    };
  }

  const dates = cycleStarts.map(toUtcDay).sort((a, b) => a - b);
  const lengths = dates.slice(1).map((d, i) => Math.round((d - dates[i]) / DAY_MS));
  const recent = lengths.slice(-6);

  const medianLength = median(recent);
  const avgLength = recent.reduce((a, b) => a + b, 0) / recent.length;
  const stdDev =
    recent.length > 1 ? Math.sqrt(recent.reduce((a, b) => a + (b - avgLength) ** 2, 0) / recent.length) : 0;

  const windowDays = Math.max(2, Math.min(7, pyRound(stdDev)));
  const predictedNext = dates[dates.length - 1] + pyRound(medianLength) * DAY_MS;
  const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const daysSincePredicted = Math.floor((todayUtc - predictedNext) / DAY_MS);
  const isLate = daysSincePredicted > windowDays;
  const n = recent.length;

  return {
    predicted_next_start: new Date(predictedNext).toISOString().slice(0, 10),
    window_days: windowDays,
    median_cycle_length: medianLength,
    avg_cycle_length: Math.round(avgLength * 10) / 10,
    std_dev_days: Math.round(stdDev * 10) / 10,
    cycles_used: n,
    cycles_logged: dates.length,
    confidence: n < 3 ? 'low' : n < 5 ? 'medium' : 'high',
    is_late: isLate,
    days_late: isLate ? Math.max(0, daysSincePredicted) : 0,
  };
}

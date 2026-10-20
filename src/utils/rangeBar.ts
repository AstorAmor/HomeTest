// Barra de rango de un valor de laboratorio: dónde caen (en % del ancho) los límites del laboratorio y
// el valor. Se deja margen a los lados para que se vea por dónde queda fuera, y el valor siempre cabe.
// Igual que rangeText: un mínimo de 0 cuenta como si solo hubiera máximo ("< 5").

export interface RangeBarLayout {
  minPct: number | null; // límite inferior (null = no hay)
  maxPct: number | null; // límite superior
  valuePct: number;
}

export function rangeBarLayout(value: number, min: number | null, max: number | null): RangeBarLayout | null {
  const low = min !== null && min > 0 ? min : null;
  if (low === null && max === null) return null;
  let lo: number;
  let hi: number;
  if (low !== null && max !== null) {
    const span = max - low > 0 ? max - low : Math.abs(max) * 0.1 || 1;
    lo = Math.min(low - span * 0.4, value - span * 0.1);
    hi = Math.max(max + span * 0.4, value + span * 0.1);
    if (value >= 0) lo = Math.max(lo, 0);
  } else if (max !== null) {
    lo = 0;
    hi = Math.max(max * 1.5, value * 1.1);
  } else {
    lo = Math.max(0, Math.min(low! * 0.5, value * 0.9));
    hi = Math.max(low! * 1.8, value * 1.1);
  }
  if (!(hi > lo)) hi = lo + 1;
  const pct = (x: number) => Math.max(0, Math.min(100, ((x - lo) / (hi - lo)) * 100));
  return { minPct: low !== null ? pct(low) : null, maxPct: max !== null ? pct(max) : null, valuePct: pct(value) };
}

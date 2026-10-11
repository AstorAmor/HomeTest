// "Edad KUOVA": un único número de edad biológica (el centro del intervalo de PhenoAge) y un
// grado de confianza en lugar del intervalo. La confianza baja cuanto más ancho es el intervalo
// (variación normal de la analítica): 4 puntos por cada año de anchura, entre 40 % y 95 %.
// Orientativo; el cálculo real sigue pendiente de validar con el asesor médico.

export type KuovaAgeQuality = 'high' | 'good' | 'rough';

export interface KuovaAge {
  age: number; // años, con un decimal
  diff: number; // edad real - Edad KUOVA (positivo = más joven)
  confidence: number; // %
  quality: KuovaAgeQuality;
}

const round1 = (v: number) => Math.round(v * 10) / 10;

export function kuovaAge(p: { low: number; high: number; chronological_age: number }): KuovaAge {
  const age = round1((p.low + p.high) / 2);
  const confidence = Math.round(Math.max(40, Math.min(95, 100 - (p.high - p.low) * 4)));
  return {
    age,
    diff: round1(p.chronological_age - age),
    confidence,
    quality: confidence >= 80 ? 'high' : confidence >= 65 ? 'good' : 'rough',
  };
}

export const QUALITY_LABEL: Record<KuovaAgeQuality, string> = {
  high: 'High-quality estimate with minor uncertainty',
  good: 'Good estimate, with some uncertainty',
  rough: 'Rough estimate: repeat the test to confirm it',
};

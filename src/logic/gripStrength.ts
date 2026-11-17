// Fuerza de agarre (dinamómetro de mano): valores de referencia por edad y sexo de Dodds RM, Syddall HE, Cooper R
// y cols. «Grip strength across the life course: normative data from twelve British studies». PLoS One
// 2014;9(12):e113637 (doi 10.1371/journal.pone.0113637), tabla 2. Doce estudios de población general de Gran
// Bretaña, 60.803 mediciones de 49.964 personas de 4 a 90+ años; en cada uno, el mejor intento (hasta 6, con las
// dos manos) con dinamómetros Jamar, Smedley, Nottingham o Takei. Centiles 10, 25, 50, 75 y 90 en kg, modelados
// (GAMLSS) a la edad exacta de cada fila; la tabla da 5 años de separación y su n cuenta a quien tenía esa edad
// ± 2,5 años, así que cada fila vale para su edad ± 2 (18-22, 23-27… y 88 o más).
// Se eligió frente a otras porque es la que cubre toda la vida adulta con más gente y la que usa el consenso
// europeo de sarcopenia (EWGSOP2, 2019) para sus puntos de corte. Orientativo; pendiente de revisión médica.
// Igual que el VO2max (src/logic/vo2max.ts): un valor se lee frente a la gente de su edad y sexo, por percentiles.

export type GripSex = 'male' | 'female';
export type GripBand = 'low' | 'fair' | 'good' | 'excellent' | 'superior';

export interface GripRow {
  age: number; // la edad exacta de la tabla (20, 25… 90)
  p: [number, number, number, number, number]; // p10, p25, p50, p75, p90 en kg
}

export const DODDS_GRIP: Record<GripSex, GripRow[]> = {
  male: [
    { age: 20, p: [30, 35, 40, 46, 52] },
    { age: 25, p: [36, 41, 48, 55, 61] },
    { age: 30, p: [38, 44, 51, 58, 64] },
    { age: 35, p: [39, 45, 51, 58, 64] },
    { age: 40, p: [38, 44, 50, 57, 63] },
    { age: 45, p: [36, 42, 49, 56, 61] },
    { age: 50, p: [35, 41, 48, 54, 60] },
    { age: 55, p: [34, 40, 47, 53, 59] },
    { age: 60, p: [33, 39, 45, 51, 56] },
    { age: 65, p: [31, 37, 43, 48, 53] },
    { age: 70, p: [29, 34, 39, 44, 49] },
    { age: 75, p: [26, 31, 35, 41, 45] },
    { age: 80, p: [23, 27, 32, 37, 42] },
    { age: 85, p: [19, 24, 29, 33, 38] },
    { age: 90, p: [16, 20, 25, 29, 33] },
  ],
  female: [
    { age: 20, p: [21, 24, 28, 32, 36] },
    { age: 25, p: [23, 26, 30, 35, 38] },
    { age: 30, p: [24, 27, 31, 35, 39] },
    { age: 35, p: [23, 27, 31, 35, 39] },
    { age: 40, p: [23, 27, 31, 35, 39] },
    { age: 45, p: [22, 26, 30, 34, 38] },
    { age: 50, p: [21, 25, 29, 33, 37] },
    { age: 55, p: [19, 23, 28, 32, 35] },
    { age: 60, p: [18, 22, 27, 31, 34] },
    { age: 65, p: [17, 21, 25, 29, 33] },
    { age: 70, p: [16, 20, 24, 27, 31] },
    { age: 75, p: [14, 18, 21, 25, 28] },
    { age: 80, p: [13, 16, 19, 23, 26] },
    { age: 85, p: [11, 14, 17, 20, 23] },
    { age: 90, p: [9, 11, 14, 17, 20] },
  ],
};

const FIRST_AGE = 20;
const LAST_AGE = 90;

// La fila de una edad: la de la edad de la tabla más cercana (22 → 20, 23 → 25). Por debajo de 20 se usa la de 20
// y por encima de 90, la de 90
export function gripRowFor(age: number, sex: GripSex): GripRow {
  const rows = DODDS_GRIP[sex];
  const at = Math.max(FIRST_AGE, Math.min(LAST_AGE, Math.round(age / 5) * 5));
  return rows.find((r) => r.age === at) ?? rows[0];
}

// Las edades que cubre cada fila, para la tabla: «18-22», «23-27»… y «88+» la última
export function gripAgeLabel(row: GripRow): string {
  return row.age >= LAST_AGE ? `${row.age - 2}+` : `${row.age - 2}-${row.age + 2}`;
}

// Dónde queda un valor frente a la gente de su edad y sexo (como el VO2max):
// < p25 bajo · p25-p50 aceptable · p50-p75 bueno · p75-p90 excelente · >= p90 superior
export function gripBand(value: number, age: number, sex: GripSex): GripBand {
  const [, p25, p50, p75, p90] = gripRowFor(age, sex).p;
  if (value >= p90) return 'superior';
  if (value >= p75) return 'excellent';
  if (value >= p50) return 'good';
  if (value >= p25) return 'fair';
  return 'low';
}

// Con «nivel» y no como los del VO2max: en español, «fuerza» es femenino y «Bueno para tu edad» no concordaría
export const GRIP_BAND_LABEL: Record<GripBand, string> = {
  low: 'Low level for your age',
  fair: 'Fair level for your age',
  good: 'Good level for your age',
  excellent: 'Excellent level for your age',
  superior: 'Superior level for your age',
};

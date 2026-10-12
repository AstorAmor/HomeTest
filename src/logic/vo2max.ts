// VO2max: valores de referencia por edad y sexo del registro FRIEND (Kaminsky LA, Arena R, Myers J.
// Mayo Clin Proc 2015;90(11):1515-23, tabla 3: prueba de esfuerzo en cinta con análisis de gases,
// adultos sin enfermedad cardiovascular). Percentiles 10, 25, 50, 75 y 90 en mL/kg/min.
// Orientativo: en bicicleta los valores salen algo más bajos; pendiente de revisión médica.

export type Vo2Sex = 'male' | 'female';
export type Vo2Band = 'low' | 'fair' | 'good' | 'excellent' | 'superior';

export interface Vo2Row {
  ages: [number, number];
  p: [number, number, number, number, number]; // p10, p25, p50, p75, p90
}

export const FRIEND_VO2MAX: Record<Vo2Sex, Vo2Row[]> = {
  male: [
    { ages: [20, 29], p: [32.1, 40.1, 48.0, 55.2, 61.8] },
    { ages: [30, 39], p: [30.2, 35.9, 42.4, 49.2, 56.5] },
    { ages: [40, 49], p: [26.8, 31.9, 37.8, 45.0, 52.1] },
    { ages: [50, 59], p: [22.8, 27.1, 32.6, 39.7, 45.6] },
    { ages: [60, 69], p: [19.8, 23.7, 28.2, 34.5, 40.3] },
    { ages: [70, 79], p: [17.1, 20.4, 24.4, 30.4, 36.6] },
  ],
  female: [
    { ages: [20, 29], p: [23.9, 30.5, 37.6, 44.7, 51.3] },
    { ages: [30, 39], p: [20.9, 25.3, 30.2, 36.1, 41.4] },
    { ages: [40, 49], p: [18.8, 22.1, 26.7, 32.4, 38.4] },
    { ages: [50, 59], p: [17.3, 19.9, 23.4, 27.6, 32.0] },
    { ages: [60, 69], p: [14.6, 17.2, 20.0, 23.8, 27.0] },
    { ages: [70, 79], p: [13.6, 15.6, 18.3, 20.8, 23.1] },
  ],
};

// Fila de la edad (por debajo de 20 se usa la de 20-29 y por encima de 79 la de 70-79)
export function vo2RowFor(age: number, sex: Vo2Sex): Vo2Row {
  const rows = FRIEND_VO2MAX[sex];
  return rows.find((r) => age >= r.ages[0] && age <= r.ages[1]) ?? (age < 20 ? rows[0] : rows[rows.length - 1]);
}

// Dónde queda un valor frente a la gente de su edad y sexo:
// < p25 bajo · p25-p50 aceptable · p50-p75 bueno · p75-p90 excelente · >= p90 superior
export function vo2Band(value: number, age: number, sex: Vo2Sex): Vo2Band {
  const [, p25, p50, p75, p90] = vo2RowFor(age, sex).p;
  if (value >= p90) return 'superior';
  if (value >= p75) return 'excellent';
  if (value >= p50) return 'good';
  if (value >= p25) return 'fair';
  return 'low';
}

export const VO2_BAND_LABEL: Record<Vo2Band, string> = {
  low: 'Low for your age',
  fair: 'Fair for your age',
  good: 'Good for your age',
  excellent: 'Excellent for your age',
  superior: 'Superior for your age',
};

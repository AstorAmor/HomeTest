import { DailyWearableRecord, WearableMetric } from '../types';

// Datos DUMMY con la forma de lo que dará Huawei Health: 14 días de pasos,
// pulso en reposo, VFC, sueño, calorías activas y temperatura. Deterministas (misma salida cada vez) para que
// las pruebas sean reproducibles. Se sustituirán por el adaptador real de
// Huawei Health Kit cuando la cuenta de desarrollador tenga esos permisos.
const SOURCE = 'Huawei Health (dummy)';

// Pseudoaleatorio determinista a partir de un entero.
const noise = (seed: number) => {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x); // 0..1
};

export function generateHuaweiDummy(days = 14, today = new Date()): DailyWearableRecord[] {
  const records: DailyWearableRecord[] = [];
  const push = (date: string, metric: WearableMetric, value: number, rawTypeName: string) =>
    records.push({
      date,
      metric,
      value,
      sourceName: SOURCE,
      provider: 'huawei_dummy',
      rawTypeId: metric,
      rawTypeName,
    });

  for (let i = 0; i < days; i++) {
    const d = new Date(today.getTime() - i * 24 * 3600 * 1000);
    const date = d.toISOString().slice(0, 10);
    const weekend = d.getDay() === 0 || d.getDay() === 6;
    // Los últimos 3 días simulan una mala racha (menos sueño, pulso más alto, VFC más baja)
    // para poder probar las reglas de la sección 5.2 del documento de diseño.
    const badStreak = i < 3;
    push(date, 'steps', Math.round((weekend ? 5200 : 8400) + noise(i) * 3000), 'Steps');
    push(date, 'resting_heart_rate', Math.round(58 + noise(i + 100) * 4 + (badStreak ? 6 : 0)), 'Resting heart rate');
    push(date, 'hrv', Math.round(48 + noise(i + 200) * 10 - (badStreak ? 12 : 0)), 'HRV (RMSSD)');
    push(date, 'sleep_duration', Math.round(410 + noise(i + 300) * 60 - (badStreak ? 90 : 0)), 'Sleep (minutes)');
    push(date, 'active_energy', Math.round((weekend ? 380 : 520) + noise(i + 400) * 180), 'Active calories (kcal)');
    push(date, 'body_temperature', Math.round((36.5 + noise(i + 500) * 0.4 + (badStreak ? 0.2 : 0)) * 10) / 10, 'Body temperature (°C)');
  }
  return records;
}

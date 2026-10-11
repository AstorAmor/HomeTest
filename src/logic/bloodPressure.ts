// Semáforo de cada toma de tensión (el check verde, amarillo o rojo del historial), con los
// cortes de la guía europea ESC/ESH 2018 para la consulta: óptima/normal por debajo de 130/85,
// normal-alta 130-139 / 85-89 e hipertensión desde 140/90. La tensión baja (< 90/60) también
// se marca en amarillo. Orientativo, no diagnóstico (pendiente de revisión médica).

export type BpLevel = 'ok' | 'watch' | 'high';

export function bpLevel(systolic: number, diastolic: number): BpLevel {
  if (systolic >= 140 || diastolic >= 90) return 'high';
  if (systolic >= 130 || diastolic >= 85 || systolic < 90 || diastolic < 60) return 'watch';
  return 'ok';
}

export function bpLabel(systolic: number, diastolic: number): string {
  const level = bpLevel(systolic, diastolic);
  if (level === 'high') return 'High';
  if (level === 'watch') return systolic < 90 || diastolic < 60 ? 'Low' : 'High-normal';
  return 'In range';
}

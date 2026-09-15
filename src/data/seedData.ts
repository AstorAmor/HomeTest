import { saveBloodPressureEntry } from './bloodPressureRepository';
import { saveGlucoseEntry } from './glucoseRepository';
import { cholesterolRepository } from './cholesterolRepository';
import { cortisolRepository } from './cortisolRepository';
import { MealType } from '@/types/glucose';
import bloodPressureSeed from './seed/bloodPressureSeed.json';
import glucoseSeed from './seed/glucoseSeed.json';
import cholesterolSeed from './seed/cholesterolSeed.json';
import cortisolSeed from './seed/cortisolSeed.json';

// Convierte "2026-06-01 08:30" (fácil de editar a mano) a ISO estricto
function toIso(fecha: string): string {
  return new Date(fecha.replace(' ', 'T')).toISOString();
}

export async function loadSeedData(): Promise<{
  bloodPressure: number;
  glucose: number;
  cholesterol: number;
  cortisol: number;
}> {
  for (const item of bloodPressureSeed as {
    systolic: number;
    diastolic: number;
    pulse: number | null;
    fecha: string;
  }[]) {
    await saveBloodPressureEntry({
      id: `seed-bp-${item.fecha}`,
      systolic: item.systolic,
      diastolic: item.diastolic,
      pulse: item.pulse,
      fecha: toIso(item.fecha),
      source: 'manual',
      createdAt: new Date().toISOString(),
    });
  }

  for (const item of glucoseSeed as {
    valor: number;
    unidad: 'mg/dL' | 'mmol/L';
    fecha: string;
    mealType: MealType;
  }[]) {
    await saveGlucoseEntry({
      id: `seed-glucose-${item.fecha}`,
      valor: item.valor,
      unidad: item.unidad,
      fecha: toIso(item.fecha),
      mealType: item.mealType,
      createdAt: new Date().toISOString(),
    });
  }

  for (const item of cholesterolSeed as { valor: number; unidad: string; fecha: string }[]) {
    await cholesterolRepository.save({
      id: `seed-cholesterol-${item.fecha}`,
      valor: item.valor,
      unidad: item.unidad,
      fecha: toIso(item.fecha),
      createdAt: new Date().toISOString(),
    });
  }

  for (const item of cortisolSeed as { valor: number; unidad: string; fecha: string }[]) {
    await cortisolRepository.save({
      id: `seed-cortisol-${item.fecha}`,
      valor: item.valor,
      unidad: item.unidad,
      fecha: toIso(item.fecha),
      createdAt: new Date().toISOString(),
    });
  }

  return {
    bloodPressure: bloodPressureSeed.length,
    glucose: glucoseSeed.length,
    cholesterol: cholesterolSeed.length,
    cortisol: cortisolSeed.length,
  };
}

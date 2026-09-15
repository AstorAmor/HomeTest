export type MealType = 'desayuno' | 'comida' | 'cena' | 'unspecified';

export interface GlucoseEntry {
  id: string;
  valor: number;
  unidad: 'mg/dL' | 'mmol/L';
  fecha: string; // ISO timestamp de la medición (editable por el usuario)
  mealType: MealType;
  createdAt: string; // ISO timestamp de creación del registro
}

export const MEAL_TYPE_LABEL: Record<MealType, string> = {
  desayuno: 'Desayuno',
  comida: 'Comida',
  cena: 'Cena',
  unspecified: 'Unspecified',
};

import { createMetricRepository, definedOnly } from './metricRepository';
import { getCurrentUserId, isRemoteActive, supabase } from '@/lib/supabase';
import { compressPhoto } from '@/utils/imageUpload';

// "Your plan" en Today: versión simplificada de las recomendaciones personalizadas.
// DUMMY por ahora. Cuando exista el motor de recomendaciones, solo hay que
// cambiar CURRENT_PLAN (o cargarlo de su salida); la UI lee de aquí.
export type PlanItemKind = 'strength' | 'steps' | 'nutrition';

export interface PlanItem {
  kind: PlanItemKind;
  title: string;
  subtitle: string;
  target: number; // meta en la unidad del tipo (sesiones/semana, pasos/día, comidas/día)
}

export const CURRENT_PLAN: PlanItem[] = [
  {
    kind: 'strength',
    title: 'Hit 3 days of strength training',
    subtitle: 'Supports insulin sensitivity and muscle mass',
    target: 3,
  },
  {
    kind: 'steps',
    title: 'Walk 8,000 steps a day',
    subtitle: 'Updated from your wearable',
    target: 8000,
  },
  {
    kind: 'nutrition',
    title: 'Reduce added sugar',
    subtitle: 'Snap your meals to track it',
    target: 3,
  },
];

export type WorkoutType = 'strength' | 'cardio' | 'mobility' | 'sport';

export interface WorkoutEntry {
  id: string;
  fecha: string;
  createdAt: string;
  type: WorkoutType;
  minutes: number;
  intensity: 'easy' | 'moderate' | 'hard';
}

export interface MealEntry {
  id: string;
  fecha: string;
  createdAt: string;
  photoUri?: string; // foto local (modo demo o antes de subirla)
  photoPath?: string; // ruta en el bucket privado meal-photos (<user_id>/<id>.jpg); futuro dataset propio
  description: string;
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  addedSugar: boolean | null;
}

export const workoutRepository = createMetricRepository<WorkoutEntry>('hometest:workouts', {
  table: 'workouts',
  dateColumn: 'performed_at',
  toRow: (e) =>
    definedOnly({
      id: e.id,
      type: e.type,
      minutes: e.minutes,
      intensity: e.intensity,
      performed_at: e.fecha,
      created_at: e.createdAt,
    }),
  fromRow: (r) => ({
    id: r.id,
    type: r.type,
    minutes: r.minutes,
    intensity: r.intensity,
    fecha: r.performed_at,
    createdAt: r.created_at,
  }),
});

export const mealRepository = createMetricRepository<MealEntry>('hometest:meals', {
  table: 'meals',
  dateColumn: 'eaten_at',
  toRow: (e) =>
    definedOnly({
      id: e.id,
      photo_path: e.photoPath,
      description: e.description,
      meal_type: e.mealType,
      added_sugar: e.addedSugar,
      eaten_at: e.fecha,
      created_at: e.createdAt,
    }),
  fromRow: (r) => ({
    id: r.id,
    photoPath: r.photo_path ?? undefined,
    description: r.description,
    mealType: r.meal_type,
    addedSugar: r.added_sugar,
    fecha: r.eaten_at,
    createdAt: r.created_at,
  }),
});

// Guarda una comida. La foto se comprime siempre antes de guardarla; con sesión
// de Supabase se sube al bucket privado meal-photos.
export async function saveMeal(entry: MealEntry): Promise<void> {
  const photoUri = entry.photoUri ? await compressPhoto(entry.photoUri) : undefined;
  const userId = getCurrentUserId();
  if (photoUri && isRemoteActive() && supabase && userId) {
    const path = `${userId}/${entry.id}.jpg`;
    const bytes = await (await fetch(photoUri)).arrayBuffer();
    const { error } = await supabase.storage
      .from('meal-photos')
      .upload(path, bytes, { contentType: 'image/jpeg', upsert: true });
    if (error) throw new Error(error.message);
    await mealRepository.save({ ...entry, photoUri: undefined, photoPath: path });
    return;
  }
  await mealRepository.save({ ...entry, photoUri });
}

const startOfWeek = (d = new Date()) => {
  const date = new Date(d);
  const day = (date.getDay() + 6) % 7; // lunes = 0
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - day);
  return date;
};

export async function strengthSessionsThisWeek(): Promise<number> {
  const from = startOfWeek().getTime();
  const all = await workoutRepository.getAll();
  return all.filter((w) => w.type === 'strength' && new Date(w.fecha).getTime() >= from).length;
}

export async function mealsLoggedToday(): Promise<number> {
  const today = new Date().toISOString().slice(0, 10);
  const all = await mealRepository.getAll();
  return all.filter((m) => m.fecha.slice(0, 10) === today).length;
}

// Racha de días seguidos con al menos una comida registrada (gamificación).
export async function mealStreakDays(): Promise<number> {
  const all = await mealRepository.getAll();
  const days = new Set(all.map((m) => m.fecha.slice(0, 10)));
  let streak = 0;
  const cursor = new Date();
  while (days.has(cursor.toISOString().slice(0, 10))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

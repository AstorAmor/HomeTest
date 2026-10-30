import { createMetricRepository, definedOnly } from './metricRepository';
import { getCurrentUserId, isRemoteActive, supabase } from '@/lib/supabase';
import { compressPhoto } from '@/utils/imageUpload';
import { planHabits, PlanHabits } from '@/logic/planHabits';
import { wearableRepository } from '@/wearables/wearableRepository';
import { toDailySeries } from '@/wearables/seriesLogic';
import { generateHuaweiDummy } from '@/wearables/providers/huaweiDummy';
import { checkInRepository } from './checkInRepository';
import { showSamples } from './dataMode';

// El plan de partida (lógica pura, también en los tests) vive en src/logic/plan.ts, y lo que mira de
// tus últimas semanas, en src/logic/planHabits.ts
export { buildPlan, planKept, planSummary } from '@/logic/plan';
export type { PlanItem, PlanItemKind, PlanKept, PlanProfile } from '@/logic/plan';
export type { HabitLogs, PlanHabits } from '@/logic/planHabits';

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

// Sesiones de calma completadas (respiración, body scan...). Solo en el dispositivo por ahora.
export interface MindfulSession {
  id: string;
  fecha: string;
  createdAt: string;
  exerciseId: string;
  minutes: number;
}
export const mindfulRepository = createMetricRepository<MindfulSession>('hometest:mindful_sessions');

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

export async function mindfulSessionsThisWeek(): Promise<number> {
  const from = startOfWeek().getTime();
  const all = await mindfulRepository.getAll();
  return all.filter((m) => new Date(m.fecha).getTime() >= from).length;
}

// Lo que el plan mira de tus últimas semanas (reloj, entrenos, calma, check-ins y comidas), para las
// pantallas que no lo tienen ya cargado. Como en Hoy: sin nada sincronizado, en las cuentas de
// prueba, el reloj de ejemplo.
export async function loadPlanHabits(now = new Date()): Promise<PlanHabits> {
  const [records, workouts, calm, checkIns, meals] = await Promise.all([
    wearableRepository.getRecords().catch(() => []),
    workoutRepository.getAll().catch(() => []),
    mindfulRepository.getAll().catch(() => []),
    checkInRepository.getAll().catch(() => []),
    mealRepository.getAll().catch(() => []),
  ]);
  const series = toDailySeries(records.length ? records : showSamples() ? generateHuaweiDummy(28, now) : []);
  return planHabits(series, { workouts, calm, checkIns, meals }, now);
}

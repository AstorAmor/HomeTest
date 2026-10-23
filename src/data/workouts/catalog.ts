import { getLang, t } from '@/i18n';
import { EXERCISE_DATA, EXERCISE_DATA_COMMIT } from './exerciseData';
import type { CatalogExercise, Equipment, Level, MovementPattern } from './types';

// Catálogo de ejercicios para los entrenamientos. Base provisional (free-exercise-db): ~150 ejercicios
// con dos fotos cada uno (inicio y final), que ExerciseLoop alterna como un GIF.

export const EXERCISES: Record<string, CatalogExercise> = Object.fromEntries(EXERCISE_DATA.map((e) => [e.id, e]));
export const EXERCISE_LIST: CatalogExercise[] = EXERCISE_DATA;

export const getExercise = (id: string): CatalogExercise | undefined => EXERCISES[id];

export const exerciseName = (ex: CatalogExercise | undefined) => (!ex ? '' : getLang() === 'es' ? ex.name.es : ex.name.en);
export const exerciseSteps = (ex: CatalogExercise) => (getLang() === 'es' ? ex.steps.es : ex.steps.en);

// Único sitio que sabe de dónde salen las imágenes. Las fotos de la base son PROVISIONALES: el
// repositorio se declara de dominio público pero no documenta su origen. Cuando haya clips propios
// (vídeo corto en bucle en Supabase Storage), se cambia aquí y ExerciseLoop pasa a reproducir el vídeo.
const MEDIA_BASE = `https://raw.githubusercontent.com/yuhonas/free-exercise-db/${EXERCISE_DATA_COMMIT}/exercises/`;
export const exerciseMedia = (ex: CatalogExercise): { kind: 'frames'; frames: string[] } => ({
  kind: 'frames',
  frames: ex.frames.map((f) => MEDIA_BASE + f),
});
export const MEDIA_ASPECT = 850 / 569; // las fotos de la base son 850 × 569

// ¿Se puede hacer con este material? Todo lo de "needs" y al menos una cosa de "anyOf"
export const canDo = (ex: CatalogExercise, have: Equipment[]) =>
  ex.needs.every((n) => have.includes(n)) && (!ex.anyOf?.length || ex.anyOf.some((n) => have.includes(n)));

// ¿Lleva peso que se apunte en kilos? (mancuernas, pesa rusa, barra o máquina). Con bandas, barra de
// dominadas o el propio cuerpo, solo repeticiones
const LOADS: Equipment[] = ['dumbbells', 'kettlebell', 'barbell', 'machines'];
export const isLoadable = (ex: CatalogExercise) => !ex.timed && [...ex.needs, ...(ex.anyOf ?? [])].some((e) => LOADS.includes(e));

const LEVEL_RANK: Record<Level, number> = { beginner: 0, intermediate: 1, advanced: 2 };
export const levelAllows = (user: Level, ex: Level) => LEVEL_RANK[ex] <= LEVEL_RANK[user];

// ── Textos (fuente en inglés; el español está en src/i18n/workoutsEs.ts) ──
export const PATTERN_LABEL: Record<MovementPattern, string> = {
  squat: 'Squat',
  lunge: 'Lunge and single leg',
  hinge: 'Hip hinge',
  back: 'Lower back',
  push_h: 'Horizontal push',
  push_v: 'Overhead push',
  pull_h: 'Row',
  pull_v: 'Vertical pull',
  core: 'Core',
  carry: 'Carry',
  conditioning: 'Cardio',
  hamstrings: 'Hamstrings',
  quads: 'Quads',
  glutes: 'Glutes',
  calves: 'Calves',
  chest: 'Chest',
  shoulders: 'Shoulders',
  biceps: 'Biceps',
  triceps: 'Triceps',
  mobility: 'Warm-up and mobility',
  stretch: 'Stretch',
};
export const patternLabel = (p: MovementPattern) => t(PATTERN_LABEL[p]);

export const EQUIPMENT: { id: Equipment; label: string }[] = [
  { id: 'dumbbells', label: 'Dumbbells' },
  { id: 'kettlebell', label: 'Kettlebell' },
  { id: 'bands', label: 'Resistance bands' },
  { id: 'bench', label: 'Bench or step' },
  { id: 'bar', label: 'Pull-up bar' },
  { id: 'barbell', label: 'Barbell and rack' },
  { id: 'machines', label: 'Machines and cables' },
  { id: 'cardio', label: 'Cardio machines' },
];
export const ALL_EQUIPMENT: Equipment[] = EQUIPMENT.map((e) => e.id);
export const equipmentLabel = (id: Equipment) => t(EQUIPMENT.find((e) => e.id === id)?.label ?? id);

// Lo que hace falta para un ejercicio, en una línea: "Mancuernas + Banco o escalón", "Pesa rusa o Mancuernas"
export const exerciseEquipmentText = (ex: CatalogExercise) => {
  const parts = ex.needs.map(equipmentLabel);
  if (ex.anyOf?.length) parts.push(ex.anyOf.map(equipmentLabel).join(` ${t('or')} `));
  return parts.length ? parts.join(' + ') : t('No equipment');
};

export const MUSCLE_LABEL: Record<string, string> = {
  abdominals: 'Abs',
  abductors: 'Abductors',
  adductors: 'Adductors',
  biceps: 'Biceps',
  calves: 'Calves',
  chest: 'Chest',
  forearms: 'Forearms',
  glutes: 'Glutes',
  hamstrings: 'Hamstrings',
  lats: 'Lats',
  'lower back': 'Lower back',
  'middle back': 'Mid back',
  neck: 'Neck',
  quadriceps: 'Quads',
  shoulders: 'Shoulders',
  traps: 'Traps',
  triceps: 'Triceps',
};
export const muscleLabel = (m: string) => t(MUSCLE_LABEL[m] ?? m);

export const LEVEL_LABEL: Record<Level, string> = { beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced' };

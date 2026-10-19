// Entrenamientos: tipos del catálogo de ejercicios, de las preferencias del generador y de los
// programas (los que se hace el usuario y los que le manda su entrenador desde el portal).

// Patrón de movimiento: el generador rellena huecos por patrón y "cambiar ejercicio" ofrece otros del mismo
export type MovementPattern =
  | 'squat' // sentadilla (rodilla)
  | 'lunge' // zancada y una pierna
  | 'hinge' // bisagra de cadera (peso muerto, puente)
  | 'back' // espalda baja (superman, extensiones)
  | 'push_h' // empuje horizontal (flexiones, press de banca)
  | 'push_v' // empuje vertical (press de hombros)
  | 'pull_h' // tirón horizontal (remos)
  | 'pull_v' // tirón vertical (dominadas, jalón)
  | 'core'
  | 'carry'
  | 'conditioning' // cardio y circuito
  | 'hamstrings'
  | 'quads'
  | 'glutes'
  | 'calves'
  | 'chest'
  | 'shoulders'
  | 'biceps'
  | 'triceps'
  | 'mobility' // calentamiento
  | 'stretch'; // vuelta a la calma

// Material. "bench" = banco o escalón estable; "bar" = barra de dominadas; "barbell" = barra con discos y rack
export type Equipment = 'dumbbells' | 'kettlebell' | 'bands' | 'bench' | 'bar' | 'barbell' | 'machines' | 'cardio';

export type Level = 'beginner' | 'intermediate' | 'advanced';

export interface CatalogExercise {
  id: string;
  pattern: MovementPattern;
  needs: Equipment[]; // hace falta todo esto
  anyOf?: Equipment[]; // y al menos una de estas cosas
  level: Level;
  timed?: boolean; // se hace por tiempo (plancha, estiramientos, cardio)
  perSide?: boolean; // las repeticiones o el tiempo son por lado
  impact?: boolean; // con saltos: fuera si se pide "sin saltos"
  compound: boolean;
  primary: string[]; // músculos (nombres de la base, en inglés: ver MUSCLE_LABEL)
  secondary: string[];
  name: { en: string; es: string };
  steps: { en: string[]; es: string[] };
  frames: string[]; // rutas de las fotos dentro de la base (inicio y final del movimiento)
}

export type WorkoutGoal = 'health' | 'strength' | 'muscle' | 'fat_loss' | 'mobility';
export type TrainingPlace = 'home' | 'home_kit' | 'gym';

export interface WorkoutPrefs {
  goal: WorkoutGoal;
  level: Level;
  daysPerWeek: number; // 2 a 5
  minutes: number; // 20, 30, 45 o 60 por sesión
  place: TrainingPlace;
  equipment: Equipment[]; // lo que tiene a mano (en el gimnasio, todo)
  lowImpact: boolean; // sin saltos
  seed: number; // misma semilla, mismo programa; "otra variación" cambia la semilla
}

export type WorkoutBlock = 'warmup' | 'main' | 'finisher' | 'cooldown';

export interface WorkoutExercise {
  exerciseId: string;
  block: WorkoutBlock;
  sets: number;
  reps: string; // "8–10", "12" o "30 s" (por tiempo); "por lado" lo añade la pantalla si perSide
  restSec: number;
  note?: string; // indicación del entrenador
}

export interface WorkoutSession {
  id: string; // 'A', 'B'…
  title: string; // "Cuerpo completo A", "Tren superior"… (texto fuente en inglés, se traduce al pintar)
  focus: 'full' | 'upper' | 'lower' | 'conditioning' | 'mobility';
  exercises: WorkoutExercise[];
}

export interface WorkoutCompletion {
  sessionId: string;
  at: string; // ISO
  minutes: number;
}

export interface WorkoutProgram {
  id: string;
  title: string;
  createdAt: string;
  // Quién lo hizo: el propio usuario con el generador, o su profesional desde el portal
  source: 'self' | 'professional';
  professionalId?: string | null;
  professionalName?: string | null;
  patientId?: string | null; // en el portal: para quién es
  prefs: WorkoutPrefs;
  sessions: WorkoutSession[];
  note?: string; // nota del profesional para el paciente
  active: boolean;
  completions: WorkoutCompletion[];
}

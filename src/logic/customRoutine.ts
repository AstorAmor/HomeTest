import { getExercise } from '@/data/workouts/catalog';
import type { WorkoutPrefs, WorkoutProgram, WorkoutSession } from '@/data/workouts/types';
import { DEFAULT_PREFS, defaultDose, newProgram } from './workoutGenerator';

// "Crear mi propia rutina" (como en Hevy o Strong): un nombre, uno o varios días (A, B, C…) y en cada
// uno los ejercicios que se eligen de la biblioteca, en el orden que se quiera, con series,
// repeticiones o tiempo, peso y descanso. Se guarda como un WorkoutProgram más (source 'self' y
// prefs.custom) para que la lista, la sesión guiada y el portal la traten igual que las del generador.
// El mismo editor cambia cualquier programa (también los del generador y los del entrenador): ahí se
// respetan su calentamiento, sus estiramientos y el tipo de cada día.

export const CUSTOM_PREFS: WorkoutPrefs = { ...DEFAULT_PREFS, level: 'intermediate', custom: true };

export const isCustomProgram = (p: Pick<WorkoutProgram, 'prefs'>) => !!p.prefs?.custom;

export const dayLetter = (i: number) => String.fromCharCode(65 + i);

// Sin título: la pantalla lo llama "Día A" (sessionName en labels.ts)
export const emptyDay = (i: number): WorkoutSession => ({ id: dayLetter(i), title: '', focus: 'full', exercises: [] });

// Al final del día (antes de los estiramientos, si los hay), con la dosis de partida del generador
// para alguien de nivel intermedio (3 × 10–12 en los grandes, 1 × 30 s en los estiramientos…). Luego
// se cambia con el lápiz.
export function addExercises(day: WorkoutSession, ids: string[]): WorkoutSession {
  const added = ids.filter((id) => getExercise(id)).map((id) => ({ exerciseId: id, block: 'main' as const, ...defaultDose(id, CUSTOM_PREFS, 'main') }));
  const cool = day.exercises.findIndex((e) => e.block === 'cooldown');
  const at = cool < 0 ? day.exercises.length : cool;
  return { ...day, exercises: [...day.exercises.slice(0, at), ...added, ...day.exercises.slice(at)] };
}

export function moveExercise(day: WorkoutSession, index: number, dir: -1 | 1): WorkoutSession {
  const j = index + dir;
  if (j < 0 || j >= day.exercises.length) return day;
  const exercises = [...day.exercises];
  [exercises[index], exercises[j]] = [exercises[j], exercises[index]];
  return { ...day, exercises };
}

// Qué tipo de día es por sus ejercicios (decide si cuenta en el plan como fuerza, cardio o movilidad)
export function focusFor(exercises: WorkoutSession['exercises']): WorkoutSession['focus'] {
  const patterns = exercises.map((e) => getExercise(e.exerciseId)?.pattern).filter(Boolean);
  if (!patterns.length) return 'full';
  if (patterns.every((p) => p === 'mobility' || p === 'stretch')) return 'mobility';
  if (patterns.every((p) => p === 'conditioning')) return 'conditioning';
  return 'full';
}

// Al guardar: fuera los ejercicios que ya no están en el catálogo y los días vacíos; las letras van
// en orden (A, B, C…) y cada día lleva su tipo (en un programa del generador, el que ya tenía:
// "Tren superior" sigue siéndolo aunque se quite un ejercicio)
export const cleanDays = (days: WorkoutSession[], keepFocus = false): WorkoutSession[] =>
  days
    .map((d) => ({ ...d, title: d.title.trim().slice(0, 60), exercises: d.exercises.filter((e) => getExercise(e.exerciseId)) }))
    .filter((d) => d.exercises.length)
    .map((d, i) => ({ ...d, id: dayLetter(i), focus: keepFocus ? d.focus : focusFor(d.exercises) }));

// Nueva (se sigue al guardarla, como las del generador, salvo que se diga lo contrario) o cambiada
// (conserva id, fecha, sesiones hechas, si se sigue y de dónde salió: una del generador sigue siéndolo)
export function customProgram(title: string, days: WorkoutSession[], opts: { base?: WorkoutProgram | null; follow?: boolean } = {}): WorkoutProgram {
  const name = title.trim().slice(0, 120);
  if (opts.base) return { ...opts.base, title: name || opts.base.title, sessions: cleanDays(days, !isCustomProgram(opts.base)) };
  const sessions = cleanDays(days);
  return newProgram(CUSTOM_PREFS, { title: name || 'My routine', sessions, active: opts.follow ?? true });
}

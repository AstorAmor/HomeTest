import type { SetLog, WorkoutProgram, WorkoutSession } from '@/data/workouts/types';

// Historial de entrenos (Entrenamientos → Historial): lo que se entrenó, del más reciente al más
// antiguo, sin editar nada. Junta dos fuentes:
// - las sesiones hechas de los programas (`completions`, con cada serie desde el 2026-10-23);
// - los entrenamientos del plan (tabla `workouts`): los apuntados a mano con «Apuntar un entreno».
// Cada sesión de programa guarda también un entrenamiento del plan con la misma hora: ese no se repite.
// Si se borra el programa, la sesión sigue en el historial por ese entrenamiento (día, tipo y minutos,
// sin las series). Lógica pura; la pantalla es src/screens/workouts/WorkoutHistoryScreen.tsx.

// Lo que hace falta de un entrenamiento del plan (WorkoutEntry, en src/data/planRepository.ts)
export interface LoggedWorkout {
  id: string;
  fecha: string;
  type: 'strength' | 'cardio' | 'mobility' | 'sport';
  minutes: number;
  intensity: 'easy' | 'moderate' | 'hard';
}

export type HistoryEntry =
  | {
      kind: 'session';
      key: string;
      at: string;
      minutes: number;
      programTitle: string;
      session: Pick<WorkoutSession, 'id' | 'title'> | null; // null si ya no está en el programa
      sets: SetLog[];
      volumeKg: number;
    }
  | ({ kind: 'logged'; key: string; at: string } & Omit<LoggedWorkout, 'fecha' | 'id'>);

// Misma hora: es el entrenamiento que se guardó con la sesión (se da un margen por si la base de datos
// redondea)
const SAME_MS = 2000;

export const volumeOf = (sets: SetLog[]) => Math.round(sets.reduce((sum, s) => sum + (s.kg ?? 0) * (s.reps ?? 0), 0));

export function workoutHistory(programs: Pick<WorkoutProgram, 'id' | 'title' | 'sessions' | 'completions'>[], logged: LoggedWorkout[]): HistoryEntry[] {
  const sessions: HistoryEntry[] = programs.flatMap((p) =>
    (p.completions ?? []).map((c, i) => {
      const s = p.sessions.find((x) => x.id === c.sessionId);
      const sets = c.sets ?? [];
      return {
        kind: 'session' as const,
        key: `${p.id}-${c.at}-${i}`,
        at: c.at,
        minutes: c.minutes,
        programTitle: p.title,
        session: s ? { id: s.id, title: s.title } : null,
        sets,
        volumeKg: volumeOf(sets),
      };
    }),
  );
  const times = sessions.map((s) => Date.parse(s.at));
  const others: HistoryEntry[] = logged
    .filter((w) => !times.some((t) => Math.abs(t - Date.parse(w.fecha)) < SAME_MS))
    .map((w) => ({ kind: 'logged' as const, key: w.id, at: w.fecha, type: w.type, minutes: w.minutes, intensity: w.intensity }));
  return [...sessions, ...others].sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
}

// Las series de una sesión agrupadas por ejercicio, en el orden en que se hicieron
export function setsByExercise(sets: SetLog[]): { exerciseId: string; sets: SetLog[] }[] {
  const out: { exerciseId: string; sets: SetLog[] }[] = [];
  for (const s of sets) {
    const group = out.find((g) => g.exerciseId === s.exerciseId);
    if (group) group.sets.push(s);
    else out.push({ exerciseId: s.exerciseId, sets: [s] });
  }
  return out;
}

// Por meses ("2026-10"), del más reciente al más antiguo, para las cabeceras
export function byMonth(entries: HistoryEntry[]): { month: string; entries: HistoryEntry[] }[] {
  const out: { month: string; entries: HistoryEntry[] }[] = [];
  for (const e of entries) {
    const d = new Date(e.at);
    const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const last = out[out.length - 1];
    if (last?.month === month) last.entries.push(e);
    else out.push({ month, entries: [e] });
  }
  return out;
}

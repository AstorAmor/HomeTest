import { beforeEach, describe, expect, it, vi } from 'vitest';

const store = new Map<string, string>();
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async (k: string) => store.get(k) ?? null,
    setItem: async (k: string, v: string) => void store.set(k, v),
    removeItem: async (k: string) => void store.delete(k),
  },
}));
let userId: string | null = 'user-1';
vi.mock('@/lib/supabase', () => ({ getCurrentUserId: () => userId }));

import { byMonth, setsByExercise, workoutHistory, type LoggedWorkout } from '@/logic/workoutHistory';
import { clearActiveWorkout, isFreshWorkout, loadActiveWorkout, saveActiveWorkout, type ActiveWorkout } from '@/data/workouts/activeWorkout';
import type { WorkoutProgram } from '@/data/workouts/types';

const program = (id: string, completions: WorkoutProgram['completions']) =>
  ({ id, title: 'Strength to get started', sessions: [{ id: 'A', title: 'Full body', focus: 'full', exercises: [] }], completions }) as unknown as WorkoutProgram;
const logged = (fecha: string, type: LoggedWorkout['type'] = 'strength'): LoggedWorkout => ({ id: `w-${fecha}`, fecha, type, minutes: 30, intensity: 'moderate' });

describe('Historial de entrenos', () => {
  it('junta las sesiones de los programas y los entrenos apuntados, del más reciente al más antiguo', () => {
    const h = workoutHistory(
      [program('p1', [{ sessionId: 'A', at: '2026-10-20T18:00:00.000Z', minutes: 50, sets: [{ exerciseId: 'Goblet_Squat', kg: 20, reps: 10 }] }])],
      [logged('2026-10-22T09:00:00.000Z', 'cardio'), logged('2026-10-18T09:00:00.000Z')],
    );
    expect(h.map((e) => e.kind)).toEqual(['logged', 'session', 'logged']);
    expect(h[1]).toMatchObject({ kind: 'session', minutes: 50, session: { id: 'A', title: 'Full body' }, volumeKg: 200 });
  });

  it('el entreno del plan que se guardó con la sesión no sale dos veces (aunque la base de datos cambie el formato de la hora)', () => {
    const h = workoutHistory(
      [program('p1', [{ sessionId: 'A', at: '2026-10-26T17:05:12.345Z', minutes: 52 }])],
      [logged('2026-10-26T17:05:12.345+00:00'), logged('2026-10-26T19:00:00.000Z', 'cardio')],
    );
    expect(h).toHaveLength(2);
    expect(h.find((e) => e.kind === 'logged')).toMatchObject({ type: 'cardio' });
  });

  it('si ya no está el programa, la sesión sigue por su entreno del plan (sin series)', () => {
    const h = workoutHistory([], [logged('2026-10-26T17:05:12.345Z')]);
    expect(h).toEqual([{ kind: 'logged', key: 'w-2026-10-26T17:05:12.345Z', at: '2026-10-26T17:05:12.345Z', type: 'strength', minutes: 30, intensity: 'moderate' }]);
  });

  it('una sesión de un día que ya no está en el programa sale con el nombre del programa', () => {
    const [e] = workoutHistory([program('p1', [{ sessionId: 'Z', at: '2026-10-20T18:00:00.000Z', minutes: 40 }])], []);
    expect(e).toMatchObject({ kind: 'session', session: null, programTitle: 'Strength to get started', sets: [], volumeKg: 0 });
  });

  it('agrupa las series por ejercicio en el orden en que se hicieron, y los entrenos por meses', () => {
    const groups = setsByExercise([
      { exerciseId: 'a', kg: 20, reps: 10 },
      { exerciseId: 'b', reps: 12 },
      { exerciseId: 'a', kg: 20, reps: 8 },
    ]);
    expect(groups).toEqual([
      { exerciseId: 'a', sets: [{ exerciseId: 'a', kg: 20, reps: 10 }, { exerciseId: 'a', kg: 20, reps: 8 }] },
      { exerciseId: 'b', sets: [{ exerciseId: 'b', reps: 12 }] },
    ]);
    const months = byMonth(workoutHistory([], [logged('2026-10-26T12:00:00.000Z'), logged('2026-10-02T12:00:00.000Z'), logged('2026-09-30T12:00:00.000Z')]));
    expect(months.map((m) => [m.month, m.entries.length])).toEqual([
      ['2026-10', 2],
      ['2026-09', 1],
    ]);
  });
});

describe('Entreno a medias en el móvil', () => {
  beforeEach(() => {
    store.clear();
    userId = 'user-1';
  });

  const draft = (updatedAt = Date.now()): Omit<ActiveWorkout, 'v' | 'owner'> => ({
    programId: 'p1',
    session: { id: 'A', title: 'Full body' },
    mode: 'run',
    view: 'list',
    startedAt: updatedAt - 20 * 60e3,
    finishedAt: 0,
    updatedAt,
    items: [{ exerciseId: 'Goblet_Squat', block: 'main', sets: 3, reps: '10', restSec: 90 }],
    rows: [[{ kg: '20', reps: '10', done: true }, { kg: '', reps: '', done: false }, { kg: '', reps: '', done: false }]],
    at: { item: 0, set: 2 },
    phase: 'rest',
    endsAt: updatedAt + 60e3,
    restTotal: 90,
    timerOn: false,
    timerAt: null,
    intensity: 'moderate',
  });

  it('lo marcado se recupera tal cual tras cerrarse la app', async () => {
    await saveActiveWorkout(draft());
    const w = await loadActiveWorkout();
    expect(w?.rows[0][0]).toEqual({ kg: '20', reps: '10', done: true });
    expect(w).toMatchObject({ programId: 'p1', phase: 'rest', at: { item: 0, set: 2 } });
  });

  it('no se abre el de otra persona ni uno roto, y al guardar o descartar desaparece', async () => {
    await saveActiveWorkout(draft());
    userId = 'user-2';
    expect(await loadActiveWorkout()).toBeNull();
    userId = 'user-1';
    store.set('workouts.active.v1', '{roto');
    expect(await loadActiveWorkout()).toBeNull();
    await saveActiveWorkout(draft());
    await clearActiveWorkout();
    expect(await loadActiveWorkout()).toBeNull();
  });

  it('al arrancar solo se vuelve sola a la sesión si se tocó hace menos de 6 horas', () => {
    const now = Date.parse('2026-10-26T20:00:00Z');
    expect(isFreshWorkout({ updatedAt: now - 2 * 3600e3 }, now)).toBe(true);
    expect(isFreshWorkout({ updatedAt: now - 7 * 3600e3 }, now)).toBe(false);
  });
});

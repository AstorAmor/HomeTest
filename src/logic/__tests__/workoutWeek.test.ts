import { describe, expect, it } from 'vitest';
import type { WorkoutCompletion, WorkoutSession } from '@/data/workouts/types';
import { addExercises, cleanDays, customProgram, emptyDay, firstEmptyRoutine, fromDraft, routineIdMap, toDraft, type DraftRoutine } from '@/logic/customRoutine';
import { daysText, isScheduled, nextUp, normWeekdays, sessionsPerWeek, toggleWeekday, weekdayShort, whenText } from '@/logic/workoutWeek';
import { doseText, programFacts, sessionName } from '@/data/workouts/labels';
import { plannedSets } from '@/logic/setPlan';
import { es } from '@/i18n/es';
import { workoutsEs } from '@/i18n/workoutsEs';

// Un entrenamiento con varias rutinas, cada una en uno o varios días de la semana (fundador, 2026-11-06)
const MON = 1;
const TUE = 2;
const WED = 3;
const THU = 4;
const FRI = 5;
const SAT = 6;
const SUN = 0;

const routine = (i: number, ids: string[], weekdays?: number[], title = ''): WorkoutSession => ({
  ...addExercises({ ...emptyDay(i), title }, ids),
  ...(weekdays ? { weekdays } : {}),
});
const done = (sessionId: string, at: string): WorkoutCompletion => ({ sessionId, at, minutes: 40 });
// 2026-11-09 es lunes
const day = (d: number, h = 9) => new Date(2026, 10, d, h);

describe('Los días de cada rutina', () => {
  it('limpios: de lunes a domingo, sin repetir y solo días que existen', () => {
    expect(normWeekdays([SUN, THU, MON, THU, 9, -1, 2.5, 'x'])).toEqual([MON, THU, SUN]);
    expect(normWeekdays(undefined)).toEqual([]);
  });

  it('un día es de una sola rutina: si era de otra, pasa a esta', () => {
    const rs = [routine(0, ['Pushups'], [MON, THU]), routine(1, ['Goblet_Squat'], [TUE])];
    const moved = toggleWeekday(rs, 1, THU);
    expect(moved.map((r) => r.weekdays)).toEqual([[MON], [TUE, THU]]);
    // Tocarlo otra vez lo quita
    expect(toggleWeekday(moved, 1, THU).map((r) => r.weekdays)).toEqual([[MON], [TUE]]);
  });

  it('se leen cortos y en orden', () => {
    expect(daysText({ weekdays: [THU, MON] })).toBe('Mon, Thu');
    expect(weekdayShort(SUN)).toBe('Sun');
  });

  it('las sesiones a la semana: con días, los días puestos; sin días, una por rutina', () => {
    const scheduled = { sessions: [routine(0, ['Pushups'], [MON, THU]), routine(1, ['Goblet_Squat'], [TUE, FRI]), routine(2, ['Plank'])] };
    expect(isScheduled(scheduled)).toBe(true);
    expect(sessionsPerWeek(scheduled)).toBe(4);
    const inOrder = { sessions: [routine(0, ['Pushups']), routine(1, ['Goblet_Squat'])] };
    expect(isScheduled(inOrder)).toBe(false);
    expect(sessionsPerWeek(inOrder)).toBe(2);
  });
});

describe('Lo que toca', () => {
  // Empuje lunes y jueves, pierna martes y viernes, movilidad sin día
  const p = { sessions: [routine(0, ['Pushups'], [MON, THU], 'Push'), routine(1, ['Goblet_Squat'], [TUE, FRI], 'Legs'), routine(2, ['Plank'], undefined, 'Core')] };

  it('hoy, la rutina de hoy si aún no has entrenado', () => {
    expect(nextUp({ ...p, completions: [] }, day(9))).toEqual({ id: 'A', inDays: 0 });
    expect(nextUp({ ...p, completions: [] }, day(10))).toEqual({ id: 'B', inDays: 0 });
  });

  it('si hoy ya entrenaste, la del siguiente día con rutina', () => {
    expect(nextUp({ ...p, completions: [done('A', day(9, 8).toISOString())] }, day(9, 20))).toEqual({ id: 'B', inDays: 1 });
    // Viernes hecho: lo siguiente es el lunes, a 3 días
    expect(nextUp({ ...p, completions: [done('B', day(13, 8).toISOString())] }, day(13, 20))).toEqual({ id: 'A', inDays: 3 });
  });

  it('un día sin rutina: la del siguiente día que tiene', () => {
    expect(nextUp({ ...p, completions: [] }, day(11))).toEqual({ id: 'A', inDays: 1 }); // miércoles → jueves
    expect(nextUp({ ...p, completions: [] }, day(14))).toEqual({ id: 'A', inDays: 2 }); // sábado → lunes
  });

  it('sin días en ninguna rutina, en orden después de la última hecha, como antes', () => {
    const inOrder = { sessions: [routine(0, ['Pushups']), routine(1, ['Goblet_Squat']), routine(2, ['Plank'])] };
    expect(nextUp({ ...inOrder, completions: [] })).toEqual({ id: 'A', inDays: null });
    expect(nextUp({ ...inOrder, completions: [done('C', '2026-11-02T10:00:00Z')] })).toEqual({ id: 'A', inDays: null });
    expect(nextUp({ ...inOrder, completions: [done('A', '2026-11-02T10:00:00Z')] })).toEqual({ id: 'B', inDays: null });
  });

  it('cuándo, en palabras', () => {
    expect(whenText(null)).toBe('Next session');
    expect(whenText(0)).toBe('Today');
    expect(whenText(1)).toBe('Tomorrow');
    expect(whenText(3, day(13))).toMatch(/^On monday$/i);
  });
});

describe('Al guardar el editor', () => {
  it('cada día se queda en una sola rutina y las rutinas sin días no llevan el campo', () => {
    const clean = cleanDays([routine(0, ['Pushups'], [THU, MON]), routine(1, ['Goblet_Squat'], [MON, FRI]), routine(2, ['Plank'], [])]);
    expect(clean.map((r) => r.weekdays)).toEqual([[MON, THU], [FRI], undefined]);
    expect('weekdays' in clean[2]).toBe(false);
  });

  it('quitar una rutina: las demás vuelven a ir por orden y lo hecho se va con la suya', () => {
    const base = customProgram('PPL', [routine(0, ['Pushups'], [MON]), routine(1, ['Pullups'], [TUE]), routine(2, ['Goblet_Squat'], [WED])]);
    const withHistory = { ...base, completions: [done('A', '2026-11-02T10:00:00Z'), done('B', '2026-11-03T10:00:00Z'), done('C', '2026-11-04T10:00:00Z')] };
    // En el editor se quita B; A y C conservan la letra que tenían (orig)
    const drafts: DraftRoutine[] = [
      { ...withHistory.sessions[0], orig: 'A' },
      { ...withHistory.sessions[2], orig: 'C' },
    ];
    const edited = customProgram('PPL', drafts, { base: withHistory });
    expect(edited.sessions.map((s) => [s.id, s.exercises[0].exerciseId])).toEqual([
      ['A', 'Pushups'],
      ['B', 'Goblet_Squat'],
    ]);
    // Lo de la sentadilla (antes C) es ahora de B; lo de la B quitada no se pega a ninguna
    expect(edited.completions.map((c) => c.sessionId)).toEqual(['A', 'xB', 'B']);
    expect(routineIdMap(drafts, withHistory)).toEqual({ A: 'A', B: 'xB', C: 'B' });
  });

  it('una rutina nueva no se queda con lo hecho de otra', () => {
    const base = { ...customProgram('X', [routine(0, ['Pushups'])]), completions: [done('A', '2026-11-02T10:00:00Z')] };
    const drafts: DraftRoutine[] = [{ ...routine(0, ['Goblet_Squat']), orig: null }, { ...base.sessions[0], id: 'B', orig: 'A' }];
    const edited = customProgram('X', drafts, { base });
    expect(edited.sessions.map((s) => s.exercises[0].exerciseId)).toEqual(['Goblet_Squat', 'Pushups']);
    expect(edited.completions[0].sessionId).toBe('B');
  });

  it('una rutina con nombre o días pero sin ejercicios no se pierde sin avisar', () => {
    expect(firstEmptyRoutine([routine(0, ['Pushups']), { ...emptyDay(1), title: 'Pierna' }])).toBe(1);
    expect(firstEmptyRoutine([routine(0, ['Pushups']), { ...emptyDay(1), weekdays: [SAT] }])).toBe(1);
    // Una vacía del todo se quita al guardar, como antes
    expect(firstEmptyRoutine([routine(0, ['Pushups']), emptyDay(1)])).toBe(-1);
  });
});

describe('Cómo se llaman', () => {
  it('una rutina sin nombre es «Rutina A» (el día es ahora el de la semana)', () => {
    expect(sessionName({ id: 'B', title: '' })).toBe('Routine B');
    const ES: Record<string, string> = { ...workoutsEs, ...es };
    expect(ES['Routine {id}']).toBe('Rutina {id}');
  });

  it('el resumen del programa: días a la semana y rutinas', () => {
    const scheduled = { title: 'PPL', prefs: { goal: 'muscle' as const, custom: true }, sessions: [routine(0, ['Pushups'], [MON, THU]), routine(1, ['Goblet_Squat'], [TUE, FRI])] };
    expect(programFacts(scheduled)).toEqual(['4 days a week', '2 routines']);
    const inOrder = { ...scheduled, sessions: [routine(0, ['Pushups']), routine(1, ['Goblet_Squat']), routine(2, ['Plank'])] };
    expect(programFacts(inOrder)).toEqual(['3 routines']);
  });
});

describe('Cada ejercicio, a modo lista y serie a serie', () => {
  const read = async (p: string) => {
    const fs = (await import('node:fs' as string)) as { readFileSync: (p: string, enc: 'utf8') => string };
    return fs.readFileSync(p, 'utf8');
  };

  it('cerrado, una línea con el resumen de sus series, también con pesos distintos', () => {
    const it0 = { exerciseId: 'Leg_Press', block: 'main' as const, sets: 3, reps: '8', weightKg: 100, restSec: 120 };
    const draft = [
      { kg: '90', reps: '8' },
      { kg: '100', reps: '6' },
      { kg: '100', reps: '6' },
      { kg: '110', reps: '4' },
    ];
    const changed = fromDraft(it0, draft);
    expect(doseText(changed)).toMatch(/^4 × .* · 90–110 kg$/);
    expect(plannedSets(changed).map((p) => p.kg)).toEqual([90, 100, 100, 110]);
    // Y de vuelta al editor, cada serie con lo suyo
    expect(toDraft(changed).map((d) => d.kg)).toEqual(['90', '100', '100', '110']);
  });

  it('en «Editar rutina» empiezan todos cerrados y se abre uno a la vez', async () => {
    const src = await read('src/screens/workouts/CustomRoutineScreen.tsx');
    expect(src).toMatch(/useState<\{ routine: string; i: number \} \| null>\(null\)/);
    expect(src).toContain('open={openAt === i}');
    expect(src).toContain('onToggle={() => toggleEx(i)}');
  });

  it('en «Ver las sesiones», el lápiz abre el mismo editor serie a serie (antes, una sola dosis para todas)', async () => {
    const src = await read('src/screens/workouts/WorkoutSessionScreen.tsx');
    expect(src).toContain('<RoutineExerciseCard');
    expect(src).not.toContain('DoseEditor');
    expect(src).toContain('fromDraft(editDraft.item, editDraft.draft)');
  });

  it('las pestañas de las rutinas no se aplastan (se cortaban por arriba)', async () => {
    const src = await read('src/screens/workouts/WorkoutSessionScreen.tsx');
    expect(src).toMatch(/tabsScroll: \{ flexGrow: 0, flexShrink: 0/);
  });
});

describe('Elegir ejercicios en la biblioteca', () => {
  it('la foto no cambia al marcar o desmarcar: la marca va encima (desmarcar la dejaba en blanco)', async () => {
    const fs = (await import('node:fs' as string)) as { readFileSync: (p: string, enc: 'utf8') => string };
    const src = fs.readFileSync('src/components/workouts/ExerciseLibrary.tsx', 'utf8');
    expect(src).toContain('<ExerciseLoop exercise={ex} radius={10} />');
    expect(src).not.toMatch(/<ExerciseLoop[^>]*\bon \?/);
    expect(src).toMatch(/styles\.ring, !on && styles\.ringOff/);
  });
});

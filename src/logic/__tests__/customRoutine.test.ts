import { describe, expect, it } from 'vitest';
import { addExercises, cleanDays, customProgram, emptyDay, focusFor, isCustomProgram, moveExercise } from '@/logic/customRoutine';
import { nextSessionId } from '@/logic/workoutGenerator';

const ids = (d: { exercises: { exerciseId: string }[] }) => d.exercises.map((e) => e.exerciseId);

describe('Crear mi propia rutina', () => {
  it('los ejercicios se añaden al final con una dosis de partida, y los que no existen no', () => {
    const day = addExercises(emptyDay(0), ['Goblet_Squat', 'No_Such_Exercise', 'Hamstring_Stretch']);
    expect(ids(day)).toEqual(['Goblet_Squat', 'Hamstring_Stretch']);
    const [squat, stretch] = day.exercises;
    expect(squat).toMatchObject({ block: 'main', sets: 3 });
    expect(squat.restSec).toBeGreaterThan(0);
    expect(stretch).toMatchObject({ sets: 1, restSec: 0 });
    expect(ids(addExercises(day, ['Pushups']))).toEqual(['Goblet_Squat', 'Hamstring_Stretch', 'Pushups']);
  });

  it('se ordenan subiendo y bajando, sin salirse de la lista', () => {
    const day = addExercises(emptyDay(0), ['Goblet_Squat', 'Pushups', 'Plank']);
    expect(ids(moveExercise(day, 2, -1))).toEqual(['Goblet_Squat', 'Plank', 'Pushups']);
    expect(ids(moveExercise(day, 0, -1))).toEqual(ids(day));
    expect(ids(moveExercise(day, 2, 1))).toEqual(ids(day));
  });

  it('el tipo de día sale de sus ejercicios', () => {
    expect(focusFor(addExercises(emptyDay(0), ['Hamstring_Stretch', 'Arm_Circles']).exercises)).toBe('mobility');
    expect(focusFor(addExercises(emptyDay(0), ['Rowing_Stationary', 'Mountain_Climbers']).exercises)).toBe('conditioning');
    expect(focusFor(addExercises(emptyDay(0), ['Rowing_Stationary', 'Goblet_Squat']).exercises)).toBe('full');
  });

  it('al guardar quita los días vacíos y vuelve a poner las letras en orden', () => {
    const days = [emptyDay(0), addExercises({ ...emptyDay(1), title: '  Pierna ' }, ['Goblet_Squat']), addExercises(emptyDay(2), ['Pushups'])];
    const clean = cleanDays(days);
    expect(clean.map((d) => d.id)).toEqual(['A', 'B']);
    expect(clean[0].title).toBe('Pierna');
  });

  it('se guarda como un programa propio, que se sigue y que la app trata como los demás', () => {
    const p = customProgram('  Torso y pierna ', [addExercises(emptyDay(0), ['Goblet_Squat']), addExercises(emptyDay(1), ['Pushups'])]);
    expect(p).toMatchObject({ title: 'Torso y pierna', source: 'self', active: true, completions: [] });
    expect(isCustomProgram(p)).toBe(true);
    expect(p.sessions.map((s) => s.id)).toEqual(['A', 'B']);
    expect(nextSessionId(p)).toBe('A');
    expect(customProgram('', [addExercises(emptyDay(0), ['Pushups'])]).title).toBe('My routine');
    expect(customProgram('X', [addExercises(emptyDay(0), ['Pushups'])], { follow: false }).active).toBe(false);
  });

  it('al cambiarla conserva el id, la fecha, lo hecho y si se sigue', () => {
    const base = { ...customProgram('Mía', [addExercises(emptyDay(0), ['Pushups'])]), active: false, completions: [{ sessionId: 'A', at: '2026-10-20T18:00:00Z', minutes: 30 }] };
    const edited = customProgram('Mía 2', [addExercises(emptyDay(0), ['Pushups', 'Plank'])], { base });
    expect(edited).toMatchObject({ id: base.id, createdAt: base.createdAt, active: false, completions: base.completions, title: 'Mía 2' });
    expect(ids(edited.sessions[0])).toEqual(['Pushups', 'Plank']);
  });
});

import { describe, expect, it } from 'vitest';
import { EXERCISE_LIST, canDo, getExercise, isLoadable, kgHead } from '@/data/workouts/catalog';
import { doseText } from '@/data/workouts/labels';
import type { WorkoutPrefs } from '@/data/workouts/types';
import {
  DEFAULT_PREFS,
  alternativesFor,
  equipmentForPlace,
  estimateMinutes,
  generateProgram,
  goalFromPatientGoals,
  nextSessionId,
  splitFor,
} from '@/logic/workoutGenerator';

const prefs = (p: Partial<WorkoutPrefs>): WorkoutPrefs => ({ ...DEFAULT_PREFS, ...p });
const exIds = (s: { exercises: { exerciseId: string }[] }) => s.exercises.map((e) => e.exerciseId);

describe('Catálogo de ejercicios', () => {
  it('cada ejercicio trae nombre e indicaciones en los dos idiomas y dos fotos', () => {
    expect(EXERCISE_LIST.length).toBeGreaterThan(100);
    for (const ex of EXERCISE_LIST) {
      expect(ex.name.es, ex.id).toBeTruthy();
      expect(ex.steps.es.length, ex.id).toBeGreaterThan(0);
      expect(ex.steps.en.length, ex.id).toBeGreaterThan(0);
      expect(ex.frames.length, ex.id).toBe(2);
    }
  });

  it('sin material solo salen ejercicios de peso corporal', () => {
    expect(canDo(getExercise('Pushups')!, [])).toBe(true);
    expect(canDo(getExercise('Dumbbell_Bench_Press')!, ['dumbbells'])).toBe(false); // falta el banco
    expect(canDo(getExercise('Goblet_Squat')!, ['dumbbells'])).toBe(true); // pesa rusa o mancuerna
  });

  it('el peso se apunta con material de cargar y en los lastrados ("+kg"), no en fondos ni remo invertido', () => {
    expect(isLoadable(getExercise('Barbell_Bench_Press_-_Medium_Grip')!)).toBe(true);
    expect(isLoadable(getExercise('Pullups')!)).toBe(false);
    for (const id of ['Weighted_Pull_Ups', 'Parallel_Bar_Dip']) {
      expect(isLoadable(getExercise(id)!), id).toBe(true);
      expect(kgHead(getExercise(id)!), id).toBe('+kg');
    }
    for (const id of ['Dips_-_Triceps_Version', 'Dips_-_Chest_Version', 'Inverted_Row']) expect(isLoadable(getExercise(id)!), id).toBe(false);
    expect(kgHead(getExercise('Leg_Press')!)).toBe('kg');
    expect(doseText({ exerciseId: 'Parallel_Bar_Dip', sets: 3, reps: '8', weightKg: 10 })).toBe('3 × 8 · +10 kg');
    expect(doseText({ exerciseId: 'Leg_Press', sets: 3, reps: '8', weightKg: 100 })).toBe('3 × 8 · 100 kg');
  });
});

describe('Generador de entrenamientos', () => {
  it('reparte las sesiones según los días: cuerpo completo hasta 3, torso/pierna con 4', () => {
    expect(splitFor('health', 2)).toEqual(['full', 'full']);
    expect(splitFor('strength', 3)).toEqual(['full', 'full', 'full']);
    expect(splitFor('muscle', 4)).toEqual(['upper', 'lower', 'upper', 'lower']);
    expect(splitFor('fat_loss', 4)).toEqual(['full', 'conditioning', 'full', 'conditioning']);
    expect(splitFor('mobility', 3)).toEqual(['mobility', 'mobility', 'mobility']);
  });

  it('en casa sin material: todo se puede hacer sin material y hay calentamiento y estiramientos', () => {
    const program = generateProgram(prefs({ place: 'home', equipment: [] }));
    expect(program).toHaveLength(3);
    for (const s of program) {
      for (const id of exIds(s)) expect(canDo(getExercise(id)!, []), id).toBe(true);
      expect(s.exercises.some((e) => e.block === 'warmup')).toBe(true);
      expect(s.exercises.some((e) => e.block === 'cooldown')).toBe(true);
      // Hay pierna, empuje y abdomen en cada cuerpo completo
      const patterns = s.exercises.filter((e) => e.block === 'main').map((e) => getExercise(e.exerciseId)!.pattern);
      expect(patterns.some((p) => ['squat', 'lunge', 'hinge'].includes(p))).toBe(true);
      expect(patterns.some((p) => ['push_h', 'push_v'].includes(p))).toBe(true);
    }
  });

  it('un principiante no recibe ejercicios de nivel intermedio o avanzado', () => {
    const program = generateProgram(prefs({ level: 'beginner', place: 'gym', equipment: equipmentForPlace('gym', []) }));
    for (const s of program) for (const id of exIds(s)) expect(getExercise(id)!.level, id).toBe('beginner');
  });

  it('"sin saltos" quita los ejercicios con impacto', () => {
    const program = generateProgram(prefs({ goal: 'fat_loss', level: 'intermediate', daysPerWeek: 4, lowImpact: true }));
    for (const s of program) for (const id of exIds(s)) expect(getExercise(id)!.impact ?? false, id).toBe(false);
  });

  it('la duración estimada se ajusta a los minutos pedidos (con un margen)', () => {
    for (const minutes of [20, 30, 45, 60]) {
      for (const goal of ['health', 'strength', 'muscle', 'fat_loss'] as const) {
        const program = generateProgram(prefs({ goal, minutes, level: 'intermediate', place: 'gym', equipment: equipmentForPlace('gym', []) }));
        for (const s of program) expect(estimateMinutes(s), `${goal} ${minutes}`).toBeLessThanOrEqual(minutes + 8);
      }
    }
  });

  it('fuerza: series de pocas repeticiones con descansos largos; pérdida de grasa: descansos cortos', () => {
    const strength = generateProgram(prefs({ goal: 'strength', level: 'intermediate', place: 'gym', equipment: equipmentForPlace('gym', []), minutes: 60 }));
    const main = strength[0].exercises.find((e) => e.block === 'main')!;
    expect(main.reps).toBe('5–6');
    expect(main.restSec).toBeGreaterThanOrEqual(120);
    const fat = generateProgram(prefs({ goal: 'fat_loss', level: 'intermediate' }));
    for (const e of fat[0].exercises.filter((x) => x.block === 'main')) expect(e.restSec).toBeLessThanOrEqual(45);
  });

  it('las sesiones de la semana no repiten el mismo ejercicio principal si hay donde elegir', () => {
    const program = generateProgram(prefs({ place: 'gym', equipment: equipmentForPlace('gym', []), level: 'intermediate', minutes: 45 }));
    const mains = program.flatMap((s) => s.exercises.filter((e) => e.block === 'main').map((e) => e.exerciseId));
    const repeated = mains.length - new Set(mains).size;
    expect(repeated).toBeLessThanOrEqual(2);
  });

  it('es determinista con la misma semilla y cambia con otra', () => {
    const a = generateProgram(prefs({ seed: 3 }));
    const b = generateProgram(prefs({ seed: 3 }));
    const c = generateProgram(prefs({ seed: 4 }));
    expect(a).toEqual(b);
    expect(JSON.stringify(a)).not.toEqual(JSON.stringify(c));
  });

  it('cambiar un ejercicio ofrece otros del mismo patrón que se pueden hacer', () => {
    const alts = alternativesFor('Goblet_Squat', { equipment: [], level: 'beginner', lowImpact: false });
    expect(alts.map((a) => a.id)).toContain('Bodyweight_Squat');
    expect(alts.every((a) => a.pattern === 'squat')).toBe(true);
    expect(alts.map((a) => a.id)).not.toContain('Leg_Press');
    expect(alternativesFor('Goblet_Squat', { equipment: [], level: 'beginner', lowImpact: false }, { anyEquipment: true }).map((a) => a.id)).toContain('Leg_Press');
  });

  it('la sesión que toca es la siguiente a la última hecha', () => {
    const sessions = generateProgram(prefs({}));
    expect(nextSessionId({ sessions, completions: [] })).toBe('A');
    expect(nextSessionId({ sessions, completions: [{ sessionId: 'A', at: '2026-10-19T10:00:00Z', minutes: 30 }] })).toBe('B');
    expect(nextSessionId({ sessions, completions: [{ sessionId: 'C', at: '2026-10-19T10:00:00Z', minutes: 30 }] })).toBe('A');
  });

  it('el objetivo del paciente en el portal decide el de partida', () => {
    expect(goalFromPatientGoals(['Perder peso'])).toBe('fat_loss');
    expect(goalFromPatientGoals(['Perform better in sport'])).toBe('strength');
    expect(goalFromPatientGoals(['More energy', 'Sleep better'])).toBe('health');
  });
});

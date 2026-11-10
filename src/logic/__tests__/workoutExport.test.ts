import { describe, expect, it } from 'vitest';
import { buildWorkoutExport, exportFileName, historyPart, progressRows, workoutExportText } from '@/logic/workoutExport';
import { workoutHistory, type LoggedWorkout } from '@/logic/workoutHistory';
import { workoutsToHtml } from '@/utils/workoutPdf';
import { CUSTOM_PREFS } from '@/logic/customRoutine';
import type { WorkoutProgram } from '@/data/workouts/types';

// Exportar el plan y el historial (fundador, 2026-11-09): el texto para una IA y el PDF salen de los mismos datos

const NOW = new Date('2026-11-09T12:00:00.000Z');

const own: WorkoutProgram = {
  id: 'p-own',
  title: 'Push Pull',
  createdAt: '2026-09-01T10:00:00.000Z',
  source: 'self',
  prefs: CUSTOM_PREFS,
  active: true,
  sessions: [
    {
      id: 'A',
      title: 'Push',
      focus: 'upper',
      weekdays: [1, 4],
      exercises: [
        { exerciseId: 'Goblet_Squat', block: 'main', sets: 3, reps: '8', restSec: 90, weightKg: 20, setPlan: [{ kg: 20, reps: '8' }, { kg: 22.5, reps: '6' }, { kg: 25, reps: '5' }], note: 'Espalda recta' },
        { exerciseId: 'Weighted_Pull_Ups', block: 'main', sets: 3, reps: '6', restSec: 120, weightKg: 10 },
        { exerciseId: 'Plank', block: 'cooldown', sets: 1, reps: '30 s', restSec: 0 },
      ],
    },
    { id: 'B', title: '', focus: 'full', exercises: [] },
  ],
  completions: [
    { sessionId: 'A', at: '2026-10-01T18:00:00.000Z', minutes: 45, sets: [{ exerciseId: 'Goblet_Squat', kg: 16, reps: 10 }, { exerciseId: 'Goblet_Squat', kg: 16, reps: 9 }] },
    { sessionId: 'A', at: '2026-10-20T18:00:00.000Z', minutes: 50, sets: [{ exerciseId: 'Goblet_Squat', kg: 26, reps: 4 }, { exerciseId: 'Plank', sec: 40 }] },
    { sessionId: 'A', at: '2026-11-03T18:00:00.000Z', minutes: 52, sets: [{ exerciseId: 'Goblet_Squat', kg: 25, reps: 6 }, { exerciseId: 'Goblet_Squat', kg: 22.5, reps: 8 }] },
    // Hace un año: fuera de «3 meses», dentro de «Todo»
    { sessionId: 'A', at: '2025-11-01T18:00:00.000Z', minutes: 30, sets: [{ exerciseId: 'Goblet_Squat', kg: 12, reps: 10 }] },
  ],
};

const trainer: WorkoutProgram = {
  ...own,
  id: 'p-trainer',
  title: 'Strength to get started',
  source: 'professional',
  professionalName: 'Laura',
  prefs: { ...CUSTOM_PREFS, custom: false, goal: 'strength', place: 'gym', minutes: 45 },
  active: false,
  note: 'Calienta bien',
  sessions: [{ id: 'A', title: 'Full body', focus: 'full', exercises: [] }],
  completions: [{ sessionId: 'A', at: '2026-10-10T08:00:00.000Z', minutes: 40 }],
};

const logged: LoggedWorkout[] = [{ id: 'w1', fecha: '2026-10-29T09:00:00.000Z', type: 'cardio', minutes: 30, intensity: 'moderate' }];

describe('Exportar el entrenamiento', () => {
  it('el plan lleva cada rutina con sus días, sus bloques, la dosis, el descanso, las series que cambian y la nota', () => {
    const doc = buildWorkoutExport([own, trainer], logged, { programId: 'p-own', period: null, now: NOW });
    expect(doc.history).toBeNull();
    const [a, b] = doc.plan!.routines;
    expect(a.title).toBe('Push · A');
    expect(a.days).toBe('Mon, Thu');
    expect(a.blocks.map((x) => x.label)).toEqual(['Workout', 'Cool-down']);
    const [squat, pullUps] = a.blocks[0].items;
    expect(squat).toMatchObject({ name: 'Goblet Squat', perSet: '20 kg × 8 · 22.5 kg × 6 · 25 kg × 5', note: 'Espalda recta', rest: 'rest 90 s' });
    expect(pullUps.dose).toContain('+10 kg');
    expect(pullUps.perSet).toBeNull();
    expect(b.blocks).toEqual([]);
    // Un programa hecho a mano no se traduce ni dice el nivel ni el sitio
    expect(doc.plan!.title).toBe('Push Pull');
    expect(doc.plan!.byline[0]).toBe('Made by you');
  });

  it('el del entrenador dice de quién es, su nota y lo que se pidió al generador', () => {
    const doc = buildWorkoutExport([own, trainer], logged, { programId: 'p-trainer', period: null, now: NOW });
    expect(doc.plan!.byline).toEqual(expect.arrayContaining(['From Laura', '45 min per session', 'At the gym']));
    expect(doc.plan!.note).toBe('Calienta bien');
  });

  it('el historial se queda en el periodo, junta las sesiones y los entrenos apuntados y cuenta por semana', () => {
    const h = historyPart([own, trainer], logged, 3, 'p-own', NOW);
    expect(h.count).toBe(5); // 3 del programa propio + 1 del entrenador + 1 cardio apuntado
    expect(h.minutes).toBe(45 + 50 + 52 + 40 + 30);
    // Por semana desde el primer entreno del periodo (1 oct → 9 nov, 5,7 semanas), no desde hace 3 meses
    expect(h.perWeek).toBe('0.9');
    expect(h.months.map((m) => m.items.length)).toEqual([1, 4]);
    const items = h.months.flatMap((m) => m.items);
    // La sesión de otro programa dice cuál; la del plan, no
    expect(items.find((e) => e.minutes === 40)?.program).toBe('Strength to get started');
    expect(items.find((e) => e.minutes === 52)?.program).toBeNull();
    expect(items.find((e) => e.title === 'Cardio')?.facts).toEqual(['Moderate']);
    expect(historyPart([own, trainer], logged, 'all', 'p-own', NOW).count).toBe(6);
  });

  it('el progreso por ejercicio: la serie más pesada la primera y la última vez, y la mejor', () => {
    const [squat, plank] = progressRows(workoutHistory([own], []).filter((e) => e.at >= '2026-10'));
    expect(squat.name).toBe('Goblet Squat');
    expect(squat.sessions).toBe(3);
    expect(squat.first).toMatch(/^16 kg × 10 /);
    expect(squat.last).toMatch(/^25 kg × 6 /);
    expect(squat.best).toMatch(/^26 kg × 4 /);
    // Lastrado: el peso es el lastre
    const [pulls] = progressRows(workoutHistory([{ ...own, completions: [{ sessionId: 'A', at: '2026-11-01T10:00:00.000Z', minutes: 40, sets: [{ exerciseId: 'Weighted_Pull_Ups', kg: 12.5, reps: 5 }] }] }], []));
    expect(pulls.best).toMatch(/^\+12.5 kg × 5 /);
    expect(plank).toMatchObject({ name: 'Plank', sessions: 1 });
    expect(plank.best).toMatch(/^0:40 /);
  });

  it('el texto para una IA explica las unidades y lleva plan, historial y progreso', () => {
    const text = workoutExportText(buildWorkoutExport([own, trainer], logged, { programId: 'p-own', period: 3, now: NOW }));
    expect(text.startsWith('# Workouts · Kuova Health')).toBe(true);
    expect(text).toContain('Weights in kg');
    expect(text).toContain('## Plan: Push Pull');
    expect(text).toContain('### Push · A (Mon, Thu) · ~');
    expect(text).toContain('  Set by set: 20 kg × 8 · 22.5 kg × 6 · 25 kg × 5');
    expect(text).toContain('## History: last 3 months');
    expect(text).toContain('5 workouts · 217 min');
    expect(text).toContain('  - Goblet Squat: 25 kg × 6 · 22.5 kg × 8');
    expect(text).toContain('## Progress by exercise');
    expect(text).not.toContain('2025'); // lo de hace un año se queda fuera
    // La mejor sale solo si no es la última; lo hecho una vez, una vez
    expect(text).toMatch(/- Goblet Squat \(3 sessions\): 16 kg × 10 \([^)]*\) → 25 kg × 6 \([^)]*\) · best 26 kg × 4/);
    expect(text).toMatch(/- Plank \(1 session\): 0:40 \([^)]*\)\n/);
  });

  it('sin entrenos en el periodo lo dice', () => {
    const text = workoutExportText(buildWorkoutExport([], [], { programId: null, period: 1, now: NOW }));
    expect(text).toContain('No workouts in this period.');
    expect(text).not.toContain('## Plan');
  });

  it('el PDF lleva la marca, el plan, el historial en otra página y escapa lo escrito a mano', () => {
    const p = { ...own, title: 'Mi <rutina> & co' };
    const html = workoutsToHtml(buildWorkoutExport([p, trainer], logged, { programId: 'p-own', period: 3, now: NOW }), exportFileName(NOW));
    expect(html).toContain('aria-label="Kuova"');
    expect(html).toContain('Mi &lt;rutina&gt; &amp; co');
    expect(html).toContain('class="new-page"');
    expect(html).toContain('Progress by exercise');
    expect(html).not.toMatch(/<script/i);
    expect(exportFileName(NOW)).toBe('Kuova-workouts-2026-11-09');
  });
});

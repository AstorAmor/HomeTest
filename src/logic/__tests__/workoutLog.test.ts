import { describe, expect, it } from 'vitest';
import type { WorkoutCompletion } from '@/data/workouts/types';
import { checkRow, lastTimes, nextPending, parseKg, rowHints, setHint, setLogs, startRows, summarize, type SetRow } from '@/logic/workoutLog';

const row = (kg: string, reps: string, done = false): SetRow => ({ kg, reps, done });
const done = (at: string, sets: WorkoutCompletion['sets'], sessionId = 'A'): WorkoutCompletion => ({ sessionId, at, minutes: 40, sets });

describe('Registro de series', () => {
  it('lee el peso con coma o con punto y descarta lo que no es un número', () => {
    expect(parseKg('22,5')).toBe(22.5);
    expect(parseKg(' 40 ')).toBe(40);
    expect(parseKg('')).toBeUndefined();
    expect(parseKg('abc')).toBeUndefined();
    expect(parseKg('-5')).toBeUndefined();
  });

  it('la última vez de cada ejercicio sale de la sesión más reciente que lo tenga, en cualquier programa', () => {
    const programs = [
      { completions: [done('2026-10-10T18:00:00Z', [{ exerciseId: 'Goblet_Squat', kg: 16, reps: 10 }])] },
      {
        completions: [
          done('2026-10-15T18:00:00Z', [
            { exerciseId: 'Goblet_Squat', kg: 20, reps: 10 },
            { exerciseId: 'Goblet_Squat', kg: 20, reps: 8 },
          ]),
          done('2026-10-20T18:00:00Z', undefined), // de antes de apuntar series
          done('2026-10-18T18:00:00Z', [{ exerciseId: 'Pushups', reps: 12 }]),
        ],
      },
    ];
    const last = lastTimes(programs);
    expect(last.get('Goblet_Squat')).toEqual({
      at: '2026-10-15T18:00:00Z',
      sets: [
        { exerciseId: 'Goblet_Squat', kg: 20, reps: 10 },
        { exerciseId: 'Goblet_Squat', kg: 20, reps: 8 },
      ],
    });
    expect(last.get('Pushups')?.at).toBe('2026-10-18T18:00:00Z');
    expect(lastTimes(programs, '2026-10-12T00:00:00Z').get('Goblet_Squat')?.sets[0].kg).toBe(16);
  });

  it('la pista de cada serie: manda la rutina; si no dice peso, lo de esa serie la última vez', () => {
    const last = [
      { exerciseId: 'x', kg: 20, reps: 10 },
      { exerciseId: 'x', kg: 22.5, reps: 8 },
    ];
    // Con peso en la rutina: el de la rutina (la última vez sale en «Anterior»); reps, el objetivo
    const withKg = { sets: 3, reps: '8–10', weightKg: 12 };
    expect(setHint(withKg, last, 1)).toEqual({ kg: 12, reps: 8 });
    expect(setHint(withKg, undefined, 0)).toEqual({ kg: 12, reps: 8 });
    // Sin peso en la rutina: la misma serie la última vez, si no la de arriba hoy, si no la última de entonces
    const noKg = { sets: 3, reps: '8–10' };
    expect(setHint(noKg, last, 1)).toEqual({ kg: 22.5, reps: 8 });
    expect(setHint(noKg, last, 1, 25)).toEqual({ kg: 22.5, reps: 8 });
    expect(setHint(noKg, last, 2, 25)).toEqual({ kg: 25, reps: 8 });
    expect(setHint(noKg, last, 3)).toEqual({ kg: 22.5, reps: 8 });
    expect(setHint(noKg, undefined, 1, 16)).toEqual({ kg: 16, reps: 8 });
  });

  it('con la rutina serie a serie (como en Hevy), cada fila lleva su peso y sus repeticiones', () => {
    const item = {
      sets: 4,
      reps: '6–7',
      weightKg: 100,
      setPlan: [
        { kg: 100, reps: '6' },
        { kg: 100, reps: '6' },
        { kg: 90, reps: '7' },
        { kg: 90, reps: '7' },
      ],
    };
    const hints = rowHints(item, [{ exerciseId: 'x', kg: 95, reps: 6 }], startRows(item));
    expect(hints).toEqual([
      { kg: 100, reps: 6 },
      { kg: 100, reps: 6 },
      { kg: 90, reps: 7 },
      { kg: 90, reps: 7 },
    ]);
    // Una serie añadida en la sesión copia la última de la rutina
    expect(setHint(item, undefined, 4)).toEqual({ kg: 90, reps: 7 });
    // Por tiempo, los segundos de cada serie
    expect(setHint({ sets: 2, reps: '30 s', setPlan: [{ reps: '30 s' }, { reps: '45 s' }] }, undefined, 1)).toEqual({ reps: 45 });
  });

  it('el peso escrito en una serie pasa como pista a las de abajo, aunque aún no estén marcadas', () => {
    const rows = [row('16', '10', true), row('', ''), row('', ''), row('18', '')];
    expect(rowHints({ sets: 4, reps: '10–12' }, undefined, rows).map((h) => h.kg)).toEqual([undefined, 16, 16, 16]);
    expect(rowHints({ sets: 4, reps: '10–12' }, undefined, [...rows, row('', '')])[4].kg).toBe(18);
    // Sin nada escrito, la de la rutina en todas
    expect(rowHints({ sets: 3, reps: '10', weightKg: 20 }, undefined, startRows({ sets: 3, reps: '10' })).map((h) => h.kg)).toEqual([20, 20, 20]);
    // Por tiempo: los segundos de la rutina
    expect(setHint({ sets: 1, reps: '45 s' }, [{ exerciseId: 'x', sec: 30 }], 0)).toEqual({ reps: 45 });
  });

  it('al marcar una serie sin escribir se queda con la pista; lo escrito manda', () => {
    expect(checkRow(row('', ''), { kg: 22.5, reps: 8 }, (n) => String(n).replace('.', ','))).toEqual(row('22,5', '8', true));
    expect(checkRow(row('25', '6'), { kg: 22.5, reps: 8 })).toEqual(row('25', '6', true));
    expect(checkRow(row('', ''), {})).toEqual(row('', '', true));
  });

  it('se guardan solo las series hechas; sin peso no se apunta 0 kg y por tiempo van segundos', () => {
    const items = [
      { exerciseId: 'Goblet_Squat', reps: '10–12' },
      { exerciseId: 'Pushups', reps: '12' },
      { exerciseId: 'Plank', reps: '30 s' },
    ];
    const rows = [[row('20', '10', true), row('20', '9', true), row('', '', false)], [row('', '12', true)], [row('', '30', true)]];
    expect(setLogs(items, rows)).toEqual([
      { exerciseId: 'Goblet_Squat', kg: 20, reps: 10 },
      { exerciseId: 'Goblet_Squat', kg: 20, reps: 9 },
      { exerciseId: 'Pushups', reps: 12 },
      { exerciseId: 'Plank', sec: 30 },
    ]);
  });

  it('el modo guiado sigue por la siguiente serie sin hacer y se salta las marcadas en la lista', () => {
    const rows = [startRows({ sets: 2, reps: '10' }), startRows({ sets: 2, reps: '10' })];
    expect(nextPending(rows)).toEqual({ item: 0, set: 1 });
    rows[0][1].done = true;
    rows[1][0].done = true;
    expect(nextPending(rows, { item: 0, set: 1 })).toEqual({ item: 1, set: 2 });
    rows[1][1].done = true;
    expect(nextPending(rows, { item: 0, set: 1 })).toBeNull();
    // Sin más por delante no vuelve atrás (la que se saltó queda sin hacer)
    expect(nextPending(rows)).toEqual({ item: 0, set: 1 });
  });

  it('el resumen suma los kilos movidos y compara la mejor serie con la de la última vez', () => {
    const last = lastTimes([
      {
        completions: [
          done('2026-10-15T18:00:00Z', [
            { exerciseId: 'Goblet_Squat', kg: 20, reps: 10 },
            { exerciseId: 'Pushups', reps: 12 },
            { exerciseId: 'Dumbbell_Bench_Press', kg: 18, reps: 10 },
            { exerciseId: 'Plank', sec: 30 },
          ]),
        ],
      },
    ]);
    const s = summarize(
      [
        { exerciseId: 'Goblet_Squat', kg: 22.5, reps: 8 },
        { exerciseId: 'Goblet_Squat', kg: 20, reps: 10 },
        { exerciseId: 'Pushups', reps: 14 },
        { exerciseId: 'Dumbbell_Bench_Press', kg: 16, reps: 12 },
        { exerciseId: 'Plank', sec: 30 },
        { exerciseId: 'Bodyweight_Squat', reps: 15 },
      ],
      last,
    );
    expect(s.sets).toBe(6);
    expect(s.volumeKg).toBe(Math.round(22.5 * 8 + 20 * 10 + 16 * 12));
    const by = Object.fromEntries(s.exercises.map((e) => [e.exerciseId, e]));
    expect(by.Goblet_Squat).toMatchObject({ sets: 2, best: { kg: 22.5, reps: 8 }, change: 'more_weight' });
    expect(by.Pushups.change).toBe('more_reps');
    expect(by.Dumbbell_Bench_Press).toMatchObject({ change: 'less', previous: { kg: 18, reps: 10 } });
    expect(by.Plank.change).toBe('same');
    expect(by.Bodyweight_Squat.change).toBe('first');
  });
});

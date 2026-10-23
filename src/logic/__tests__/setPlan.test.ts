import { describe, expect, it } from 'vitest';
import type { WorkoutExercise } from '@/data/workouts/types';
import { fromDraft, switchTimed, toDraft } from '@/logic/customRoutine';
import { applyDose, plannedSet, plannedSets, withPlan } from '@/logic/setPlan';

const bench: WorkoutExercise = { exerciseId: 'Barbell_Bench_Press_-_Medium_Grip', block: 'main', sets: 3, reps: '8–10', restSec: 90, weightKg: 60 };

describe('Series de la rutina, serie a serie', () => {
  it('una rutina guardada antes (sin setPlan) tiene sus series iguales', () => {
    expect(plannedSets(bench)).toEqual([
      { kg: 60, reps: '8–10' },
      { kg: 60, reps: '8–10' },
      { kg: 60, reps: '8–10' },
    ]);
    expect(plannedSets({ ...bench, weightKg: undefined })[0]).toEqual({ reps: '8–10' });
    // Una serie de más (añadida en la sesión) copia la última
    expect(plannedSet(bench, 7)).toEqual({ kg: 60, reps: '8–10' });
  });

  it('si las series son distintas se guardan serie a serie con un resumen; si son iguales, como siempre', () => {
    const plan = [
      { kg: 100, reps: '6' },
      { kg: 100, reps: '6' },
      { kg: 90, reps: '7' },
      { kg: 90, reps: '7' },
    ];
    const it4 = withPlan(bench, plan);
    expect(it4).toMatchObject({ sets: 4, reps: '6–7', weightKg: 100, setPlan: plan, restSec: 90 });
    const same = withPlan(bench, [
      { kg: 70, reps: '5' },
      { kg: 70, reps: '5' },
    ]);
    expect(same).toEqual({ exerciseId: bench.exerciseId, block: 'main', sets: 2, reps: '5', restSec: 90, weightKg: 70 });
    // Sin peso: no se guarda weightKg
    expect(withPlan(bench, [{ reps: '12' }]).weightKg).toBeUndefined();
  });

  it('el lápiz (misma dosis para todas) deja de ir serie a serie salvo que solo cambie el descanso', () => {
    const it4 = withPlan(bench, [
      { kg: 100, reps: '6' },
      { kg: 90, reps: '7' },
    ]);
    expect(applyDose(it4, { sets: it4.sets, reps: it4.reps, restSec: 120, weightKg: it4.weightKg }).setPlan).toHaveLength(2);
    expect(applyDose(it4, { sets: 3, reps: it4.reps, restSec: 90, weightKg: it4.weightKg }).setPlan).toBeUndefined();
  });
});

describe('Editor de rutina como Hevy', () => {
  it('cada serie es una fila con lo escrito; al guardar, peso con coma, rangos y lo que no vale se queda como estaba', () => {
    expect(toDraft(bench, (n) => String(n).replace('.', ','))).toEqual([
      { kg: '60', reps: '8–10' },
      { kg: '60', reps: '8–10' },
      { kg: '60', reps: '8–10' },
    ]);
    const saved = fromDraft(bench, [
      { kg: '62,5', reps: '8' },
      { kg: '60', reps: '8-10' },
      { kg: '', reps: 'abc' },
    ]);
    expect(saved.setPlan).toEqual([
      { kg: 62.5, reps: '8' },
      { kg: 60, reps: '8–10' },
      { reps: '8–10' },
    ]);
    expect(saved).toMatchObject({ sets: 3, reps: '8–10', weightKg: 62.5 });
  });

  it('por tiempo, cada fila son segundos; se puede pasar de repeticiones a tiempo y al revés', () => {
    const plank: WorkoutExercise = { exerciseId: 'Plank', block: 'main', sets: 2, reps: '30 s', restSec: 30 };
    expect(toDraft(plank)).toEqual([
      { kg: '', reps: '30' },
      { kg: '', reps: '30' },
    ]);
    expect(fromDraft(plank, [{ kg: '', reps: '45' }, { kg: '', reps: '90' }]).setPlan).toEqual([{ reps: '45 s' }, { reps: '1 min 30 s' }]);
    const toTime = switchTimed(bench, toDraft(bench), true);
    expect(toTime.item).toMatchObject({ reps: '30 s', sets: 3 });
    expect(toTime.item.weightKg).toBeUndefined();
    expect(fromDraft(toTime.item, toTime.draft)).toMatchObject({ sets: 3, reps: '30 s' });
    const back = switchTimed(toTime.item, toTime.draft, false);
    expect(fromDraft(back.item, back.draft)).toMatchObject({ sets: 3, reps: '10' });
  });
});

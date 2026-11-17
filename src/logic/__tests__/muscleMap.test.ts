import { describe, expect, it } from 'vitest';
import { EXERCISE_LIST } from '@/data/workouts/catalog';
import { MUSCLE_LAYERS, MUSCLE_TONE, VIEW_LAYERS, muscleHighlights, muscleLegend } from '@/logic/muscleMap';

// El mapa de músculos de la ficha de un ejercicio (fundador, 2026-11-16: «para cada ejercicio, los músculos que
// implica»)
describe('El mapa de músculos de un ejercicio', () => {
  it('todos los músculos del catálogo tienen capa, y cada capa existe en alguna vista; dos tonos, rojo y violeta', () => {
    const used = new Set(EXERCISE_LIST.flatMap((e) => [...e.primary, ...e.secondary]));
    for (const m of used) expect(MUSCLE_LAYERS[m], m).toBeTruthy();
    const drawn = new Set([...VIEW_LAYERS.front, ...VIEW_LAYERS.back]);
    for (const layers of Object.values(MUSCLE_LAYERS)) for (const l of layers) expect(drawn.has(l), l).toBe(true);
    expect(MUSCLE_TONE.primary).toMatch(/^#F[0-9A-F]{5}$/);
    expect(MUSCLE_TONE.secondary).toMatch(/^#[0-9A-F]{6}$/);
    expect(MUSCLE_TONE.primary).not.toBe(MUSCLE_TONE.secondary);
  });

  it('press de banca: el pecho vivo de frente; hombros y tríceps, más suaves', () => {
    const h = muscleHighlights(['chest'], ['shoulders', 'triceps']);
    expect(h.front).toEqual([
      { layer: 'chest', level: 'primary' },
      { layer: 'shoulders', level: 'secondary' },
    ]);
    expect(h.back).toEqual([
      { layer: 'shoulders', level: 'secondary' },
      { layer: 'triceps', level: 'secondary' },
    ]);
  });

  it('sentadilla: cuádriceps de frente; glúteos, isquios y gemelos; los gemelos salen en las dos vistas', () => {
    const h = muscleHighlights(['quadriceps'], ['calves', 'glutes', 'hamstrings']);
    expect(h.front.map((x) => x.layer)).toEqual(['quadriceps', 'calves']);
    expect(h.back.map((x) => x.layer)).toEqual(['glutes', 'hamstrings', 'calves']);
    expect(h.front[0].level).toBe('primary');
    expect(h.back.every((x) => x.level === 'secondary')).toBe(true);
  });

  it('una capa que sale como principal y como secundaria cuenta como principal', () => {
    // remo: «middle back» enciende trapecio y dorsal; el dorsal además viene como secundario
    const h = muscleHighlights(['middle back'], ['lats', 'biceps']);
    expect(h.back).toEqual([
      { layer: 'traps', level: 'primary' },
      { layer: 'lats', level: 'primary' },
    ]);
    expect(h.front).toEqual([{ layer: 'biceps', level: 'secondary' }]);
  });

  it('los abdominales encienden el recto y los oblicuos; un músculo sin capa no rompe nada', () => {
    expect(muscleHighlights(['abdominals'], []).front.map((x) => x.layer)).toEqual(['abs', 'obliques']);
    expect(muscleHighlights(['something else'], [])).toEqual({ front: [], back: [] });
  });

  it('la leyenda: primero los principales, sin repetir', () => {
    expect(muscleLegend(['chest', 'triceps'], ['shoulders', 'chest', 'unknown'])).toEqual([
      { muscle: 'chest', level: 'primary' },
      { muscle: 'triceps', level: 'primary' },
      { muscle: 'shoulders', level: 'secondary' },
    ]);
  });
});

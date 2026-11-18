import { describe, expect, it } from 'vitest';
import { es } from '@/i18n/es';
import { workoutsEs } from '@/i18n/workoutsEs';
import { BADGE_EMBLEM_PATHS } from '@/components/badges/badgeIconPaths';
import { DUMBBELL_PATH, isWeightsIcon } from '@/components/fine/dumbbell';
import { workoutHistory, type LoggedWorkout } from '@/logic/workoutHistory';
import { historyPart } from '@/logic/workoutExport';
import {
  OTHER_SPORT,
  SPORT_NAME_MAX,
  WORKOUT_SPORTS,
  WORKOUT_TYPE_LABEL,
  cleanSportName,
  sportName,
  sportOptions,
  sportToSave,
  workoutLabel,
  workoutTypeFromRow,
  workoutTypeToRow,
} from '@/logic/workoutSports';

// «Otro» al apuntar un entreno, con su deporte (fundador, 2026-11-17), y las pesas únicas de toda la app.
// Igual que src/i18n/index.ts: es.ts gana a workoutsEs
const ES: Record<string, string> = { ...workoutsEs, ...es };

type Fs = { readFileSync: (p: string, enc: 'utf8') => string };

describe('El deporte de un entreno de «Otro»', () => {
  it('lo elegido en la lista se guarda con su clave; con «Otro», el nombre escrito y limpio', () => {
    expect(sportToSave('tennis')).toBe('tennis');
    expect(sportToSave(OTHER_SPORT, '  Petanca   con amigos ')).toBe('Petanca con amigos');
    expect(sportToSave(OTHER_SPORT, '   ')).toBeUndefined();
    expect(sportToSave(null)).toBeUndefined();
    expect(sportToSave('no-existe')).toBeUndefined();
    expect(cleanSportName('x'.repeat(80))).toHaveLength(SPORT_NAME_MAX);
  });

  it('en la tabla viaja dentro de `type` y al leer se separa otra vez', () => {
    expect(workoutTypeToRow('sport', 'tennis')).toBe('sport:tennis');
    expect(workoutTypeToRow('sport', 'Petanca con amigos')).toBe('sport:Petanca con amigos');
    expect(workoutTypeFromRow('sport:tennis')).toEqual({ type: 'sport', sport: 'tennis' });
    expect(workoutTypeFromRow('sport:Petanca con amigos')).toEqual({ type: 'sport', sport: 'Petanca con amigos' });
    // Un nombre con dos puntos no se corta
    expect(workoutTypeFromRow(workoutTypeToRow('sport', 'Tiro: arco'))).toEqual({ type: 'sport', sport: 'Tiro: arco' });
  });

  it('un entreno de antes (solo «sport») y los demás tipos se leen y se guardan como siempre', () => {
    expect(workoutTypeFromRow('sport')).toEqual({ type: 'sport' });
    expect(workoutTypeFromRow('strength')).toEqual({ type: 'strength' });
    expect(workoutTypeFromRow('sport:')).toEqual({ type: 'sport' });
    expect(workoutTypeToRow('sport')).toBe('sport');
    expect(workoutTypeToRow('sport', '  ')).toBe('sport');
    expect(workoutTypeToRow('sport', OTHER_SPORT)).toBe('sport');
    // El deporte solo cuenta con «Otro»
    expect(workoutTypeToRow('strength', 'tennis')).toBe('strength');
    expect(workoutTypeToRow('cardio')).toBe('cardio');
  });

  it('se llama por su deporte si lo lleva y, si no, «Otro»', () => {
    expect(workoutLabel({ type: 'sport', sport: 'tennis' })).toBe('Tennis');
    expect(workoutLabel({ type: 'sport', sport: 'Petanca' })).toBe('Petanca');
    expect(workoutLabel({ type: 'sport' })).toBe('Other');
    expect(workoutLabel({ type: 'strength', sport: 'tennis' })).toBe('Strength');
    expect(workoutLabel({ type: 'algo-nuevo' })).toBe('algo-nuevo');
    expect(sportName(undefined)).toBeNull();
    expect(sportName(OTHER_SPORT)).toBeNull();
  });

  it('la lista va por orden alfabético y acaba en «Otro»', () => {
    const list = sportOptions();
    expect(list).toHaveLength(WORKOUT_SPORTS.length + 1);
    expect(list[list.length - 1]).toEqual({ id: OTHER_SPORT, label: 'Other' });
    const names = list.slice(0, -1).map((s) => s.label);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'en-GB')));
    // Sin claves repetidas, y ninguna es la de «Otro»
    expect(new Set(WORKOUT_SPORTS.map((s) => s.id)).size).toBe(WORKOUT_SPORTS.length);
    expect(WORKOUT_SPORTS.some((s) => s.id === OTHER_SPORT)).toBe(false);
  });

  it('el historial y lo que se exporta lo enseñan', () => {
    const logged: LoggedWorkout[] = [
      { id: 'w1', fecha: '2026-11-16T18:00:00.000Z', type: 'sport', sport: 'tennis', minutes: 60, intensity: 'moderate' },
      { id: 'w2', fecha: '2026-11-15T18:00:00.000Z', type: 'sport', minutes: 30, intensity: 'easy' },
    ];
    const h = workoutHistory([], logged);
    expect(h[0]).toMatchObject({ kind: 'logged', type: 'sport', sport: 'tennis' });
    expect(h[1]).not.toHaveProperty('sport');
    const part = historyPart([], logged, 'all', null, new Date('2026-11-17T12:00:00.000Z'));
    expect(part.months.flatMap((m) => m.items.map((i) => i.title))).toEqual(['Tennis', 'Other']);
  });
});

describe('Apuntar un entreno en español', () => {
  it('cada deporte, cada tipo y cada texto de la pantalla tiene su traducción', async () => {
    const fs = (await import('node:fs' as string)) as Fs;
    const src = fs.readFileSync('src/screens/LogWorkoutScreen.tsx', 'utf8');
    const keys = new Set<string>([...WORKOUT_SPORTS.map((s) => s.label), ...Object.values(WORKOUT_TYPE_LABEL)]);
    // tr('…') en la pantalla y los textos de sus listas (label: '…', hint: '…')
    for (const m of src.matchAll(/\btr\(\s*'((?:\\'|[^'\n])*)'/g)) keys.add(m[1].replace(/\\'/g, "'"));
    for (const m of src.matchAll(/\b(?:label|hint): '((?:\\'|[^'\n])*)'/g)) keys.add(m[1].replace(/\\'/g, "'"));
    expect(keys.size).toBeGreaterThan(30);
    expect([...keys].filter((k) => !(k in ES))).toEqual([]);
  });

  it('el tipo de antes se llama ahora «Otro» y los deportes van en español de España', () => {
    expect(ES[WORKOUT_TYPE_LABEL.sport]).toBe('Otro');
    expect(ES['Scuba diving']).toBe('Buceo');
    expect(ES.Football).toBe('Fútbol');
    expect(ES.Padel).toBe('Pádel');
  });
});

describe('Las pesas, un solo dibujo', () => {
  it('la insignia «Racha de fuerza» usa el del entrenador personal', () => {
    expect(BADGE_EMBLEM_PATHS.barbell).toBe(DUMBBELL_PATH);
  });

  it('el rol de entrenador, el tema de Aprende y el objetivo de forma lo toman del mismo sitio', async () => {
    const fs = (await import('node:fs' as string)) as Fs;
    for (const f of ['src/components/fine/RoleEmblem.tsx', 'src/components/fine/LineEmblem.tsx', 'src/components/fine/GoalEmblem.tsx']) {
      expect(fs.readFileSync(f, 'utf8'), f).toContain('DUMBBELL_PATH');
    }
  });

  it('los nombres de pesas de las librerías de iconos salen con ese dibujo', () => {
    for (const name of ['barbell', 'barbell-outline', 'dumbbell', 'mci:dumbbell']) expect(isWeightsIcon(name)).toBe(true);
    for (const name of ['fitness-outline', 'walk-outline', '', undefined, null]) expect(isWeightsIcon(name)).toBe(false);
  });
});

// El mapa de músculos de un ejercicio (Entrenamientos → ficha del ejercicio): qué capas de la figura se encienden.
// Fundador, 2026-11-16: «a nivel entrenamiento […] incluir de alguna forma estos hologramas y resaltar los grupos
// musculares […] recortarlos bien y hacerlo por capas […] Sería óptimo poder poner, para cada ejercicio, los
// músculos que implica».
// La figura (src/components/workouts/MuscleMap.tsx) es la imagen del fundador recortada por capas: una base con el
// cuerpo entero en un solo tono y, encima, una imagen por grupo muscular en rojo (principal) o violeta (secundario). Aquí, lógica pura (sin
// React Native) para la app y los tests: de los músculos del catálogo (nombres de la base free-exercise-db, en
// inglés: `primary` y `secondary` de cada ejercicio) a las capas de cada vista.

export type MuscleView = 'front' | 'back';
export type MuscleLayer =
  | 'chest'
  | 'shoulders'
  | 'biceps'
  | 'forearms'
  | 'abs'
  | 'obliques'
  | 'abductors'
  | 'quadriceps'
  | 'adductors'
  | 'calves'
  | 'traps'
  | 'triceps'
  | 'lats'
  | 'lowerback'
  | 'glutes'
  | 'hamstrings';

// Las capas que hay recortadas en cada vista (assets/images/muscles)
export const VIEW_LAYERS: Record<MuscleView, MuscleLayer[]> = {
  front: ['chest', 'shoulders', 'biceps', 'forearms', 'abs', 'obliques', 'abductors', 'quadriceps', 'adductors', 'calves'],
  back: ['traps', 'shoulders', 'triceps', 'lats', 'lowerback', 'forearms', 'glutes', 'hamstrings', 'calves', 'abductors'],
};

// Músculo del catálogo → sus capas. «abdominals» enciende el recto y los oblicuos (la base no los separa);
// «middle back» (romboides y trapecio medio), el trapecio y el dorsal, que es lo que cubre esa zona en la figura;
// «neck», el trapecio.
export const MUSCLE_LAYERS: Record<string, MuscleLayer[]> = {
  abdominals: ['abs', 'obliques'],
  abductors: ['abductors'],
  adductors: ['adductors'],
  biceps: ['biceps'],
  calves: ['calves'],
  chest: ['chest'],
  forearms: ['forearms'],
  glutes: ['glutes'],
  hamstrings: ['hamstrings'],
  lats: ['lats'],
  'lower back': ['lowerback'],
  'middle back': ['traps', 'lats'],
  neck: ['traps'],
  quadriceps: ['quadriceps'],
  shoulders: ['shoulders'],
  traps: ['traps'],
  triceps: ['triceps'],
};

export type MuscleLevel = 'primary' | 'secondary';

// Los dos tonos del mapa (fundador, 2026-11-17: «que sea rojo el músculo principal, y luego violeta/azul los
// secundarios»): el de las capas (assets/images/muscles, -p y -s) y el del punto de la leyenda
export const MUSCLE_TONE: Record<MuscleLevel, string> = { primary: '#F0524A', secondary: '#8B7BF2' };
export interface LayerHighlight {
  layer: MuscleLayer;
  level: MuscleLevel;
}

// Las capas que se encienden en cada vista: las de los músculos principales, en rojo, y las de los secundarios,
// en violeta. Si una capa sale por los dos lados, cuenta como principal. En el orden de VIEW_LAYERS
export function muscleHighlights(primary: string[], secondary: string[]): Record<MuscleView, LayerHighlight[]> {
  const level = new Map<MuscleLayer, MuscleLevel>();
  for (const m of secondary) for (const l of MUSCLE_LAYERS[m] ?? []) level.set(l, 'secondary');
  for (const m of primary) for (const l of MUSCLE_LAYERS[m] ?? []) level.set(l, 'primary');
  const of = (view: MuscleView) => VIEW_LAYERS[view].filter((l) => level.has(l)).map((layer) => ({ layer, level: level.get(layer)! }));
  return { front: of('front'), back: of('back') };
}

// La leyenda: los músculos del catálogo sin repetir, primero los principales (un secundario que ya es principal no
// se repite) y solo los que tienen capa
export function muscleLegend(primary: string[], secondary: string[]): { muscle: string; level: MuscleLevel }[] {
  const seen = new Set<string>();
  const out: { muscle: string; level: MuscleLevel }[] = [];
  const add = (list: string[], level: MuscleLevel) => {
    for (const m of list) {
      if (seen.has(m) || !MUSCLE_LAYERS[m]) continue;
      seen.add(m);
      out.push({ muscle: m, level });
    }
  };
  add(primary, 'primary');
  add(secondary, 'secondary');
  return out;
}

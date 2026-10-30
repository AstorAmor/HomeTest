import type { PlanCategory, PlanItemKind } from '@/logic/plan';
import { ART_PALETTES } from '@/components/BlobArt';

// El plan se ordena en tres bloques: hábitos (sueño, calma, agua, check-in), actividad física
// (fuerza, cardio, caminar) y nutrición y suplementación (comida, tomas de medicación, hierro,
// vitamina D…). Lo que se ve de avance en Today sale del mismo plan que el "Plan completo", así que
// todo lo del avance está también allí.

export type { PlanCategory };
// Qué acción va en qué bloque (en la lógica: Hoy no enseña más de 2 del mismo)
export { KIND_CATEGORY } from '@/logic/plan';

export const PLAN_CATEGORIES: { id: PlanCategory; title: string; subtitle: string; icon: string; color: 'violet' | 'coral' | 'green' }[] = [
  { id: 'habits', title: 'Habits', subtitle: 'Sleep, rest, stress and water', icon: 'mci:meditation', color: 'violet' },
  { id: 'activity', title: 'Physical activity', subtitle: 'Strength, cardio and walking', icon: 'mci:run', color: 'coral' },
  { id: 'nutrition', title: 'Nutrition and supplements', subtitle: 'What you eat and what you take', icon: 'mci:food-apple-outline', color: 'green' },
];

// Acciones del informe (act.sueno.…, act.actividad.…, act.dieta.…, act.suplemento.…)
export const actionCategory = (actionId: string): PlanCategory =>
  /^act\.(actividad|ejercicio|fuerza|movimiento)/.test(actionId)
    ? 'activity'
    : /^act\.(dieta|suplemento|nutricion|alimentacion)/.test(actionId)
      ? 'nutrition'
      : 'habits';

// Ilustración de cada acción (icono sobre degradado, como los especialistas) en lugar de fotos
export const KIND_ART: Record<PlanItemKind, { icon: string; palette: [string, string, string] }> = {
  strength: { icon: 'dumbbell', palette: [...ART_PALETTES.terracotta] },
  cardio: { icon: 'run', palette: [...ART_PALETTES.rose] },
  steps: { icon: 'walk', palette: [...ART_PALETTES.ocean] },
  nutrition: { icon: 'food-apple-outline', palette: [...ART_PALETTES.sage] },
  medication: { icon: 'pill', palette: [...ART_PALETTES.gold] },
  sleep: { icon: 'weather-night', palette: [...ART_PALETTES.night] },
  mindfulness: { icon: 'meditation', palette: [...ART_PALETTES.forest] },
  water: { icon: 'cup-water', palette: [...ART_PALETTES.ocean] },
  checkin: { icon: 'emoticon-happy-outline', palette: [...ART_PALETTES.gold] },
};

// Título de una acción, igual en el avance de Today y en el Plan completo (la de nutrición lleva a
// la lista de "Tus nutrientes")
export const planItemTitle = (item: { kind: PlanItemKind; title: string }, tr: (s: string) => string) =>
  item.kind === 'nutrition' ? tr('Food') : tr(item.title);

// Tocar una acción en Hoy abre el plan completo en esa acción (la página intermedia, con dónde
// estás, el porqué y el cómo: fundador, 2026-10-30); desde allí, su botón lleva a lo suyo. Fuerza va a
// Entrenamientos: el programa y la sesión que toca, y desde ahí también se registra uno hecho por tu cuenta.
export const planItemRoute = (kind: PlanItemKind) =>
  kind === 'strength'
    ? { pathname: '/workouts' }
    : kind === 'cardio'
      ? { pathname: '/log-workout', params: { type: 'cardio' } }
      : kind === 'steps'
        ? { pathname: '/metric', params: { kind: 'steps' } }
        : kind === 'sleep'
          ? { pathname: '/metric', params: { kind: 'sleep_duration' } }
          : kind === 'mindfulness'
            ? { pathname: '/exercise', params: { id: 'box_breathing' } }
            : kind === 'water'
              ? { pathname: '/log-water' }
              : kind === 'checkin'
                ? { pathname: '/check-in' }
                : kind === 'medication'
                  ? { pathname: '/medications' }
                  : { pathname: '/nutrients' };

// El botón de cada acción en el plan completo
export const PLAN_ITEM_ACTION: Record<PlanItemKind, string> = {
  strength: 'Go to your strength programme',
  cardio: 'Log a cardio workout',
  steps: 'See your steps',
  sleep: 'See your sleep',
  mindfulness: 'Start a calm session',
  water: 'Log what you drink',
  checkin: 'Do a check-in',
  medication: 'Go to your medication',
  nutrition: 'Tick off your nutrients today',
};

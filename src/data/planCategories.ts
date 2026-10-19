import type { PlanItemKind } from '@/logic/plan';
import { ART_PALETTES } from '@/components/BlobArt';

// El plan se ordena en tres bloques: hábitos (sueño, calma), actividad física (fuerza, caminar)
// y nutrición y suplementación (comida, hierro, vitamina D…). Lo que se ve de avance en Today
// sale del mismo plan que el "Plan completo", así que todo lo del avance está también allí.

export type PlanCategory = 'habits' | 'activity' | 'nutrition';

export const PLAN_CATEGORIES: { id: PlanCategory; title: string; subtitle: string; icon: string; color: 'violet' | 'coral' | 'green' }[] = [
  { id: 'habits', title: 'Habits', subtitle: 'Sleep, rest and stress', icon: 'mci:meditation', color: 'violet' },
  { id: 'activity', title: 'Physical activity', subtitle: 'Strength, walking and moving more', icon: 'mci:run', color: 'coral' },
  { id: 'nutrition', title: 'Nutrition and supplements', subtitle: 'What you eat and what you take', icon: 'mci:food-apple-outline', color: 'green' },
];

export const KIND_CATEGORY: Record<PlanItemKind, PlanCategory> = {
  sleep: 'habits',
  mindfulness: 'habits',
  strength: 'activity',
  steps: 'activity',
  nutrition: 'nutrition',
};

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
  steps: { icon: 'walk', palette: [...ART_PALETTES.ocean] },
  nutrition: { icon: 'food-apple-outline', palette: [...ART_PALETTES.sage] },
  sleep: { icon: 'weather-night', palette: [...ART_PALETTES.night] },
  mindfulness: { icon: 'meditation', palette: [...ART_PALETTES.forest] },
};

// Título de una acción, igual en el avance de Today y en el Plan completo (la de nutrición lleva a
// la lista de "Tus nutrientes")
export const planItemTitle = (item: { kind: PlanItemKind; title: string }, tr: (s: string) => string) =>
  item.kind === 'nutrition' ? tr('Food') : tr(item.title);

// A dónde lleva tocar una acción (lo mismo desde Today y desde el Plan completo). Fuerza va a
// Entrenamientos: el programa y la sesión que toca, y desde ahí también se registra uno hecho por tu cuenta.
export const planItemRoute = (kind: PlanItemKind) =>
  kind === 'strength'
    ? { pathname: '/workouts' }
    : kind === 'steps'
      ? { pathname: '/metric', params: { kind: 'steps' } }
      : kind === 'sleep'
        ? { pathname: '/metric', params: { kind: 'sleep_duration' } }
        : kind === 'mindfulness'
          ? { pathname: '/exercise', params: { id: 'box_breathing' } }
          : { pathname: '/nutrients' };

import type { DayTargets, DietDay, DietPlan, DietPrefs } from '@/data/diet/types';
import { cleanDayTargets, dayKcalTarget, fitDay, type LabFlag } from '@/logic/dietPlanner';

// «Calorías y macros» día a día (fundador, 2026-11-06: «poder configurar lo de breakfast, lunch… para cada día, y arriba
// a la derecha algo rollo aplicar a todos los días»). En el editor cada día lleva su borrador completo: kcal, proteína,
// hidratos, grasa y su reparto por comida (vacío = lo calcula el generador). Al guardar se ordena:
// - si los 7 días son iguales, esos números van a la semana (`prefs`) y los días no llevan nada propio;
// - si no, la semana se queda sin números y cada día lleva los suyos en `days[].targets` (el mismo campo que usa el dietista
//   para un día; `prefsForDay` lo mezcla con la semana, ahora también el reparto por comida).
// Así lo que se ve en el editor es exactamente lo que se guarda.

export type DayDrafts = Record<number, DayTargets | undefined>;

const FIELDS = ['kcalTarget', 'proteinTarget', 'carbsTarget', 'fatTarget', 'meals'] as const;

// La semana sin números propios: todo lo calcula el generador
export const basePrefs = (prefs: DietPrefs): DietPrefs => ({ ...prefs, ...Object.fromEntries(FIELDS.map((k) => [k, null])) });

// Las preferencias de un día con su borrador
export const draftPrefs = (prefs: DietPrefs, d?: DayTargets): DietPrefs => ({
  ...basePrefs(prefs),
  kcalTarget: d?.kcal ?? null,
  proteinTarget: d?.protein ?? null,
  carbsTarget: d?.carbs ?? null,
  fatTarget: d?.fat ?? null,
  meals: d?.meals ?? null,
});

// Lo que lleva cada día del menú guardado: lo suyo y, lo que no tenga, lo de la semana
export function dayDrafts(plan: Pick<DietPlan, 'prefs' | 'days'>): DayDrafts {
  const p = plan.prefs;
  const out: DayDrafts = {};
  for (const d of plan.days) {
    const t = d.targets ?? {};
    out[d.day] = cleanDayTargets({
      kcal: t.kcal || p.kcalTarget,
      protein: t.protein || p.proteinTarget,
      carbs: t.carbs || p.carbsTarget,
      fat: t.fat || p.fatTarget,
      meals: t.meals ?? p.meals,
    });
  }
  return out;
}

const key = (d?: DayTargets) => JSON.stringify(cleanDayTargets(d) ?? null);
export const sameDraft = (a?: DayTargets, b?: DayTargets) => key(a) === key(b);
export const allSame = (days: Pick<DietDay, 'day'>[], drafts: DayDrafts) => days.every((d) => sameDraft(drafts[d.day], drafts[days[0]?.day ?? 0]));

// El borrador que más se repite (para elegir platos nuevos: los que encajan con la mayoría de los días)
export function commonDraft(days: Pick<DietDay, 'day'>[], drafts: DayDrafts): DayTargets | undefined {
  const count = new Map<string, number>();
  for (const d of days) count.set(key(drafts[d.day]), (count.get(key(drafts[d.day])) ?? 0) + 1);
  let best = 'null';
  let n = 0;
  for (const [k, c] of count) if (c > n) [best, n] = [k, c];
  return best === 'null' ? undefined : (JSON.parse(best) as DayTargets);
}

// Cada día con sus raciones hechas a su borrador (mismos platos)
export const fitDrafts = (days: DietDay[], prefs: DietPrefs, drafts: DayDrafts, labs: LabFlag[]): DietDay[] =>
  days.map((d) => ({ ...fitDay({ ...d, targets: undefined }, draftPrefs(prefs, drafts[d.day]), labs), targets: cleanDayTargets(drafts[d.day]) }));

// Lo que se guarda: la semana y los días, ordenados como dice arriba
export function saveDrafts(prefs: DietPrefs, days: DietDay[], drafts: DayDrafts, labs: LabFlag[]): { prefs: DietPrefs; days: DietDay[] } {
  const strip = ({ targets, ...d }: DietDay): DietDay => (targets ? { ...d, targets } : d);
  if (allSame(days, drafts)) {
    const p = draftPrefs(prefs, drafts[days[0]?.day ?? 0]);
    return { prefs: p, days: days.map((d) => strip({ ...fitDay({ ...d, targets: undefined }, p, labs), targets: undefined })) };
  }
  return { prefs: basePrefs(prefs), days: fitDrafts(days, prefs, drafts, labs).map(strip) };
}

// Las kcal de media de la semana (para «Unas 2300 kcal al día» del menú, con días distintos)
export const weekKcalTarget = (plan: Pick<DietPlan, 'prefs' | 'targets' | 'days'>) =>
  plan.days.length ? Math.round(plan.days.reduce((a, d) => a + dayKcalTarget(plan, d), 0) / plan.days.length / 10) * 10 : plan.targets.kcal;

import { createMetricRepository, definedOnly } from './metricRepository';
import { bowelRepository, REMOTE_HAS_GUT_LOGS } from './bathroomRepository';
import { mealRepository } from './planRepository';
import { userFlags } from './userFlags';
import { familyHistoryStore } from './familyHistoryStore';
import { ageFromDob, profileRepository } from './profileRepository';
import { showSamples } from './dataMode';
import { sampleGutData } from './sampleDigestion';
import type { FoodGroup } from '@/logic/foodGroups';
import type { GutContext } from '@/logic/gutPatterns';
import type { DigestionEntry, GutSafetyAnswers, GutSymptom, Intensity } from '@/types/digestion';
import type { RelationId } from '@/types/familyHistory';

// Registro de Digestión (lo que notas en la tripa). Tabla gut_symptom_logs de la migración
// 20261018150000_gut_symptom_logs.sql; mientras no esté aplicada (REMOTE_HAS_GUT_LOGS = false), se
// guarda solo en el móvil.
const SYMPTOM_COLUMNS: GutSymptom[] = ['fullness', 'bloating', 'reflux', 'gas', 'pain', 'nausea'];

export const digestionRepository = createMetricRepository<DigestionEntry>(
  'hometest:gut_symptom_logs',
  REMOTE_HAS_GUT_LOGS
    ? {
        table: 'gut_symptom_logs',
        dateColumn: 'logged_at',
        toRow: (e) =>
          definedOnly({
            id: e.id,
            kind: e.kind,
            ...Object.fromEntries(SYMPTOM_COLUMNS.map((s) => [s, e.symptoms ? (e.symptoms[s] ?? null) : undefined])),
            woke_at_night: e.wokeAtNight,
            note: e.note,
            logged_at: e.fecha,
            created_at: e.createdAt,
          }),
        fromRow: (r) => ({
          id: r.id,
          kind: r.kind,
          symptoms: Object.fromEntries(SYMPTOM_COLUMNS.filter((s) => r[s]).map((s) => [s, r[s] as Intensity])),
          wokeAtNight: r.woke_at_night ?? undefined,
          note: r.note ?? undefined,
          fecha: r.logged_at,
          createdAt: r.created_at,
        }),
      }
    : undefined
);

// Correcciones del usuario a lo que la app dedujo de una comida ({ idComida: grupos }). Son pocas,
// así que van en user_flags (se sincroniza solo, sin tabla nueva). El registro de comidas de
// "Tus nutrientes" no cambia.
const MEAL_GROUPS_KEY = 'meal_food_groups';
const SAFETY_KEY = 'gut_safety';

export const mealGroupsStore = {
  async getAll(): Promise<Record<string, FoodGroup[]>> {
    const v = await userFlags.get(MEAL_GROUPS_KEY);
    return v && typeof v === 'object' ? (v as Record<string, FoodGroup[]>) : {};
  },
  async set(mealId: string, groups: FoodGroup[]): Promise<void> {
    const all = await this.getAll();
    await userFlags.set(MEAL_GROUPS_KEY, { ...all, [mealId]: groups });
  },
};

export const gutSafetyStore = {
  async get(): Promise<GutSafetyAnswers | null> {
    const v = await userFlags.get(SAFETY_KEY);
    return v && typeof v === 'object' && 'answeredAt' in v ? (v as unknown as GutSafetyAnswers) : null;
  },
  async save(answers: GutSafetyAnswers): Promise<void> {
    await userFlags.set(SAFETY_KEY, answers as unknown as Record<string, unknown>);
  },
};

const FIRST_DEGREE: RelationId[] = ['mother', 'father', 'sister', 'brother', 'daughter', 'son'];

export interface LoadedGut extends GutContext {
  sample: boolean; // datos de ejemplo (cuenta de prueba sin nada apuntado en Digestión)
}

// Todo lo que necesita el análisis. En cuentas de prueba sin nada en Digestión, un mes de ejemplo.
export async function loadGutContext(): Promise<LoadedGut> {
  const [meals, digestion, bowel, overrides, safety, profile, family] = await Promise.all([
    mealRepository.getAll(),
    digestionRepository.getAll(),
    bowelRepository.getAll(),
    mealGroupsStore.getAll(),
    gutSafetyStore.get(),
    profileRepository.get().catch(() => null),
    familyHistoryStore.getRecord().catch(() => null),
  ]);
  if (!digestion.length && showSamples()) return { ...sampleGutData(), sample: true };
  return {
    meals: meals.map((m) => ({ id: m.id, fecha: m.fecha, description: m.description, groups: overrides[m.id] ?? null })),
    digestion,
    bowel,
    safety,
    age: ageFromDob(profile?.dateOfBirth),
    anaemia: !!profile?.conditions?.includes('anaemia'),
    familyColorectal: !!family?.answers.relatives.some(
      (r) => FIRST_DEGREE.includes(r.relation) && r.cancers.some((c) => c.type === 'colorectal')
    ),
    sample: false,
  };
}

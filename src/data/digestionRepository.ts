import { createMetricRepository, definedOnly } from './metricRepository';
import { bowelRepository, REMOTE_HAS_GUT_LOGS } from './bathroomRepository';
import { userFlags } from './userFlags';
import { familyHistoryStore } from './familyHistoryStore';
import { ageFromDob, profileRepository } from './profileRepository';
import { showSamples } from './dataMode';
import { sampleGutData } from './sampleDigestion';
import type { GutContext } from '@/logic/gutPatterns';
import type { DigestionEntry, GutSafetyAnswers, GutSymptom, Intensity, UsualFoods } from '@/types/digestion';
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
            food_fasted: e.food ? !!e.food.fasted : undefined,
            food_description: e.food ? (e.food.description ?? null) : undefined,
            food_groups: e.food ? (e.food.groups ?? null) : undefined,
            food_minutes_before: e.food ? (e.food.minutesBefore ?? null) : undefined,
            food_amount: e.food ? (e.food.amount ?? null) : undefined,
            logged_at: e.fecha,
            created_at: e.createdAt,
          }),
        fromRow: (r) => ({
          id: r.id,
          kind: r.kind,
          symptoms: Object.fromEntries(SYMPTOM_COLUMNS.filter((s) => r[s]).map((s) => [s, r[s] as Intensity])),
          wokeAtNight: r.woke_at_night ?? undefined,
          note: r.note ?? undefined,
          food:
            r.food_fasted != null || r.food_description || r.food_groups
              ? {
                  fasted: r.food_fasted || undefined,
                  description: r.food_description ?? undefined,
                  groups: r.food_groups ?? undefined,
                  minutesBefore: r.food_minutes_before ?? undefined,
                  amount: r.food_amount ?? undefined,
                }
              : undefined,
          fecha: r.logged_at,
          createdAt: r.created_at,
        }),
      }
    : undefined
);

// Cada cuánto sueles tomar cada grupo de alimentos (la comparación de los patrones). Son pocas
// respuestas, así que van en user_flags (se sincroniza solo, sin tabla nueva).
const USUAL_KEY = 'gut_usual_foods';
const SAFETY_KEY = 'gut_safety';

export const usualFoodsStore = {
  async get(): Promise<UsualFoods> {
    const v = await userFlags.get(USUAL_KEY);
    return v && typeof v === 'object' ? (v as UsualFoods) : {};
  },
  async merge(answers: UsualFoods): Promise<UsualFoods> {
    const next = { ...(await this.get()), ...answers };
    await userFlags.set(USUAL_KEY, next);
    return next;
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
  const [digestion, bowel, usual, safety, profile, family] = await Promise.all([
    digestionRepository.getAll(),
    bowelRepository.getAll(),
    usualFoodsStore.get(),
    gutSafetyStore.get(),
    profileRepository.get().catch(() => null),
    familyHistoryStore.getRecord().catch(() => null),
  ]);
  if (!digestion.length && showSamples()) return { ...sampleGutData(), sample: true };
  return {
    digestion,
    usual,
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

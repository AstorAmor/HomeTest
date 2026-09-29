import AsyncStorage from '@react-native-async-storage/async-storage';
import { getCurrentUserId, isRemoteActive, supabase } from '@/lib/supabase';

export type Sex = 'female' | 'male' | 'other' | 'undisclosed';
export type ActivityLevel = 'sedentary' | 'light' | 'active' | 'very_active';
export type SleepHabit = 'lt6' | '6to7' | '7to8' | 'gt8';
export type Smoking = 'never' | 'former' | 'occasional' | 'current';
export type Alcohol = 'never' | 'occasional' | 'weekly' | 'daily';
export type GoalId =
  | 'general_health'
  | 'more_energy'
  | 'sleep_better'
  | 'lose_weight'
  | 'performance'
  | 'reduce_stress'
  | 'manage_condition'
  | 'longevity';

// Respuestas del cuestionario de onboarding. Todo es opcional: el usuario
// puede saltarse el cuestionario en cualquier momento.
export interface UserProfile {
  dateOfBirth?: string; // YYYY-MM-DD
  sex?: Sex;
  heightCm?: number;
  weightKg?: number;
  activity?: ActivityLevel;
  sleep?: SleepHabit;
  smoking?: Smoking;
  alcohol?: Alcohol;
  // Antecedentes de salud
  takesMedication?: boolean;
  medications?: string;
  conditions: ConditionId[];
  conditionsOther?: string;
  goals: GoalId[];
  completedAt?: string;
  badges: string[];
}

export const GOAL_OPTIONS: { id: GoalId; label: string; icon: string }[] = [
  { id: 'general_health', label: 'Improve my general health', icon: 'heart-outline' },
  { id: 'more_energy', label: 'Have more energy', icon: 'flash-outline' },
  { id: 'sleep_better', label: 'Sleep better', icon: 'moon-outline' },
  { id: 'lose_weight', label: 'Lose weight', icon: 'scale-outline' },
  { id: 'performance', label: 'Perform better in sport', icon: 'barbell-outline' },
  { id: 'reduce_stress', label: 'Reduce stress', icon: 'leaf-outline' },
  { id: 'manage_condition', label: 'Keep a condition under control', icon: 'medkit-outline' },
  { id: 'longevity', label: 'Longevity', icon: 'hourglass-outline' },
];

export type ConditionId =
  | 'diabetes'
  | 'prediabetes'
  | 'hypertension'
  | 'high_cholesterol'
  | 'thyroid'
  | 'heart_disease'
  | 'asthma_copd'
  | 'anaemia'
  | 'autoimmune'
  | 'pcos'
  | 'none'
  | 'other';

export const CONDITION_OPTIONS: { id: ConditionId; label: string; femaleOnly?: boolean }[] = [
  { id: 'diabetes', label: 'Diabetes' },
  { id: 'prediabetes', label: 'Prediabetes' },
  { id: 'hypertension', label: 'High blood pressure' },
  { id: 'high_cholesterol', label: 'High cholesterol' },
  { id: 'thyroid', label: 'Thyroid disorder' },
  { id: 'heart_disease', label: 'Heart disease' },
  { id: 'asthma_copd', label: 'Asthma / COPD' },
  { id: 'anaemia', label: 'Anaemia' },
  { id: 'autoimmune', label: 'Autoimmune disease' },
  { id: 'pcos', label: 'PCOS', femaleOnly: true },
  { id: 'other', label: 'Other' },
  { id: 'none', label: 'None' },
];

export const BADGES: Record<string, { title: string; description: string; icon: string }> = {
  plan_builder: {
    title: 'Plan builder',
    description: 'You shared your goals and unlocked your first personalised plan.',
    icon: 'ribbon',
  },
};

const STORAGE_KEY = 'hometest:user_profile';
const EMPTY: UserProfile = { goals: [], badges: [], conditions: [] };

// Con sesión de Supabase: tabla profiles (la fila la crea un trigger al registrarse).
// Sin sesión (modo demo): AsyncStorage.
const fromRow = (r: any): UserProfile => ({
  dateOfBirth: r.date_of_birth ?? undefined,
  sex: r.sex ?? undefined,
  heightCm: r.height_cm != null ? Number(r.height_cm) : undefined,
  weightKg: r.weight_kg != null ? Number(r.weight_kg) : undefined,
  activity: r.activity ?? undefined,
  sleep: r.sleep_habit ?? undefined,
  smoking: r.smoking ?? undefined,
  alcohol: r.alcohol ?? undefined,
  takesMedication: r.takes_medication ?? undefined,
  medications: r.medications ?? undefined,
  conditions: r.conditions ?? [],
  conditionsOther: r.conditions_other ?? undefined,
  goals: r.goals ?? [],
  badges: r.badges ?? [],
  completedAt: r.onboarding_completed_at ?? undefined,
});

const toRow = (p: UserProfile) => ({
  date_of_birth: p.dateOfBirth ?? null,
  sex: p.sex ?? null,
  height_cm: p.heightCm ?? null,
  weight_kg: p.weightKg ?? null,
  activity: p.activity ?? null,
  sleep_habit: p.sleep ?? null,
  smoking: p.smoking ?? null,
  alcohol: p.alcohol ?? null,
  takes_medication: p.takesMedication ?? null,
  medications: p.medications ?? null,
  conditions: p.conditions ?? [],
  conditions_other: p.conditionsOther ?? null,
  goals: p.goals,
  badges: p.badges,
  onboarding_completed_at: p.completedAt ?? null,
});

export const profileRepository = {
  async get(): Promise<UserProfile> {
    if (isRemoteActive()) {
      const { data, error } = await supabase!
        .from('profiles')
        .select('*')
        .eq('id', getCurrentUserId()!)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data ? fromRow(data) : { ...EMPTY };
    }
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...EMPTY };
    try {
      return { ...EMPTY, ...(JSON.parse(raw) as UserProfile) };
    } catch {
      return { ...EMPTY };
    }
  },
  async save(profile: UserProfile): Promise<void> {
    if (isRemoteActive()) {
      const { error } = await supabase!.from('profiles').update(toRow(profile)).eq('id', getCurrentUserId()!);
      if (error) throw new Error(error.message);
      return;
    }
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  },
  // Sube el perfil guardado en el móvil a la cuenta (solo si en la cuenta está vacío).
  async importLocalToRemote(): Promise<boolean> {
    if (!isRemoteActive()) return false;
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const remote = await this.get();
    if (remote.completedAt || remote.goals.length) return false;
    await this.save({ ...EMPTY, ...(JSON.parse(raw) as UserProfile) });
    return true;
  },
  async awardBadge(badgeId: string): Promise<UserProfile> {
    const profile = await this.get();
    if (!profile.badges.includes(badgeId)) profile.badges.push(badgeId);
    await this.save(profile);
    return profile;
  },
};

export function ageFromDob(dob?: string): number | null {
  if (!dob) return null;
  const birth = new Date(`${dob}T12:00:00`);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
  return age;
}

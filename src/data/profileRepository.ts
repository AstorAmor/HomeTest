import AsyncStorage from '@react-native-async-storage/async-storage';

export type Sex = 'female' | 'male' | 'other' | 'undisclosed';
export type ActivityLevel = 'sedentary' | 'light' | 'active' | 'very_active';
export type SleepHabit = 'lt6' | '6to7' | '7to8' | 'gt8';
export type Smoking = 'never' | 'former' | 'current';
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

export const BADGES: Record<string, { title: string; description: string; icon: string }> = {
  plan_builder: {
    title: 'Plan builder',
    description: 'You shared your goals and unlocked your first personalised plan.',
    icon: 'ribbon',
  },
};

const STORAGE_KEY = 'hometest:user_profile';
const EMPTY: UserProfile = { goals: [], badges: [] };

export const profileRepository = {
  async get(): Promise<UserProfile> {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...EMPTY };
    try {
      return { ...EMPTY, ...(JSON.parse(raw) as UserProfile) };
    } catch {
      return { ...EMPTY };
    }
  },
  async save(profile: UserProfile): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
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

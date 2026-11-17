// Opciones y reglas de los datos de «Sobre ti», compartidas por el cuestionario (OnboardingScreen, que también es
// la pantalla de editar el perfil) y por Mi perfil, donde cada dato se cambia con un toque (fundador, 2026-11-16).
// Las etiquetas van en inglés y se traducen con t() al pintarlas.
import { appPrefs } from '@/data/appPrefs';
import { sectionsFromAnswers } from '@/data/goalEffects';
import {
  ActivityLevel,
  Alcohol,
  ConditionId,
  profileRepository,
  Sex,
  SleepHabit,
  Smoking,
  StepsBand,
  UserProfile,
} from '@/data/profileRepository';
import { dateLocale } from '@/i18n';

// Ruedas de la fecha de nacimiento y de altura y peso (los mismos límites en los dos sitios)
export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const DAYS = Array.from({ length: 31 }, (_, i) => String(i + 1));
export const YEARS = Array.from({ length: 81 }, (_, i) => String(1930 + i));
export const HEIGHTS = Array.from({ length: 71 }, (_, i) => String(140 + i));
export const WEIGHTS = Array.from({ length: 111 }, (_, i) => String(40 + i));

// Lo que sale en las ruedas si aún no lo ha contestado
export const DEFAULT_DOB = { day: 14, month: 5, year: YEARS.indexOf('1992') };
export const DEFAULT_HEIGHT_CM = 175;
export const DEFAULT_WEIGHT_KG = 75;

// Días a la semana de fuerza y de cardio («3» = 3 o más): sin entrenos registrados, el plan parte de aquí
export const DAYS_OPTIONS = [
  { id: '0', label: 'None' },
  { id: '1', label: '1 day' },
  { id: '2', label: '2 days' },
  { id: '3', label: '3 or more' },
];

export const SEX_OPTIONS: { id: Sex; label: string; icon: 'female' | 'male' | 'male-female' | 'remove-circle-outline' }[] = [
  { id: 'female', label: 'Female', icon: 'female' },
  { id: 'male', label: 'Male', icon: 'male' },
  { id: 'other', label: 'Other', icon: 'male-female' },
  { id: 'undisclosed', label: 'Prefer not to say', icon: 'remove-circle-outline' },
];

export const ACTIVITY_OPTIONS: { id: ActivityLevel; label: string }[] = [
  { id: 'sedentary', label: 'Mostly sitting' },
  { id: 'light', label: 'Light activity' },
  { id: 'active', label: 'Fairly active' },
  { id: 'very_active', label: 'Very active' },
];

export const STEPS_OPTIONS: { id: StepsBand; label: string }[] = [
  { id: 'lt5k', label: 'Fewer than 5,000' },
  { id: '5to7k', label: '5,000-7,500' },
  { id: '7to10k', label: '7,500-10,000' },
  { id: 'gt10k', label: 'More than 10,000' },
  { id: 'unknown', label: "I don't know" },
];

export const SLEEP_OPTIONS: { id: SleepHabit; label: string }[] = [
  { id: 'lt6', label: '< 6 h' },
  { id: '6to7', label: '6–7 h' },
  { id: '7to8', label: '7–8 h' },
  { id: 'gt8', label: '> 8 h' },
];

export const SMOKING_OPTIONS: { id: Smoking; label: string }[] = [
  { id: 'never', label: 'Never' },
  { id: 'former', label: 'I used to' },
  { id: 'occasional', label: 'Occasionally' },
  { id: 'current', label: 'Yes' },
];

export const ALCOHOL_OPTIONS: { id: Alcohol; label: string }[] = [
  { id: 'never', label: 'Never' },
  { id: 'occasional', label: 'Occasionally' },
  { id: 'weekly', label: 'Every week' },
  { id: 'daily', label: 'Daily' },
];

const pad2 = (n: number) => String(n).padStart(2, '0');

// Fecha de nacimiento (YYYY-MM-DD) a partir de la posición de cada rueda
export const dobFromWheels = (day: number, month: number, year: number) => `${YEARS[year]}-${pad2(month + 1)}-${pad2(day + 1)}`;

// Y al revés: la posición de cada rueda para una fecha guardada (null si no hay fecha). Un año fuera de la rueda
// deja el de por defecto, como hacía el cuestionario.
export function wheelsFromDob(dob?: string): { day: number; month: number; year: number } | null {
  if (!dob) return null;
  const [y, m, d] = dob.split('-').map(Number);
  if (!m || !d) return null;
  const year = YEARS.indexOf(String(y));
  return { day: Math.min(30, Math.max(0, d - 1)), month: Math.min(11, Math.max(0, m - 1)), year: year >= 0 ? year : DEFAULT_DOB.year };
}

// Días que tiene un mes (posición de las ruedas): así un 31 de febrero se guarda como el último día de febrero
export const daysInMonth = (month: number, year: number) => new Date(Number(YEARS[year]), month + 1, 0).getDate();

// Nombres cortos de los meses en el idioma de la app («ene», «feb»… en español); si el móvil no sabe, en inglés
export function monthLabels(): string[] {
  try {
    return MONTHS.map((fallback, i) => {
      const s = new Date(2000, i, 15).toLocaleDateString(dateLocale(), { month: 'short' }).replace('.', '');
      return s ? s.charAt(0).toUpperCase() + s.slice(1) : fallback;
    });
  } catch {
    return MONTHS;
  }
}

// Enfermedades: «Ninguna» va sola; elegir otra la quita
export function toggleConditionIn(list: ConditionId[], id: ConditionId): ConditionId[] {
  if (id === 'none') return list.includes('none') ? [] : ['none'];
  const without = list.filter((c) => c !== 'none');
  return without.includes(id) ? without.filter((c) => c !== id) : [...without, id];
}

// Enciende lo que piden sus respuestas (p. ej. medicación si toma alguna, el ciclo si cuida su salud reproductiva
// y es mujer); lo demás queda como esté
export async function applyProfileSections(profile: UserProfile): Promise<void> {
  for (const section of sectionsFromAnswers(profile)) await appPrefs.setSectionVisible(section, true);
}

// Guarda un cambio de «Sobre ti» sobre el perfil guardado, con lo mismo que hace el cuestionario después de
// guardar (las secciones que encienden sus respuestas). Devuelve el perfil como queda.
export async function saveProfileChange(patch: Partial<UserProfile>): Promise<UserProfile> {
  const current = await profileRepository.get();
  const next: UserProfile = { ...current, ...patch };
  await profileRepository.save(next);
  await applyProfileSections(next);
  return next;
}

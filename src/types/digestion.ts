import type { FoodGroup } from '@/logic/foodGroups';

// Registro de Digestión: lo que notas en la tripa, cuando lo notas, y después (solo si notaste
// algo) qué comiste antes. Va aparte de "Tus nutrientes" (que no se toca ni se lee aquí) y de las
// heces (bowel_logs), que se cruzan por la hora (src/logic/gutPatterns.ts).
//
// Síntomas adaptados de la GSRS (Gastrointestinal Symptom Rating Scale; Svedlund, Sjödin y
// Dotevall, Dig Dis Sci 1988;33:129-134), que puntúa 15 síntomas de 1 a 7. Aquí quedan 6 en
// lenguaje llano y 3 intensidades (leve ≈ GSRS 2-3, moderado ≈ 4-5, fuerte ≈ 6-7). La diarrea y la
// urgencia no están aquí porque son de las heces: se apuntan allí. "Pesadez o me llené enseguida"
// recoge la plenitud posprandial y la saciedad precoz de la dispepsia funcional de Roma IV
// (Stanghellini et al., Gastroenterology 2016;150:1380-1392).
// SUPUESTO (revisión clínica): la reducción de 7 a 3 niveles y el corte de las intensidades.

export type GutSymptom = 'fullness' | 'bloating' | 'reflux' | 'gas' | 'pain' | 'nausea';

export type Intensity = 1 | 2 | 3; // leve, moderado, fuerte

export const GUT_SYMPTOMS: { id: GutSymptom; label: string; hint: string }[] = [
  { id: 'fullness', label: 'Heaviness or full too soon', hint: 'Heavy tummy, or full after only a little food' },
  { id: 'bloating', label: 'Bloating', hint: 'Swollen or tight tummy' },
  { id: 'reflux', label: 'Heartburn or reflux', hint: 'Burning in the chest or acid in the mouth' },
  { id: 'gas', label: 'Gas or burping', hint: 'Wind, or burping more than usual' },
  { id: 'pain', label: 'Tummy pain', hint: 'Pain or cramps' },
  { id: 'nausea', label: 'Nausea', hint: 'Feeling sick' },
];

export const INTENSITIES: { id: Intensity; label: string }[] = [
  { id: 1, label: 'Mild' },
  { id: 2, label: 'Moderate' },
  { id: 3, label: 'Strong' },
];

// Lo que comiste antes de notarlo: la última comida o picoteo. Se pregunta justo después de
// apuntar las molestias, nunca antes de que pase nada.
export type MealAmount = 'little' | 'normal' | 'lot';

export interface FoodBefore {
  fasted?: boolean; // no había comido nada en las horas antes
  description?: string;
  groups?: FoodGroup[]; // lo que confirmó el usuario (relleno con lo deducido del texto)
  minutesBefore?: number; // cuánto antes de empezar: 30, 120, 270 o 480
  amount?: MealAmount;
}

export const MINUTES_BEFORE: { id: number; label: string }[] = [
  { id: 30, label: 'Less than 1 h' },
  { id: 120, label: '1–3 h' },
  { id: 270, label: '3–6 h' },
  { id: 480, label: 'More than 6 h' },
];

export const MEAL_AMOUNTS: { id: MealAmount; label: string }[] = [
  { id: 'little', label: 'A little' },
  { id: 'normal', label: 'As usual' },
  { id: 'lot', label: 'A lot' },
];

// Cada cuánto sueles tomar cada grupo: es la comparación (diseño case-crossover con la frecuencia
// habitual, Maclure, Am J Epidemiol 1991;133:144-153). Se pregunta una vez por grupo, la primera
// vez que aparece antes de una molestia.
export type UsualFrequency = 'most' | 'daily' | 'weekly' | 'rarely';

export const USUAL_FREQUENCIES: { id: UsualFrequency; label: string }[] = [
  { id: 'most', label: 'In most meals' },
  { id: 'daily', label: 'Once a day' },
  { id: 'weekly', label: 'A few times a week' },
  { id: 'rarely', label: 'Hardly ever' },
];

export type UsualFoods = Partial<Record<FoodGroup, UsualFrequency>>;

export interface DigestionEntry {
  id: string;
  // Cuándo empezó (síntomas) o el mediodía del día (day_ok)
  fecha: string;
  createdAt: string;
  // symptoms = noto algo; day_ok = "Hoy, bien" / "Nada más hoy": confirma que el resto del día no
  // hubo molestias (sin eso no se sabe si no pasó nada o no se apuntó)
  kind: 'symptoms' | 'day_ok';
  symptoms?: Partial<Record<GutSymptom, Intensity>>;
  wokeAtNight?: boolean;
  note?: string;
  food?: FoodBefore; // solo en symptoms
}

// Preguntas de seguridad antes de sugerir ninguna prueba (se vuelven a hacer cada 3 meses)
export type SafetyQuestionId = 'weight_loss' | 'blood' | 'anaemia' | 'night' | 'swallow_vomit' | 'onset_after_50' | 'family';

export interface GutSafetyAnswers {
  answeredAt: string;
  answers: Partial<Record<SafetyQuestionId, boolean>>;
}

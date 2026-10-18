// Registro de Digestión: lo que notas en la tripa, cuando lo notas. Va aparte de las comidas (el
// registro de "Tus nutrientes", que no cambia) y de las heces (bowel_logs): la app los cruza por
// detrás con las horas (src/logic/gutPatterns.ts), sin pedir al usuario que los relacione.
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
}

// Preguntas de seguridad antes de sugerir ninguna prueba (se vuelven a hacer cada 3 meses)
export type SafetyQuestionId = 'weight_loss' | 'blood' | 'anaemia' | 'night' | 'swallow_vomit' | 'onset_after_50' | 'family';

export interface GutSafetyAnswers {
  answeredAt: string;
  answers: Partial<Record<SafetyQuestionId, boolean>>;
}

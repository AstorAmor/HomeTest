import type { SafetyQuestionId } from '@/types/digestion';

// Preguntas de seguridad antes de sugerir ninguna prueba de digestión (pantalla GutSafetyScreen): cualquier «sí»
// manda al médico en vez de a un test (src/logic/gutPatterns.ts). Basadas en NICE NG12 y CG184, ACG/CAG 2017
// (dispepsia) y la guía británica de colon irritable (BSG 2021). Se vuelven a preguntar cada 3 meses.
// SUPUESTO (revisión clínica): el texto de cada pregunta y el 5 % de peso.
// Lógica pura (sin React Native) para poder probarla.
export const SAFETY_QUESTIONS: { id: SafetyQuestionId; text: string; onlyFrom50?: boolean }[] = [
  { id: 'weight_loss', text: 'Have you lost weight without trying in the last 6–12 months (about 5% or more)?' },
  { id: 'blood', text: 'Have you seen blood in your stools, or black stools?' },
  { id: 'anaemia', text: 'Have you been told you have anaemia or low iron?' },
  { id: 'night', text: 'Does pain or diarrhoea wake you up at night?' },
  { id: 'swallow_vomit', text: 'Does food get stuck when you swallow, or do you vomit often?' },
  { id: 'onset_after_50', text: 'Did these symptoms start after you turned 50?', onlyFrom50: true },
  { id: 'family', text: 'Has a parent, brother, sister or child had bowel cancer or coeliac disease?' },
];

// La edad del perfil se sabe y es menor de 50. Sin fecha de nacimiento (o con una que no se entiende), no se sabe
export const knownUnder50 = (age?: number | null): boolean => age != null && Number.isFinite(age) && age < 50;

// Las preguntas que se hacen: la de «¿empezaron después de cumplir los 50?» no se le hace a quien tiene menos de 50
// (fundador, 2026-11-17: «si mi edad es <50 no lo pongas»). Sin edad en el perfil, se pregunta también
export const safetyQuestionsFor = (age?: number | null) => SAFETY_QUESTIONS.filter((q) => !q.onlyFrom50 || !knownUnder50(age));

type Answers = Partial<Record<SafetyQuestionId, boolean>>;

// ¿Están contestadas todas las que se hacen?
export const safetyComplete = (answers: Answers, age?: number | null): boolean =>
  safetyQuestionsFor(age).every((q) => answers[q.id] !== undefined);

// Lo que se guarda: solo lo que se preguntó. Lo que no se preguntó no queda como «sí» de una vez anterior
export const safetyAnswersToSave = (answers: Answers, age?: number | null): Answers =>
  Object.fromEntries(safetyQuestionsFor(age).filter((q) => answers[q.id] !== undefined).map((q) => [q.id, answers[q.id]]));

// Las respuestas que cuentan para las alarmas: la pregunta que no se hace (menos de 50) vale «no», aunque quedara
// un «sí» guardado de cuando no se sabía la edad
export const effectiveSafetyAnswers = (answers: Answers, age?: number | null): Answers =>
  knownUnder50(age) ? { ...answers, onset_after_50: false } : answers;

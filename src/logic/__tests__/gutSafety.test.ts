import { describe, expect, it } from 'vitest';
import { analyseGut } from '@/logic/gutPatterns';
import { effectiveSafetyAnswers, knownUnder50, safetyAnswersToSave, safetyComplete, safetyQuestionsFor, SAFETY_QUESTIONS } from '@/logic/gutSafety';
import type { GutSafetyAnswers } from '@/types/digestion';

// Fundador (2026-11-17): «¿Empezaron estas molestias después de cumplir los 50?» → «si mi edad es <50 no lo pongas»
const ids = (age?: number | null) => safetyQuestionsFor(age).map((q) => q.id);
const now = new Date('2026-11-17T12:00:00');
const answered = (answers: GutSafetyAnswers['answers']): GutSafetyAnswers => ({ answeredAt: '2026-11-16T12:00:00.000Z', answers });
const alarmsWith = (answers: GutSafetyAnswers['answers'], age?: number | null) =>
  analyseGut({ digestion: [], bowel: [], usual: {}, safety: answered(answers), age, now }).alarms.map((a) => a.id);

describe('preguntas de seguridad de digestión según la edad', () => {
  it('con menos de 50 años no se pregunta si empezaron después de los 50', () => {
    expect(ids(49)).not.toContain('onset_after_50');
    expect(ids(18)).not.toContain('onset_after_50');
    expect(ids(49)).toHaveLength(SAFETY_QUESTIONS.length - 1);
  });

  it('con 50 o más, y sin edad en el perfil, se pregunta', () => {
    expect(ids(50)).toContain('onset_after_50');
    expect(ids(72)).toContain('onset_after_50');
    expect(ids(null)).toContain('onset_after_50');
    expect(ids(undefined)).toContain('onset_after_50');
    // Una fecha de nacimiento que no se entiende da NaN: es como no saber la edad
    expect(ids(Number.NaN)).toContain('onset_after_50');
    expect(knownUnder50(Number.NaN)).toBe(false);
  });

  it('las demás preguntas salen siempre, en el mismo orden', () => {
    const rest = SAFETY_QUESTIONS.filter((q) => !q.onlyFrom50).map((q) => q.id);
    expect(ids(30)).toEqual(rest);
    expect(ids(null)).toEqual(SAFETY_QUESTIONS.map((q) => q.id));
  });

  it('está completo sin la pregunta que no se hace', () => {
    const answers = { weight_loss: false, blood: false, anaemia: false, night: false, swallow_vomit: false, family: false };
    expect(safetyComplete(answers, 35)).toBe(true);
    expect(safetyComplete(answers, null)).toBe(false);
    expect(safetyComplete(answers, 60)).toBe(false);
    expect(safetyComplete({ ...answers, onset_after_50: false }, 60)).toBe(true);
  });

  it('no se guarda la respuesta de una pregunta que no se ha hecho', () => {
    const answers = { weight_loss: false, blood: true, onset_after_50: true };
    expect(safetyAnswersToSave(answers, 35)).toEqual({ weight_loss: false, blood: true });
    expect(safetyAnswersToSave(answers, 60)).toEqual(answers);
    expect(safetyAnswersToSave(answers, null)).toEqual(answers);
  });

  it('la pregunta que no se hace vale «no» al leer las respuestas', () => {
    expect(effectiveSafetyAnswers({ onset_after_50: true }, 35).onset_after_50).toBe(false);
    expect(effectiveSafetyAnswers({ onset_after_50: true }, 60).onset_after_50).toBe(true);
    expect(effectiveSafetyAnswers({ onset_after_50: true }, null).onset_after_50).toBe(true);
    expect(effectiveSafetyAnswers({}, 35).onset_after_50).toBe(false);
  });

  it('el análisis no da la alarma de los 50 a quien tiene menos de 50, aunque quedara un «sí» guardado', () => {
    expect(alarmsWith({ onset_after_50: true }, 35)).toEqual([]);
    expect(alarmsWith({ onset_after_50: true }, 60)).toEqual(['onset_after_50']);
    expect(alarmsWith({ onset_after_50: true }, null)).toEqual(['onset_after_50']);
    expect(alarmsWith({ onset_after_50: true })).toEqual(['onset_after_50']);
    // Sin contestarla (no se le hizo): no hay alarma y las demás siguen contando
    expect(alarmsWith({ blood: true }, 35)).toEqual(['blood']);
  });
});

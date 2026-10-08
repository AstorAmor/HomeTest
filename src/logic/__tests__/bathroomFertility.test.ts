import { describe, expect, it } from 'vitest';
import { bowelObservations, dailyTotalNote, urineObservations, volumeCheckSuggestion } from '@/logic/bathroom';
import { detectTempShift, fertilityAdvice } from '@/logic/fertility';
import { BowelEntry, UrineEntry } from '@/types/bathroom';

const now = new Date('2026-10-08T20:00:00');
const daysAgo = (n: number) => new Date(now.getTime() - n * 86400000 - 8 * 3600000).toISOString();
const bowel = (n: number, e: Partial<BowelEntry>): BowelEntry => ({ id: `b${n}`, fecha: daysAgo(n), createdAt: daysAgo(n), count: 1, ...e });
const urine = (n: number, e: Partial<UrineEntry>): UrineEntry => ({ id: `u${n}`, fecha: daysAgo(n), createdAt: daysAgo(n), ...e });

describe('observaciones digestivas', () => {
  it('pide más días antes de opinar', () => {
    expect(bowelObservations([bowel(0, {})], now)[0].id).toBe('bowel_need_more');
  });
  it('semana normal', () => {
    const week = [0, 1, 2, 3, 4].map((n) => bowel(n, { color: 'brown', consistency: 4 }));
    expect(bowelObservations(week, now).map((o) => o.id)).toEqual(['bowel_ok']);
  });
  it('color rojo: primero pregunta, no alarma', () => {
    const week = [0, 1, 2, 3].map((n) => bowel(n, { color: n === 0 ? 'red' : 'brown', consistency: 4 }));
    const red = bowelObservations(week, now).find((o) => o.id === 'stool_red')!;
    expect(red.level).toBe('ask');
    expect(red.question?.text).toMatch(/dragon fruit/);
  });
  it('si ya está explicado, no vuelve a preguntar', () => {
    const week = [0, 1, 2, 3].map((n) =>
      bowel(n, { color: n === 0 ? 'red' : 'brown', explainedBy: n === 0 ? 'Beetroot' : undefined })
    );
    expect(bowelObservations(week, now).some((o) => o.id === 'stool_red')).toBe(false);
  });
  it('tres días sin ir', () => {
    const week = [0, 1, 2, 3, 4].map((n) => bowel(n, { count: n < 3 ? 0 : 1 }));
    expect(bowelObservations(week, now)[0].title).toMatch(/3 days/);
  });
});

describe('observaciones urinarias', () => {
  it('orina oscura: beber más', () => {
    const week = [0, 1, 2, 3].map((n) => urine(n, { color: n < 2 ? 'dark' : 'pale', count: 6 }));
    expect(urineObservations(week, now).map((o) => o.id)).toContain('urine_dark');
  });
  it('prueba de volumen: primera vez, repetir y bote de 24 h', () => {
    expect(volumeCheckSuggestion([urine(1, {})], now)).toEqual({ kind: 'first' });
    expect(volumeCheckSuggestion([urine(1, { voidVolume: 'quarter', volumeUsual: 'no' })], now)).toEqual({ kind: 'repeat' });
    expect(
      volumeCheckSuggestion(
        [urine(1, { voidVolume: 'quarter', volumeUsual: 'no' }), urine(5, { voidVolume: 'quarter', volumeUsual: 'no' })],
        now
      )
    ).toEqual({ kind: 'collect_24h' });
    expect(volumeCheckSuggestion([urine(100, { voidVolume: 'half', volumeUsual: 'yes' })], now)?.kind).toBe('periodic');
  });
  it('total de 24 h', () => {
    expect(dailyTotalNote(400).level).toBe('see_doctor');
    expect(dailyTotalNote(1500).level).toBe('good');
    expect(dailyTotalNote(3500).level).toBe('see_doctor');
  });
});

describe('fertilidad', () => {
  it('menos de 35: médico a los 12 meses', () => {
    expect(fertilityAdvice({ age: 30, tryingFor: '6_12m', regularCycles: 'yes' }).level).toBe('keep_trying');
    expect(fertilityAdvice({ age: 30, tryingFor: '1_2y', regularCycles: 'yes' }).level).toBe('see_doctor');
  });
  it('35-39: médico a los 6 meses; 40 o más: ya', () => {
    expect(fertilityAdvice({ age: 36, tryingFor: '6_12m', regularCycles: 'yes' }).level).toBe('see_doctor');
    expect(fertilityAdvice({ age: 41, tryingFor: 'under_6m', regularCycles: 'yes' }).level).toBe('see_doctor_now');
  });
  it('ciclos irregulares: médico pronto', () => {
    expect(fertilityAdvice({ age: 28, tryingFor: 'under_6m', regularCycles: 'no' }).level).toBe('see_doctor_now');
  });
  it('detecta la subida de temperatura (3 sobre 6)', () => {
    const temps = Array.from({ length: 20 }, (_, i) => ({
      date: `2026-09-${String(i + 1).padStart(2, '0')}`,
      celsius: i < 13 ? 36.3 + (i % 3) * 0.05 : 36.7,
      source: 'manual' as const,
    }));
    const shift = detectTempShift(temps)!;
    expect(shift.shiftDate).toBe('2026-09-14');
    expect(shift.likelyOvulation).toBe('2026-09-13');
    expect(shift.confidence).toBe('high');
  });
});

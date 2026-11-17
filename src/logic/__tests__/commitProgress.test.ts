import { describe, expect, it } from 'vitest';
import { commitProgress } from '../metas';

// La línea temporal del compromiso de Plan: por dónde vas entre el día que firmaste y el último
describe('commitProgress', () => {
  const c = { day: '2026-11-09', weeks: 8 };

  it('el día que firmas es el primero y estás en la semana 1', () => {
    const p = commitProgress(c, '2026-11-09');
    expect(p.days).toBe(1);
    expect(p.week).toBe(1);
    expect(p.total).toBe(56);
    expect(p.end).toBe('2027-01-03');
    expect(p.left).toBe(55);
    expect(p.started).toBe(true);
    expect(p.finished).toBe(false);
  });

  it('el octavo día ya es la semana 2', () => {
    expect(commitProgress(c, '2026-11-15').week).toBe(1);
    expect(commitProgress(c, '2026-11-16').week).toBe(2);
  });

  it('el último día llega al final sin pasarse', () => {
    const p = commitProgress(c, '2027-01-03');
    expect(p.days).toBe(56);
    expect(p.fraction).toBe(1);
    expect(p.week).toBe(8);
    expect(p.finished).toBe(false);
    expect(commitProgress(c, '2027-01-04').finished).toBe(true);
    expect(commitProgress(c, '2027-02-01').fraction).toBe(1);
  });

  it('antes de empezar no lleva días', () => {
    const p = commitProgress(c, '2026-11-01');
    expect(p.days).toBe(0);
    expect(p.started).toBe(false);
    expect(p.week).toBe(1);
  });
});

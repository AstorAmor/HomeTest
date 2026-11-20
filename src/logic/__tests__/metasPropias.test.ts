// Notas de una probadora en iPhone (2026-11-20): metas tuyas con «menos de», la cifra escrita con el teclado, la unidad
// sin la mayúscula del teclado y los días de antes de empezar en la primera semana.
import { describe, expect, it } from 'vitest';
import {
  areaScore,
  bounds,
  closedWeek,
  customText,
  emptyState,
  evalMeta,
  firstMarkOf,
  metaText,
  normalizeState,
  progressText,
  resolveMeta,
  typedTarget,
  unitCase,
  weekMisses,
  weekOf,
  type CustomMeta,
  type MetasState,
} from '@/logic/metas';
import { parseTyped } from '@/utils/typedNumber';

const st = (patch: Partial<MetasState> = {}): MetasState => ({ ...emptyState(), ...patch });
const own = (c: Partial<CustomMeta>, cfg: { tgt: number; per: 'day' | 'week' }) =>
  st({
    custom: [{ id: 'own-1', area: 'ha', name: 'Dulces', kind: 'amount', unit: '', max: 20, ...c }],
    sel: { ej: [], al: [], ha: ['own-1'] },
    cfg: { 'own-1': cfg },
  });

describe('Metas tuyas con «menos de»', () => {
  it('cantidad a la semana: «menos de 5», y cumple con 4 y no con 5', () => {
    const s = own({ limit: true }, { tgt: 5, per: 'week' });
    const m = resolveMeta(s, 'own-1')!;
    expect(m.limit).toBe(true);
    expect(metaText(m)).toBe('Dulces: less than 5 a week');
    expect(evalMeta(m, [1, 1, 1, 1, 0, 0, 0], { from: 0, to: 6, current: false, share: 1 }).score).toBe(1);
    expect(evalMeta(m, [1, 1, 1, 1, 1, 0, 0], { from: 0, to: 6, current: false, share: 1 }).score).toBeLessThan(1);
    expect(progressText(m, evalMeta(m, [1, 1, null, null, null, null, null], { from: 0, to: 2, current: true, share: 1 }))).toBe('2 this week · your limit, less than 5');
  });

  it('cantidad al día con unidad: un día con 3 raciones de «menos de 3» se pasa', () => {
    const s = own({ name: 'Carbohidratos', unit: 'raciones', limit: true }, { tgt: 3, per: 'day' });
    const m = resolveMeta(s, 'own-1')!;
    expect(metaText(m)).toBe('Carbohidratos: less than 3 raciones a day');
    const e = evalMeta(m, [2, 3, null, null, null, null, null], { from: 0, to: 1, current: true, share: 1 });
    expect(e.st.slice(0, 2)).toEqual(['ok', 'no']);
    const misses = weekMisses(s, { 'own-1': [2, 3, 3, 1, 1, 1, 1] });
    expect(misses.misses[0].text).toBe('“Carbohidratos” (2 days over your limit)');
  });

  it('sí / no a la semana: «menos de 3 días», y un sí / no cada día nunca es límite', () => {
    const week = own({ name: 'Comer fuera', kind: 'yesno', max: 1, limit: true }, { tgt: 3, per: 'week' });
    const m = resolveMeta(week, 'own-1')!;
    expect(metaText(m)).toBe('Comer fuera, less than 3 days a week');
    expect(bounds(m)).toEqual([2, 7]);
    expect(evalMeta(m, [1, 0, 1, 0, 0, 0, 0], { from: 0, to: 6, current: false, share: 1 }).score).toBe(1);
    expect(weekMisses(week, { 'own-1': [1, 1, 1, 0, 0, 0, 0] }).misses[0].text).toBe('“Comer fuera” (1 day too many)');
    expect(weekMisses(week, { 'own-1': [1, 1, 0, 0, 0, 0, 0] }).misses).toEqual([]);
    const daily = own({ name: 'Sin dulces', kind: 'yesno', max: 1, limit: true }, { tgt: 1, per: 'day' });
    expect(resolveMeta(daily, 'own-1')!.limit).toBe(false);
    expect(metaText(resolveMeta(daily, 'own-1')!)).toBe('Sin dulces every day');
  });

  it('sin «menos de», como siempre (las ya guardadas no cambian)', () => {
    const s = own({ name: 'Agua', unit: 'vasos' }, { tgt: 8, per: 'day' });
    const m = resolveMeta(s, 'own-1')!;
    expect(m.limit).toBe(false);
    expect(metaText(m)).toBe('Agua: 8 vasos a day');
    // Lo guardado lleva el «menos de» de vuelta
    expect(normalizeState({ ...s, custom: [{ ...s.custom[0], limit: true }] }).custom[0].limit).toBe(true);
  });

  it('la vista previa al crearla', () => {
    expect(customText({ name: 'Dulces', kind: 'amount', per: 'week', q: 5, days: 5, unit: '', limit: true })).toBe('Dulces: less than 5 a week');
    expect(customText({ name: 'Pan', kind: 'amount', per: 'day', q: 3, days: 5, unit: 'Raciones', limit: true })).toBe('Pan: less than 3 raciones a day');
    expect(customText({ name: 'Comer fuera', kind: 'yesno', per: 'week', q: 1, days: 3, unit: '', limit: true })).toBe('Comer fuera, less than 3 days a week');
    expect(customText({ name: 'Leer', kind: 'yesno', per: 'day', q: 1, days: 3, unit: '', limit: true })).toBe('Leer every day');
  });
});

describe('La unidad, sin la mayúscula del teclado', () => {
  it('«Raciones» → «raciones»; siglas y mayúsculas de dentro se quedan', () => {
    expect(unitCase('Raciones')).toBe('raciones');
    expect(unitCase(' Vasos de agua ')).toBe('vasos de agua');
    expect(unitCase('Ámbitos')).toBe('ámbitos');
    expect(unitCase('UI')).toBe('UI');
    expect(unitCase('mL')).toBe('mL');
    expect(unitCase('L')).toBe('L');
    expect(unitCase('')).toBe('');
    const s = own({ unit: 'Raciones' }, { tgt: 3, per: 'day' });
    expect(metaText(resolveMeta(s, 'own-1')!)).toBe('Dulces: 3 raciones a day');
  });
});

describe('La cifra escrita con el teclado', () => {
  it('se entiende con coma, punto o puntos de miles', () => {
    expect(parseTyped('20')).toBe(20);
    expect(parseTyped('7.500')).toBe(7500);
    expect(parseTyped('7 500')).toBe(7500);
    expect(parseTyped('')).toBeNull();
    expect(parseTyped('abc')).toBeNull();
    expect(parseTyped('7,5', true)).toBe(7.5);
    expect(parseTyped('7.5', true)).toBe(7.5);
    expect(parseTyped('1.500', true)).toBe(1500);
    expect(parseTyped('1.500,5', true)).toBe(1500.5);
  });

  it('queda dentro de lo que se puede elegir', () => {
    const s = st();
    expect(typedTarget(resolveMeta(s, 'pasos')!, 8234)).toBe(8234);
    expect(typedTarget(resolveMeta(s, 'pasos')!, 0)).toBe(500);
    expect(typedTarget(resolveMeta(s, 'pasos')!, 1e9)).toBe(30000);
    expect(typedTarget(resolveMeta(s, 'dormir')!, 7.25)).toBe(7.25);
    expect(typedTarget(resolveMeta(s, 'fruta')!, 2.6)).toBe(3);
    expect(typedTarget(resolveMeta(s, 'embutido')!, 1)).toBe(2); // un límite empieza en 2
  });
});

describe('Los días de antes de empezar, en la primera semana', () => {
  // El jueves 19/11/2026 firma; la semana va del lunes 16 al domingo 22
  const commit = { day: '2026-11-19', weeks: 4 };
  it('sin nada apuntado antes, cuenta desde el jueves', () => {
    expect(weekOf('2026-11-19', { weekStart: 1, commit }, '2026-11-19')).toMatchObject({ from: 3, to: 3 });
  });

  it('si apuntas el lunes, cuenta desde el lunes (y la proporción de las metas a la semana con él)', () => {
    const w = weekOf('2026-11-19', { weekStart: 1, commit }, '2026-11-19', '2026-11-16');
    expect(w).toMatchObject({ from: 0, to: 3, share: 1 });
    // Lo de después del compromiso no mueve nada
    expect(weekOf('2026-11-19', { weekStart: 1, commit }, '2026-11-19', '2026-11-20').from).toBe(3);
    // La semana cerrada también
    expect(closedWeek({ weekStart: 1, commit }, '2026-11-23', '2026-11-17')).toMatchObject({ from: 1 });
  });

  it('el primer día apuntado: solo lo apuntado a mano de las metas que tienes', () => {
    const s = own({}, { tgt: 5, per: 'week' });
    expect(firstMarkOf(s, {})).toBeNull();
    expect(firstMarkOf(s, { 'own-1': { '2026-11-18': 1, '2026-11-17': 0 }, otra: { '2026-11-01': 1 } })).toBe('2026-11-17');
  });

  it('al contar desde el lunes, lo del lunes suma en el donut', () => {
    const s = own({ name: 'Agua', unit: 'vasos' }, { tgt: 8, per: 'day' });
    const w = weekOf('2026-11-19', { weekStart: 1, commit }, '2026-11-19', '2026-11-16');
    const vals = { 'own-1': [8, null, null, null, null, null, null] };
    expect(areaScore(s, 'ha', vals, w)).toBeCloseTo(1 / 7);
  });
});

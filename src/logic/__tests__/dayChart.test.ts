import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SERIES,
  SERIES,
  SERIES_BY_ID,
  cycleByDay,
  cycleRuns,
  localKey,
  normalizeSeries,
  scaled,
  segments,
  seriesScale,
  toggleSeries,
} from '@/logic/dayChart';
import { es } from '@/i18n/es';
import { workoutsEs } from '@/i18n/workoutsEs';

// La gráfica de «Tus últimos días» (fundador, 2026-11-06)
const days = (from: string, n: number) =>
  Array.from({ length: n }, (_, i) => {
    const d = new Date(`${from}T12:00:00`);
    d.setDate(d.getDate() + i);
    return localKey(d);
  });

describe('Escalas de cada medida', () => {
  it('ánimo, energía y estrés, siempre de 1 a 5', () => {
    expect(seriesScale(SERIES_BY_ID.mood, [4, 4.5, null])).toEqual([1, 5]);
    expect(seriesScale(SERIES_BY_ID.stress, [])).toEqual([1, 5]);
  });

  it('pocos cambios no parecen una montaña: margen mínimo centrado y redondeado', () => {
    // Pasos entre 7.800 y 8.400: al menos 6.000 de margen
    expect(seriesScale(SERIES_BY_ID.steps, [7800, 8400, null])).toEqual([5000, 12000]);
    // Sueño (minutos) entre 6 h 50 y 7 h 20: al menos 3 h, en horas enteras
    expect(seriesScale(SERIES_BY_ID.sleep, [410, 440])).toEqual([300, 540]); // de 5 a 9 h
    // Pulso en reposo de 58 a 60: 15 lpm de margen
    expect(seriesScale(SERIES_BY_ID.rhr, [58, 60])).toEqual([50, 70]);
  });

  it('con mucha diferencia, de su mínimo a su máximo', () => {
    expect(seriesScale(SERIES_BY_ID.steps, [2100, 14300])).toEqual([2000, 15000]);
  });

  it('no baja del suelo: las veces al baño empiezan en 0', () => {
    expect(seriesScale(SERIES_BY_ID.bowel, [0, 1, 1])).toEqual([0, 3]);
    expect(seriesScale(SERIES_BY_ID.urine, [5, 6])).toEqual([2, 9]);
    expect(seriesScale(SERIES_BY_ID.urine, [1])).toEqual([0, 6]);
  });

  it('sin datos, una escala por defecto', () => {
    expect(seriesScale(SERIES_BY_ID.hrv, [null, null])).toEqual([0, 30]);
  });

  it('el valor en su escala, de 0 a 1', () => {
    expect(scaled(3, [1, 5])).toBe(0.5);
    expect(scaled(9, [1, 5])).toBe(1);
    expect(scaled(4, [4, 4])).toBe(0.5);
  });
});

describe('Qué se ve en la gráfica', () => {
  it('por defecto, ánimo y energía', () => {
    expect(DEFAULT_SERIES).toEqual(['mood', 'energy']);
    expect(normalizeSeries(undefined)).toEqual(['mood', 'energy']);
    expect(normalizeSeries({ series: [] })).toEqual(['mood', 'energy']);
  });

  it('lo guardado, limpio: sin repetir, solo las que existen y hasta 4', () => {
    expect(normalizeSeries({ series: ['steps', 'steps', 'nope', 'mood'] })).toEqual(['steps', 'mood']);
    expect(normalizeSeries({ series: ['mood', 'energy', 'steps', 'hrv', 'rhr'] })).toEqual(['mood', 'energy', 'steps', 'hrv']);
  });

  it('añadir y quitar: hasta 4, y siempre queda una', () => {
    expect(toggleSeries(['mood', 'energy'], 'steps')).toEqual(['mood', 'energy', 'steps']);
    expect(toggleSeries(['mood', 'energy'], 'mood')).toEqual(['energy']);
    expect(toggleSeries(['mood'], 'mood')).toEqual(['mood']);
    expect(toggleSeries(['mood', 'energy', 'steps', 'hrv'], 'rhr')).toBeNull();
  });

  it('tramos con dato (los días sin dato cortan la línea)', () => {
    expect(segments([1, 2, null, 3, null, null, 4, 5])).toEqual([[0, 1], [3], [6, 7]]);
    expect(segments([null, null])).toEqual([]);
  });
});

describe('La fase del ciclo de cada día', () => {
  const entry = (k: string) => ({ id: k, fecha: `${k}T12:00:00.000Z`, createdAt: `${k}T12:00:00.000Z` });

  it('con las reglas apuntadas hasta ese día; antes de la primera, no se sabe', () => {
    const keys = days('2026-10-01', 40);
    const c = cycleByDay(keys, [entry('2026-10-05'), entry('2026-11-02')], 28);
    expect(c[0]).toBeNull(); // 1 de octubre
    expect(c[4]).toEqual({ phase: 'menstrual', day: 1 }); // 5 de octubre
    expect(c[4 + 9]).toEqual({ phase: 'follicular', day: 10 });
    expect(c[4 + 13]?.phase).toBe('ovulation'); // día 14 de 28
    expect(c[4 + 20]?.phase).toBe('luteal');
    expect(c[32]).toEqual({ phase: 'menstrual', day: 1 }); // 2 de noviembre, la siguiente
  });

  it('tramos seguidos de la misma fase', () => {
    const keys = days('2026-10-01', 12);
    const runs = cycleRuns(cycleByDay(keys, [entry('2026-10-03')], 28));
    expect(runs).toEqual([
      { from: 2, to: 6, phase: 'menstrual' },
      { from: 7, to: 11, phase: 'follicular' },
    ]);
  });

  it('en la demo sin reglas, un ejemplo como el de Hoy (la última, hace 11 días)', () => {
    const keys = days('2026-10-08', 30);
    const c = cycleByDay(keys, [], null, true);
    expect(c[29]).toEqual({ phase: 'follicular', day: 12 });
    expect(c.every(Boolean)).toBe(true);
    // Sin el ejemplo, nada
    expect(cycleByDay(keys, [], null, false).some(Boolean)).toBe(false);
  });
});

describe('En español', () => {
  it('el nombre de cada medida y de cada fase', () => {
    const ES: Record<string, string> = { ...workoutsEs, ...es };
    const names = [...SERIES.map((s) => s.label), 'Period', 'Follicular', 'Ovulation', 'Luteal', 'bpm'];
    expect(names.filter((x) => !(x in ES))).toEqual([]);
  });
});

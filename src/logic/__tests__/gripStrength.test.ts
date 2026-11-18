import { describe, expect, it } from 'vitest';
import { DODDS_GRIP, gripAgeLabel, gripBand, gripRowFor, GRIP_BAND_LABEL } from '@/logic/gripStrength';

describe('Fuerza de agarre (Dodds 2014)', () => {
  it('la tabla está completa y ordenada: de 20 a 90 años de 5 en 5, con los centiles de menor a mayor', () => {
    for (const sex of ['male', 'female'] as const) {
      const rows = DODDS_GRIP[sex];
      expect(rows.map((r) => r.age)).toEqual([20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90]);
      for (const r of rows) for (let i = 1; i < r.p.length; i++) expect(r.p[i]).toBeGreaterThan(r.p[i - 1]);
    }
  });

  it('las cifras de la tabla 2 del artículo: mediana máxima 51 kg en hombres y 31 kg en mujeres', () => {
    expect(gripRowFor(30, 'male').p).toEqual([38, 44, 51, 58, 64]);
    expect(gripRowFor(35, 'female').p).toEqual([23, 27, 31, 35, 39]);
    expect(Math.max(...DODDS_GRIP.male.map((r) => r.p[2]))).toBe(51);
    expect(Math.max(...DODDS_GRIP.female.map((r) => r.p[2]))).toBe(31);
  });

  it('cada edad va a la fila más cercana; por debajo de 20 la de 20 y por encima de 90 la de 90', () => {
    expect(gripRowFor(22, 'male').age).toBe(20);
    expect(gripRowFor(23, 'male').age).toBe(25);
    expect(gripRowFor(37, 'female').age).toBe(35);
    expect(gripRowFor(38, 'female').age).toBe(40);
    expect(gripRowFor(16, 'male').age).toBe(20);
    expect(gripRowFor(97, 'female').age).toBe(90);
  });

  it('las edades de cada fila en la tabla', () => {
    expect(gripAgeLabel(gripRowFor(20, 'male'))).toBe('18-22');
    expect(gripAgeLabel(gripRowFor(45, 'male'))).toBe('43-47');
    expect(gripAgeLabel(gripRowFor(90, 'male'))).toBe('88+');
  });

  it('banda según la edad y el sexo, con los límites dentro de la banda de arriba', () => {
    // Hombre de 40: p25 44, p50 50, p75 57, p90 63
    expect(gripBand(43.9, 40, 'male')).toBe('low');
    expect(gripBand(44, 40, 'male')).toBe('fair');
    expect(gripBand(50, 40, 'male')).toBe('good');
    expect(gripBand(57, 40, 'male')).toBe('excellent');
    expect(gripBand(63, 40, 'male')).toBe('superior');
    // Los mismos 30 kg: aceptables en una mujer de 30 años, bajos en un hombre de 30 y buenos en un hombre de 85
    expect(gripBand(30, 30, 'female')).toBe('fair');
    expect(gripBand(30, 30, 'male')).toBe('low');
    expect(gripBand(30, 85, 'male')).toBe('good');
    // Mujer de 72 (fila de 70): p50 24, p90 31
    expect(gripBand(24, 72, 'female')).toBe('good');
    expect(gripBand(31, 72, 'female')).toBe('superior');
  });

  it('cada banda tiene su texto', () => {
    expect(Object.keys(GRIP_BAND_LABEL).sort()).toEqual(['excellent', 'fair', 'good', 'low', 'superior']);
  });
});

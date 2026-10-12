import { describe, expect, it } from 'vitest';
import { bpLevel } from '@/logic/bloodPressure';
import { kuovaAge } from '@/logic/kuovaAge';

describe('Edad KUOVA', () => {
  it('un número (centro del intervalo) y la confianza según su anchura', () => {
    const k = kuovaAge({ low: 29.1, high: 33.2, chronological_age: 32 });
    expect(k.age).toBeCloseTo(31.2, 1);
    expect(k.confidence).toBe(84);
    expect(k.quality).toBe('high');
    expect(k.diff).toBeGreaterThan(0); // más joven que su edad
  });

  it('un intervalo muy ancho da una estimación aproximada', () => {
    const k = kuovaAge({ low: 30, high: 40, chronological_age: 35 });
    expect(k.confidence).toBe(60);
    expect(k.quality).toBe('rough');
  });
});

describe('Semáforo de la tensión', () => {
  it('verde, amarillo y rojo con los cortes europeos', () => {
    expect(bpLevel(120, 80)).toBe('ok');
    expect(bpLevel(134, 86)).toBe('watch');
    expect(bpLevel(85, 55)).toBe('watch');
    expect(bpLevel(142, 88)).toBe('high');
    expect(bpLevel(128, 92)).toBe('high');
  });
});

describe('VO2max (FRIEND 2015)', () => {
  it('banda según la edad y el sexo', async () => {
    const { vo2Band, vo2RowFor } = await import('@/logic/vo2max');
    expect(vo2RowFor(32, 'male').p[2]).toBe(42.4);
    expect(vo2Band(42.4, 32, 'male')).toBe('good');
    expect(vo2Band(30, 32, 'male')).toBe('low');
    expect(vo2Band(30, 32, 'female')).toBe('fair');
    expect(vo2Band(60, 25, 'male')).toBe('excellent');
    expect(vo2Band(40, 85, 'female')).toBe('superior'); // por encima de 79 usa 70-79
  });
});

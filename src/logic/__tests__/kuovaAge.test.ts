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

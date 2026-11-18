import { describe, expect, it } from 'vitest';
import { cannotFit, clampNumber, cleanNumberText, parseNumberText, readDraft, stepNumber, wholeDigits } from '@/logic/numberStepper';
import { es } from '@/i18n/es';
import { metasEs } from '@/i18n/metasEs';
import { workoutsEs } from '@/i18n/workoutsEs';
import { dietEs } from '@/i18n/dietEs';
import { historialEs } from '@/i18n/historialEs';
import { authEs } from '@/i18n/authEs';
import { bodyEs } from '@/i18n/bodyEs';

// El «− cifra +» con teclado (FineNumber) de la glucosa, el peso, la tensión y las mediciones de un solo valor
// (fundador, 2026-11-16: «me quedo con +- y que se pueda introducir con teclado»)
const GLU = { min: 20, max: 409 };
const KG = { min: 30, max: 250, decimals: 1 };

describe('pasos con − y +', () => {
  it('de uno en uno, sin pasarse de los límites', () => {
    expect(stepNumber(90, 1, 1, GLU)).toBe(91);
    expect(stepNumber(90, -1, 1, GLU)).toBe(89);
    expect(stepNumber(409, 1, 1, GLU)).toBe(409);
    expect(stepNumber(20, -1, 1, GLU)).toBe(20);
  });

  it('con decimales, sin errores de coma flotante', () => {
    expect(stepNumber(72.4, 1, 0.1, KG)).toBe(72.5);
    expect(stepNumber(72.4, -1, 0.1, KG)).toBe(72.3);
    expect(stepNumber(0.1, 1, 0.1, { min: 0, max: 1, decimals: 1 })).toBe(0.2);
    expect(stepNumber(250, 1, 0.1, KG)).toBe(250);
  });

  it('dejándolo pulsado salta a los múltiplos del paso rápido', () => {
    expect(stepNumber(91, 1, 1, GLU, 5)).toBe(95);
    expect(stepNumber(95, 1, 1, GLU, 5)).toBe(100);
    expect(stepNumber(93, -1, 1, GLU, 5)).toBe(90);
    expect(stepNumber(90, -1, 1, GLU, 5)).toBe(85);
    expect(stepNumber(72.3, 1, 0.1, KG, 0.5)).toBe(72.5);
    expect(stepNumber(72.5, 1, 0.1, KG, 0.5)).toBe(73);
    expect(stepNumber(407, 1, 1, GLU, 5)).toBe(409);
  });
});

describe('lo que se escribe', () => {
  it('solo cifras; con decimales, una coma o un punto y los decimales que tocan', () => {
    expect(cleanNumberText('1a2b0', 0, 3)).toBe('120');
    expect(cleanNumberText('1205', 0, 3)).toBe('120');
    expect(cleanNumberText('12.5', 0, 3)).toBe('125');
    expect(cleanNumberText('72,45', 1, 3)).toBe('72,4');
    expect(cleanNumberText('72.4.5', 1, 3)).toBe('72.4');
    expect(cleanNumberText('1234,5', 1, 3)).toBe('123,5');
    expect(cleanNumberText(',5', 1, 3)).toBe(',5');
  });

  it('vale la coma y el punto', () => {
    expect(parseNumberText('72,4')).toBe(72.4);
    expect(parseNumberText('72.4')).toBe(72.4);
    expect(parseNumberText('72,')).toBe(72);
    expect(parseNumberText('')).toBeNull();
    expect(parseNumberText(',')).toBeNull();
  });

  it('lo escrito se ajusta a los límites y a sus decimales', () => {
    expect(readDraft('140', GLU)).toEqual({ value: 140, inRange: true });
    expect(readDraft('14', GLU)).toEqual({ value: 20, inRange: false });
    expect(readDraft('500', GLU)).toEqual({ value: 409, inRange: false });
    expect(readDraft('', GLU)).toEqual({ value: null, inRange: false });
    expect(readDraft('72,46', KG)).toEqual({ value: 72.5, inRange: true });
    expect(clampNumber(72.46, KG)).toBe(72.5);
  });

  it('a medio escribir no se avisa; lo que ya no puede valer, sí', () => {
    expect(cannotFit('1', GLU)).toBe(false); // camino de 140
    expect(cannotFit('14', GLU)).toBe(false);
    expect(cannotFit('500', GLU)).toBe(true); // pasa del máximo
    expect(cannotFit('015', GLU)).toBe(true); // ya no caben más cifras
    expect(cannotFit('2', KG)).toBe(false); // camino de 25x
    expect(cannotFit('25,', KG)).toBe(true); // con la coma ya no crece
    expect(cannotFit('250,5', KG)).toBe(true);
    expect(cannotFit('', GLU)).toBe(false);
  });

  it('cifras de la parte entera según el máximo', () => {
    expect(wholeDigits(409)).toBe(3);
    expect(wholeDigits(90)).toBe(2);
    expect(wholeDigits(250)).toBe(3);
  });
});

// Igual que src/i18n/index.ts: es.ts gana a los demás
const ES: Record<string, string> = { ...authEs, ...workoutsEs, ...dietEs, ...metasEs, ...historialEs, ...bodyEs, ...es };
type Fs = { readFileSync: (p: string, enc: 'utf8') => string };

describe('textos', () => {
  it('cada t(«…») del «− +» y de las pantallas que lo usan tiene su traducción', async () => {
    const fs = (await import('node:fs' as string)) as Fs;
    const files = [
      'src/components/fine/FineNumber.tsx',
      'src/screens/LogGlucoseScreen.tsx',
      'src/screens/LogWeightScreen.tsx',
      'src/screens/LogBloodPressureScreen.tsx',
      'src/screens/LogSimpleMetricScreen.tsx',
    ];
    const missing: string[] = [];
    for (const f of files) {
      for (const m of fs.readFileSync(f, 'utf8').matchAll(/\bt\(\s*'((?:\\'|[^'\n])*)'/g)) {
        const k = m[1].replace(/\\'/g, "'");
        if (!(k in ES)) missing.push(`${f}: ${k}`);
      }
    }
    expect(missing).toEqual([]);
  });
});

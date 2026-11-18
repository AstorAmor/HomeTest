import { describe, expect, it } from 'vitest';
import { es } from '@/i18n/es';
import { bodyEs } from '@/i18n/bodyEs';
import { workoutsEs } from '@/i18n/workoutsEs';
import { dietEs } from '@/i18n/dietEs';
import { metasEs } from '@/i18n/metasEs';
import { historialEs } from '@/i18n/historialEs';

// Igual que src/i18n/index.ts: es.ts gana a los demás
const ES: Record<string, string> = { ...workoutsEs, ...dietEs, ...metasEs, ...historialEs, ...bodyEs, ...es };

// TypeScript 6 deja types = [] (sin tipos de Node): se carga fs así, como en historialEs.test.ts
type Fs = { readFileSync: (p: string, enc: 'utf8') => string };
const FILES = [
  'src/screens/WeightInfo.tsx',
  'src/screens/LogMeasurementsScreen.tsx',
  'src/screens/MeasurementsHistoryScreen.tsx',
  'src/screens/LogWeightScreen.tsx',
  'src/screens/measureFormat.ts',
];

// Los textos de Peso → composición corporal estimada con las medidas (2026-11-16), que van en bodyEs.ts
describe('Composición corporal y medidas en español', () => {
  it('cada t(«…») de las pantallas del peso y de las medidas tiene su traducción', async () => {
    const fs = (await import('node:fs' as string)) as Fs;
    const found = new Set<string>();
    for (const f of FILES) {
      const src = fs.readFileSync(f, 'utf8');
      // t('…') y también los dos textos de «cond ? t('…') : t('…')» y de «? '…' : '…'» dentro de un t(
      for (const m of src.matchAll(/\bt\(\s*'((?:\\'|[^'])*)'/g)) found.add(m[1].replace(/\\'/g, "'"));
      for (const m of src.matchAll(/\bt\(\s*[\w.!?=\s'"]+\?\s*'((?:\\'|[^'])*)'\s*:\s*'((?:\\'|[^'])*)'/g)) {
        found.add(m[1]);
        found.add(m[2]);
      }
    }
    expect(found.size).toBeGreaterThan(40);
    expect([...found].filter((x) => !(x in ES))).toEqual([]);
    // Y todo lo de bodyEs.ts se usa en esas pantallas
    expect(Object.keys(bodyEs).filter((k) => !found.has(k))).toEqual([]);
  });

  it('ninguna clave choca con es.ts (es.ts ganaría y saldría otro texto)', () => {
    const clash = Object.keys(bodyEs).filter((k) => k in es && es[k] !== bodyEs[k]);
    expect(clash).toEqual([]);
  });

  it('sin tono de diagnóstico: son estimaciones para compararse con uno mismo', () => {
    const texts = Object.values(bodyEs).join(' ').toLowerCase();
    for (const word of ['riesgo', 'obesidad', 'sobrepeso', 'peligro', 'alto', 'alta', 'elevado', 'elevada']) expect(texts, word).not.toMatch(new RegExp(`\\b${word}\\b`));
  });
});

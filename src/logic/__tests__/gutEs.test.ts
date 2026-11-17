import { describe, expect, it } from 'vitest';
import { es } from '@/i18n/es';
import { authEs } from '@/i18n/authEs';
import { bodyEs } from '@/i18n/bodyEs';
import { careEs } from '@/i18n/careEs';
import { dietEs } from '@/i18n/dietEs';
import { gutEs } from '@/i18n/gutEs';
import { historialEs } from '@/i18n/historialEs';
import { metasEs } from '@/i18n/metasEs';
import { symptomsEs } from '@/i18n/symptomsEs';
import { workoutsEs } from '@/i18n/workoutsEs';
import { SAFETY_QUESTIONS } from '@/logic/gutSafety';
import { BRISTOL_TYPES, STOOL_COLORS, URINE_COLORS } from '@/types/bathroom';
import { GUT_SYMPTOMS, INTENSITIES, MEAL_AMOUNTS, MINUTES_BEFORE, USUAL_FREQUENCIES } from '@/types/digestion';

// Igual que src/i18n/index.ts: es.ts gana a los demás
const ES: Record<string, string> = { ...authEs, ...workoutsEs, ...dietEs, ...metasEs, ...historialEs, ...bodyEs, ...gutEs, ...careEs, ...symptomsEs, ...es };

// TypeScript 6 deja types = [] (sin tipos de Node): se carga fs así, como en historialEs.test.ts
type Fs = { readFileSync: (p: string, enc: 'utf8') => string };
const FILES = [
  'src/screens/DigestiveScreen.tsx',
  'src/screens/GutInsightsScreen.tsx',
  'src/screens/GutSafetyScreen.tsx',
  'src/screens/LogBowelScreen.tsx',
  'src/screens/LogUrineScreen.tsx',
  'src/screens/LogDigestionScreen.tsx',
  'src/components/BathroomVisuals.tsx',
  'src/components/BathroomVisits.tsx',
];

// Digestión, heces e hidratación (rediseño del 2026-11-17): lo nuevo va en gutEs.ts
describe('Digestión, heces e hidratación en español', () => {
  it('cada t(«…») de esas pantallas tiene su traducción', async () => {
    const fs = (await import('node:fs' as string)) as Fs;
    const found = new Set<string>();
    let all = '';
    for (const f of FILES) {
      const src = fs.readFileSync(f, 'utf8');
      all += src;
      // t('…') y tr('…') (LogBowelScreen), y los dos textos de «cond ? t('…') : t('…')» dentro de un t(
      for (const m of src.matchAll(/\btr?\(\s*'((?:\\'|[^'])*)'/g)) found.add(m[1].replace(/\\'/g, "'"));
      for (const m of src.matchAll(/\btr?\(\s*[\w.!?=\s'"]+\?\s*'((?:\\'|[^'])*)'\s*:\s*'((?:\\'|[^'])*)'/g)) {
        found.add(m[1]);
        found.add(m[2]);
      }
    }
    expect(found.size).toBeGreaterThan(80);
    expect([...found].filter((x) => !(x in ES))).toEqual([]);
    // Y todo lo de gutEs.ts se usa en esas pantallas (como texto de un t(…) o en una lista que luego se traduce)
    expect(Object.keys(gutEs).filter((k) => !found.has(k) && !all.includes(`'${k}'`))).toEqual([]);
  });

  it('las listas que se traducen al pintarlas tienen su traducción', () => {
    const texts = [
      ...SAFETY_QUESTIONS.map((q) => q.text),
      ...STOOL_COLORS.map((c) => c.label),
      ...URINE_COLORS.map((c) => c.label),
      ...BRISTOL_TYPES.flatMap((b) => [b.label, b.hint]),
      ...GUT_SYMPTOMS.flatMap((s) => [s.label, s.hint]),
      ...INTENSITIES.map((i) => i.label),
      ...USUAL_FREQUENCIES.map((f) => f.label),
      ...MINUTES_BEFORE.map((m) => m.label),
      ...MEAL_AMOUNTS.map((m) => m.label),
      'Discomfort',
      'Mild discomfort',
      'Moderate discomfort',
      'Strong discomfort',
    ];
    expect(texts.filter((x) => !(x in ES))).toEqual([]);
  });

  it('ninguna clave choca con es.ts (es.ts ganaría y saldría otro texto)', () => {
    const clash = Object.keys(gutEs).filter((k) => k in es && es[k] !== gutEs[k]);
    expect(clash).toEqual([]);
  });

  it('los títulos que pidió el fundador', () => {
    expect(ES['Food frequency']).toBe('Frecuencia de alimentos');
    expect(ES['The day in general']).toBe('El día en general');
    expect(ES['Mild discomfort']).toBe('Molestias leves');
  });

  it('sin tono de diagnóstico ni palabras de alarma en lo nuevo', () => {
    const texts = Object.values(gutEs).join(' ').toLowerCase();
    for (const word of ['riesgo', 'peligro', 'grave', 'alarma', 'urgente', 'enfermedad', 'diagnóstico', 'anormal']) expect(texts, word).not.toMatch(new RegExp(`\\b${word}\\b`));
  });
});

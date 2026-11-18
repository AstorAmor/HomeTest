import { describe, expect, it } from 'vitest';
import { es } from '@/i18n/es';
import { authEs } from '@/i18n/authEs';
import { workoutsEs } from '@/i18n/workoutsEs';
import { dietEs } from '@/i18n/dietEs';
import { metasEs } from '@/i18n/metasEs';
import { historialEs } from '@/i18n/historialEs';
import { bodyEs } from '@/i18n/bodyEs';
import { gutEs } from '@/i18n/gutEs';
import { careEs } from '@/i18n/careEs';
import { symptomsEs } from '@/i18n/symptomsEs';
import { CONDITION_OPTIONS, CONTRACEPTION_OPTIONS, CYCLE_GOAL_OPTIONS, SYMPTOM_OPTIONS } from '@/types/cycleGoal';

// Igual que src/i18n/index.ts: es.ts gana a los demás
const ES: Record<string, string> = { ...authEs, ...workoutsEs, ...dietEs, ...metasEs, ...historialEs, ...bodyEs, ...gutEs, ...careEs, ...symptomsEs, ...es };

// TypeScript 6 deja types = [] (sin tipos de Node): se carga fs así, como en historialEs.test.ts
type Fs = { readFileSync: (p: string, enc: 'utf8') => string };
// El cuestionario del ciclo, los ejercicios guiados y la medicación, pasados al lenguaje fino el 2026-11-17
const FILES = [
  'src/screens/CycleGoalScreen.tsx',
  'src/screens/ExerciseScreen.tsx',
  'src/screens/MedicationsScreen.tsx',
  'src/screens/MedicationHistoryScreen.tsx',
  'src/screens/MedicationSetupScreen.tsx',
  'src/components/DoseRows.tsx',
  'src/components/MedToday.tsx',
  'src/components/ZoneChangeBanner.tsx',
  'src/components/fine/FineSteps.tsx',
];

const Q = `'((?:\\\\'|[^'])*)'`; // un texto entre comillas simples
const DQ = `"((?:\\\\"|[^"])*)"`; // o entre comillas dobles (los que llevan un apóstrofo)

describe('Ciclo, ejercicios guiados y medicación en español', () => {
  it('cada t(«…») de esas pantallas tiene su traducción', async () => {
    const fs = (await import('node:fs' as string)) as Fs;
    const found = new Set<string>();
    for (const f of FILES) {
      const src = fs.readFileSync(f, 'utf8');
      // t('…') y tr('…'), con comillas simples o dobles
      for (const m of src.matchAll(new RegExp(`\\btr?\\(\\s*${Q}`, 'g'))) found.add(m[1].replace(/\\'/g, "'"));
      for (const m of src.matchAll(new RegExp(`\\btr?\\(\\s*${DQ}`, 'g'))) found.add(m[1].replace(/\\"/g, '"'));
      // Los dos textos de «t(cond ? '…' : '…'»
      for (const m of src.matchAll(new RegExp(`\\btr?\\(\\s*[\\w.!?=\\s'"]+\\?\\s*${Q}\\s*:\\s*${Q}`, 'g'))) {
        found.add(m[1]);
        found.add(m[2]);
      }
      // tn(n, 'uno', 'varios')
      for (const m of src.matchAll(new RegExp(`\\btn\\([^,]+,\\s*${Q},\\s*${Q}`, 'g'))) {
        found.add(m[1]);
        found.add(m[2]);
      }
    }
    expect(found.size).toBeGreaterThan(150);
    expect([...found].filter((x) => !(x in ES))).toEqual([]);
  });

  it('las opciones del cuestionario del ciclo tienen su traducción', () => {
    const texts = [
      ...CYCLE_GOAL_OPTIONS.flatMap((o) => [o.title, o.subtitle]),
      ...SYMPTOM_OPTIONS.map((o) => o.label),
      ...CONTRACEPTION_OPTIONS.map((o) => o.label),
      ...CONDITION_OPTIONS.map((o) => o.label),
    ];
    expect(texts.filter((x) => !(x in ES))).toEqual([]);
  });

  it('ninguna clave choca con es.ts (es.ts ganaría y saldría otro texto)', () => {
    const clash = Object.keys(careEs).filter((k) => k in es && es[k] !== careEs[k]);
    expect(clash).toEqual([]);
  });

  it('sin tono de alarma ni de diagnóstico', () => {
    const texts = Object.values(careEs).join(' ').toLowerCase();
    for (const word of ['peligro', 'peligroso', 'grave', 'alarma', 'urgente', 'riesgo', 'anormal']) expect(texts, word).not.toMatch(new RegExp(`\\b${word}\\b`));
  });
});

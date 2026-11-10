import { describe, expect, it } from 'vitest';
import { es } from '@/i18n/es';
import { metasEs } from '@/i18n/metasEs';
import { workoutsEs } from '@/i18n/workoutsEs';
import { dietEs } from '@/i18n/dietEs';
import { historialEs } from '@/i18n/historialEs';
import { EXPORT_PERIODS } from '@/logic/workoutExport';

// Exportar el entrenamiento (fundador, 2026-11-09): cada texto nuevo tiene su traducción, también los del texto y el
// PDF que se comparten. Igual que src/i18n/index.ts: es.ts gana a los demás
const ES: Record<string, string> = { ...workoutsEs, ...dietEs, ...metasEs, ...historialEs, ...es };

type Fs = { readFileSync: (p: string, enc: 'utf8') => string };
const FILES = [
  'src/logic/workoutExport.ts',
  'src/utils/workoutPdf.ts',
  'src/screens/workouts/WorkoutExportScreen.tsx',
  'src/screens/workouts/WorkoutsScreen.tsx',
  'src/screens/workouts/WorkoutHistoryScreen.tsx',
];

const keysIn = (src: string) => {
  const found = new Set<string>();
  for (const m of src.matchAll(/\b(?:t|tn\([^,]+,)\(?\s*'((?:\\'|[^'\n])*)'/g)) found.add(m[1].replace(/\\'/g, "'"));
  // tn(n, '…', '…'): las dos
  for (const m of src.matchAll(/\btn\([^,'\n]+,\s*'((?:\\'|[^'\n])*)',\s*'((?:\\'|[^'\n])*)'/g)) {
    found.add(m[1]);
    found.add(m[2]);
  }
  return found;
};

describe('Exportar el entrenamiento en español', () => {
  it('cada t(«…») y tn(…) de los archivos nuevos tiene su traducción', async () => {
    const fs = (await import('node:fs' as string)) as Fs;
    const missing: string[] = [];
    for (const f of FILES) for (const k of keysIn(fs.readFileSync(f, 'utf8'))) if (!(k in ES)) missing.push(`${f}: ${k}`);
    expect(missing).toEqual([]);
  });

  it('los periodos y los tipos de entreno, también', () => {
    const texts = [...EXPORT_PERIODS.map((p) => p.label), 'Strength', 'Cardio', 'Mobility', 'Sport', 'Easy', 'Moderate', 'Hard'];
    expect(texts.filter((x) => !(x in ES))).toEqual([]);
  });
});

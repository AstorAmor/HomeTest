import { describe, expect, it } from 'vitest';
import { es } from '@/i18n/es';
import { metasEs } from '@/i18n/metasEs';
import { workoutsEs } from '@/i18n/workoutsEs';
import { dietEs } from '@/i18n/dietEs';
import { historialEs } from '@/i18n/historialEs';
import { authEs } from '@/i18n/authEs';
import { symptomsEs } from '@/i18n/symptomsEs';
import { measuresEs } from '@/i18n/measuresEs';
import { TAB } from '@/constants/tabs';

// La app en 4 pestañas (2026-11-16, borradores/app-estructura/ESPECIFICACION.md): cada texto nuevo o movido de
// las pantallas tocadas tiene su traducción, y las pestañas son las que dice la especificación.
// Igual que src/i18n/index.ts: es.ts gana a los demás (symptomsEs: la opción «Síntoma» del botón K, 2026-11-17)
// measuresEs va después de es.ts, como en index.ts (Mediciones y fuerza de agarre, 2026-11-17)
const ES: Record<string, string> = { ...authEs, ...workoutsEs, ...dietEs, ...metasEs, ...historialEs, ...symptomsEs, ...es, ...measuresEs };

type Fs = { readFileSync: (p: string, enc: 'utf8') => string };
const FILES = [
  'src/components/BottomTabBar.tsx',
  'src/components/FirstAnalysisCard.tsx',
  'src/components/fine/Fine.tsx',
  'src/components/CheckInButton.tsx',
  'src/components/KuovaAgeSection.tsx',
  'src/components/metas/MetasToday.tsx',
  'src/components/web/WebShell.tsx',
  'src/screens/PlanScreen.tsx',
  'src/screens/LabScreen.tsx',
  'src/screens/MoreScreen.tsx',
  'src/screens/TodayScreen.tsx',
  'src/screens/MyDataScreen.tsx',
  'src/screens/AppSectionsScreen.tsx',
];

const keysIn = (src: string) => {
  const found = new Set<string>();
  for (const m of src.matchAll(/\bt\(\s*'((?:\\'|[^'\n])*)'/g)) found.add(m[1].replace(/\\'/g, "'"));
  // t(x ? '…' : '…') en una línea, con una condición sin comillas
  for (const m of src.matchAll(/\bt\([ \t]*[\w.!?=<> \t]+\?[ \t]*'((?:\\'|[^'\n])*)'[ \t]*:[ \t]*'((?:\\'|[^'\n])*)'/g)) {
    found.add(m[1]);
    found.add(m[2]);
  }
  return found;
};

// Textos que se pasan por t() al pintarse: label, title, subtitle, text y sub de las listas
const listTexts = (src: string) =>
  [...src.matchAll(/\b(?:label|title|subtitle|text|sub): '((?:\\'|[^'\n])*)'/g)].map((m) => m[1].replace(/\\'/g, "'"));

describe('Kuova en 4 pestañas', () => {
  it('Hoy, Plan, Análisis y Tú, en este orden', () => {
    expect(TAB).toEqual({ today: 0, plan: 1, analysis: 2, you: 3 });
  });

  it('cada t(«…») de las pantallas tocadas tiene su traducción', async () => {
    const fs = (await import('node:fs' as string)) as Fs;
    const missing: string[] = [];
    for (const f of FILES) for (const k of keysIn(fs.readFileSync(f, 'utf8'))) if (!(k in ES)) missing.push(`${f}: ${k}`);
    expect(missing).toEqual([]);
  });

  it('las pestañas, «Apuntar», el tutorial, el menú de Tú y las secciones, también', async () => {
    const fs = (await import('node:fs' as string)) as Fs;
    const files = ['src/components/BottomTabBar.tsx', 'src/components/tour/tourStore.ts', 'src/screens/MoreScreen.tsx', 'src/data/appPrefs.ts', 'src/screens/LabScreen.tsx', 'src/screens/PlanScreen.tsx'];
    const missing: string[] = [];
    for (const f of files) for (const k of listTexts(fs.readFileSync(f, 'utf8'))) if (!(k in ES)) missing.push(`${f}: ${k}`);
    expect(missing).toEqual([]);
  });
});

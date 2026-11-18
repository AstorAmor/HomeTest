import { describe, expect, it } from 'vitest';
import { es } from '@/i18n/es';
import { metasEs } from '@/i18n/metasEs';
import { historialEs } from '@/i18n/historialEs';
import { workoutsEs } from '@/i18n/workoutsEs';
import { dietEs } from '@/i18n/dietEs';
import { ALLERGY_CATALOG, ALLERGY_GROUP_NAME, BLOOD_GROUPS, EVENT_CAT_NAME, EVENT_PLACEHOLDER, MONTHS, NOTICE_CATALOG, VACCINE_CATALOG } from '@/logic/historial';

// Igual que src/i18n/index.ts: es.ts gana a los demás
const ES: Record<string, string> = { ...workoutsEs, ...dietEs, ...metasEs, ...historialEs, ...es };

// TypeScript 6 deja types = [] (sin tipos de Node): se carga fs así, como en platformFiles.test.ts
type Fs = { readFileSync: (p: string, enc: 'utf8') => string };
const FILES = [
  'src/logic/historial.ts',
  'src/components/historial/HistorialBlock.tsx',
  'src/components/historial/EmergencyCard.tsx',
  'src/components/historial/HistorialParts.tsx',
  'src/screens/HistorialScreens.tsx',
  'src/screens/MoreScreen.tsx',
];

describe('Historial y tarjeta de emergencia en español', () => {
  it('cada texto de las listas tiene su traducción', () => {
    const texts = [
      ...Object.values(ALLERGY_GROUP_NAME),
      ...Object.values(ALLERGY_CATALOG).flat(),
      ...VACCINE_CATALOG,
      ...MONTHS,
      ...Object.values(EVENT_CAT_NAME),
      ...Object.values(EVENT_PLACEHOLDER),
      ...NOTICE_CATALOG,
      ...BLOOD_GROUPS.filter((g) => g.startsWith('O')).map((g) => g.replace('-', '−')),
    ];
    expect(texts.filter((x) => !(x in ES))).toEqual([]);
  });

  it('cada t(«…») de las pantallas tiene su traducción', async () => {
    const fs = (await import('node:fs' as string)) as Fs;
    const found = new Set<string>();
    for (const f of FILES) {
      const src = fs.readFileSync(f, 'utf8');
      for (const m of src.matchAll(/\bt\(\s*'((?:\\'|[^'])*)'/g)) found.add(m[1].replace(/\\'/g, "'"));
      for (const m of src.matchAll(/\bt\(\s*[\w.!?=\s'"]+\?\s*'((?:\\'|[^'])*)'\s*:\s*'((?:\\'|[^'])*)'/g)) {
        found.add(m[1]);
        found.add(m[2]);
      }
      // Los títulos de Más van como «title: '…'» y «subtitle: '…'» y se traducen al pintarlos
      if (f.endsWith('MoreScreen.tsx')) for (const m of src.matchAll(/\b(?:title|subtitle): '((?:\\'|[^'])*)'/g)) found.add(m[1]);
      // Las versiones de la tarjeta: «['full', '…']» y sus notas «full: '…',»
      if (f.endsWith('HistorialScreens.tsx')) {
        for (const m of src.matchAll(/\['(?:full|compact|lock)', '((?:\\'|[^'])*)'\]/g)) found.add(m[1]);
        for (const m of src.matchAll(/^\s+(?:full|compact|lock): '((?:\\'|[^'])*)',$/gm)) found.add(m[1]);
      }
    }
    expect(found.size).toBeGreaterThan(60);
    expect([...found].filter((x) => !(x in ES))).toEqual([]);
  });

  it('ninguna clave choca con es.ts (es.ts ganaría y saldría otro texto)', () => {
    // Las que coinciden con es.ts tienen que dar lo mismo; si no, hay que cambiar la clave
    const clash = Object.keys(historialEs).filter((k) => k in es && es[k] !== historialEs[k]);
    expect(clash).toEqual([]);
  });
});

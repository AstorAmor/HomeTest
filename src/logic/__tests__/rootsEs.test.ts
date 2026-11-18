import { describe, expect, it } from 'vitest';
import { es } from '@/i18n/es';
import { authEs } from '@/i18n/authEs';
import { bodyEs } from '@/i18n/bodyEs';
import { careEs } from '@/i18n/careEs';
import { dietEs } from '@/i18n/dietEs';
import { gutEs } from '@/i18n/gutEs';
import { historialEs } from '@/i18n/historialEs';
import { metasEs } from '@/i18n/metasEs';
import { rootsEs } from '@/i18n/rootsEs';
import { symptomsEs } from '@/i18n/symptomsEs';
import { workoutsEs } from '@/i18n/workoutsEs';

// Igual que src/i18n/index.ts: es.ts gana a los demás
const ES: Record<string, string> = { ...authEs, ...workoutsEs, ...dietEs, ...metasEs, ...historialEs, ...bodyEs, ...gutEs, ...careEs, ...symptomsEs, ...rootsEs, ...es };

// TypeScript 6 deja types = [] (sin tipos de Node): se carga fs así, como en historialEs.test.ts
type Fs = { readFileSync: (p: string, enc: 'utf8') => string };
const FILES = ['src/screens/KnowYourRootsScreen.tsx', 'src/screens/GeneticProfileScreen.tsx'];

const read = async () => {
  const fs = (await import('node:fs' as string)) as Fs;
  return FILES.map((f) => fs.readFileSync(f, 'utf8'));
};

// «Conoce tus raíces» y «Tu perfil genético» en el lenguaje fino (2026-11-17): lo nuevo va en rootsEs.ts
describe('Conoce tus raíces en español', () => {
  it('cada t(«…») de esas pantallas tiene su traducción', async () => {
    const found = new Set<string>();
    for (const src of await read()) {
      // t('…') y tr('…'), y los dos textos de «cond ? t('…') : t('…')»
      for (const m of src.matchAll(/\btr?\(\s*'((?:\\'|[^'])*)'/g)) found.add(m[1].replace(/\\'/g, "'"));
      for (const m of src.matchAll(/\btr?\(\s*"((?:\\"|[^"])*)"/g)) found.add(m[1]);
    }
    expect(found.size).toBeGreaterThan(60);
    expect([...found].filter((x) => !(x in ES))).toEqual([]);
  });

  it('«Quién cuenta» sale una sola vez en la pantalla, como nota al pie, y con el mismo texto', async () => {
    const [roots] = await read();
    expect(roots.match(/tr\('Who counts'\)/g) ?? []).toHaveLength(1);
    expect(roots).toContain(
      "tr('Blood relatives on both sides (your mother’s and your father’s): parents, brothers and sisters, children, grandparents, aunts and uncles, first cousins, nieces and nephews. Partners and in-laws do not count.')",
    );
    expect(roots).toContain("tr('If you answer yes, next we ask who it was and at what age.')");
    expect(ES['Who counts']).toBe('Quién cuenta');
  });

  it('el lenguaje fino: sin fontWeight, sin los colores de antes ni iconos de MaterialCommunityIcons', async () => {
    for (const src of await read()) {
      expect(src).not.toMatch(/fontWeight/);
      expect(src).not.toMatch(/MaterialCommunityIcons/);
      expect(src).not.toMatch(/\bColors\./);
      expect(src).toMatch(/backgroundColor: 'transparent'/);
    }
  });

  it('ninguna clave choca con es.ts (es.ts ganaría y saldría otro texto)', () => {
    const clash = Object.keys(rootsEs).filter((k) => k in es && es[k] !== rootsEs[k]);
    expect(clash).toEqual([]);
  });
});

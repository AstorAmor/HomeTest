import { describe, expect, it } from 'vitest';
import { es } from '@/i18n/es';
import { metasEs } from '@/i18n/metasEs';
import { bodyEs } from '@/i18n/bodyEs';
import { measuresEs } from '@/i18n/measuresEs';
import { GRIP_BAND_LABEL } from '@/logic/gripStrength';

// Mediciones en fino y fuerza de agarre (fundador, 2026-11-17): cada texto de las pantallas nuevas o tocadas tiene
// su traducción. Igual que src/i18n/index.ts: measuresEs va después de es.ts
const ES: Record<string, string> = { ...metasEs, ...bodyEs, ...es, ...measuresEs };

type Fs = { readFileSync: (p: string, enc: 'utf8') => string };
const FILES = ['src/screens/GripStrengthInfo.tsx', 'src/app/grip-strength-detail.tsx', 'src/screens/MyDataScreen.tsx', 'src/screens/MeasurementsHistoryScreen.tsx'];

const keysIn = (src: string) => [...src.matchAll(/\bt\(\s*'((?:\\'|[^'\n])*)'/g)].map((m) => m[1].replace(/\\'/g, "'"));

describe('Mediciones y fuerza de agarre en español', () => {
  it('cada t(«…») de sus pantallas tiene su traducción', async () => {
    const fs = (await import('node:fs' as string)) as Fs;
    const missing: string[] = [];
    for (const f of FILES) for (const k of keysIn(fs.readFileSync(f, 'utf8'))) if (!(k in ES)) missing.push(`${f}: ${k}`);
    expect(missing).toEqual([]);
  });

  it('el título y la línea del registro (se pasan como texto y se traducen al pintarse)', async () => {
    const fs = (await import('node:fs' as string)) as Fs;
    const src = fs.readFileSync('src/app/log-grip-strength.tsx', 'utf8');
    const texts = [...src.matchAll(/\b(?:title|hint)="([^"]+)"/g)].map((m) => m[1]);
    expect(texts.length).toBe(2);
    for (const k of texts) expect(ES[k], k).toBeTruthy();
  });

  it('los niveles de la fuerza de agarre, con «nivel» para que concuerden', () => {
    for (const label of Object.values(GRIP_BAND_LABEL)) expect(ES[label], label).toMatch(/nivel/i);
  });
});

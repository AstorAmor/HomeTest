import { describe, expect, it } from 'vitest';
import { es } from '@/i18n/es';
import { metasEs } from '@/i18n/metasEs';
import { workoutsEs } from '@/i18n/workoutsEs';
import { dietEs } from '@/i18n/dietEs';
import { ALCOHOL, AREA_NAME, CATALOG, GOALS, TOBACCO } from '@/logic/metas';
import { META_EVIDENCE, SERVING_INFO } from '@/data/metasInfo';

// Igual que src/i18n/index.ts: es.ts gana a los demás
const ES: Record<string, string> = { ...workoutsEs, ...dietEs, ...metasEs, ...es };

// TypeScript 6 deja types = [] (sin tipos de Node): se carga fs así, como en platformFiles.test.ts
type Fs = { readFileSync: (p: string, enc: 'utf8') => string };
const FILES = ['src/logic/metas.ts', 'src/components/metas/MetaParts.tsx', 'src/components/metas/MetasToday.tsx', 'src/screens/MetasScreens.tsx', 'src/components/metas/WeekStartSetting.tsx'];

describe('Metas en español', () => {
  it('cada texto del catálogo tiene su traducción', () => {
    const texts: string[] = [...Object.values(AREA_NAME)];
    for (const d of Object.values(CATALOG)) {
      texts.push(d.short);
      if (d.name) texts.push(d.name);
      if (d.phrase) texts.push(d.phrase);
      if (d.unit) texts.push(d.unit.one, d.unit.many, ...(d.unit.of ? [d.unit.of] : []));
      texts.push(...(d.sessions ?? []), ...(d.countWord ?? []), ...(d.doneLabels ?? []));
    }
    for (const u of Object.values(TOBACCO)) texts.push(u.label, u.one, u.many);
    for (const k of Object.values(ALCOHOL)) texts.push(k.label, k.one, k.many);
    for (const g of Object.values(GOALS)) texts.push(g.name, g.track);
    for (const [title, body] of Object.values(SERVING_INFO)) texts.push(title, body);
    for (const list of Object.values(META_EVIDENCE)) for (const [level, body] of list) texts.push(level, body);
    const missing = [...new Set(texts)].filter((x) => !(x in ES));
    expect(missing).toEqual([]);
  });

  it('cada t(«…») de las pantallas de metas tiene su traducción', async () => {
    const fs = (await import('node:fs' as string)) as Fs;
    const found = new Set<string>();
    for (const f of FILES) {
      const src = fs.readFileSync(f, 'utf8');
      // t('…') y las dos ramas de t(x ? '…' : '…')
      for (const m of src.matchAll(/\bt\(\s*'((?:\\'|[^'])*)'/g)) found.add(m[1].replace(/\\'/g, "'"));
      for (const m of src.matchAll(/\bt\(\s*"((?:\\"|[^"])*)"/g)) found.add(m[1]);
      for (const m of src.matchAll(/\bt\(\s*[\w.!?=\s'"]+\?\s*'((?:\\'|[^'])*)'\s*:\s*'((?:\\'|[^'])*)'/g)) {
        found.add(m[1]);
        found.add(m[2]);
      }
    }
    expect(found.size).toBeGreaterThan(100);
    expect([...found].filter((x) => !(x in ES))).toEqual([]);
  });
});

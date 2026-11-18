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
import { rootsEs } from '@/i18n/rootsEs';
import { settingsEs } from '@/i18n/settingsEs';
import { checkinEs } from '@/i18n/checkinEs';
import { measuresEs } from '@/i18n/measuresEs';
import { guideEs } from '@/i18n/guideEs';
import { storeEs } from '@/i18n/storeEs';
import { wearablesEs } from '@/i18n/wearablesEs';

// Igual que src/i18n/index.ts y en el mismo orden (lo de después gana): wearablesEs va el último
const ES: Record<string, string> = {
  ...authEs,
  ...workoutsEs,
  ...dietEs,
  ...metasEs,
  ...historialEs,
  ...bodyEs,
  ...gutEs,
  ...careEs,
  ...symptomsEs,
  ...rootsEs,
  ...settingsEs,
  ...es,
  ...checkinEs,
  ...measuresEs,
  ...guideEs,
  ...storeEs,
  ...wearablesEs,
};

// TypeScript 6 deja types = [] (sin tipos de Node): se carga fs así, como en settingsEs.test.ts
type Fs = { readFileSync: (p: string, enc: 'utf8') => string };
const load = async () => (await import('node:fs' as string)) as Fs;

// Wearables, pasada al lenguaje fino el 2026-11-17
const SCREEN = 'src/screens/WearablesScreen.tsx';

const Q = `'((?:\\\\'|[^'])*)'`; // un texto entre comillas simples
const DQ = `"((?:\\\\"|[^"])*)"`; // o entre comillas dobles (los que llevan un apóstrofo)

// El cuerpo de un `const NOMBRE … = { … };` del archivo
const body = (src: string, name: string) => {
  const start = src.indexOf(`const ${name}`);
  expect(start, name).toBeGreaterThan(-1);
  return src.slice(start, src.indexOf(';', src.indexOf('=', start)));
};

describe('Wearables en español', () => {
  it('cada t(«…») de la pantalla tiene su traducción', async () => {
    const src = (await load()).readFileSync(SCREEN, 'utf8');
    const found = new Set<string>();
    for (const m of src.matchAll(new RegExp(`\\bt\\(\\s*${Q}`, 'g'))) found.add(m[1].replace(/\\'/g, "'"));
    for (const m of src.matchAll(new RegExp(`\\bt\\(\\s*${DQ}`, 'g'))) found.add(m[1].replace(/\\"/g, '"'));
    // Los dos textos de «t(cond ? '…' : '…'»
    for (const m of src.matchAll(new RegExp(`\\bt\\(\\s*[\\w.!?=\\s'"]+\\?\\s*${Q}\\s*:\\s*${Q}`, 'g'))) {
      found.add(m[1]);
      found.add(m[2]);
    }
    expect(found.size).toBeGreaterThan(35);
    expect([...found].filter((x) => !(x in ES))).toEqual([]);
  });

  it('los nombres de las métricas y de los tipos de Health Connect y Apple Salud también', async () => {
    const fs = await load();
    const labels = [...body(fs.readFileSync(SCREEN, 'utf8'), 'METRIC_LABEL').matchAll(new RegExp(`label: ${Q}`, 'g'))].map((m) => m[1]);
    const values = (f: string, name: string) => [...body(fs.readFileSync(f, 'utf8'), name).matchAll(new RegExp(`:\\s*${Q}`, 'g'))].map((m) => m[1]);
    const texts = [
      ...labels,
      ...values('src/wearables/providers/healthConnect.ts', 'TYPE_LABEL'),
      ...values('src/wearables/providers/appleHealthShared.ts', 'APPLE_TYPE_LABEL'),
    ];
    expect(labels.length).toBe(16);
    expect(texts.length).toBeGreaterThan(25);
    expect(texts.filter((x) => !(x in ES))).toEqual([]);
  });

  it('los textos nuevos son etiquetas y frases, sin preguntas ni exclamaciones', () => {
    for (const [en, tr] of Object.entries(wearablesEs)) {
      expect(en, en).not.toMatch(/[?!]/);
      expect(tr, en).not.toMatch(/[¿?¡!]/);
    }
  });

  it('«Tus últimos días» ya no sale (en español suena a despedida)', async () => {
    const src = (await load()).readFileSync(SCREEN, 'utf8');
    expect(src).not.toContain("t('Your last days')");
    expect(ES['Recent days']).toBe('Días recientes');
  });

  it('sin los iconos, los colores ni la negrita de antes', async () => {
    const src = (await load()).readFileSync(SCREEN, 'utf8');
    expect(src).not.toMatch(/@expo\/vector-icons/);
    expect(src).not.toMatch(/\bColors\b/);
    expect(src).not.toMatch(/fontWeight/);
    expect(src).not.toMatch(/@react-navigation\//);
  });
});

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
import { guideEs } from '@/i18n/guideEs';

// Igual que src/i18n/index.ts: es.ts gana a los de antes; guideEs (vistas previas y «Cómo lo calculamos») va después
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
  ...guideEs,
};

// TypeScript 6 deja types = [] (sin tipos de Node): se carga fs así, como en historialEs.test.ts
type Fs = { readFileSync: (p: string, enc: 'utf8') => string };
// Ajustes y lo que se abre desde ahí, pasados al lenguaje fino el 2026-11-17
const FILES = [
  'src/screens/SettingsScreen.tsx',
  'src/components/PreferencesBlock.tsx',
  'src/components/metas/WeekStartSetting.tsx',
  'src/components/AppLockSetting.tsx',
  'src/components/LanguagePicker.tsx',
  'src/screens/AppSectionsScreen.tsx',
  'src/components/SectionToggles.tsx',
  'src/screens/FeatureGuideScreen.tsx',
  'src/components/FeaturePreview.tsx',
  'src/screens/NotificationsScreen.tsx',
  'src/components/DeliveryHelp.tsx',
  'src/screens/YourNameScreen.tsx',
  'src/screens/SecurityScreen.tsx',
];

const Q = `'((?:\\\\'|[^'])*)'`; // un texto entre comillas simples
const DQ = `"((?:\\\\"|[^"])*)"`; // o entre comillas dobles (los que llevan un apóstrofo)

// Textos que se pasan por t() al pintarse desde las listas: title, why, label, description y body
const LIST = new RegExp(`\\b(?:title|why|label|description|body|sub): (?:${Q}|${DQ})`, 'g');

describe('Ajustes en español', () => {
  it('cada t(«…») de Ajustes y sus pantallas tiene su traducción', async () => {
    const fs = (await import('node:fs' as string)) as Fs;
    const found = new Set<string>();
    for (const f of FILES) {
      const src = fs.readFileSync(f, 'utf8');
      // t('…'), con comillas simples o dobles
      for (const m of src.matchAll(new RegExp(`\\bt\\(\\s*${Q}`, 'g'))) found.add(m[1].replace(/\\'/g, "'"));
      for (const m of src.matchAll(new RegExp(`\\bt\\(\\s*${DQ}`, 'g'))) found.add(m[1].replace(/\\"/g, '"'));
      // Los dos textos de «t(cond ? '…' : '…'»
      for (const m of src.matchAll(new RegExp(`\\bt\\(\\s*[\\w.!?=\\s'"]+\\?\\s*${Q}\\s*:\\s*${Q}`, 'g'))) {
        found.add(m[1]);
        found.add(m[2]);
      }
    }
    expect(found.size).toBeGreaterThan(80);
    expect([...found].filter((x) => !(x in ES))).toEqual([]);
  });

  it('los textos de las listas (permisos, avisos, ajustes del móvil) también', async () => {
    const fs = (await import('node:fs' as string)) as Fs;
    const files = ['src/screens/SettingsScreen.tsx', 'src/screens/NotificationsScreen.tsx', 'src/components/DeliveryHelp.tsx', 'src/components/AppLockSetting.tsx'];
    const missing: string[] = [];
    for (const f of files) {
      for (const m of fs.readFileSync(f, 'utf8').matchAll(LIST)) {
        const k = m[1] !== undefined ? m[1].replace(/\\'/g, "'") : m[2].replace(/\\"/g, '"');
        if (!(k in ES)) missing.push(`${f}: ${k}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it('los textos de las tablas que se traducen al pintarse (bloqueo, grupos de avisos, tamaños, silencios)', async () => {
    const fs = (await import('node:fs' as string)) as Fs;
    // Los valores entre comillas de un `const NOMBRE … = { … };` (o `[ … ];`) del archivo
    const values = (f: string, name: string) => {
      const src = fs.readFileSync(f, 'utf8');
      const start = src.indexOf(`const ${name}`);
      expect(start, `${f}: ${name}`).toBeGreaterThan(-1);
      const end = src.indexOf(';', src.indexOf('=', start));
      const body = src.slice(start, end);
      return [...body.matchAll(new RegExp(`:\\s*(?:${Q}|${DQ})`, 'g'))].map((m) => (m[1] !== undefined ? m[1].replace(/\\'/g, "'") : m[2]));
    };
    const texts = [
      ...values('src/components/AppLockSetting.tsx', 'TITLE'),
      ...values('src/components/AppLockSetting.tsx', 'AFTER_LABEL'),
      ...values('src/screens/NotificationsScreen.tsx', 'CATEGORY_LABEL'),
      ...values('src/components/DeliveryHelp.tsx', 'MANUAL_TITLE'),
      ...values('src/theme/textSize.ts', 'TEXT_SIZES').filter((x) => !/^(small|default|large|xlarge)$/.test(x)),
      ...values('src/logic/nudges/types.ts', 'MUTE_OPTIONS').filter((x) => !/^(7d|1m|3m|forever)$/.test(x)),
    ];
    expect(texts.length).toBeGreaterThan(20);
    expect(texts.filter((x) => !(x in ES))).toEqual([]);
  });
});

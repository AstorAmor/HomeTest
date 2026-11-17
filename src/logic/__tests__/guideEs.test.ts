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
import { evidenceTopic } from '@/data/evidence';
import { READINESS_BANDS, READINESS_WEIGHTS } from '@/wearables/seriesLogic';

// En el mismo orden que src/i18n/index.ts (lo de después gana)
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
};

// TypeScript 6 deja types = [] (sin tipos de Node): se carga fs así, como en historialEs.test.ts
type Fs = { readFileSync: (p: string, enc: 'utf8') => string };
const FILES = ['src/components/FeaturePreview.tsx', 'src/screens/FeatureGuideScreen.tsx', 'src/screens/EvidenceScreen.tsx'];
const read = async () => {
  const fs = (await import('node:fs' as string)) as Fs;
  return FILES.map((f) => fs.readFileSync(f, 'utf8'));
};

// «Cómo funciona cada parte» (vistas previas) y «Cómo lo calculamos», en el lenguaje fino (2026-11-17)
describe('Cómo funciona cada parte y Cómo lo calculamos', () => {
  it('cada t(«…») y tr(«…») de las pantallas tiene su traducción', async () => {
    const found = new Set<string>();
    for (const src of await read()) {
      for (const m of src.matchAll(/\btr?\(\s*'((?:\\'|[^'])*)'/g)) found.add(m[1].replace(/\\'/g, "'"));
      for (const m of src.matchAll(/\btr?\(\s*"((?:\\"|[^"])*)"/g)) found.add(m[1]);
    }
    expect(found.size).toBeGreaterThan(30);
    expect([...found].filter((x) => !(x in ES))).toEqual([]);
  });

  it('los textos de ejemplo que se traducen al pintarse (áreas, caras, fases, insignias, pesos y tramos)', async () => {
    const [preview, , evidence] = await read();
    const texts = [
      ...[...preview.matchAll(/names: '([^']*)'/g)].map((m) => m[1]),
      ...[...preview.matchAll(/sampleBadge\('[^']+', '([^']*)'/g)].map((m) => m[1]),
      ...['Happy', 'Calm', 'Neutral', 'Period', 'Follicular', 'Ovulation', 'Luteal'],
      ...[...evidence.matchAll(/\['(?:sleep|hrv|restingHr)', '([^']+)'\]/g)].map((m) => m[1]),
      ...[...evidence.matchAll(/`, '([^']+)'\]/g)].map((m) => m[1]),
    ];
    expect(texts.length).toBeGreaterThan(14);
    expect(texts.filter((x) => !(x in ES))).toEqual([]);
  });

  it('el estado de hoy: cada texto en español, sin signos de exclamación', () => {
    const r = evidenceTopic('readiness')!;
    const texts = [r.title, r.summary, ...r.body, ...(r.blocks ?? []).flatMap((b) => [b.label, b.text ?? ''].filter(Boolean)), ...r.sources.map((s) => s.label)];
    expect(texts.filter((x) => !(x in ES) && !/\(.*et al\./.test(x))).toEqual([]);
    expect(texts.map((x) => ES[x] ?? '').filter((x) => x.includes('!'))).toEqual([]);
    // Qué entra, cómo pesa y qué no es
    expect(r.blocks?.map((b) => b.label)).toEqual(expect.arrayContaining(['What goes in', 'Weighting', 'What it is not']));
  });

  it('los pesos y los tramos que se explican son los de la fórmula', () => {
    const total = Object.values(READINESS_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(1, 6);
    expect(READINESS_BANDS.ready).toBeGreaterThan(READINESS_BANDS.steady);
    const blocks = evidenceTopic('readiness')!.blocks ?? [];
    expect(blocks.some((b) => b.figure === 'readinessWeights')).toBe(true);
    expect(blocks.some((b) => b.figure === 'readinessBands')).toBe(true);
  });

  it('las vistas previas no vuelven al estilo de antes (gotas, formas de Bristol rellenas, la tira del ciclo, emoji)', async () => {
    const [preview] = await read();
    for (const old of ['UrineDrop', 'BristolShape', 'CycleStrip', 'GaugeBar', 'ProgressRing', "How's your energy level?"]) expect(preview).not.toContain(old);
    expect(preview).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u);
  });

  it('las traducciones de guideEs no llevan exclamaciones', () => {
    expect(Object.values(guideEs).filter((v) => /[!¡]/.test(v))).toEqual([]);
  });
});

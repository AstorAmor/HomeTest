import { describe, expect, it } from 'vitest';
import { es } from '@/i18n/es';
import { metasEs } from '@/i18n/metasEs';
import { workoutsEs } from '@/i18n/workoutsEs';
import { dietEs } from '@/i18n/dietEs';
import { historialEs } from '@/i18n/historialEs';
import { rootsEs } from '@/i18n/rootsEs';
import { storeEs } from '@/i18n/storeEs';
import { CATALOG, CATEGORY_INTRO, CATEGORY_LABEL, PLANS } from '@/data/testCatalog';
import { TEST_GUIDE } from '@/data/testGuide';
import { CATEGORY_INTRO_ES, CATEGORY_LABEL_ES, TEST_COPY_ES } from '@/i18n/testCatalogEs';
import { TEST_GUIDE_ES } from '@/i18n/testGuideEs';
import { FINDER_STEPS, PANEL_TEXT } from '@/logic/testFinder';
import { PANEL_BOTH, PANEL_FIRST_YEAR, PANEL_PREMIUM, PANEL_PREMIUM_MALE, PANEL_YEARLY, panelCounts, subscriptionPanelMarkers } from '@/data/subscriptionPanel';
import { getAllCanonicalBiomarkers } from '@/knowledge/canonicalBiomarkers';

// La tienda con el catálogo real de paneles (2026-11-08): src/data/testCatalog.ts y sus textos.
// rootsEs: lo nuevo de «Conoce tus raíces» (KnowYourRootsScreen, que también se revisa aquí), desde el 2026-11-17
// storeEs: la tienda, el buscador y la suscripción en el lenguaje fino (2026-11-17); como en index.ts, va después de es.ts
const ES: Record<string, string> = { ...workoutsEs, ...dietEs, ...metasEs, ...historialEs, ...rootsEs, ...es, ...storeEs };
const ALL = [...PLANS, ...CATALOG];

// Todo lo que la persona puede leer de cada producto, en inglés y en español
const texts = () =>
  ALL.flatMap((p) => {
    const c = TEST_COPY_ES[p.id];
    const g = [TEST_GUIDE[p.id], TEST_GUIDE_ES[p.id]];
    return [p.name, p.description, p.notes ?? '', p.sample, p.delivery, ...p.includes, c.name, c.description, c.notes ?? '', c.delivery ?? '', ...c.includes, ...g.flatMap((x) => [x.useful, x.repeat])];
  }).concat(Object.values(CATEGORY_INTRO), Object.values(CATEGORY_INTRO_ES));

describe('Catálogo de paneles en la tienda', () => {
  it('cada producto tiene sus textos en español y su guía, con las mismas líneas en «Qué incluye»', () => {
    for (const p of ALL) {
      expect(TEST_COPY_ES[p.id], p.id).toBeDefined();
      expect(TEST_GUIDE[p.id], p.id).toBeDefined();
      expect(TEST_GUIDE_ES[p.id], p.id).toBeDefined();
      expect(TEST_COPY_ES[p.id].includes.length, p.id).toBe(p.includes.length);
      expect(!!TEST_COPY_ES[p.id].notes, p.id).toBe(!!p.notes);
    }
    for (const c of Object.keys(CATEGORY_LABEL)) expect(CATEGORY_LABEL_ES[c], c).toBeDefined();
    for (const c of Object.keys(CATEGORY_INTRO)) expect(CATEGORY_INTRO_ES[c], c).toBeDefined();
    expect(new Set(ALL.map((p) => p.id)).size).toBe(ALL.length);
  });

  it('nada enseña precio todavía: ni las pruebas sueltas ni las suscripciones (fundador, 2026-11-09)', () => {
    expect(ALL.filter((p) => p.price != null).map((p) => p.id)).toEqual([]);
    expect(texts().filter((x) => /€|\beuros?\b|al día|a day/i.test(x))).toEqual([]);
  });

  it('ni costes internos ni nombres de laboratorios o competidores en lo que se enseña', () => {
    const banned = /\bcoste|\bcost\b|\bPVP\b|margen|margin|tarifa B3|Eurofins|Vivolabs|Synlab|Ailin|Lucis|Function Health/i;
    expect(texts().filter((x) => banned.test(x))).toEqual([]);
  });

  it('tono neutro: sin diagnósticos, sin función de un órgano, sin dosis ni avisos alarmistas', () => {
    const banned =
      /funci[oó]n (renal|hepática|hep[aá]tica)|kidney function|liver function|\btienes (una? )?(enfermedad|diabetes|anemia|hipotiroidismo)|\byou have (a )?(disease|diabetes|anaemia)|\bdosis\b|\bdoses?\b|⚠|¡atención|\burgente/i;
    expect(texts().filter((x) => banned.test(x))).toEqual([]);
  });

  it('el cuestionario y las pantallas de la tienda tienen todos sus textos en español', async () => {
    const fs = (await import('node:fs' as string)) as { readFileSync: (p: string, enc: 'utf8') => string };
    const keys = new Set<string>();
    for (const f of ['src/screens/StoreScreen.tsx', 'src/components/TestCard.tsx', 'src/screens/TestFinderScreen.tsx', 'src/screens/CheckoutScreen.tsx', 'src/screens/PanelMarkersScreen.tsx', 'src/screens/KnowYourRootsScreen.tsx']) {
      const src = fs.readFileSync(f, 'utf8');
      for (const m of src.matchAll(/\btr?\(\s*'((?:\\'|[^'\n])*)'/g)) keys.add(m[1].replace(/\\'/g, "'"));
      for (const m of src.matchAll(/\btr?\(\s*"((?:\\"|[^"\n])*)"/g)) keys.add(m[1]);
      for (const m of src.matchAll(/\? t\('((?:\\'|[^'\n])*)'\)/g)) keys.add(m[1].replace(/\\'/g, "'"));
      for (const m of src.matchAll(/: t\('((?:\\'|[^'\n])*)'\)/g)) keys.add(m[1].replace(/\\'/g, "'"));
    }
    for (const s of FINDER_STEPS) {
      keys.add(s.title);
      keys.add(s.subtitle);
      for (const o of s.options) {
        if (!o.es) keys.add(o.label); // las de género llevan su propio texto
        if (o.why) keys.add(o.why);
      }
    }
    for (const p of PANEL_TEXT) keys.add(p);
    // Fragmentos de ternarios en una línea que no son claves
    const real = [...keys].filter((k) => !k.includes("') : "));
    expect(real.filter((k) => !(k in ES))).toEqual([]);
  });

  it('la composición del análisis anual y del seguimiento existe en la base de marcadores', () => {
    const ids = new Set(getAllCanonicalBiomarkers().map((b) => b.canonical_id));
    expect([...PANEL_BOTH, ...PANEL_YEARLY, ...PANEL_FIRST_YEAR, ...PANEL_PREMIUM, ...PANEL_PREMIUM_MALE].filter((id) => !ids.has(id))).toEqual([]);
    // El seguimiento fijo lleva ApoB, fosfatasa alcalina y testosterona; la TSH, la vitamina D y la insulina, solo el anual
    expect(PANEL_BOTH).toEqual(expect.arrayContaining(['APOB', 'ALP', 'TESTOSTERONE_TOTAL', 'HS_CRP', 'HBA1C']));
    expect(PANEL_YEARLY).toEqual(expect.arrayContaining(['TSH', 'VITAMIN_D', 'INSULIN', 'MAGNESIUM']));
    expect(PANEL_FIRST_YEAR).toEqual(['LIPOPROTEIN_A']);
  });

  it('el anual de Premium es el Baseline más 11 pruebas por persona, y la albúmina en orina solo va en Premium', () => {
    const markers = subscriptionPanelMarkers();
    const when = (id: string) => markers.find((m) => m.id === id)?.when;
    expect(when('URINE_PH')).toBe('both');
    expect(when('URINE_MICROALBUMIN')).toBe('premium');
    expect(when('T4_FREE')).toBe('premium');
    expect(when('PROGESTERONE')).toBe('premium');
    expect(markers.find((m) => m.id === 'PROGESTERONE')?.only).toBe('female');
    expect(markers.find((m) => m.id === 'PSA_TOTAL')?.only).toBe('male');
    // Ningún marcador del Baseline sale como solo de Premium
    expect(markers.filter((m) => m.when === 'premium' && [...PANEL_BOTH, ...PANEL_YEARLY].includes(m.id))).toEqual([]);
    // Una mujer suma 11 (con la progesterona) y un hombre 11 (con el PSA): 31 → 42 pruebas
    const premiumOnly = markers.filter((m) => m.when === 'premium');
    expect(premiumOnly.filter((m) => m.only !== 'male')).toHaveLength(11);
    expect(premiumOnly.filter((m) => m.only !== 'female')).toHaveLength(11);
    const c = panelCounts(markers);
    expect(c.premium - c.basic).toBe(11);
    expect(c.followUp).toBeLessThan(c.basic);
  });

  it('las pruebas genéticas no se piden desde la tienda y dicen que hace falta asesoramiento genético (RD 942/2025)', () => {
    const genetic = CATALOG.filter((p) => p.category === 'genetic');
    expect(genetic.map((p) => p.id)).toEqual(['gen_carrier', 'gen_coeliac', 'gen_intolerance', 'gen_hfe', 'gen_thrombophilia', 'gen_apoe']);
    for (const p of genetic) {
      expect(p.orderable, p.id).toBe(false);
      expect(p.counselling, p.id).toBe(true);
      expect(p.price, p.id).toBeUndefined();
      expect(p.includes[0], p.id).toMatch(/genetic counselling/i);
      expect(TEST_COPY_ES[p.id].includes[0], p.id).toMatch(/asesoramiento genético/);
    }
    // Solo las genéticas llevan el aviso; MTHFR no se ofrece (poca utilidad clínica por sí sola)
    expect(CATALOG.filter((p) => p.counselling && p.category !== 'genetic')).toEqual([]);
    expect(texts().filter((x) => /MTHFR/.test(x) && !/(not included|No incluye)/.test(x))).toEqual([]);
    expect(CATEGORY_INTRO_ES.genetic).toMatch(/asesoramiento genético/);
  });

  it('la ficha de Premium habla del análisis Kuova Premium y no del Baseline', () => {
    const premium = PLANS.find((p) => p.id === 'premium')!;
    expect(premium.includes[0]).toMatch(/Kuova Premium analysis/);
    expect(TEST_COPY_ES.premium.includes[0]).toMatch(/^Análisis anual Kuova Premium/);
    expect([...premium.includes, ...TEST_COPY_ES.premium.includes].some((l) => /Baseline/.test(l))).toBe(false);
  });
});

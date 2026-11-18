import { describe, expect, it } from 'vitest';
import { es } from '@/i18n/es';
import { symptomsEs } from '@/i18n/symptomsEs';
import { authEs } from '@/i18n/authEs';
import { workoutsEs } from '@/i18n/workoutsEs';
import { dietEs } from '@/i18n/dietEs';
import { metasEs } from '@/i18n/metasEs';
import { historialEs } from '@/i18n/historialEs';
import { bodyEs } from '@/i18n/bodyEs';
import { gutEs } from '@/i18n/gutEs';
import { careEs } from '@/i18n/careEs';
import { AREAS, INTENSITIES, OTHER_SYMPTOM, PATTERN_TEXT, PHASE_PHRASE, PROBLEM_TEXT, SAMPLE_NOTE, SYMPTOMS, SYMPTOM_GROUPS, WEEK_TEXT } from '@/logic/symptoms';

// Igual que src/i18n/index.ts: es.ts gana a los demás
const ES: Record<string, string> = { ...authEs, ...workoutsEs, ...dietEs, ...metasEs, ...historialEs, ...bodyEs, ...gutEs, ...careEs, ...symptomsEs, ...es };

// TypeScript 6 deja types = [] (sin tipos de Node): se carga fs así, como en bodyEs.test.ts
type Fs = { readFileSync: (p: string, enc: 'utf8') => string };
const FILES = ['src/screens/LogSymptomScreen.tsx', 'src/screens/SymptomsScreen.tsx'];

// Lo que las pantallas pasan por t() sin escribirlo allí: el catálogo y las frases de las reglas
const FROM_LOGIC = [
  ...SYMPTOM_GROUPS.map((g) => g.label),
  ...SYMPTOMS.map((s) => s.label),
  OTHER_SYMPTOM.label,
  ...Object.values(AREAS),
  ...INTENSITIES.flatMap((i) => [i.label, i.phrase]),
  ...Object.values(PROBLEM_TEXT),
  ...Object.values(PATTERN_TEXT),
  ...Object.values(PHASE_PHRASE),
  ...Object.values(WEEK_TEXT),
  SAMPLE_NOTE,
  // La opción del botón K (src/components/BottomTabBar.tsx)
  'Symptom',
];

const vars = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

// El registro de síntomas, «Tus síntomas» y la opción «Síntoma» del botón K (2026-11-17), que van en symptomsEs.ts
describe('Síntomas en español', () => {
  it('cada t(«…») de las pantallas de síntomas, y cada texto del catálogo y de las reglas, tiene su traducción', async () => {
    const fs = (await import('node:fs' as string)) as Fs;
    const found = new Set<string>(FROM_LOGIC);
    let inScreens = 0;
    for (const f of FILES) {
      const src = fs.readFileSync(f, 'utf8');
      // t('…'), los dos textos de «cond ? t('…') : t('…')» y los dos de tn(n, '…', '…')
      for (const m of src.matchAll(/\bt\(\s*'((?:\\'|[^'])*)'/g)) {
        found.add(m[1].replace(/\\'/g, "'"));
        inScreens += 1;
      }
      for (const m of src.matchAll(/\btn\([^,]+,\s*'((?:\\'|[^'])*)'\s*,\s*'((?:\\'|[^'])*)'/g)) {
        found.add(m[1]);
        found.add(m[2]);
      }
    }
    expect(inScreens).toBeGreaterThan(40);
    expect([...found].filter((x) => !(x in ES))).toEqual([]);
    // Y todo lo de symptomsEs.ts se usa
    expect(Object.keys(symptomsEs).filter((k) => !found.has(k))).toEqual([]);
  });

  it('la opción «Síntoma» es la primera del botón K y abre el registro', async () => {
    const fs = (await import('node:fs' as string)) as Fs;
    const src = fs.readFileSync('src/components/BottomTabBar.tsx', 'utf8');
    const items = [...src.slice(src.indexOf('const LOG_ITEMS')).matchAll(/\{ label: '([^']+)', to: '([^']+)', icon: '([^']+)' \}/g)].map((m) => [m[1], m[2], m[3]]);
    expect(items[0]).toEqual(['Symptom', '/log-symptom', 'symptom']);
    // Las demás opciones siguen ahí, y todas con su traducción
    expect(items.length).toBeGreaterThanOrEqual(13);
    expect(items.map(([label]) => label).filter((x) => !(x in ES))).toEqual([]);
    // Cada una con su dibujo a línea, sin repetir; «Entrenamiento», con las pesas compartidas (fine/DumbbellIcon)
    expect(new Set(items.map(([, , icon]) => icon)).size).toBe(items.length);
    expect(items.find(([label]) => label === 'Workout')?.[2]).toBe('weights');
    const paths = src.slice(src.indexOf('const LOG_PATHS'), src.indexOf('type LogIcon'));
    for (const [, , icon] of items) if (icon !== 'weights') expect(paths, icon).toMatch(new RegExp(`\\b${icon}:\\s+'M`));
    expect(src).toContain("icon === 'weights' ? <DumbbellIcon");
  });

  it('ninguna clave choca con es.ts (es.ts ganaría y saldría otro texto)', () => {
    const clash = Object.keys(symptomsEs).filter((k) => k in es && es[k] !== symptomsEs[k]);
    expect(clash).toEqual([]);
  });

  it('cada traducción lleva las mismas {variables} que su texto', () => {
    const wrong = Object.entries(symptomsEs).filter(([k, v]) => vars(k).join() !== vars(v).join());
    expect(wrong).toEqual([]);
  });

  it('los avisos, tal cual: no es un diagnóstico, la línea del 112 y lo de pago', () => {
    expect(ES['This is not a diagnosis. It is your own record of how you feel: it helps you see patterns and tell your doctor.']).toBe(
      'Esto no es un diagnóstico. Es tu propio registro de cómo te sientes: te sirve para ver patrones y para contárselo a tu médico.',
    );
    expect(ES['If it is intense, does not ease or worries you, call 112.']).toBe('Si es intenso, no cede o te preocupa, llama al 112.');
    expect(ES['Insights about your week']).toBe('Insights sobre tu semana');
    expect(ES['With Kuova Premium: your week explained from everything you log.']).toContain('Kuova Premium');
  });

  it('sin tono de diagnóstico ni de alarma: cuentas de lo apuntado, nunca la causa', () => {
    const texts = Object.values(symptomsEs).join(' ').toLowerCase();
    for (const word of ['se debe', 'debido', 'provoca', 'causa', 'culpa', 'riesgo', 'peligro', 'grave', 'urgente', 'urgencias', 'emergencia', 'alarma', 'enfermedad', 'padeces', 'sufres', 'tienes que'])
      expect(texts, word).not.toMatch(new RegExp(`\\b${word}\\b`));
    // «Diagnóstico» y «causas» solo salen para decir que esto no lo es
    for (const v of Object.values(symptomsEs)) {
      if (/diagnóstico/i.test(v)) expect(v).toMatch(/no es un diagnóstico|ni un diagnóstico/i);
      if (/causas/i.test(v)) expect(v).toMatch(/no causas/i);
    }
    // Las observaciones son cuentas («4 de 6 días»), no explicaciones
    for (const k of [...Object.values(PATTERN_TEXT), ...Object.values(WEEK_TEXT)]) expect(ES[k], k).toMatch(/\{k\} de (tus )?\{n\} días|\{b\} de (tus )?\{m\}|\{p\} %/);
  });
});

import { describe, expect, it, vi } from 'vitest';

// Solo se prueba la lógica pura (sugerencias y huecos): fuera almacenamiento y Supabase
vi.mock('@react-native-async-storage/async-storage', () => ({ default: { getItem: vi.fn(), setItem: vi.fn() } }));
vi.mock('@/lib/supabase', () => ({ supabase: null, getCurrentUserId: () => null }));
vi.mock('../specialistPortal', () => ({ isPortalDemo: () => true }));

const { SAMPLE_TEMPLATES, cleanCustomTopic, customTopicsOf, fillTemplate, findGaps, guessTopic, suggestTemplates, toTemplateBody, topicOptions } = await import('../proTemplates');

const samples = SAMPLE_TEMPLATES.map((d, i) => ({
  ...d,
  id: `t${i}`,
  customTopic: null,
  uses: 0,
  lastUsedAt: null,
  createdAt: '2026-10-09T00:00:00Z',
  updatedAt: '2026-10-09T00:00:00Z',
}));
const top = (q: string, extra?: Parameters<typeof suggestTemplates>[3]) => suggestTemplates(q, samples, 3, extra).map((t) => t.title);

describe('suggestTemplates', () => {
  it('sugiere la de ferritina para cansancio en inglés y en español', () => {
    expect(top("I've been really tired for a month. My ferritin was 24 in March.")[0]).toBe('Low ferritin and tiredness');
    expect(top('Estoy muy cansada y tengo el hierro bajo')[0]).toBe('Low ferritin and tiredness');
  });

  it('sugiere la del ciclo para preguntas de la regla', () => {
    expect(top('Since I started training my period comes every 38–40 days. Is that normal?')).toContain('Irregular cycle');
    expect(top('La regla me viene cada 40 días, ¿es normal?')[0]).toBe('Irregular cycle');
  });

  it('colesterol, tiroides y glucosa', () => {
    expect(top('Could you look at my LDL and triglycerides?')[0]).toBe('LDL cholesterol a bit high');
    expect(top('My TSH came back at 5.1, should I worry?')[0]).toBe('TSH slightly high (thyroid)');
    expect(top('Mi HbA1c es 5,9 %, ¿tengo prediabetes?')[0]).toBe('HbA1c in the prediabetes range');
  });

  it('las siglas cortas solo cuentan como palabra entera ("lh" no está en "health")', () => {
    expect(guessTopic('I want to improve my health')).toBe('other');
    expect(guessTopic('My LH and FSH are high')).toBe('hormones');
  });

  it('no sugiere nada si la pregunta no tiene que ver', () => {
    expect(top('What time is my appointment tomorrow?')).toEqual([]);
  });
});

describe('temas propios', () => {
  it('se listan sin repetir mayúsculas y por orden alfabético', () => {
    expect(customTopicsOf([{ customTopic: 'Embarazo' }, { customTopic: 'embarazo ' }, { customTopic: null }, { customTopic: 'Deporte' }])).toEqual([
      'Deporte',
      'Embarazo',
    ]);
  });

  it('un nombre nuevo se limpia y, si ya existe con otra forma, se reutiliza esa', () => {
    expect(cleanCustomTopic('  corazón   y  ejercicio ')).toBe('corazón y ejercicio');
    expect(cleanCustomTopic('EMBARAZO', ['Embarazo'])).toBe('Embarazo');
    expect(cleanCustomTopic('   ')).toBeNull();
  });

  it('el nombre del tema propio sugiere la plantilla', () => {
    const tpl = { ...samples[0], id: 'x', title: 'Planning a pregnancy', topic: 'other' as const, keywords: [], customTopic: 'Embarazo' };
    expect(suggestTemplates('Estoy buscando embarazo, ¿qué análisis me hago?', [tpl]).map((t) => t.id)).toEqual(['x']);
  });
});

describe('lista de temas del médico', () => {
  it('quita los de ejemplo borrados y añade los suyos (creados o usados en plantillas), sin "Otro"', () => {
    const keys = topicOptions({ hidden: ['cycle', 'glucose'], custom: ['Embarazo'] }, [{ customTopic: 'deporte' }, { customTopic: 'embarazo' }]).map((o) => o.key);
    expect(keys).toEqual(['blood_test', 'hormones', 'energy', 'cholesterol', 'c:deporte', 'c:embarazo']);
  });
});

describe('huecos', () => {
  it('rellena [name] y [doctor] y deja el resto para el médico', () => {
    const out = fillTemplate('Hi [name], your value is [value].\n[doctor]', { patientName: 'Laura Martín', doctorName: 'Dra. Marta Echeverría' });
    expect(out).toBe('Hi Laura, your value is [value].\nDra. Marta Echeverría');
    expect(findGaps(out)).toEqual(['[value]']);
  });

  it('guardar una respuesta como plantilla devuelve el nombre a [name], también con tildes', () => {
    expect(toTemplateBody('Hola Inés, Inés no es Inésa. Dra. P', 'Inés Ruiz', 'Dra. P')).toBe('Hola [name], [name] no es Inésa. [doctor]');
  });
});

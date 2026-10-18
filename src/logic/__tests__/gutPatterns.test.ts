import { describe, expect, it } from 'vitest';
import { inferFoodGroups } from '@/logic/foodGroups';
import { analyseGut, binomialGreater, foodEpisodes, grade, gutEvents } from '@/logic/gutPatterns';
import type { DigestionEntry, FoodBefore, GutSafetyAnswers, UsualFoods } from '@/types/digestion';
import type { BowelEntry } from '@/types/bathroom';

const now = new Date('2026-10-18T20:00:00');
const at = (daysAgo: number, hh: number, mm = 0) => {
  const d = new Date(now);
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hh, mm, 0, 0);
  return d.toISOString();
};
let seq = 0;
const sym = (fecha: string, symptoms: DigestionEntry['symptoms'], food?: FoodBefore, wokeAtNight?: boolean): DigestionEntry => ({
  id: `s${seq++}`,
  fecha,
  createdAt: fecha,
  kind: 'symptoms',
  symptoms,
  food,
  wokeAtNight,
});
// Lo que comió antes, con los grupos deducidos del texto (como al apuntarlo)
const ate = (description: string, minutesBefore = 120, extra: Partial<FoodBefore> = {}): FoodBefore => ({
  description,
  groups: inferFoodGroups(description).map((g) => g.group),
  minutesBefore,
  ...extra,
});
const dayOk = (daysAgo: number): DigestionEntry => ({ id: `ok${seq++}`, fecha: at(daysAgo, 22), createdAt: at(daysAgo, 22), kind: 'day_ok' });
const safetyOk: GutSafetyAnswers = { answeredAt: at(2, 12), answers: {} };
const groups = (text: string) => inferFoodGroups(text).map((g) => g.group);
const days = (n: number) => Array.from({ length: n }, (_, i) => i + 1);
const ctx = (digestion: DigestionEntry[], usual: UsualFoods = {}, bowel: BowelEntry[] = [], safety: GutSafetyAnswers | null = safetyOk) => ({
  digestion,
  bowel,
  usual,
  safety,
  now,
});

describe('qué llevaba la comida (deducido del texto)', () => {
  it('platos habituales', () => {
    expect(groups('Pizza')).toEqual(['gluten', 'dairy_low_lactose']);
    expect(groups('Café con leche y tostada')).toEqual(['gluten', 'lactose', 'coffee']);
    expect(groups('Lentejas con sofrito')).toEqual(['legumes', 'onion_garlic']);
    expect(groups('Patatas bravas y una caña')).toEqual(['gluten', 'fatty', 'spicy', 'alcohol']);
    expect(groups('Yogur con miel')).toEqual(['lactose', 'fructose']);
  });
  it('"sin" quita el grupo solo en su trozo', () => {
    expect(groups('Cerveza sin alcohol')).toEqual(['gluten']);
    expect(groups('Cerveza 0,0')).toEqual(['gluten']);
    expect(groups('Pan sin gluten con queso')).toEqual(['dairy_low_lactose']);
    expect(groups('Leche sin lactosa')).toEqual(['dairy_low_lactose']);
    expect(groups('Pizza sin gluten y cerveza')).toEqual(['gluten', 'dairy_low_lactose', 'alcohol']);
  });
  it('no confunde palabras parecidas', () => {
    expect(groups('Judías verdes')).toEqual([]);
    expect(groups('Leche de avena')).toEqual([]);
    expect(groups('Ensalada después del trabajo')).toEqual([]);
    expect(groups('Panceta')).toEqual(['fatty']);
    expect(groups('')).toEqual([]);
  });
  it('dice qué palabra lo delató', () => {
    expect(inferFoodGroups('Lasaña').find((g) => g.group === 'lactose')?.because).toBe('lasana');
  });
});

describe('estadística frente a lo que sueles tomar', () => {
  it('binomial de una cola', () => {
    expect(binomialGreater(3, 3, 0.5)).toBeCloseTo(0.125, 9);
    expect(binomialGreater(0, 5, 0.3)).toBe(1);
    expect(binomialGreater(2, 4, 0.5)).toBeCloseTo(11 / 16, 9);
  });
  it('niveles de seguridad', () => {
    expect(grade(9, 10, 0.1)).toBe('clear');
    expect(grade(4, 6, 0.1)).toBe('probable');
    expect(grade(2, 4, 0.1)).toBe('hint');
    // Lo tomas en casi todas las comidas: aunque salga siempre, no puede ser "bastante claro"
    expect(grade(12, 12, 0.75)).not.toBe('clear');
    expect(grade(3, 10, 0.3)).toBeNull(); // justo lo esperable
    expect(grade(5, 5, 0)).toBeNull(); // sin frecuencia válida no se compara
  });
});

// 28 días; los pares, café con leche y tostada en el desayuno y a las 2 h hinchazón y gases
function lactoseMonth() {
  const digestion: DigestionEntry[] = [];
  for (const d of days(28)) {
    if (d % 2 === 0) digestion.push(sym(at(d, 10), { bloating: 2, gas: 2 }, ate('Café con leche y tostada')));
    digestion.push(dayOk(d));
  }
  return digestion;
}
const COFFEE_DRINKER: UsualFoods = { gluten: 'most', coffee: 'daily', lactose: 'weekly' };

describe('patrones de comida', () => {
  it('con pocas veces no saca patrones, solo el progreso', () => {
    const r = analyseGut(ctx([sym(at(1, 10), { bloating: 2 }, ate('Pizza')), dayOk(1)], { gluten: 'daily' }));
    expect(r.ready).toBe(false);
    expect(r.foodEpisodes).toBe(1);
    expect(r.patterns.filter((p) => p.kind === 'food')).toEqual([]);
  });

  it('sin lo que comiste antes, o en ayunas, no cuenta', () => {
    const digestion = [sym(at(1, 10), { bloating: 2 }), sym(at(2, 10), { bloating: 2 }, { fasted: true }), sym(at(3, 10), { bloating: 2 }, {})];
    expect(analyseGut(ctx(digestion)).foodEpisodes).toBe(0);
  });

  it('pregunta cada cuánto tomas lo que sale antes de las molestias', () => {
    const r = analyseGut(ctx(lactoseMonth(), { gluten: 'most' }));
    expect(r.missingUsual).toEqual(['lactose', 'coffee']);
    expect(r.patterns.some((p) => p.factor === 'lactose')).toBe(false); // sin frecuencia, no se compara
  });

  it('lácteos: bastante claro, con sus números, y el test de aliento de lactosa', () => {
    const r = analyseGut(ctx(lactoseMonth(), COFFEE_DRINKER));
    expect(r.ready).toBe(true);
    const lactose = r.patterns.find((p) => p.factor === 'lactose')!;
    expect(lactose.confidence).toBe('clear');
    expect(lactose.numbers).toBe('Dairy with lactose: before 14 of your 14 logs. You have it a few times a week; normal would be around 1 of 14.');
    expect(lactose.suggestion?.storeIds).toEqual(['lactose']);
    // El café y el pan van en todos esos desayunos, pero los tomas mucho más a menudo: no se enseñan
    expect(lactose.confoundedWith).toBeUndefined();
    expect(r.patterns.some((p) => p.factor === 'coffee' || p.factor === 'gluten')).toBe(false);
    expect(r.showTests).toBe(true);
  });

  it('el café no hincha: no es confusión de la hinchazón', () => {
    const r = analyseGut(ctx(lactoseMonth(), { gluten: 'most', coffee: 'daily', lactose: 'daily' }));
    expect(r.patterns.find((p) => p.factor === 'lactose')!.confoundedWith).toBeUndefined();
  });

  it('café con leche a diario y urgencia después: no se puede separar la leche del café', () => {
    const digestion = lactoseMonth();
    const bowel: BowelEntry[] = days(28)
      .filter((d) => d % 2 === 0)
      .map((d) => ({ id: `b${d}`, fecha: at(d, 12), createdAt: at(d, 12), count: 1, consistency: 6, movements: [{ at: at(d, 11), consistency: 6, urgent: true }] }));
    const r = analyseGut(ctx(digestion, { gluten: 'most', coffee: 'daily', lactose: 'daily' }, bowel));
    const lactose = r.patterns.find((p) => p.factor === 'lactose')!;
    expect(lactose.confoundedWith).toBe('coffee');
    expect(lactose.body).toMatch(/try one without the other/);
  });

  it('gluten y lactosa siempre juntos (lasaña): avisa de que no se pueden separar', () => {
    const digestion: DigestionEntry[] = [];
    for (const d of days(20)) {
      if (d % 2 === 0) digestion.push(sym(at(d, 16), { bloating: 3 }, ate('Lasaña')));
      digestion.push(dayOk(d));
    }
    const r = analyseGut(ctx(digestion, { gluten: 'weekly', lactose: 'weekly' }));
    const gluten = r.patterns.find((p) => p.factor === 'gluten')!;
    const lactose = r.patterns.find((p) => p.factor === 'lactose')!;
    expect(gluten.confoundedWith).toBe('lactose');
    expect(lactose.confoundedWith).toBe('gluten');
    expect(gluten.body).toMatch(/cannot tell yet/);
    expect(gluten.suggestion?.warning).toMatch(/Do not cut out gluten/);
  });

  it('una molestia fuera de la ventana de esa comida no se le atribuye', () => {
    // Reflujo 6 h después de comer: no encaja con esa comida
    const ep = foodEpisodes([sym(at(1, 20), { reflux: 2, bloating: 2 }, ate('Pizza', 360))], [], now)[0];
    expect(ep.outcomes).toEqual({ bloating: 2 });
  });

  it('heces sueltas después de una comida apuntada cuentan para esa comida', () => {
    const bowel: BowelEntry[] = [
      { id: 'b', fecha: at(1, 12), createdAt: at(1, 12), count: 1, consistency: 6, movements: [{ at: at(1, 12), consistency: 6, urgent: true }] },
    ];
    const ep = foodEpisodes([sym(at(1, 10), { bloating: 2 }, ate('Café con leche', 60))], bowel, now)[0];
    expect(ep.outcomes).toEqual({ bloating: 2, diarrhoea: 2 });
  });
});

describe('patrones de frecuencia', () => {
  it('hinchazón casi a diario con comidas de todo tipo: SIBO', () => {
    const lunches = ['Tortilla francesa', 'Arroz con pollo', 'Pescado con verduras', 'Lentejas', 'Pasta con tomate'];
    const digestion: DigestionEntry[] = [];
    for (const d of days(28)) {
      digestion.push(sym(at(d, 16), { bloating: 2 }, ate(lunches[d % lunches.length])));
      digestion.push(dayOk(d));
    }
    const r = analyseGut(ctx(digestion, { gluten: 'most', legumes: 'weekly', onion_garlic: 'daily' }));
    const p = r.patterns.find((x) => x.id === 'freq_bloating')!;
    expect(p.suggestion?.storeIds).toEqual(['sibo']);
    expect(r.weeksCovered).toBe(4);
    expect(p.confidence).toBe('probable');
    expect(p.body).toMatch(/3 months/);
  });

  it('reflujo frecuente: dice si llega tras cenar tarde o comer mucho', () => {
    const digestion: DigestionEntry[] = [];
    for (const d of days(28)) {
      if (d % 2 === 0) digestion.push(sym(at(d, 23, 30), { reflux: 2 }, ate('Pescado con verduras', 60, { amount: 'lot' })));
      digestion.push(dayOk(d));
    }
    const r = analyseGut(ctx(digestion));
    const freq = r.patterns.find((p) => p.id === 'freq_reflux')!;
    expect(freq.suggestion?.id).toBe('reflux_advice');
    expect(freq.body).toBe('It shows up most with meals after 10 pm, that were big.');
  });

  it('dolor que coincide con heces más sueltas: parecido a colon irritable', () => {
    const digestion: DigestionEntry[] = [];
    const bowel: BowelEntry[] = [];
    for (const d of days(28)) {
      const bad = d % 3 === 0;
      if (bad) digestion.push(sym(at(d, 17), { pain: 2 }));
      digestion.push(dayOk(d));
      bowel.push({ id: `b${d}`, fecha: at(d, 12), createdAt: at(d, 12), count: 1, consistency: bad ? 6 : 4 });
    }
    const r = analyseGut(ctx(digestion, {}, bowel));
    const p = r.patterns.find((x) => x.id === 'freq_ibs')!;
    expect(p.suggestion?.storeIds).toEqual(['coeliac', 'consult_digestive']);
    expect(p.body).toMatch(/loose side/);
  });
});

describe('alarmas y preguntas de seguridad', () => {
  it('sin preguntas de seguridad no se sugieren pruebas', () => {
    const r = analyseGut(ctx(lactoseMonth(), COFFEE_DRINKER, [], null));
    expect(r.safety).toBe('needed');
    expect(r.showTests).toBe(false);
    expect(r.patterns.some((p) => p.factor === 'lactose')).toBe(true); // el patrón se sigue viendo
  });
  it('preguntas de hace más de 3 meses: se vuelven a hacer', () => {
    const r = analyseGut(ctx([], {}, [], { answeredAt: at(120, 12), answers: {} }));
    expect(r.safety).toBe('needed');
  });
  it('cualquier "sí" es una alarma: médico antes que pruebas', () => {
    const r = analyseGut(ctx(lactoseMonth(), COFFEE_DRINKER, [], { answeredAt: at(1, 12), answers: { blood: true } }));
    expect(r.alarms.map((a) => a.id)).toEqual(['blood']);
    expect(r.showTests).toBe(false);
  });
  it('del perfil y de Conoce tus raíces, sin volver a preguntar', () => {
    const r = analyseGut({ ...ctx([]), anaemia: true, familyColorectal: true });
    expect(r.alarms.map((a) => a.id)).toEqual(['anaemia', 'family']);
  });
  it('heces rojizas sin explicar, aunque haya comido algo', () => {
    const bowel: BowelEntry[] = [{ id: 'b', fecha: at(3, 12), createdAt: at(3, 12), count: 1, color: 'red' }];
    expect(analyseGut(ctx([], {}, bowel)).alarms[0].id).toBe('stool_blood');
    bowel[0].explainedBy = 'Beetroot';
    expect(analyseGut(ctx([], {}, bowel)).alarms).toEqual([]);
  });
  it('dolor que despierta dos noches', () => {
    const digestion = [sym(at(3, 3), { pain: 2 }, undefined, true), sym(at(9, 4), { pain: 3 }, undefined, true)];
    expect(analyseGut(ctx(digestion)).alarms.map((a) => a.id)).toEqual(['night_logs']);
  });
  it('el reflujo nocturno no es alarma', () => {
    const digestion = [sym(at(3, 3), { reflux: 3 }, undefined, true), sym(at(9, 4), { reflux: 3 }, undefined, true)];
    expect(analyseGut(ctx(digestion)).alarms).toEqual([]);
  });
  it('heces sueltas más de 4 semanas', () => {
    const bowel: BowelEntry[] = Array.from({ length: 28 }, (_, d) => ({ id: `b${d}`, fecha: at(d, 12), createdAt: at(d, 12), count: 2, consistency: 6 as const }));
    expect(analyseGut(ctx([], {}, bowel)).alarms.map((a) => a.id)).toEqual(['diarrhoea_4w']);
  });
});

describe('heces con hora', () => {
  it('las deposiciones sueltas o con urgencia cuentan como molestia, con su hora', () => {
    const bowel: BowelEntry[] = [
      {
        id: 'b1',
        fecha: at(1, 12),
        createdAt: at(1, 12),
        count: 2,
        consistency: 6,
        movements: [
          { at: at(1, 11), consistency: 4, urgent: true },
          { at: at(1, 18), consistency: 7 },
        ],
      },
      { id: 'b2', fecha: at(2, 12), createdAt: at(2, 12), count: 1, consistency: 6 },
    ];
    const ev = gutEvents([], bowel);
    expect(ev.map((e) => [e.intensity, new Date(e.at).getHours()])).toEqual([
      [2, 21], // día entero sin hora: a las 21:00
      [2, 11],
      [3, 18],
    ]);
  });
});

describe('mes de ejemplo (cuentas de prueba)', () => {
  it('enseña el patrón de los lácteos con su prueba', async () => {
    const { sampleGutData } = await import('@/data/sampleDigestion');
    const r = analyseGut(sampleGutData(now));
    expect(r.ready).toBe(true);
    expect(r.alarms).toEqual([]);
    expect(r.showTests).toBe(true);
    const top = r.patterns[0];
    expect(top.factor).toBe('lactose');
    expect(top.confidence).not.toBe('hint');
    // La tostada y el café van con la leche, pero los tomas mucho más a menudo: lo explica la lactosa
    expect(r.patterns.some((p) => p.factor === 'gluten' || p.factor === 'coffee')).toBe(false);
  });
});

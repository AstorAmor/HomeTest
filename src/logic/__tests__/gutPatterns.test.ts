import { describe, expect, it } from 'vitest';
import { inferFoodGroups } from '@/logic/foodGroups';
import { analyseGut, fisherGreater, grade, GutMeal, gutEvents, matchingMeal } from '@/logic/gutPatterns';
import type { DigestionEntry, GutSafetyAnswers } from '@/types/digestion';
import type { BowelEntry } from '@/types/bathroom';

const now = new Date('2026-10-18T20:00:00');
const at = (daysAgo: number, hh: number, mm = 0) => {
  const d = new Date(now);
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hh, mm, 0, 0);
  return d.toISOString();
};
let seq = 0;
const meal = (fecha: string, description: string): GutMeal => ({ id: `m${seq++}`, fecha, description });
const sym = (fecha: string, symptoms: DigestionEntry['symptoms'], wokeAtNight?: boolean): DigestionEntry => ({
  id: `s${seq++}`,
  fecha,
  createdAt: fecha,
  kind: 'symptoms',
  symptoms,
  wokeAtNight,
});
const dayOk = (daysAgo: number): DigestionEntry => ({ id: `ok${seq++}`, fecha: at(daysAgo, 22), createdAt: at(daysAgo, 22), kind: 'day_ok' });
const safetyOk: GutSafetyAnswers = { answeredAt: at(2, 12), answers: {} };
const groups = (text: string) => inferFoodGroups(text).map((g) => g.group);
const days = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

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

describe('estadística', () => {
  it('Fisher de una cola', () => {
    expect(fisherGreater(7, 1, 1, 7)).toBeCloseTo(65 / 12870, 5);
    expect(fisherGreater(0, 5, 5, 0)).toBeCloseTo(1, 9);
  });
  it('niveles de seguridad', () => {
    expect(grade(9, 10, 1, 12)).toBe('clear');
    expect(grade(5, 6, 1, 8)).toBe('probable');
    expect(grade(4, 6, 1, 8)).toBe('hint'); // p ≈ 0,06
    expect(grade(3, 3, 1, 6)).toBe('hint'); // muy claro pero con solo 3 comidas
    expect(grade(2, 10, 2, 10)).toBeNull();
    expect(grade(3, 4, 0, 2)).not.toBe('clear'); // pocas comidas sin el factor
  });
});

// 28 días con desayuno, comida y cena; los días pares el desayuno lleva leche y a las 2 h hay
// hinchazón. El resto de días, "Hoy, bien".
function lactoseMonth() {
  const meals: GutMeal[] = [];
  const digestion: DigestionEntry[] = [];
  for (const d of days(28)) {
    const dairy = d % 2 === 0;
    meals.push(meal(at(d, 8), dairy ? 'Café con leche' : 'Café solo'));
    meals.push(meal(at(d, 14), 'Arroz con pollo'));
    meals.push(meal(at(d, 21), 'Ensalada'));
    if (dairy) digestion.push(sym(at(d, 10), { bloating: 2, gas: 2 }));
    digestion.push(dayOk(d));
  }
  return { meals, digestion };
}

describe('patrones de comida', () => {
  it('con pocas comidas no saca patrones, solo el progreso', () => {
    const meals = [meal(at(1, 8), 'Café con leche'), meal(at(1, 14), 'Pizza')];
    const r = analyseGut({ meals, digestion: [dayOk(1)], bowel: [], safety: safetyOk, now });
    expect(r.ready).toBe(false);
    expect(r.observedMeals).toBe(2);
    expect(r.patterns.filter((p) => p.kind === 'food')).toEqual([]);
  });

  it('las comidas de días sin nada en Digestión no cuentan', () => {
    const { meals } = lactoseMonth();
    const r = analyseGut({ meals, digestion: [], bowel: [], safety: safetyOk, now });
    expect(r.observedMeals).toBe(0);
  });

  it('lácteos: bastante claro, con sus números, y el test de aliento de lactosa', () => {
    const { meals, digestion } = lactoseMonth();
    const r = analyseGut({ meals, digestion, bowel: [], safety: safetyOk, now });
    expect(r.ready).toBe(true);
    const lactose = r.patterns.find((p) => p.factor === 'lactose')!;
    expect(lactose.confidence).toBe('clear');
    expect(lactose.numbers).toBe('Symptoms after 14 of 14 meals with dairy, against 0 of 70 of the rest.');
    expect(lactose.suggestion?.storeIds).toEqual(['lactose']);
    // El café va en todos esos desayunos, pero el café solo sienta bien: no se confunde
    expect(lactose.confoundedWith).toBeUndefined();
    // El FODMAP conjunto no se repite si la lactosa ya lo explica
    expect(r.patterns.some((p) => p.factor === 'fodmap')).toBe(false);
    expect(r.showTests).toBe(true);
  });

  it('gluten y lactosa siempre juntos (lasaña): avisa de que no se pueden separar', () => {
    const meals: GutMeal[] = [];
    const digestion: DigestionEntry[] = [];
    for (const d of days(20)) {
      const lasagna = d % 2 === 0;
      meals.push(meal(at(d, 8), 'Tortilla francesa'));
      meals.push(meal(at(d, 14), lasagna ? 'Lasaña' : 'Arroz con pollo'));
      if (lasagna) digestion.push(sym(at(d, 16), { bloating: 3 }));
      digestion.push(dayOk(d));
    }
    const r = analyseGut({ meals, digestion, bowel: [], safety: safetyOk, now });
    const gluten = r.patterns.find((p) => p.factor === 'gluten')!;
    const lactose = r.patterns.find((p) => p.factor === 'lactose')!;
    expect(gluten.confoundedWith).toBe('lactose');
    expect(lactose.confoundedWith).toBe('gluten');
    expect(gluten.body).toMatch(/cannot tell yet/);
    expect(gluten.suggestion?.warning).toMatch(/Do not cut out gluten/);
  });

  it('reflujo cuando cenas tarde', () => {
    const meals: GutMeal[] = [];
    const digestion: DigestionEntry[] = [];
    for (const d of days(28)) {
      const late = d % 2 === 0;
      meals.push(meal(at(d, 14), 'Arroz con pollo'));
      meals.push(meal(at(d, late ? 22 : 20, 30), 'Pescado con verduras'));
      if (late) digestion.push(sym(at(d, 23, 30), { reflux: 2 }));
      digestion.push(dayOk(d));
    }
    const r = analyseGut({ meals, digestion, bowel: [], safety: safetyOk, now });
    expect(r.patterns.find((p) => p.factor === 'late_meal')?.confidence).toBe('clear');
    const freq = r.patterns.find((p) => p.id === 'freq_reflux')!;
    expect(freq.suggestion?.id).toBe('reflux_advice');
    expect(freq.body).toMatch(/after 10 pm/);
  });
});

describe('patrones de frecuencia', () => {
  it('hinchazón con casi cualquier comida y sin alimento que lo explique: SIBO', () => {
    const meals: GutMeal[] = [];
    const digestion: DigestionEntry[] = [];
    for (const d of days(28)) {
      meals.push(meal(at(d, 8), 'Tortilla francesa'));
      meals.push(meal(at(d, 14), 'Arroz con pollo'));
      meals.push(meal(at(d, 21), 'Pescado con verduras'));
      digestion.push(sym(at(d, 16), { bloating: 2 }));
      digestion.push(dayOk(d));
    }
    const r = analyseGut({ meals, digestion, bowel: [], safety: safetyOk, now });
    const p = r.patterns.find((x) => x.id === 'freq_bloating')!;
    expect(p.suggestion?.storeIds).toEqual(['sibo']);
    expect(r.weeksCovered).toBe(4);
    expect(p.confidence).toBe('probable');
    expect(p.body).toMatch(/3 months/);
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
    const r = analyseGut({ meals: [], digestion, bowel, safety: safetyOk, now });
    const p = r.patterns.find((x) => x.id === 'freq_ibs')!;
    expect(p.suggestion?.storeIds).toEqual(['coeliac', 'consult_digestive']);
    expect(p.body).toMatch(/loose side/);
  });
});

describe('alarmas y preguntas de seguridad', () => {
  it('sin preguntas de seguridad no se sugieren pruebas', () => {
    const { meals, digestion } = lactoseMonth();
    const r = analyseGut({ meals, digestion, bowel: [], safety: null, now });
    expect(r.safety).toBe('needed');
    expect(r.showTests).toBe(false);
    expect(r.patterns.some((p) => p.factor === 'lactose')).toBe(true); // el patrón se sigue viendo
  });
  it('preguntas de hace más de 3 meses: se vuelven a hacer', () => {
    const r = analyseGut({ meals: [], digestion: [], bowel: [], safety: { answeredAt: at(120, 12), answers: {} }, now });
    expect(r.safety).toBe('needed');
  });
  it('cualquier "sí" es una alarma: médico antes que pruebas', () => {
    const { meals, digestion } = lactoseMonth();
    const r = analyseGut({ meals, digestion, bowel: [], safety: { answeredAt: at(1, 12), answers: { blood: true } }, now });
    expect(r.alarms.map((a) => a.id)).toEqual(['blood']);
    expect(r.showTests).toBe(false);
  });
  it('del perfil y de Conoce tus raíces, sin volver a preguntar', () => {
    const r = analyseGut({ meals: [], digestion: [], bowel: [], safety: safetyOk, anaemia: true, familyColorectal: true, now });
    expect(r.alarms.map((a) => a.id)).toEqual(['anaemia', 'family']);
  });
  it('heces rojizas sin explicar, aunque haya comido algo', () => {
    const bowel: BowelEntry[] = [{ id: 'b', fecha: at(3, 12), createdAt: at(3, 12), count: 1, color: 'red' }];
    expect(analyseGut({ meals: [], digestion: [], bowel, safety: safetyOk, now }).alarms[0].id).toBe('stool_blood');
    bowel[0].explainedBy = 'Beetroot';
    expect(analyseGut({ meals: [], digestion: [], bowel, safety: safetyOk, now }).alarms).toEqual([]);
  });
  it('dolor que despierta dos noches', () => {
    const digestion = [sym(at(3, 3), { pain: 2 }, true), sym(at(9, 4), { pain: 3 }, true)];
    expect(analyseGut({ meals: [], digestion, bowel: [], safety: safetyOk, now }).alarms.map((a) => a.id)).toEqual(['night_logs']);
  });
  it('el reflujo nocturno no es alarma', () => {
    const digestion = [sym(at(3, 3), { reflux: 3 }, true), sym(at(9, 4), { reflux: 3 }, true)];
    expect(analyseGut({ meals: [], digestion, bowel: [], safety: safetyOk, now }).alarms).toEqual([]);
  });
  it('heces sueltas más de 4 semanas', () => {
    const bowel: BowelEntry[] = Array.from({ length: 28 }, (_, d) => ({ id: `b${d}`, fecha: at(d, 12), createdAt: at(d, 12), count: 2, consistency: 6 as const }));
    expect(analyseGut({ meals: [], digestion: [], bowel, safety: safetyOk, now }).alarms.map((a) => a.id)).toEqual(['diarrhoea_4w']);
  });
});

describe('cruce por horas', () => {
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
  it('heces sueltas apuntadas para el día entero: cuentan para las comidas de ese día', () => {
    const meals = [meal(at(2, 21), 'Cena de la víspera'), meal(at(1, 8), 'Desayuno'), meal(at(1, 14), 'Comida')];
    const bowel: BowelEntry[] = [{ id: 'b', fecha: at(1, 12), createdAt: at(1, 12), count: 2, consistency: 6 }];
    const r = analyseGut({ meals, digestion: [dayOk(1), dayOk(2)], bowel, safety: safetyOk, now });
    expect(r.observedMeals).toBe(3);
    const ev = gutEvents([], bowel)[0];
    expect(matchingMeal(ev.at, 'diarrhoea', meals)?.description).toBe('Comida');
  });
  it('una molestia encaja con la comida más reciente de su ventana', () => {
    const meals = [meal(at(1, 8), 'Desayuno'), meal(at(1, 14), 'Pizza'), meal(at(1, 21), 'Cena')];
    expect(matchingMeal(new Date(at(1, 15, 30)).getTime(), 'bloating', meals)?.description).toBe('Pizza');
    expect(matchingMeal(new Date(at(1, 14, 10)).getTime(), 'bloating', meals)?.description).toBe('Desayuno');
    expect(matchingMeal(new Date(at(1, 14, 10)).getTime(), 'reflux', meals)?.description).toBe('Pizza');
    expect(matchingMeal(new Date(at(0, 3)).getTime(), 'reflux', meals, true)?.description).toBe('Cena');
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
    // La tostada (gluten) va con el café con leche, pero también con el café solo, que sienta bien:
    // el gluten lo explica la lactosa y no se enseña
    expect(r.patterns.some((p) => p.factor === 'gluten')).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import type { DietPrefs } from '@/data/diet/types';
import {
  cleanDayTargets,
  dayIssue,
  dayKcalTarget,
  dayLock,
  dayTotals,
  DEFAULT_DIET_PREFS,
  dietTargets,
  fitPortions,
  generateDiet,
  macroIssues,
  mealSplit,
  mealTargets,
  ownMacros,
  prefsForDay,
  selfKcalFloor,
  slotCount,
  weekSummary,
} from '@/logic/dietPlanner';
import { allSame, commonDraft, dayDrafts, fitDrafts, saveDrafts, weekKcalTarget, type DayDrafts } from '@/logic/dietDayMacros';

// «Calorías y macros» de tu menú: tus propios números, con el mismo panel que el dietista (fundador, 2026-11-06)
const prefs = (p: Partial<DietPrefs>): DietPrefs => ({ ...DEFAULT_DIET_PREFS, ...p });
const ADULT: Partial<DietPrefs> = { sex: 'female', age: 40, heightCm: 165, weightKg: 68, activity: 'light' };

const read = async (p: string) => {
  const fs = (await import('node:fs' as string)) as { readFileSync: (p: string, enc: 'utf8') => string };
  return fs.readFileSync(p, 'utf8');
};

describe('Tus propios números', () => {
  it('sin nada puesto, todo sale calculado; cualquier número o reparto cuenta como tuyo', () => {
    expect(ownMacros(DEFAULT_DIET_PREFS)).toBe(false);
    expect(ownMacros(prefs({ meals: { lunch: {} } }))).toBe(false);
    expect(ownMacros(prefs({ kcalTarget: 2200 }))).toBe(true);
    expect(ownMacros(prefs({ proteinTarget: 120 }))).toBe(true);
    expect(ownMacros(prefs({ meals: { breakfast: { share: 30 } } }))).toBe(true);
  });

  it('con los tres macros y sin kcal, las kcal salen de ellos', () => {
    const t = dietTargets(prefs({ ...ADULT, proteinTarget: 150, carbsTarget: 200, fatTarget: 70 }), []);
    expect(t.kcal).toBe(150 * 4 + 200 * 4 + 70 * 9);
    expect([t.protein, t.carbs, t.fat]).toEqual([150, 200, 70]);
  });

  it('al guardar, los platos se quedan y las raciones siguen tus kcal', () => {
    const base = prefs(ADULT);
    const g = generateDiet(base, []);
    const mine = { ...base, kcalTarget: g.targets.kcal + 600 };
    const fitted = fitPortions(g.days, mine, []);
    expect(fitted.map((d) => d.meals.map((m) => m.recipeId))).toEqual(g.days.map((d) => d.meals.map((m) => m.recipeId)));
    const before = weekSummary(g.days).kcal;
    const after = weekSummary(fitted).kcal;
    expect(after).toBeGreaterThan(before + 300);
    expect(Math.abs(after - mine.kcalTarget)).toBeLessThan(Math.abs(before - mine.kcalTarget));
  });

  it('por debajo del suelo del generador no se guarda: 1200 kcal (1500 en hombres)', () => {
    expect(selfKcalFloor(prefs({ sex: 'female' }))).toBe(1200);
    expect(selfKcalFloor(prefs({ sex: null }))).toBe(1200);
    expect(selfKcalFloor(prefs({ sex: 'male' }))).toBe(1500);
    const low = dietTargets(prefs({ ...ADULT, kcalTarget: 900 }), []);
    expect(low.kcal < selfKcalFloor(prefs(ADULT))).toBe(true);
  });
});

describe('Por día de la semana', () => {
  it('los números de un día se limpian: solo los puestos, siempre en el mismo orden', () => {
    expect(cleanDayTargets({ protein: 150, kcal: 2800 })).toEqual({ kcal: 2800, protein: 150 });
    expect(JSON.stringify(cleanDayTargets({ protein: 150, kcal: 2800 }))).toBe(JSON.stringify({ kcal: 2800, protein: 150 }));
    expect(cleanDayTargets({ kcal: null, protein: 0 })).toBeUndefined();
    expect(cleanDayTargets(undefined)).toBeUndefined();
    // También el reparto por comida de ese día: solo lo puesto y en el orden de las comidas
    expect(JSON.stringify(cleanDayTargets({ meals: { dinner: { fat: 20 }, breakfast: { protein: 30, share: 0 }, lunch: {} } }))).toBe(
      JSON.stringify({ meals: { breakfast: { protein: 30 }, dinner: { fat: 20 } } })
    );
  });

  it('un día con su propio reparto por comida: solo cambian las raciones de ese día', () => {
    const base = prefs(ADULT);
    const g = generateDiet(base, []);
    const p = prefsForDay(base, { targets: { meals: { breakfast: { share: 40 } } } });
    expect(p.meals).toEqual({ breakfast: { share: 40 } });
    const days = g.days.map((d) => (d.day === 4 ? { ...d, targets: { meals: { breakfast: { share: 40 } } } } : d));
    const fitted = fitPortions(days, base, []);
    const bf = (d: (typeof fitted)[number]) => d.meals.find((m) => m.slot === 'breakfast')!.portion;
    expect(bf(fitted[4])).toBeGreaterThan(bf(fitPortions(g.days, base, [])[4]));
    expect(bf(fitted[1])).toBe(bf(fitPortions(g.days, base, [])[1]));
  });

  it('un día con sus kcal rehace solo sus raciones; los demás siguen a la semana', () => {
    const base = prefs(ADULT);
    const g = generateDiet(base, []);
    const days = g.days.map((d) => (d.day === 2 ? { ...d, targets: { kcal: g.targets.kcal + 700 } } : d));
    const fitted = fitPortions(days, base, []);
    expect(dayTotals(fitted[2]).kcal).toBeGreaterThan(dayTotals(g.days[2]).kcal + 400);
    expect(fitted[0].meals.map((m) => m.portion)).toEqual(fitPortions(g.days, base, [])[0].meals.map((m) => m.portion));
    expect(fitted[2].meals.map((m) => m.recipeId)).toEqual(g.days[2].meals.map((m) => m.recipeId));
  });

  it('el objetivo del día en el menú: el suyo, el de sus tres macros o el de la semana', () => {
    const plan = { prefs: prefs(ADULT), targets: { ...dietTargets(prefs(ADULT), []) } };
    expect(dayKcalTarget(plan, {})).toBe(plan.targets.kcal);
    expect(dayKcalTarget(plan, { targets: { kcal: 2900 } })).toBe(2900);
    expect(dayKcalTarget(plan, { targets: { protein: 150, carbs: 300, fat: 80 } })).toBe(150 * 4 + 300 * 4 + 80 * 9);
    expect(dayKcalTarget(plan, { targets: { protein: 150 } })).toBe(plan.targets.kcal);
  });
});

describe('Día a día y «Aplicar a todos los días»', () => {
  const base = prefs(ADULT);
  const g = generateDiet(base, []);
  const plan = { prefs: { ...base, kcalTarget: 2400 }, days: g.days, targets: g.targets };
  const train = { kcal: 2900, protein: 160, meals: { lunch: { share: 45 } } };

  it('cada día parte de lo suyo y, lo que no tenga, de la semana', () => {
    const withDay = { ...plan, days: g.days.map((d) => (d.day === 1 ? { ...d, targets: { protein: 150 } } : d)) };
    const drafts = dayDrafts(withDay);
    expect(drafts[0]).toEqual({ kcal: 2400 });
    expect(drafts[1]).toEqual({ kcal: 2400, protein: 150 });
  });

  it('con los 7 días iguales, los números van a la semana y los días no llevan nada propio', () => {
    const drafts: DayDrafts = Object.fromEntries(g.days.map((d) => [d.day, { kcal: 2600 }]));
    expect(allSame(g.days, drafts)).toBe(true);
    const out = saveDrafts(base, g.days, drafts, []);
    expect(out.prefs.kcalTarget).toBe(2600);
    expect(out.days.every((d) => !('targets' in d))).toBe(true);
  });

  it('con días distintos, la semana se queda sin números y cada día lleva los suyos; se guarda lo que se ve', () => {
    const drafts: DayDrafts = Object.fromEntries(g.days.map((d) => [d.day, d.day === 1 || d.day === 3 ? train : { kcal: 2200 }]));
    expect(allSame(g.days, drafts)).toBe(false);
    const out = saveDrafts(base, g.days, drafts, []);
    expect([out.prefs.kcalTarget, out.prefs.proteinTarget, out.prefs.meals]).toEqual([null, null, null]);
    expect(out.days[1].targets).toEqual(train);
    expect(out.days[0].targets).toEqual({ kcal: 2200 });
    // Lo guardado, vuelto a ajustar como lo hace el menú, da las mismas raciones que la vista previa del editor
    const preview = fitDrafts(g.days, base, drafts, []);
    expect(fitPortions(out.days, out.prefs, []).map((d) => d.meals.map((m) => m.portion))).toEqual(preview.map((d) => d.meals.map((m) => m.portion)));
    // Y al reabrir, cada día tiene lo que se puso
    expect(dayDrafts({ prefs: out.prefs, days: out.days })[3]).toEqual(train);
  });

  it('para elegir platos nuevos, los números que más se repiten; y la media de la semana para el menú', () => {
    const drafts: DayDrafts = Object.fromEntries(g.days.map((d) => [d.day, d.day === 1 || d.day === 3 ? train : { kcal: 2200 }]));
    expect(commonDraft(g.days, drafts)).toEqual({ kcal: 2200 });
    const out = saveDrafts(base, g.days, drafts, []);
    expect(weekKcalTarget({ prefs: out.prefs, days: out.days, targets: g.targets })).toBe(Math.round((2900 * 2 + 2200 * 5) / 7 / 10) * 10);
  });
});

describe('El día y su reparto por comida siempre cuadran («que una cosa bloquee a la otra»)', () => {
  // Con un tentempié: desayuno 25 %, comida 35 %, cena 30 % y tentempié 10 %
  const P = (p: Partial<DietPrefs>) => prefs({ ...ADULT, snacks: 1, kcalTarget: 2000, proteinTarget: 150, ...p });
  const split = (p: DietPrefs) => mealSplit(p, dietTargets(p, []));
  const sum = (p: DietPrefs, col: 'share' | 'protein' | 'carbs' | 'fat') =>
    Object.entries(split(p).meals).reduce((a, [slot, m]) => a + m![col] * slotCount(p, slot as never), 0);

  it('sin nada por comida, cada una lleva su parte y todo suma lo del día', () => {
    const p = P({});
    const s = split(p);
    expect(s.issues).toEqual([]);
    expect(s.meals.lunch!.share).toBeCloseTo(35);
    expect(s.meals.lunch!.protein).toBeCloseTo(150 * 0.35);
    for (const c of ['share', 'protein', 'carbs', 'fat'] as const) expect(sum(p, c)).toBeCloseTo(c === 'share' ? 100 : (dietTargets(p, [])[c] ?? 0));
    expect(Object.values(s.meals).every((m) => Object.values(m!.cells).every((c) => c === 'auto'))).toBe(true);
  });

  it('lo que pones en una comida se queda y las vacías se reparten lo que queda (antes cada una cogía su parte de todo)', () => {
    const p = P({ meals: { breakfast: { protein: 60 } } });
    const s = split(p);
    expect(s.meals.breakfast!.protein).toBe(60);
    expect(s.meals.breakfast!.cells.protein).toBe('own');
    expect(sum(p, 'protein')).toBeCloseTo(150);
    // Los 90 g que quedan, en proporción a la parte de cada una (35 : 30 : 10)
    expect(s.meals.lunch!.protein).toBeCloseTo((90 * 35) / 75);
    expect(s.issues).toEqual([]);
  });

  it('la última comida vacía de una columna es justo lo que queda y no se escribe', () => {
    const p = P({ meals: { breakfast: { protein: 40 }, lunch: { protein: 50 }, dinner: { protein: 40 } } });
    const s = split(p);
    expect(s.meals.snack!.cells.protein).toBe('rest');
    expect(s.meals.snack!.protein).toBeCloseTo(20);
    expect(s.meals.snack!.cells.carbs).toBe('auto');
  });

  it('si las comidas pasan de lo del día, no cuadra (no se guarda) y el generador lo reparte en proporción', () => {
    const p = P({ meals: { breakfast: { protein: 80 }, lunch: { protein: 60 }, dinner: { protein: 40 } } });
    const s = split(p);
    expect(s.issues).toEqual([{ kind: 'column', col: 'protein', sum: 180, total: 150, free: 1 }]);
    // La casilla que queda dice cuánto te pasas, no el reparto de emergencia
    expect(s.meals.snack!.shown.protein).toBeCloseTo(-30);
    expect(s.meals.breakfast!.shown.protein).toBe(80);
    expect(macroIssues(p, dietTargets(p, [])).length).toBe(1);
    const mt = mealTargets(p, dietTargets(p, []));
    expect(Object.values(mt).reduce((a, m) => a + m!.protein, 0)).toBeCloseTo(150);
    // Bajar el día por debajo de lo puesto en las comidas, igual
    expect(split(P({ proteinTarget: 100, meals: { breakfast: { protein: 60 }, lunch: { protein: 50 } } })).issues[0]).toMatchObject({ kind: 'column', col: 'protein' });
  });

  it('el % de las kcal: lo puesto se queda, y hay que dejar al menos un 5 % a cada comida vacía', () => {
    const p = P({ meals: { breakfast: { share: 30 }, lunch: { share: 40 } } });
    expect(split(p).meals.dinner!.share).toBeCloseTo((30 * 30) / 40);
    expect(split(p).meals.snack!.share).toBeCloseTo((30 * 10) / 40);
    expect(sum(p, 'share')).toBeCloseTo(100);
    expect(split(P({ meals: { breakfast: { share: 60 }, lunch: { share: 38 } } })).issues).toEqual([{ kind: 'column', col: 'share', sum: 98, total: 100, free: 2 }]);
    // Las kcal de cada comida van por su %
    expect(split(p).meals.breakfast!.kcal).toBeCloseTo(600);
  });

  it('en una comida, con tres casillas puestas la cuarta sale de ellas', () => {
    const three = split(P({ meals: { breakfast: { protein: 30, carbs: 60, fat: 20 } } })).meals.breakfast!;
    expect(three.cells.share).toBe('calc');
    expect(three.kcal).toBeCloseTo(30 * 4 + 60 * 4 + 20 * 9);
    const byShare = split(P({ meals: { breakfast: { share: 25, protein: 30, carbs: 60 } } })).meals.breakfast!;
    expect(byShare.cells.fat).toBe('calc');
    expect(byShare.fat).toBeCloseTo((500 - 30 * 4 - 60 * 4) / 9);
  });

  it('los gramos de una comida no pueden pasar de sus kcal', () => {
    const s = split(P({ meals: { snack: { protein: 80 } } }));
    expect(s.issues).toContainEqual({ kind: 'meal', slot: 'snack', gramsKcal: 320, kcal: 200, share: 10, off: false });
  });

  it('en el día, con tres casillas puestas la cuarta sale de ellas y se bloquea', () => {
    expect(dayLock({ proteinTarget: 150, carbsTarget: 200, fatTarget: 60 })).toBe('kcal');
    expect(dayLock({ kcalTarget: 2000, proteinTarget: 150, carbsTarget: 200 })).toBe('fat');
    expect(dayLock({ kcalTarget: 2000, carbsTarget: 200, fatTarget: 60 })).toBe('protein');
    expect(dayLock({ kcalTarget: 2000, proteinTarget: 150 })).toBeNull();
    const fat = dietTargets(prefs({ ...ADULT, kcalTarget: 2000, proteinTarget: 150, carbsTarget: 200 }), []);
    expect(fat.fat).toBe(Math.round((2000 - 600 - 800) / 9));
    const protein = dietTargets(prefs({ ...ADULT, kcalTarget: 2000, carbsTarget: 200, fatTarget: 60 }), []);
    expect(protein.protein).toBe(Math.round((2000 - 800 - 540) / 4));
    // Con hidratos y grasa (sin kcal), las kcal salen de los tres
    const k = dietTargets(prefs({ ...ADULT, carbsTarget: 200, fatTarget: 60 }), []);
    expect(k.kcal).toBe(k.protein * 4 + 800 + 540);
  });

  it('si los macros del día pasan de sus kcal, no cuadra', () => {
    const p = prefs({ ...ADULT, kcalTarget: 2000, proteinTarget: 300, fatTarget: 100 });
    expect(dayIssue(p, dietTargets(p, []))).toEqual({ kind: 'day', macroKcal: 2100, kcal: 2000, off: false });
    const ok = prefs({ ...ADULT, kcalTarget: 2000, proteinTarget: 150 });
    expect(dayIssue(ok, dietTargets(ok, []))).toBeNull();
  });
});

describe('Dónde sale', () => {
  it('arriba, el donut y debajo la tabla «Objetivo / Tu menú» (en una fila, en el móvil quedaba un hueco enorme)', async () => {
    const src = await read('src/screens/diet/DietMacrosScreen.tsx');
    expect(src).toMatch(/<MacroDonut m=\{totals\} size=\{84\} \/>\s*<CompareTable/);
    expect(src).toContain("t('Apply to all days')");
    expect(src).toMatch(/summaryCard: \{ gap: 12,/);
    expect(src).not.toMatch(/summaryCard: \{[^}]*flexDirection: 'row'/);
  });

  it('«Otra versión» conserva los números de cada día', async () => {
    const src = await read('src/screens/diet/DietScreen.tsx');
    expect(src).toContain('fitDay({ ...d, targets: own }, prefs, ctx.labs)');
  });

  it('en tu menú, «Calorías y macros» lleva a /diet-macros, y no en el de un dietista', async () => {
    const src = await read('src/screens/diet/DietScreen.tsx');
    expect(src).toMatch(/plan\.source !== 'professional' && \(\s*<TouchableOpacity[\s\S]{0,80}router\.push\('\/diet-macros'\)/);
  });

  it('el paciente y el portal usan el mismo panel', async () => {
    const mine = await read('src/screens/diet/DietMacrosScreen.tsx');
    const pro = await read('src/screens/pro/ProDietScreen.tsx');
    expect(mine).toContain('<MacroTargetsPanel');
    expect(pro).toContain('<MacroTargetsPanel');
    // Bajo el suelo o con números que no cuadran, los dos botones de guardar quedan desactivados; en el portal, «Enviar»
    expect(mine).toContain('const blocked = tooLow || badDays.length > 0;');
    expect(mine.match(/disabled=\{blocked \|\| saving\}/g)).toHaveLength(2);
    expect(pro).toContain("disabled={state === 'saving' || !loaded || blocked}");
    // La hoja de un día del portal también bloquea la cuarta casilla
    expect(pro).toContain("locked={lock === 'kcal'}");
  });

  it('las casillas que salen de las otras no se escriben', async () => {
    const src = await read('src/components/diet/MacroTargetsPanel.tsx');
    expect(src).toMatch(/state === 'rest' \|\| state === 'calc'\)\s*return <TextInput[^>]*editable=\{false\}/);
    expect(src).toMatch(/locked \? \(\s*<TextInput[^>]*editable=\{false\}/);
  });
});

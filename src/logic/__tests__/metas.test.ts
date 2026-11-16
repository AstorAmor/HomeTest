import { describe, expect, it } from 'vitest';
import {
  areaScore,
  bedtimeOnTime,
  cfgWithPer,
  cfgWithTobaccoUnit,
  closedWeek,
  customText,
  emptyState,
  evalMeta,
  initialGoals,
  knownBefore,
  labGoals,
  labGoalText,
  last7,
  metaText,
  normalizeState,
  pickList,
  progressText,
  rangeText,
  recommended,
  resolveMeta,
  stepDay,
  stepTarget,
  targetValues,
  toggleSel,
  tooMany,
  valueText,
  weekGoal,
  weekOf,
  weekStartOf,
  weeklyCongrats,
  weekMisses,
  weekReview,
  reviewClosing,
  valuesFor,
  type MetasState,
  type ValuesById,
} from '@/logic/metas';

const NOBODY = { smoker: false, drinker: false };
const BOTH = { smoker: true, drinker: true };
const meta = (s: MetasState, id: string) => resolveMeta(s, id)!;
const st = (patch: Partial<MetasState> = {}): MetasState => ({ ...emptyState(), ...patch });

describe('Cada meta en los últimos 7 días', () => {
  it('al día: los días cumplidos de los que tienen dato, y hoy aún pendiente; los que no, por la parte hecha', () => {
    const e = evalMeta(meta(st(), 'pasos'), [8200, 6100, 9400, 4300, 7900, 7600, 5240]);
    expect(e.st).toEqual(['ok', 'no', 'ok', 'no', 'ok', 'ok', 'pend']);
    expect(e.n).toBe(4);
    expect(e.days).toBe(7);
    expect(e.score).toBeCloseTo((4 + 6100 / 7500 + 4300 / 7500 + 5240 / 7500) / 7);
  });

  it('un día sin dato no cuenta, ni para bien ni para mal', () => {
    const e = evalMeta(meta(st(), 'fruta'), [3, null, null, 3, 1, 3, null]);
    expect(e.days).toBe(5);
    expect(e.n).toBe(3);
    expect(progressText(meta(st(), 'fruta'), e)).toBe('3 of 5 days');
  });

  it('un límite al día se cumple quedándose por debajo; hoy ya cuenta', () => {
    const e = evalMeta(meta(st(), 'tabaco'), [6, 4, 8, 5, 4, 3, 2]);
    expect(e.st).toEqual(['no', 'ok', 'no', 'no', 'ok', 'ok', 'ok']);
    expect(e.n).toBe(4);
  });

  it('a la semana: lo apuntado sobre la meta; un límite, entero si no se pasa', () => {
    const s = st();
    const cardio = evalMeta(meta(s, 'cardio'), [30, 0, 0, 25, 0, 30, 0]);
    expect(cardio.score).toBeCloseTo(85 / 90);
    expect(progressText(meta(s, 'cardio'), cardio)).toBe('85 of 90 min');
    expect(evalMeta(meta(s, 'embutido'), [1, 0, 0, 0, 0, 0, 0]).score).toBe(1);
    const over = evalMeta(meta(s, 'embutido'), [1, 0, 1, 1, 0, 0, 0]);
    expect(over.score).toBeCloseTo(2 / 4);
    expect(progressText(meta(s, 'embutido'), over)).toBe('3 servings this week · your limit, less than 2');
  });

  it('sin ningún dato: la tuya ya cuenta (hoy a 0); la del reloj, cuando lleguen datos', () => {
    const e = evalMeta(meta(st(), 'paseo'), [null, null, null, null, null, null, null]);
    expect(e.started).toBe(false);
    expect(e.score).toBe(0);
    expect(progressText(meta(st(), 'paseo'), e)).toBe('0 of 1 day');
    const past = evalMeta(meta(st(), 'paseo'), Array(7).fill(null), { from: 0, to: 6, current: false, share: 1 });
    expect(progressText(meta(st(), 'paseo'), past)).toBe('No data that week');
    expect(progressText(meta(st(), 'pasos'), evalMeta(meta(st(), 'pasos'), Array(7).fill(null)))).toBe('Counts once data arrives');
  });
});

describe('El donut de cada área', () => {
  it('la media de sus metas, cada una por la parte hecha; una que aún no marcaste, a 0', () => {
    const s = st({ sel: { ej: [], al: ['fruta', 'embutido', 'verdura'], ha: [] } });
    const vals: ValuesById = {
      fruta: [3, 3, 3, 3, 3, 3, 3], // 7/7
      embutido: [1, 0, 1, 1, 0, 0, 0], // 0,5
      verdura: Array(7).fill(null), // hoy, nada aún
    };
    expect(areaScore(s, 'al', vals)).toBeCloseTo((1 + 0.5 + 0) / 3);
    expect(areaScore(s, 'ej', vals)).toBeNull();
  });

  it('marcar nunca baja el % (fundador: 3 frutas = 100 % y 1 de verdura lo bajaba al 80 %)', () => {
    const s = st({ sel: { ej: [], al: ['fruta', 'verdura', 'frutos'], ha: [] } });
    const today = { from: 6, to: 6, current: true, share: 1 / 7 };
    const day = (f: number | null, v: number | null, a: number | null): ValuesById => ({
      fruta: [null, null, null, null, null, null, f],
      verdura: [null, null, null, null, null, null, v],
      frutos: [null, null, null, null, null, null, a], // a la semana: en la primera, 1 ración
    });
    const steps: [number | null, number | null, number | null][] = [
      [null, null, null], [1, null, null], [2, null, null], [3, null, null], [3, 1, null], [3, 2, null], [3, 2, 1],
    ];
    const scores = steps.map(([f, v, a]) => areaScore(s, 'al', day(f, v, a), today)!);
    for (let i = 1; i < scores.length; i++) expect(scores[i]).toBeGreaterThanOrEqual(scores[i - 1]);
    expect(scores[3]).toBeCloseTo(1 / 3); // las 3 frutas: un tercio del área, no el 100 %
    expect(scores[4]).toBeCloseTo((1 + 0.5) / 3); // 1 de 2 de verdura suma medio hábito
    expect(scores[scores.length - 1]).toBe(1);
  });

  it('una meta tuya cuenta en su área desde el primer día que la marcas', () => {
    const s = st({
      custom: [{ id: 'own-1', area: 'ha', name: 'Leer antes de dormir', kind: 'yesno', unit: '', max: 1 }],
      sel: { ej: [], al: [], ha: ['own-1'] },
      cfg: { 'own-1': { tgt: 1, per: 'day' } },
    });
    expect(areaScore(s, 'ha', { 'own-1': Array(7).fill(null) })).toBe(0); // ya cuenta, a 0
    expect(areaScore(s, 'ha', { 'own-1': [null, null, null, null, null, 1, 1] })).toBe(1);
    expect(areaScore(s, 'ha', { 'own-1': Array(7).fill(null) }, { from: 0, to: 6, current: false, share: 1 })).toBeNull(); // semana pasada sin datos
    expect(metaText(meta(s, 'own-1'))).toBe('Leer antes de dormir every day');
  });
});

describe('Las frases de cada meta', () => {
  it('cantidad, límite, sesiones, sí / no y dormir', () => {
    const s = st();
    expect(metaText(meta(s, 'pasos'))).toBe('7,500 steps a day');
    expect(metaText(meta(s, 'embutido'))).toBe('Less than 2 servings of processed meat a week');
    expect(metaText(meta(s, 'fuerza'))).toBe('2 strength sessions a week');
    expect(metaText(meta(s, 'paseo'))).toBe('Walk after meals every day');
    expect(metaText(meta(s, 'dormir'))).toBe('Sleep 7 h or more');
    expect(metaText(meta(s, 'tabaco'))).toBe('Less than 5 cigarettes a day');
    expect(metaText(meta(s, 'alcohol'))).toBe('Less than 4 beers a week');
  });

  it('lo de un día y la vista previa de una meta tuya', () => {
    const s = st();
    expect(valueText(meta(s, 'pasos'), 8200)).toBe('8,200 steps');
    expect(valueText(meta(s, 'fuerza'), 1)).toBe('Session done');
    expect(valueText(meta(s, 'fruta'), null)).toBe('No data');
    expect(customText({ name: 'Leer', kind: 'amount', per: 'day', q: 20, days: 5, unit: 'páginas' })).toBe('Leer: 20 páginas a day');
    expect(customText({ name: ' ', kind: 'yesno', per: 'week', q: 1, days: 3, unit: '' })).toBe('Your target, 3 days a week');
  });
});

describe('Ajustar la meta', () => {
  it('− / + y la ruedita, dentro de sus límites', () => {
    const s = st();
    expect(stepTarget(meta(s, 'pasos'), 1)).toBe(8000);
    expect(stepTarget(meta(st({ cfg: { pasos: { tgt: 500, per: 'day' } } }), 'pasos'), -1)).toBe(500);
    const sleep = targetValues(meta(s, 'dormir'));
    expect(sleep[0]).toBe(0.5);
    expect(sleep[sleep.length - 1]).toBe(12);
    // Un límite empieza en 2 pasos: «menos de 1» sería «ninguno»
    expect(targetValues(meta(s, 'embutido'))[0]).toBe(2);
  });

  it('de día a semana se multiplica; de semana a día se redondea', () => {
    const s = st();
    const week = cfgWithPer(meta(s, 'fruta'), { tgt: 3, per: 'day' }, 'week');
    expect(week).toMatchObject({ per: 'week', tgt: 21 });
    const back = cfgWithPer(meta(st({ cfg: { fruta: week } }), 'fruta'), week, 'day');
    expect(back).toMatchObject({ per: 'day', tgt: 3 });
    expect(cfgWithPer(meta(s, 'paseo'), { tgt: 1, per: 'day' }, 'week').tgt).toBe(5);
  });

  it('tabaco en cajetillas: se guarda en cigarrillos', () => {
    const s = st({ cfg: { tabaco: { tgt: 30, per: 'day', unit: 'cig' } } });
    const packs = cfgWithTobaccoUnit(meta(s, 'tabaco'), s.cfg.tabaco, 'pack');
    expect(packs).toMatchObject({ unit: 'pack', tgt: 1.5 });
    const m = meta(st({ cfg: { tabaco: packs } }), 'tabaco');
    expect(stepDay(m, 20, 1)).toBe(30);
    expect(stepDay(m, 0, -1)).toBe(0);
    expect(valueText(m, 30)).toBe('1.5 packs');
    expect(evalMeta(m, [null, null, null, null, null, null, 40]).st[6]).toBe('no');
  });
});

describe('Objetivos', () => {
  const readings = [
    { marker: 'ldl', value: 158, unit: 'mg/dL', low: 0, high: 130 },
    { marker: 'triglycerides', value: 120, unit: 'mg/dL', low: 0, high: 150 },
    { marker: 'glucose', value: 92, unit: 'mg/dL', low: 70, high: 99 },
    { marker: 'hba1c', value: 5.9, unit: '%', low: 4, high: 5.6 },
    { marker: 'hdl', value: 35, unit: 'mg/dL', low: 40, high: null },
  ];

  it('recomendados por los valores fuera del rango del laboratorio', () => {
    const g = labGoals(readings);
    expect(g.map((x) => x.key)).toEqual(['ldl', 'glucosa', 'hdl']);
    expect(g[1].reading.marker).toBe('hba1c');
    expect(labGoalText(g[0])).toBe('From your blood test: 158 mg/dL; lab range, less than 130.');
    expect(labGoalText(g[2])).toBe('From your blood test: 35 mg/dL; lab range, more than 40.');
    expect(labGoals([{ marker: 'glucose', value: 105, unit: 'mg/dL', low: 70, high: 99 }]).map((x) => labGoalText(x))).toEqual([
      'From your blood test: 105 mg/dL; lab range, 70 to 99.',
    ]);
  });

  it('la primera vez: los de la analítica y los del cuestionario, hasta 3', () => {
    expect(initialGoals(['ldl'], ['more_energy', 'sleep_better', 'lose_weight'], NOBODY)).toEqual(['ldl', 'energia', 'sueno']);
    expect(initialGoals([], ['general_health', 'prevent_disease'], NOBODY)).toEqual(['salud']);
  });

  it('las metas recomendadas: las que más se repiten entre tus objetivos, 2 por área', () => {
    const goals = ['ldl', 'tg', 'energia'] as const;
    expect(recommended('ej', [...goals], NOBODY)).toEqual(['pasos', 'cardio']);
    expect(recommended('al', [...goals], NOBODY)).toEqual(['fruta', 'verdura']);
    expect(recommended('ha', [...goals], NOBODY)).toEqual(['paseo', 'hora']);
    // Bebiendo, el alcohol sale (está en 2 de los 3)
    expect(recommended('ha', [...goals], BOTH)).toEqual(['alcohol', 'tabaco']);
    // «Mejorar tu salud general» vale para todas: no decide
    expect(recommended('al', ['salud'], NOBODY)).toEqual([]);
  });
});

describe('Fumar, beber y cafeína (fundador, 2026-11-06)', () => {
  it('salen a todo el mundo; a quien no ha marcado que fuma o bebe, al final', () => {
    expect(pickList('ha', st(), NOBODY)).toEqual(['paseo', 'hora', 'dormir', 'checkin', 'cafeina', 'sinhumo', 'tabaco', 'alcohol']);
    expect(pickList('ha', st(), BOTH)).toEqual(['sinhumo', 'tabaco', 'alcohol', 'paseo', 'hora', 'dormir', 'checkin', 'cafeina']);
    // Elegida sin haberlo marcado: se queda en su sitio (marcarla no la sube). Y las tuyas, detrás
    const own = st({ sel: { ej: [], al: [], ha: ['tabaco'] }, custom: [{ id: 'own-1', area: 'ha', name: 'Leer', kind: 'yesno', unit: '', max: 1 }] });
    expect(pickList('ha', own, NOBODY)).toEqual(['paseo', 'hora', 'dormir', 'checkin', 'cafeina', 'sinhumo', 'tabaco', 'alcohol', 'own-1']);
  });

  it('sus frases', () => {
    expect(metaText(meta(st(), 'sinhumo'))).toBe('No smoking every day');
    expect(metaText(meta(st({ cfg: { sinhumo: { tgt: 5, per: 'week' } } }), 'sinhumo'))).toBe('No smoking, 5 days a week');
    expect(metaText(meta(st(), 'cafeina'))).toBe('Less than 3 coffees a day');
  });

  it('dejar de fumar se recomienda con su objetivo, y solo a quien fuma', () => {
    expect(recommended('ha', ['tabaco'], BOTH)).toEqual(['sinhumo', 'tabaco']);
    expect(recommended('ha', ['tabaco'], NOBODY)).toEqual(['checkin']);
    expect(recommended('ha', ['sueno'], NOBODY)).toEqual(['paseo', 'hora']);
  });

  it('poner y quitar una meta, en el orden de la lista y sin tope', () => {
    let s: MetasState = st();
    s = toggleSel(s, 'ha', 'checkin', NOBODY);
    s = toggleSel(s, 'ha', 'paseo', NOBODY);
    expect(s.sel.ha).toEqual(['paseo', 'checkin']);
    s = toggleSel(s, 'ha', 'sinhumo', NOBODY);
    expect(s.sel.ha).toEqual(['paseo', 'checkin', 'sinhumo']);
    expect(tooMany(s, 'ha')).toBe(false);
    // Sin tope desde el 2026-11-06: la cuarta entra (en su sitio de la lista) y sale el aviso
    const four = toggleSel(s, 'ha', 'cafeina', NOBODY);
    expect(four.sel.ha).toEqual(['paseo', 'checkin', 'cafeina', 'sinhumo']); // el orden de la lista de quien no fuma
    expect(tooMany(four, 'ha')).toBe(true);
    expect(toggleSel(s, 'ha', 'paseo', NOBODY).sel.ha).toEqual(['checkin', 'sinhumo']);
  });

  it('guardadas, más de 3 en un área se quedan todas', () => {
    const s = normalizeState({ sel: { ha: ['paseo', 'checkin', 'sinhumo', 'cafeina', 'hora'] } });
    expect(s.sel.ha).toEqual(['paseo', 'checkin', 'sinhumo', 'cafeina', 'hora']);
  });
});

describe('La semana y la enhorabuena', () => {
  // El 28/10/2026 es miércoles; la semana de lunes a domingo va del 26/10 al 1/11
  it('la semana va de lunes a domingo, o de domingo a sábado', () => {
    expect(weekStartOf('2026-10-28', 1)).toBe('2026-10-26');
    expect(weekStartOf('2026-11-01', 1)).toBe('2026-10-26');
    expect(weekStartOf('2026-10-28', 0)).toBe('2026-10-25');
    expect(weekStartOf('2026-11-01', 0)).toBe('2026-11-01');
    // El cambio de hora (25/10) no mueve el día
    expect(weekStartOf('2026-10-27', 1)).toBe('2026-10-26');
    expect(last7('2026-11-04')[0]).toBe('2026-10-29');
  });

  it('si empiezas un miércoles, tu primera semana cuenta de miércoles a domingo', () => {
    const w = weekOf('2026-10-30', { weekStart: 1, commit: { day: '2026-10-28', weeks: 8 } }, '2026-10-30');
    expect(w).toMatchObject({ from: 2, to: 4, current: true });
    expect(w.days[0]).toBe('2026-10-26');
    expect(w.days[6]).toBe('2026-11-01');
    expect(w.share).toBeCloseTo(5 / 7);
    // La siguiente, entera; sin compromiso, entera también
    expect(weekOf('2026-11-03', { weekStart: 1, commit: { day: '2026-10-28', weeks: 8 } }, '2026-11-03')).toMatchObject({ from: 0, to: 1, share: 1 });
    expect(weekOf('2026-10-30', { weekStart: 1, commit: null }, '2026-10-30').from).toBe(0);
  });

  it('las metas a la semana van en proporción en la primera', () => {
    const s0 = st();
    expect(weekGoal(meta(s0, 'cardio'), 5 / 7)).toBe(60); // 90 × 5/7 ≈ 64, a pasos de 15
    expect(weekGoal(meta(s0, 'fuerza'), 5 / 7)).toBe(1); // 2 × 5/7 ≈ 1,4
    expect(weekGoal(meta(s0, 'fuerza'), 1 / 7)).toBe(1); // al menos una
    expect(weekGoal(meta(s0, 'embutido'), 5 / 7)).toBe(2); // límite: menos de 1,4 raciones = menos de 2
    expect(weekGoal(meta(s0, 'embutido'), 2 / 7)).toBe(1); // menos de 0,6 = ninguna
    expect(weekGoal(meta(s0, 'fruta'), 5 / 7)).toBe(3); // las de cada día no cambian
    expect(weekGoal(meta(s0, 'cardio'))).toBe(90);
  });

  it('en la semana en curso solo cuentan los días desde que empezaste y hasta hoy', () => {
    const s0 = st();
    const part = { from: 2, to: 4, current: true, share: 5 / 7 };
    const pasos = evalMeta(meta(s0, 'pasos'), [9000, 9000, 8000, 4000, null, null, null], part);
    expect(pasos.st).toEqual(['off', 'off', 'ok', 'no', 'pend', 'off', 'off']);
    expect(progressText(meta(s0, 'pasos'), pasos)).toBe('1 of 3 days');
    const cardio = evalMeta(meta(s0, 'cardio'), [60, 0, 30, 30, null, null, null], part);
    expect(cardio.sum).toBe(60);
    expect(cardio.score).toBe(1);
    expect(progressText(meta(s0, 'cardio'), cardio)).toBe('60 of 60 min · done');
    // Una semana pasada: ya no hay «hoy»
    const past = evalMeta(meta(s0, 'embutido'), [1, 0, 0, 0, 0, 0, 0], { from: 0, to: 6, current: false, share: 1 });
    expect(progressText(meta(s0, 'embutido'), past)).toBe('1 serving that week · your limit, less than 2');
  });

  it('una meta con datos de antes sigue contando aunque la semana empiece de cero', () => {
    const s0 = st({ sel: { ej: [], al: ['fruta'], ha: [] } });
    const empty = { fruta: [null, null, null, null, null, null, null] };
    const monday = { from: 0, to: 0, current: true, share: 1 };
    expect(areaScore(s0, 'al', empty, monday)).toBe(0); // la marcas tú: cuenta desde el primer día
    const known = knownBefore(s0, '2026-11-02', { fruta: { '2026-10-30': 3 } }, {});
    expect(known).toEqual({ fruta: true });
    expect(areaScore(s0, 'al', empty, monday, known)).toBe(0);
    expect(progressText(meta(s0, 'fruta'), evalMeta(meta(s0, 'fruta'), empty.fruta, monday, true))).toBe('0 of 1 day');
  });

  it('las fechas: «del 2 al 8 de noviembre»', () => {
    expect(rangeText('2026-11-02', '2026-11-08')).toBe('from 2 to 8 November');
    expect(rangeText('2026-10-29', '2026-11-04')).toBe('from 29 October to 4 November');
    expect(rangeText('2026-11-08', '2026-11-08')).toBe('on 8 November');
  });

  const s = st({
    sel: { ej: ['fuerza'], al: ['fruta', 'embutido'], ha: ['paseo'] },
    commit: { day: '2026-10-28', weeks: 8 },
  });
  const full: ValuesById = {
    fuerza: [1, 0, 0, 1, 0, 0, 0],
    fruta: [3, 3, 3, 3, 3, 3, 3],
    embutido: [1, 0, 0, 0, 0, 0, 0],
    paseo: Array(7).fill(null), // empezada después: no cuenta
  };

  it('la semana se cierra el lunes', () => {
    expect(closedWeek(s, '2026-11-01')).toBeNull(); // aún va la primera
    expect(closedWeek(s, '2026-11-02')).toMatchObject({ from: 2, to: 6, current: false });
    expect(closedWeek(s, '2026-11-02')!.days[0]).toBe('2026-10-26');
    expect(closedWeek(s, '2026-11-08')!.days[0]).toBe('2026-10-26');
    expect(closedWeek(s, '2026-11-09')).toMatchObject({ from: 0 });
    expect(closedWeek(s, '2026-11-09')!.days[0]).toBe('2026-11-02');
    // De domingo a sábado: la primera (del miércoles 28 al sábado 31) se cierra el domingo 1
    expect(closedWeek({ ...s, weekStart: 0 }, '2026-11-01')).toMatchObject({ from: 3 });
  });

  it('cumplida: enhorabuena', () => {
    const c = weeklyCongrats(s, '2026-11-09', () => full)!;
    expect(c).toMatchObject({ tone: 'done', week: '2026-11-02', title: 'Week done!' });
    expect(c.body).toBe('You met your 3 targets from 2 to 8 November. Well done.');
  });

  it('empezando un miércoles: cumplida con lo que tocaba de esa parte de la semana', () => {
    const w: ValuesById = {
      fuerza: [1, 1, 0, 1, 0, 0, 0], // los del lunes y el martes no cuentan; 1 sesión de 1
      fruta: [0, 0, 3, 3, 3, 3, 3],
      embutido: [3, 3, 1, 0, 0, 0, 0], // 1 ración, menos de 2
      paseo: Array(7).fill(null),
    };
    const c = weeklyCongrats(s, '2026-11-02', () => w)!;
    expect(c).toMatchObject({ tone: 'done', week: '2026-10-26' });
    expect(c.body).toBe('You met your 3 targets from 28 October to 1 November. Well done. You started mid-week, so only that part counted.');
  });

  it('casi (3 cosas o menos): enhorabuena y ánimo', () => {
    const w = { ...full, fruta: [3, 2, 3, 2, 3, 3, 3], fuerza: [1, 0, 0, 0, 0, 0, 0] };
    expect(weekMisses(s, w).n).toBe(3);
    const c = weeklyCongrats(s, '2026-11-09', () => w)!;
    expect(c.tone).toBe('almost');
    expect(c.body).toBe('You were close from 2 to 8 November: strength (1 session) and fruit (2 days). Failing is just part of the journey: keep going.');
  });

  it('más: ánimo, sin enhorabuena', () => {
    const w = { ...full, fruta: [1, 1, 1, 1, 3, 3, 3], embutido: [1, 1, 1, 0, 0, 0, 0] };
    const c = weeklyCongrats(s, '2026-11-09', () => w)!;
    expect(c.tone).toBe('go');
    expect(c.body).toBe("From 2 to 8 November you didn't reach your targets, but let's go for them this time!");
    expect(weekMisses(s, w).misses.find((x) => x.id === 'embutido')!.text).toBe('processed meat (2 servings too many)');
  });

  it('al tocarla: lo propuesto y lo hecho, área por área', () => {
    const w = { ...full, fruta: [1, 1, 1, 1, 3, 3, 3], embutido: [1, 1, 1, 0, 0, 0, 0] };
    const r = weekReview(s, w, closedWeek(s, '2026-11-09')!);
    expect(r.map((a) => a.area)).toEqual(['ej', 'al', 'ha']);
    const al = r.find((a) => a.area === 'al')!;
    expect(al.rows.map((x) => x.id)).toEqual(['fruta', 'embutido']);
    expect(al.rows[0].done).toBe('3 of 7 days');
    expect(al.score).toBeGreaterThan(0);
    expect(al.score).toBeLessThan(1);
    // El paseo no tuvo datos esa semana: sale, pero no cuenta en el % de Hábitos
    const ha = r.find((a) => a.area === 'ha')!;
    expect(ha.score).toBeNull();
    expect(ha.rows[0].done).toBe('No data that week');
    expect(reviewClosing('go')).toMatch(/plenty of room/);
  });

  it('en la primera semana, la meta a la semana va en proporción', () => {
    const w: ValuesById = { fuerza: [0, 0, 0, 1, 0, 0, 0], fruta: Array(7).fill(null), embutido: Array(7).fill(null), paseo: Array(7).fill(null) };
    const r = weekReview(s, w, closedWeek(s, '2026-11-02')!);
    const ej = r.find((a) => a.area === 'ej')!;
    expect(ej.rows[0].done).toMatch(/^1 of /);
    expect(ej.score).toBe(1);
  });

  it('sin compromiso, antes de acabar la semana o ya cerrada: nada', () => {
    expect(weeklyCongrats({ ...s, commit: null }, '2026-11-09', () => full)).toBeNull();
    expect(weeklyCongrats(s, '2026-11-01', () => full)).toBeNull();
    expect(weeklyCongrats({ ...s, closedWeek: '2026-11-02' }, '2026-11-09', () => full)).toBeNull();
  });

  it('el día con que empieza la semana se guarda (lunes si no hay nada)', () => {
    expect(normalizeState({}).weekStart).toBe(1);
    expect(normalizeState({ weekStart: 0 }).weekStart).toBe(0);
    expect(normalizeState({ weekStart: 'x' }).weekStart).toBe(1);
  });
});

describe('Lo que llega solo y lo guardado', () => {
  it('a tu hora: ±30 min de la mediana de tus noches', () => {
    const starts = [-60, -45, -50, 10, -120].map((value, i) => ({ date: `2026-11-0${i + 1}`, value }));
    expect(bedtimeOnTime(starts)).toEqual({ '2026-11-01': 1, '2026-11-02': 1, '2026-11-03': 1, '2026-11-04': 0, '2026-11-05': 0 });
    expect(bedtimeOnTime(starts.slice(0, 2))).toEqual({});
  });

  it('lo guardado a medias o de otra versión no rompe nada', () => {
    expect(normalizeState(null)).toEqual(emptyState());
    const s = normalizeState({ goals: ['tg', 'nope', 'ldl', 'salud', 'longev'], sel: { ej: ['pasos', 'fruta', 'x'], al: 'mal' } });
    expect(s.goals).toEqual(['ldl', 'tg', 'salud']);
    expect(s.sel).toEqual({ ej: ['pasos'], al: [], ha: [] });
  });

  it('con el reloj, un día corregido a mano manda; los demás, lo del reloj', () => {
    const s: MetasState = { ...emptyState(), sel: { ej: ['pasos'], al: [], ha: [] } };
    const days = ['2026-11-04', '2026-11-05'];
    const auto = { pasos: { '2026-11-04': 6000, '2026-11-05': 9000 } };
    const manual = { pasos: { '2026-11-04': 8000 } };
    expect(valuesFor(s, days, manual, auto).pasos).toEqual([8000, 9000]);
    // A mano: solo lo apuntado
    const byHand: MetasState = { ...s, cfg: { pasos: { tgt: 7500, per: 'day', auto: false } } };
    expect(valuesFor(byHand, days, manual, auto).pasos).toEqual([8000, null]);
  });
});

import { describe, expect, it } from 'vitest';
import {
  AREAS,
  EMPTY_CONTEXT,
  NOTE_MAX,
  OTHER_SYMPTOM,
  PATTERN,
  SYMPTOMS,
  SYMPTOM_GROUPS,
  asksWhere,
  buildSymptomEntries,
  clampStart,
  cleanSymptomEntries,
  draftProblems,
  intensityPhrase,
  isUrgentSymptom,
  packSymptomExtras,
  parseSymptomEntryId,
  sampleSymptoms,
  symptomDayKey,
  symptomEntryId,
  symptomFromRow,
  symptomKey,
  symptomName,
  symptomPatterns,
  symptomToRow,
  symptomsByDay,
  unpackSymptomExtras,
  weekSummary,
  type AreaId,
  type Intensity,
  type SymptomContext,
  type SymptomDraft,
  type SymptomEntry,
  type SymptomId,
} from '@/logic/symptoms';
import { cycleByDay } from '@/logic/dayChart';
import type { CyclePhaseId } from '@/utils/cyclePhase';

// El registro de síntomas (fundador, 2026-11-17). Fechas en hora local, para que no dependan de la zona horaria
const NOW = new Date(2026, 10, 17, 15, 0, 0);
const ago = (days: number, h = 10, m = 0) => {
  const d = new Date(NOW);
  d.setDate(d.getDate() - days);
  d.setHours(h, m, 0, 0);
  return d;
};
const key = (days: number) => symptomDayKey(ago(days));
let seq = 0;
const entry = (symptom: SymptomId, days: number, extra: Partial<SymptomEntry> & { h?: number } = {}): SymptomEntry => {
  const { h, ...rest } = extra;
  const fecha = ago(days, h ?? 10).toISOString();
  return { id: symptomEntryId(`t${++seq}`, symptom), symptom, intensity: 2, fecha, createdAt: fecha, ...rest };
};
const draft = (symptom: SymptomId, extra: Partial<SymptomDraft> = {}): SymptomDraft => ({ symptom, intensity: 2, startedAt: ago(0, 9).toISOString(), where: [], whereText: '', ...extra });
// Noches de `minutes` todos los días del periodo, salvo las cortas
const nights = (short: number[], days = 60, minutes = 440): Record<string, number> =>
  Object.fromEntries(Array.from({ length: days }, (_, i) => [key(i), short.includes(i) ? 320 : minutes]));
const ctx = (c: Partial<SymptomContext>): SymptomContext => ({ ...EMPTY_CONTEXT, ...c });

describe('El catálogo de síntomas', () => {
  it('ids sin repetir, cada uno en un grupo que existe y con zonas que existen', () => {
    const ids = SYMPTOMS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).not.toContain('other');
    const groups = SYMPTOM_GROUPS.map((g) => g.id);
    for (const s of SYMPTOMS) {
      expect(groups, s.id).toContain(s.group);
      for (const a of s.areas ?? []) expect(Object.keys(AREAS), `${s.id}: ${a}`).toContain(a);
      expect(new Set(s.areas ?? []).size, s.id).toBe((s.areas ?? []).length);
    }
    // Ningún grupo vacío, y la lista sigue siendo corta
    for (const g of groups) expect(SYMPTOMS.some((s) => s.group === g), g).toBe(true);
    expect(SYMPTOMS.length).toBeLessThanOrEqual(22);
  });

  it('están los que nombró el fundador: dolor en el pecho, mareo y náuseas', () => {
    for (const id of ['chest_pain', 'dizziness', 'nausea']) expect(SYMPTOMS.map((s) => s.id)).toContain(id);
  });

  it('«¿Dónde?» solo en los que toca (dolores, hormigueo, sarpullido) y en «Otro»', () => {
    expect(SYMPTOMS.filter((s) => asksWhere(s.id)).map((s) => s.id)).toEqual([
      'headache',
      'chest_pain',
      'abdominal_pain',
      'back_pain',
      'joint_muscle_pain',
      'tingling',
      'rash',
    ]);
    expect(asksWhere('other')).toBe(true);
    expect(asksWhere('nausea')).toBe(false);
    // Las zonas, pocas: caben en dos o tres filas de chips
    for (const s of SYMPTOMS) expect((s.areas ?? []).length, s.id).toBeLessThanOrEqual(10);
  });

  it('la línea del 112 solo con dolor en el pecho, falta de aire o desmayo', () => {
    expect([...SYMPTOMS, OTHER_SYMPTOM].filter((s) => isUrgentSymptom(s.id)).map((s) => s.id)).toEqual(['faint', 'chest_pain', 'breathless']);
    expect(isUrgentSymptom('unknown')).toBe(false);
  });
});

describe('Cómo se guarda en metric_readings', () => {
  it('el id lleva el apunte y el síntoma, y se puede leer de vuelta', () => {
    const id = symptomEntryId('1763391600000', 'chest_pain');
    expect(id).toBe('sym:1763391600000:chest_pain');
    expect(parseSymptomEntryId(id)).toEqual({ session: '1763391600000', symptom: 'chest_pain' });
    expect(parseSymptomEntryId('sym:a:b:other')).toEqual({ session: 'a:b', symptom: 'other' });
    expect(parseSymptomEntryId('sym:1:unicorn')).toBeNull();
    expect(parseSymptomEntryId('ctag:1:headache')).toBeNull();
    expect(parseSymptomEntryId('sym::headache')).toBeNull();
  });

  it('lo que no cabe en las columnas va en `unit` como JSON corto y vuelve igual', () => {
    const extras = { where: ['forehead', 'temples'] as AreaId[], whereText: 'behind the left eye', name: 'Toothache', note: 'After lunch.' };
    const unit = packSymptomExtras(extras);
    expect(JSON.parse(unit)).toEqual({ w: ['forehead', 'temples'], wt: 'behind the left eye', o: 'Toothache', n: 'After lunch.' });
    expect(unpackSymptomExtras(unit)).toEqual(extras);
    // Sin nada, un JSON vacío (la columna no admite null)
    expect(packSymptomExtras({})).toBe('{}');
    expect(unpackSymptomExtras('{}')).toEqual({});
  });

  it('un `unit` que no es lo esperado no rompe nada', () => {
    expect(unpackSymptomExtras('tag')).toEqual({});
    expect(unpackSymptomExtras(null)).toEqual({});
    expect(unpackSymptomExtras('[1,2]')).toEqual({});
    expect(unpackSymptomExtras(JSON.stringify({ w: ['forehead', 'moon', 3], wt: 7, n: 'x'.repeat(NOTE_MAX + 50) }))).toEqual({ where: ['forehead'], note: 'x'.repeat(NOTE_MAX) });
  });

  it('de apunte a fila y de fila a apunte', () => {
    const e: SymptomEntry = {
      id: symptomEntryId('s1', 'headache'),
      symptom: 'headache',
      intensity: 3,
      fecha: ago(1).toISOString(),
      createdAt: NOW.toISOString(),
      where: ['one_side'],
      note: 'Long day.',
    };
    const row = symptomToRow(e);
    expect(row).toEqual({ id: 'sym:s1:headache', value: 3, unit: '{"w":["one_side"],"n":"Long day."}', measured_at: e.fecha, created_at: e.createdAt });
    expect(symptomFromRow(row)).toEqual(e);
    // La intensidad llega como texto o fuera de 1-3: se queda dentro
    expect(symptomFromRow({ ...row, value: '9' })?.intensity).toBe(3);
    expect(symptomFromRow({ ...row, value: null })?.intensity).toBe(1);
    // Una fila de otro tipo (o de un síntoma que esta versión no conoce) no sale
    expect(symptomFromRow({ ...row, id: 'sym:s1:unicorn' })).toBeNull();
  });

  it('lo guardado sale limpio: solo síntomas conocidos, del más reciente al más antiguo', () => {
    const a = entry('headache', 3);
    const b = entry('nausea', 1);
    const out = cleanSymptomEntries([a, { id: 'sym:x:unicorn', fecha: a.fecha }, { id: 'kegel-1', fecha: a.fecha }, null, { ...b, intensity: 7 }, { id: symptomEntryId('z', 'cough'), fecha: 'nope' }]);
    expect(out.map((e) => e.id)).toEqual([b.id, a.id]);
    expect(out[0].intensity).toBe(3);
    expect(cleanSymptomEntries(undefined)).toEqual([]);
  });
});

describe('El formulario', () => {
  it('sin nada marcado no se puede guardar', () => {
    expect(draftProblems([])).toEqual(['empty']);
    expect(buildSymptomEntries([], 'note', NOW)).toEqual([]);
  });

  it('cada síntoma marcado necesita su intensidad, y «Otro», su nombre', () => {
    expect(draftProblems([draft('headache'), draft('nausea', { intensity: undefined })])).toEqual(['intensity']);
    expect(draftProblems([draft('other', { name: '  ' })])).toEqual(['name']);
    expect(draftProblems([draft('other', { name: 'Toothache', intensity: undefined })])).toEqual(['intensity']);
    expect(draftProblems([draft('headache'), draft('other', { name: 'Toothache' })])).toEqual([]);
  });

  it('un síntoma no puede empezar después de ahora (con unos minutos de margen por los relojes)', () => {
    const later = new Date(NOW.getTime() + 2 * 3600 * 1000);
    expect(draftProblems([draft('headache', { startedAt: later.toISOString() })], NOW)).toEqual(['future']);
    expect(draftProblems([draft('headache', { startedAt: new Date(NOW.getTime() + 60 * 1000).toISOString() })], NOW)).toEqual([]);
    expect(draftProblems([draft('headache', { startedAt: 'nope' })], NOW)).toEqual(['future']);
    expect(buildSymptomEntries([draft('headache', { startedAt: later.toISOString() })], '', NOW)).toEqual([]);
    // Lo elegido en el selector, como mucho, este momento
    expect(clampStart(later, NOW).getTime()).toBe(NOW.getTime());
    expect(clampStart(ago(1), NOW)).toEqual(ago(1));
  });

  it('un apunte por síntoma, del mismo apunte, cada uno con su hora y con la nota', () => {
    const out = buildSymptomEntries(
      [draft('headache', { intensity: 3, where: ['forehead', 'forehead', 'knee'], whereText: '  behind the eye  ', startedAt: ago(1, 22, 30).toISOString() }), draft('nausea', { whereText: 'tummy', name: 'x' })],
      '  After a long drive.  ',
      NOW,
    );
    expect(out).toHaveLength(2);
    const session = String(NOW.getTime());
    expect(out[0]).toEqual({
      id: `sym:${session}:headache`,
      symptom: 'headache',
      intensity: 3,
      fecha: ago(1, 22, 30).toISOString(),
      createdAt: NOW.toISOString(),
      // Solo las zonas de ese síntoma, sin repetir
      where: ['forehead'],
      whereText: 'behind the eye',
      note: 'After a long drive.',
    });
    // Las náuseas no llevan «dónde» ni nombre
    expect(out[1]).toEqual({ id: `sym:${session}:nausea`, symptom: 'nausea', intensity: 2, fecha: ago(0, 9).toISOString(), createdAt: NOW.toISOString(), note: 'After a long drive.' });
  });

  it('«Otro» guarda su nombre y dónde con sus palabras; los textos largos se cortan', () => {
    const [e] = buildSymptomEntries([draft('other', { name: ' Toothache ', whereText: 'lower left', where: ['forehead'] })], 'n'.repeat(NOTE_MAX + 10), NOW);
    expect(e.name).toBe('Toothache');
    expect(e.whereText).toBe('lower left');
    expect(e.where).toBeUndefined();
    expect(e.note).toHaveLength(NOTE_MAX);
    expect(symptomName(e)).toEqual({ text: 'Toothache', translate: false });
    expect(symptomName({ symptom: 'headache' })).toEqual({ text: 'Headache', translate: true });
    expect(symptomName({ symptom: 'other' })).toEqual({ text: 'Other', translate: true });
  });
});

describe('El historial por días', () => {
  it('del día más reciente al más antiguo y, dentro del día, la hora más reciente arriba', () => {
    const a = entry('headache', 0, { h: 8 });
    const b = entry('nausea', 0, { h: 13 });
    const c = entry('cough', 2, { h: 9 });
    const days = symptomsByDay([c, a, b]);
    expect(days.map((d) => d.day)).toEqual([key(0), key(2)]);
    expect(days[0].items.map((i) => i.entry.id)).toEqual([b.id, a.id]);
    expect(days[1].items.map((i) => i.entry.id)).toEqual([c.id]);
  });

  it('la nota de un apunte con varios síntomas sale una sola vez', () => {
    const out = buildSymptomEntries([draft('headache'), draft('nausea'), draft('fatigue', { startedAt: ago(1, 20).toISOString() })], 'Bad night.', NOW);
    const items = symptomsByDay(out).flatMap((d) => d.items);
    expect(items).toHaveLength(3);
    expect(items.filter((i) => i.showNote)).toHaveLength(1);
    expect(items[0].showNote).toBe(true);
    // Otro apunte con su propia nota también la enseña
    const more = buildSymptomEntries([draft('cough')], 'Since Monday.', new Date(NOW.getTime() + 1000));
    expect(symptomsByDay([...out, ...more]).flatMap((d) => d.items).filter((i) => i.showNote)).toHaveLength(2);
  });

  it('las palabras de la intensidad', () => {
    expect([1, 2, 3].map(intensityPhrase)).toEqual(['Mild intensity', 'Moderate intensity', 'Strong intensity']);
    expect(intensityPhrase(9)).toBe('Mild intensity');
  });
});

describe('Patrones: con qué coincide cada síntoma', () => {
  it('«4 de 5 días tras dormir menos de 6 h», con lo habitual del periodo al lado', () => {
    const short = [1, 5, 9, 14, 20, 33];
    const entries = [1, 5, 9, 14, 3].map((d) => entry('headache', d));
    const [p, ...rest] = symptomPatterns(entries, ctx({ sleepMinutes: nights(short) }), NOW);
    expect(rest).toEqual([]);
    expect(p).toEqual({ key: 'headache', symptom: 'headache', kind: 'short_night', hits: 4, total: 5, baseHits: 6, baseTotal: 60 });
  });

  it('justo 6 h no es una noche corta', () => {
    const sleepMinutes = { ...nights([]), [key(1)]: 360, [key(5)]: 360, [key(9)]: 360, [key(14)]: 359 };
    expect(symptomPatterns([1, 5, 9, 14].map((d) => entry('headache', d)), ctx({ sleepMinutes }), NOW)).toEqual([]);
  });

  it('con pocos apuntes no se dice nada', () => {
    const short = [1, 5, 9];
    // Tres días, los tres tras noche corta: aún no son bastantes
    expect(symptomPatterns([1, 5, 9].map((d) => entry('headache', d)), ctx({ sleepMinutes: nights(short) }), NOW)).toEqual([]);
    // Cuatro días pero solo dos coinciden
    expect(symptomPatterns([1, 5, 2, 3].map((d) => entry('headache', d)), ctx({ sleepMinutes: nights(short) }), NOW)).toEqual([]);
    // Varios apuntes el mismo día cuentan como un día
    expect(symptomPatterns([1, 1, 1, 5, 9].map((d) => entry('headache', d)), ctx({ sleepMinutes: nights(short) }), NOW)).toEqual([]);
  });

  it('si casi todas las noches son cortas, coincidir con una no dice nada', () => {
    const allShort = Object.fromEntries(Array.from({ length: 60 }, (_, i) => [key(i), i % 10 === 0 ? 430 : 330]));
    const entries = [1, 2, 3, 4, 6].map((d) => entry('headache', d));
    expect(symptomPatterns(entries, ctx({ sleepMinutes: allShort }), NOW)).toEqual([]);
  });

  it('sin saber qué es lo habitual (pocas noches con dato) tampoco', () => {
    const few = Object.fromEntries([1, 5, 9, 14, 3, 4].map((d) => [key(d), d === 3 || d === 4 ? 440 : 320]));
    expect(symptomPatterns([1, 5, 9, 14].map((d) => entry('headache', d)), ctx({ sleepMinutes: few }), NOW)).toEqual([]);
    expect(Object.keys(few).length).toBeLessThan(PATTERN.minBaseDays);
  });

  it('sin horas del reloj, lo que dijo en el check-in de la mañana', () => {
    const sleepRating = Object.fromEntries(Array.from({ length: 40 }, (_, i) => [key(i), [2, 6, 11, 17].includes(i) ? (i === 6 ? 1 : 2) : 4]));
    const entries = [2, 6, 11, 17, 20].map((d) => entry('fatigue', d));
    expect(symptomPatterns(entries, ctx({ sleepRating }), NOW)).toEqual([{ key: 'fatigue', symptom: 'fatigue', kind: 'bad_sleep', hits: 4, total: 5, baseHits: 4, baseTotal: 40 }]);
    // Con las dos cosas, mandan las horas
    const both = symptomPatterns(entries, ctx({ sleepRating, sleepMinutes: nights([2, 6, 11, 17]) }), NOW);
    expect(both.map((p) => p.kind)).toEqual(['short_night']);
  });

  it('de madrugada cuenta la noche anterior, no la que aún no ha pasado', () => {
    // A las 2:00 del día 5 → la noche que acabó el día 6 (hace 6 días)
    const entries = [entry('insomnia', 5, { h: 2 }), entry('insomnia', 9, { h: 2 }), entry('insomnia', 14, { h: 3 }), entry('insomnia', 20, { h: 1 })];
    const [p] = symptomPatterns(entries, ctx({ sleepMinutes: nights([6, 10, 15, 21]) }), NOW);
    expect(p).toMatchObject({ symptom: 'insomnia', kind: 'short_night', hits: 4, total: 4 });
    expect(symptomPatterns(entries, ctx({ sleepMinutes: nights([5, 9, 14, 20]) }), NOW)).toEqual([]);
  });

  it('por fase del ciclo, solo cuando es claramente más de lo que toca por reparto', () => {
    // Ciclos de 28 días: los días 1 a 5, regla; del 15 en adelante, segunda mitad
    const phaseOf = (i: number): CyclePhaseId => {
      const day = ((70 - i) % 28) + 1;
      return day <= 5 ? 'menstrual' : day < 13 ? 'follicular' : day <= 15 ? 'ovulation' : 'luteal';
    };
    const phases = Object.fromEntries(Array.from({ length: 60 }, (_, i) => [key(i), phaseOf(i)]));
    const period = Array.from({ length: 60 }, (_, i) => i).filter((i) => phaseOf(i) === 'menstrual');
    const luteal = Array.from({ length: 60 }, (_, i) => i).filter((i) => phaseOf(i) === 'luteal');
    const follicular = Array.from({ length: 60 }, (_, i) => i).filter((i) => phaseOf(i) === 'follicular');

    const entries = [period[0], period[1], period[5], period[6], follicular[0]].map((d) => entry('abdominal_pain', d));
    const [p, ...rest] = symptomPatterns(entries, ctx({ phases }), NOW);
    expect(rest).toEqual([]);
    expect(p).toMatchObject({ symptom: 'abdominal_pain', kind: 'cycle_phase', phase: 'menstrual', hits: 4, total: 5, baseHits: period.length, baseTotal: 60 });

    // La segunda mitad son casi la mitad de los días: 3 de 5 ahí no es un patrón; 5 de 5, sí
    const some = [luteal[0], luteal[3], luteal[8], follicular[1], period[2]].map((d) => entry('low_mood', d));
    expect(symptomPatterns(some, ctx({ phases }), NOW)).toEqual([]);
    const most = [luteal[0], luteal[3], luteal[8], luteal[14], luteal[20]].map((d) => entry('low_mood', d));
    expect(symptomPatterns(most, ctx({ phases }), NOW)).toMatchObject([{ symptom: 'low_mood', kind: 'cycle_phase', phase: 'luteal', hits: 5, total: 5 }]);
  });

  it('un síntoma puede tener una observación de sueño y otra del ciclo; «Otro» se agrupa por su nombre', () => {
    const phases = Object.fromEntries(Array.from({ length: 60 }, (_, i) => [key(i), (i % 28 < 5 ? 'menstrual' : 'luteal') as CyclePhaseId]));
    const days = [0, 1, 28, 29];
    const entries = days.map((d, i) => entry('other', d, { name: i % 2 ? 'toothache' : 'Toothache ' }));
    const out = symptomPatterns(entries, ctx({ phases, sleepMinutes: nights(days) }), NOW);
    expect(out.map((p) => p.kind).sort()).toEqual(['cycle_phase', 'short_night']);
    expect(new Set(out.map((p) => p.key))).toEqual(new Set(['other:toothache']));
    expect(out[0].name).toBe('Toothache');
    // Otro nombre es otro síntoma, y sin nombre no se agrupa
    expect(symptomKey({ symptom: 'other', name: 'Earache' })).toBe('other:earache');
    expect(symptomPatterns(days.map((d) => entry('other', d)), ctx({ sleepMinutes: nights(days) }), NOW)).toEqual([]);
  });

  it('solo mira los últimos 90 días', () => {
    const old = [100, 105, 110, 115];
    const sleepMinutes = Object.fromEntries(Array.from({ length: 130 }, (_, i) => [key(i), old.includes(i) ? 320 : 440]));
    expect(symptomPatterns(old.map((d) => entry('headache', d)), ctx({ sleepMinutes }), NOW)).toEqual([]);
  });
});

describe('Resumen de la semana', () => {
  it('días con síntomas, comparados con los 7 anteriores, y los más frecuentes', () => {
    const entries = [
      entry('headache', 0),
      entry('headache', 0, { h: 18 }),
      entry('headache', 2),
      entry('headache', 6),
      entry('fatigue', 2),
      entry('fatigue', 3),
      entry('nausea', 3),
      entry('cough', 6),
      entry('dizziness', 6),
      // La semana anterior
      entry('headache', 7),
      entry('cough', 9),
      entry('cough', 9, { h: 20 }),
      // Más antiguo: no cuenta en ninguna de las dos
      entry('fever', 20),
    ];
    const w = weekSummary(entries, EMPTY_CONTEXT, NOW);
    expect(w.from).toBe(key(6));
    expect(w.to).toBe(key(0));
    expect(w.days).toBe(4);
    expect(w.prevDays).toBe(2);
    // Por días distintos; a igualdad, el orden del catálogo (y como mucho tres)
    expect(w.top).toEqual([
      { key: 'headache', symptom: 'headache', days: 3 },
      { key: 'fatigue', symptom: 'fatigue', days: 2 },
      { key: 'dizziness', symptom: 'dizziness', days: 1 },
    ]);
    expect(w.sleep).toBeNull();
    expect(w.phase).toBeNull();
  });

  it('la primera semana no se compara con nada', () => {
    const w = weekSummary([entry('headache', 1)], EMPTY_CONTEXT, NOW);
    expect(w.days).toBe(1);
    expect(w.prevDays).toBeNull();
    // Con algo apuntado antes pero no en los 7 días anteriores: 0
    expect(weekSummary([entry('headache', 1), entry('headache', 30)], EMPTY_CONTEXT, NOW).prevDays).toBe(0);
  });

  it('una semana sin síntomas', () => {
    const w = weekSummary([entry('headache', 8)], EMPTY_CONTEXT, NOW);
    expect(w).toMatchObject({ days: 0, prevDays: 1, top: [], sleep: null, phase: null });
  });

  it('cuántos días con síntomas llegaron tras una noche corta (al menos 2 y la mitad)', () => {
    const entries = [entry('headache', 0), entry('fatigue', 2), entry('nausea', 4), entry('cough', 5)];
    expect(weekSummary(entries, ctx({ sleepMinutes: nights([0, 4]) }), NOW).sleep).toEqual({ kind: 'short_night', hits: 2, total: 4 });
    expect(weekSummary(entries, ctx({ sleepMinutes: nights([0]) }), NOW).sleep).toBeNull();
    expect(weekSummary(entries.slice(0, 1), ctx({ sleepMinutes: nights([0]) }), NOW).sleep).toBeNull();
    // Sin horas, con lo dicho en el check-in
    const sleepRating = { [key(0)]: 2, [key(2)]: 1, [key(4)]: 4 };
    expect(weekSummary(entries, ctx({ sleepRating }), NOW).sleep).toEqual({ kind: 'bad_sleep', hits: 2, total: 3 });
  });

  it('en qué fase del ciclo cayeron más', () => {
    const phases: Record<string, CyclePhaseId> = { [key(0)]: 'follicular', [key(1)]: 'follicular', [key(2)]: 'menstrual', [key(3)]: 'menstrual', [key(4)]: 'menstrual' };
    const entries = [entry('abdominal_pain', 2), entry('abdominal_pain', 3), entry('headache', 4), entry('fatigue', 0)];
    expect(weekSummary(entries, ctx({ phases }), NOW).phase).toEqual({ phase: 'menstrual', hits: 3, total: 4 });
    expect(weekSummary(entries.slice(3), ctx({ phases }), NOW).phase).toBeNull();
  });
});

describe('El ejemplo de la demo', () => {
  const sample = sampleSymptoms(NOW);

  it('síntomas del catálogo, ninguno en el futuro, del más reciente al más antiguo', () => {
    expect(sample.entries.length).toBeGreaterThan(8);
    for (const e of sample.entries) {
      expect(parseSymptomEntryId(e.id)?.symptom, e.id).toBe(e.symptom);
      expect(new Date(e.fecha).getTime(), e.id).toBeLessThanOrEqual(NOW.getTime());
      expect([1, 2, 3] as Intensity[]).toContain(e.intensity);
    }
    expect(sample.entries.map((e) => e.fecha)).toEqual([...sample.entries.map((e) => e.fecha)].sort().reverse());
    // De madrugada tampoco se sale del día
    const early = sampleSymptoms(new Date(2026, 10, 17, 0, 20, 0));
    for (const e of early.entries) expect(new Date(e.fecha).getTime()).toBeLessThanOrEqual(new Date(2026, 10, 17, 0, 20, 0).getTime());
    expect(Object.keys(early.sleepMinutes)).toContain('2026-11-17');
  });

  it('enseña un patrón de sueño y, con el ciclo de ejemplo de la app, uno del ciclo', () => {
    const keys = Array.from({ length: PATTERN.windowDays }, (_, i) => key(PATTERN.windowDays - 1 - i));
    const phases: Record<string, CyclePhaseId> = {};
    cycleByDay(keys, [], null, true).forEach((d, i) => {
      if (d) phases[keys[i]] = d.phase;
    });
    const patterns = symptomPatterns(sample.entries, { sleepMinutes: sample.sleepMinutes, sleepRating: {}, phases }, NOW);
    expect(patterns).toMatchObject([
      { symptom: 'abdominal_pain', kind: 'cycle_phase', phase: 'menstrual', hits: 4, total: 4 },
      { symptom: 'headache', kind: 'short_night', hits: 4, total: 5 },
    ]);
    // Sin ciclo (hombres), solo el del sueño
    expect(symptomPatterns(sample.entries, { sleepMinutes: sample.sleepMinutes, sleepRating: {}, phases: {} }, NOW).map((p) => p.kind)).toEqual(['short_night']);
  });

  it('y un resumen de la semana con algo que contar', () => {
    const w = weekSummary(sample.entries, { sleepMinutes: sample.sleepMinutes, sleepRating: {}, phases: {} }, NOW);
    expect(w.days).toBe(4);
    expect(w.prevDays).toBe(3);
    expect(w.top[0]).toEqual({ key: 'headache', symptom: 'headache', days: 2 });
    expect(w.sleep).toEqual({ kind: 'short_night', hits: 2, total: 4 });
  });
});

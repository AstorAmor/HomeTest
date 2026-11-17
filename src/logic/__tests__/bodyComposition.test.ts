import { describe, expect, it } from 'vitest';
import {
  fatSplit,
  measureFatCandidates,
  navyBodyFat,
  navyKinds,
  navySites,
  pickBodyFat,
  SAMPLE_HEIGHT_CM,
  SAMPLE_PERSON,
  tapeFatEstimate,
  tapeFatSeries,
  withSampleBasics,
  type BodyFatCandidate,
} from '@/logic/bodyComposition';
import { jp3BodyFat } from '@/logic/bodyMeasures';

// Composición corporal con las medidas (2026-11-16): la grasa estimada con la cinta (Marina de EE. UU.), qué
// cifra de grasa manda (báscula, pliegues o cinta) y el paso a kilos
describe('grasa estimada con la cinta (Marina de EE. UU., Hodgdon y Beckett)', () => {
  it('hombre: cintura − cuello y altura, con las cifras hechas a mano', () => {
    // 178 cm, cuello 38, cintura 86: log10(48) = 1,68124 y log10(178) = 2,25042
    // densidad = 1,0324 − 0,19077 × 1,68124 + 0,15456 × 2,25042 = 1,05949 → 495 / 1,05949 − 450 = 17,2
    expect(navyBodyFat('male', 178, { neck: 38, waist: 86 })).toBe(17.2);
    // 180 cm, cuello 40, cintura 90: log10(50) = 1,69897 y log10(180) = 2,25527
    // densidad = 1,0324 − 0,32411 + 0,34857 = 1,05686 → 495 / 1,05686 − 450 = 18,4
    expect(navyBodyFat('male', 180, { neck: 40, waist: 90 })).toBe(18.4);
    // La cadera no cuenta en los hombres
    expect(navyBodyFat('male', 178, { neck: 38, waist: 86, hip: 110 })).toBe(17.2);
  });

  it('mujer: cintura + cadera − cuello y altura, con las cifras hechas a mano', () => {
    // 165 cm, cuello 32, cintura 72, cadera 98: log10(138) = 2,13988 y log10(165) = 2,21748
    // densidad = 1,29579 − 0,35004 × 2,13988 + 0,22100 × 2,21748 = 1,03681 → 495 / 1,03681 − 450 = 27,4
    expect(navyBodyFat('female', 165, { neck: 32, waist: 72, hip: 98 })).toBe(27.4);
    // 170 cm, cuello 34, cintura 80, cadera 100: log10(146) = 2,16435 y log10(170) = 2,23045
    // densidad = 1,29579 − 0,75761 + 0,49293 = 1,03111 → 495 / 1,03111 − 450 = 30,1
    expect(navyBodyFat('female', 170, { neck: 34, waist: 80, hip: 100 })).toBe(30.1);
  });

  it('sin algún dato o con algo imposible, nada', () => {
    expect(navyBodyFat('male', 178, { neck: 38 })).toBeNull();
    expect(navyBodyFat('male', 178, { waist: 86 })).toBeNull();
    expect(navyBodyFat('male', 178, { neck: 38, waist: null })).toBeNull();
    // La cintura no pasa del cuello
    expect(navyBodyFat('male', 178, { neck: 45, waist: 45 })).toBeNull();
    expect(navyBodyFat('female', 165, { neck: 45, waist: 40, hip: 98 })).toBeNull();
    // Altura fuera de 100-250 cm o sin altura
    expect(navyBodyFat('male', 99, { neck: 38, waist: 86 })).toBeNull();
    expect(navyBodyFat('male', 251, { neck: 38, waist: 86 })).toBeNull();
    expect(navyBodyFat('male', undefined, { neck: 38, waist: 86 })).toBeNull();
    expect(navyBodyFat('male', null, { neck: 38, waist: 86 })).toBeNull();
    // Mujer sin cadera
    expect(navyBodyFat('female', 165, { neck: 32, waist: 72 })).toBeNull();
    // Solo con sexo masculino o femenino
    expect(navyBodyFat('other', 178, { neck: 38, waist: 86 })).toBeNull();
    expect(navyBodyFat(undefined, 178, { neck: 38, waist: 86 })).toBeNull();
    // Resultado fuera de 2-60 %: 180 cm, cuello 40 y cintura 70 da 0,3 %; 170 cm, cuello 30 y cintura 200, 70 %
    expect(navyBodyFat('male', 180, { neck: 40, waist: 70 })).toBeNull();
    expect(navyBodyFat('male', 170, { neck: 30, waist: 200 })).toBeNull();
  });

  it('los sitios de cinta que usa cada sexo', () => {
    expect(navySites('male')).toEqual(['neck', 'waist']);
    expect(navySites('female')).toEqual(['neck', 'waist', 'hip']);
    expect(navyKinds('female')).toEqual(['tape_neck', 'tape_waist', 'tape_hip']);
  });

  it('con las medidas de una vez: la estimación, lo que falta o que hace falta el perfil', () => {
    expect(tapeFatEstimate('male', 178, { neck: 38, waist: 86, arm: 32 })).toEqual({ kind: 'ok', pct: 17.2 });
    expect(tapeFatEstimate('female', 165, { neck: 32, waist: 72, hip: 98 })).toEqual({ kind: 'ok', pct: 27.4 });
    expect(tapeFatEstimate('male', 178, { arm: 32 })).toEqual({ kind: 'missing', sites: ['neck', 'waist'] });
    expect(tapeFatEstimate('female', 165, { neck: 32, waist: 72 })).toEqual({ kind: 'missing', sites: ['hip'] });
    // Sin sexo masculino/femenino o sin altura: antes que pedir más medidas
    expect(tapeFatEstimate('other', 178, { neck: 38, waist: 86 })).toEqual({ kind: 'needs_profile' });
    expect(tapeFatEstimate(undefined, 178, {})).toEqual({ kind: 'needs_profile' });
    expect(tapeFatEstimate('male', undefined, { neck: 38, waist: 86 })).toEqual({ kind: 'needs_profile' });
    // Todo relleno, pero la fórmula no da una cifra posible
    expect(tapeFatEstimate('male', 178, { neck: 45, waist: 44 })).toEqual({ kind: 'out_of_range' });
  });
});

describe('la evolución de la grasa estimada con la cinta', () => {
  const day = (d: string, h = '08:30') => `2026-${d}T${h}:00.000Z`;
  const readings = {
    tape_neck: [
      { valor: 38, fecha: day('11-10') },
      { valor: 39, fecha: day('08-20') },
    ],
    tape_waist: [
      { valor: 86, fecha: day('11-10') },
      { valor: 88, fecha: day('10-01') }, // ese día no se midió el cuello
      { valor: 90, fecha: day('08-20', '19:00') }, // mismo día que el cuello, a otra hora
    ],
    tape_hip: [{ valor: 100, fecha: day('11-10') }],
  };

  it('un punto por día en que se midieron todos los sitios de la fórmula, de lo más antiguo a lo más reciente', () => {
    const s = tapeFatSeries(readings, 'male', 178);
    expect(s).toEqual([
      { fecha: day('08-20'), valor: navyBodyFat('male', 178, { neck: 39, waist: 90 }) },
      { fecha: day('11-10'), valor: 17.2 },
    ]);
    // 178 cm, cuello 39, cintura 90: log10(51) = 1,70757 → densidad 1,05447 → 19,4
    expect(s[0].valor).toBe(19.4);
  });

  it('en mujeres hace falta también la cadera ese día; sin sexo o sin altura, nada', () => {
    expect(tapeFatSeries(readings, 'female', 165)).toEqual([{ fecha: day('11-10'), valor: navyBodyFat('female', 165, { neck: 38, waist: 86, hip: 100 }) }]);
    expect(tapeFatSeries(readings, undefined, 178)).toEqual([]);
    expect(tapeFatSeries(readings, 'male', undefined)).toEqual([]);
    expect(tapeFatSeries({}, 'male', 178)).toEqual([]);
  });
});

describe('qué cifra de grasa manda', () => {
  const c = (source: BodyFatCandidate['source'], fecha: string, pct = 20): BodyFatCandidate => ({ source, fecha, pct });

  it('gana la del día más reciente, venga de donde venga', () => {
    const scale = c('scale', '2026-10-01T07:00:00.000Z', 22);
    const folds = c('folds', '2026-11-10T08:30:00.000Z', 15);
    const tape = c('tape', '2026-11-12T08:30:00.000Z', 17);
    expect(pickBodyFat([scale, folds, tape])).toBe(tape);
    expect(pickBodyFat([scale, folds])).toBe(folds);
    // Una pesada posterior con la grasa de la báscula sustituye a la estimación
    const newer = c('scale', '2026-11-14T07:00:00.000Z', 21);
    expect(pickBodyFat([newer, folds, tape])).toBe(newer);
    expect(pickBodyFat([tape, folds, newer])).toBe(newer);
  });

  it('el mismo día: la báscula antes que los pliegues, y los pliegues antes que la cinta, aunque se apunten antes', () => {
    const scale = c('scale', '2026-11-12T07:00:00.000Z');
    const folds = c('folds', '2026-11-12T08:30:00.000Z');
    const tape = c('tape', '2026-11-12T21:00:00.000Z');
    expect(pickBodyFat([tape, folds, scale])).toBe(scale);
    expect(pickBodyFat([scale, folds, tape])).toBe(scale);
    expect(pickBodyFat([tape, folds])).toBe(folds);
    expect(pickBodyFat([tape])).toBe(tape);
  });

  it('misma fuente y mismo día: la de más tarde; sin candidatos, nada', () => {
    const early = c('scale', '2026-11-12T07:00:00.000Z', 21);
    const late = c('scale', '2026-11-12T20:00:00.000Z', 22);
    expect(pickBodyFat([late, early])).toBe(late);
    expect(pickBodyFat([early, late])).toBe(late);
    expect(pickBodyFat([])).toBeNull();
    expect(pickBodyFat([null, undefined])).toBeNull();
    expect(pickBodyFat([null, early])).toBe(early);
  });

  it('de las medidas salen la última estimación de los pliegues y la última de la cinta', () => {
    const day = (d: string) => `2026-${d}T08:30:00.000Z`;
    const readings = {
      tape_neck: [{ valor: 38, fecha: day('11-12') }],
      tape_waist: [{ valor: 86, fecha: day('11-12') }],
      skinfold_chest: [{ valor: 12, fecha: day('11-10') }],
      skinfold_abdominal: [{ valor: 25, fecha: day('11-10') }],
      skinfold_thigh: [{ valor: 18, fecha: day('11-10') }],
    };
    const all = measureFatCandidates(readings, { sex: 'male', age: 30, heightCm: 178 });
    expect(all).toEqual([
      { source: 'folds', fecha: day('11-10'), pct: jp3BodyFat('male', 30, 55) },
      { source: 'tape', fecha: day('11-12'), pct: 17.2 },
    ]);
    expect(pickBodyFat(all)?.source).toBe('tape');
    // Sin edad no hay pliegues; sin altura no hay cinta; sin sexo, ninguna
    expect(measureFatCandidates(readings, { sex: 'male', age: null, heightCm: 178 }).map((x) => x.source)).toEqual(['tape']);
    expect(measureFatCandidates(readings, { sex: 'male', age: 30 }).map((x) => x.source)).toEqual(['folds']);
    expect(measureFatCandidates(readings, { age: 30, heightCm: 178 })).toEqual([]);
  });
});

describe('del % de grasa a kilos', () => {
  it('grasa y masa sin grasa con un decimal, y suman el peso', () => {
    // 80 kg con un 17,2 %: 13,76 → 13,8 kg de grasa y 66,2 kg sin grasa
    expect(fatSplit(80, 17.2)).toEqual({ fatKg: 13.8, leanKg: 66.2, fatPct: 17.2, leanPct: 82.8 });
    expect(fatSplit(62.4, 27.4)).toEqual({ fatKg: 17.1, leanKg: 45.3, fatPct: 27.4, leanPct: 72.6 });
    const s = fatSplit(75.3, 14.5)!;
    expect(s.fatKg + s.leanKg).toBeCloseTo(75.3, 5);
  });

  it('sin peso, sin % o con cifras que no cuadran, nada', () => {
    expect(fatSplit(null, 17.2)).toBeNull();
    expect(fatSplit(80, undefined)).toBeNull();
    expect(fatSplit(10, 17.2)).toBeNull();
    expect(fatSplit(80, 0)).toBeNull();
    expect(fatSplit(80, 100)).toBeNull();
  });
});

describe('datos de ejemplo de la demo (altura y persona)', () => {
  const empty = { hasDateOfBirth: false, age: null };

  it('una cuenta real ve exactamente lo que tiene en el perfil', () => {
    expect(withSampleBasics(empty, false)).toEqual({ sex: undefined, age: null, heightCm: undefined, weightKg: undefined, sampleHeight: false, samplePerson: false });
    expect(withSampleBasics({ sex: 'female', hasDateOfBirth: true, age: 41, heightCm: 165, weightKg: 60 }, false)).toEqual({
      sex: 'female',
      age: 41,
      heightCm: 165,
      weightKg: 60,
      sampleHeight: false,
      samplePerson: false,
    });
  });

  it('en la demo, sin altura se usa la de ejemplo y, sin sexo ni fecha de nacimiento, la persona de ejemplo', () => {
    expect(withSampleBasics(empty, true)).toEqual({
      sex: SAMPLE_PERSON.sex,
      age: SAMPLE_PERSON.age,
      heightCm: SAMPLE_HEIGHT_CM,
      weightKg: undefined,
      sampleHeight: true,
      samplePerson: true,
    });
    expect(SAMPLE_HEIGHT_CM).toBe(176);
    expect(SAMPLE_PERSON).toEqual({ sex: 'male', age: 38 });
  });

  it('en la demo, lo que sí está en el perfil no se toca', () => {
    // Con altura: la suya. Con sexo o con fecha de nacimiento: la persona es la del perfil, aunque esté a medias
    expect(withSampleBasics({ sex: 'female', hasDateOfBirth: false, age: null, heightCm: 165 }, true)).toMatchObject({
      sex: 'female',
      age: null,
      heightCm: 165,
      sampleHeight: false,
      samplePerson: false,
    });
    expect(withSampleBasics({ hasDateOfBirth: true, age: 52 }, true)).toMatchObject({ sex: undefined, age: 52, heightCm: 176, sampleHeight: true, samplePerson: false });
  });
});

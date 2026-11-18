import { describe, expect, it } from 'vitest';
import {
  FOLD_SITES,
  fatSeries,
  focusTransform,
  foldEstimate,
  jp3BodyFat,
  jp3Kinds,
  latestComplete,
  MEASURE_SITES,
  parseMeasure,
  seriesChange,
  siteSeries,
  summarize,
  TAPE_SITES,
  waistToHeight,
  whtrSeries,
  withSteps,
} from '@/logic/bodyMeasures';
import { BACK_KINDS, FIGURES, figureSexOf, isTapeMark, SHARP_MAX, sideOf, zoneOf, zoomCap } from '@/logic/bodyFigure';
import { bmi } from '@/logic/weight';

// Medidas con la figura en Peso (2026-11-16): sitios, zoom, resumen y las cuentas (pliegues y cintura / altura)
describe('sitios de medida', () => {
  it('siete de cinta y siete de pinza, cada uno con su kind propio', () => {
    expect(TAPE_SITES.map((s) => s.id)).toEqual(['neck', 'chest', 'waist', 'hip', 'arm', 'thigh', 'calf']);
    expect(FOLD_SITES.map((s) => s.id)).toEqual(['chest', 'triceps', 'biceps', 'subscapular', 'suprailiac', 'abdominal', 'thigh']);
    const kinds = MEASURE_SITES.map((s) => s.kind);
    expect(new Set(kinds).size).toBe(kinds.length);
    // No pisan los kinds que ya hay en metric_readings
    for (const k of ['weight', 'body_fat', 'body_water', 'muscle_mass', 'bone_mass', 'water']) expect(kinds).not.toContain(k);
  });

  it('en las dos figuras, cada sitio tiene su marca dentro del dibujo y un zoom razonable', () => {
    for (const fig of Object.values(FIGURES)) {
      for (const s of MEASURE_SITES) {
        const m = fig.marks[s.kind];
        expect(m, `${fig.sex} ${s.kind}`).toBeDefined();
        expect(isTapeMark(m)).toBe(s.tool === 'tape');
        expect(m.x).toBeGreaterThan(0);
        expect(m.x).toBeLessThan(fig.w);
        expect(m.y).toBeGreaterThan(0);
        expect(m.y).toBeLessThan(fig.h);
        const z = zoneOf(fig, s.kind)!;
        expect(z.zoom).toBeGreaterThanOrEqual(1.5);
        expect(z.zoom).toBeLessThanOrEqual(2.5);
        // La vuelta de la cinta cabe en la imagen
        if (isTapeMark(m)) {
          expect(m.x - m.half).toBeGreaterThan(0);
          expect(m.x + m.half).toBeLessThan(fig.w);
        }
      }
    }
    expect(zoneOf(FIGURES.male, null)).toBeNull();
  });

  it('los pliegues de tríceps y subescapular, en la figura de espaldas; lo demás, de frente', () => {
    expect(sideOf('skinfold_triceps')).toBe('back');
    expect(sideOf('skinfold_subscapular')).toBe('back');
    for (const s of MEASURE_SITES.filter((x) => !BACK_KINDS.includes(x.kind))) expect(sideOf(s.kind)).toBe('front');
    expect(sideOf(null)).toBe('front');
    for (const fig of Object.values(FIGURES)) {
      // Lado derecho de la persona: de frente, a la izquierda de la pantalla; de espaldas, a la derecha
      for (const k of BACK_KINDS) expect(fig.marks[k].x, `${fig.sex} ${k}`).toBeGreaterThan(fig.w / 2);
      for (const k of ['tape_arm', 'tape_thigh', 'tape_calf', 'skinfold_biceps', 'skinfold_thigh']) expect(fig.marks[k].x, `${fig.sex} ${k}`).toBeLessThan(fig.w / 2);
    }
  });

  it('la figura sale del sexo del perfil; sin él, la de hombre', () => {
    expect(figureSexOf('female')).toBe('female');
    expect(figureSexOf('male')).toBe('male');
    expect(figureSexOf(undefined)).toBe('male');
    expect(figureSexOf('other')).toBe('male');
  });

  it('el zoom no pasa del punto en que la imagen se vería borrosa (un píxel suyo, unos 2 de la pantalla)', () => {
    // Móvil de 3x con la figura a 0,33 pt por unidad: hasta 2
    expect(zoomCap(0.33, 3)).toBeCloseTo(SHARP_MAX / 0.99, 5);
    // Figura grande en la web: menos, pero siempre algo de zoom
    expect(zoomCap(0.62, 2)).toBeCloseTo(1.61, 2);
    expect(zoomCap(1, 3)).toBe(1.3);
    expect(zoomCap(0, 3)).toBe(2);
  });

  it('lee lo escrito con coma o punto, con un decimal y dentro de lo posible', () => {
    const waist = TAPE_SITES.find((s) => s.id === 'waist')!;
    expect(parseMeasure(waist, '82,46')).toBe(82.5);
    expect(parseMeasure(waist, ' 90.0 ')).toBe(90);
    expect(parseMeasure(waist, '')).toBeNull();
    expect(parseMeasure(waist, '8')).toBeNull();
    expect(parseMeasure(waist, 'abc')).toBeNull();
    expect(parseMeasure(FOLD_SITES[0], '12')).toBe(12);
    expect(parseMeasure(FOLD_SITES[0], '120')).toBeNull();
  });
});

describe('zoom de la figura', () => {
  const FIG = FIGURES.male;

  it('sin zona, la figura entera', () => {
    expect(focusTransform(null, { w: 140, h: 300 }, FIG)).toEqual({ scale: 1, x: 0, y: 0 });
  });

  it('la zona elegida queda en el centro de la caja', () => {
    const box = { w: 140, h: 300 };
    const zone = zoneOf(FIG, 'tape_arm')!;
    const f = focusTransform(zone, box, FIG);
    // Dónde estaba el punto en la caja (figura ajustada y centrada)
    const s0 = Math.min(box.w / FIG.w, box.h / FIG.h);
    const px = (box.w - FIG.w * s0) / 2 + zone.x * s0;
    const py = (box.h - FIG.h * s0) / 2 + zone.y * s0;
    // Escalar alrededor del centro y desplazar: debe acabar en el centro
    expect(box.w / 2 + f.x + f.scale * (px - box.w / 2)).toBeCloseTo(box.w / 2, 0);
    expect(box.h / 2 + f.y + f.scale * (py - box.h / 2)).toBeCloseTo(box.h / 2, 0);
    expect(f.scale).toBe(zone.zoom);
  });

  it('el centro de la figura no se desplaza', () => {
    expect(focusTransform({ x: FIG.w / 2, y: FIG.h / 2, zoom: 2 }, { w: FIG.w, h: FIG.h }, FIG)).toEqual({ scale: 2, x: 0, y: 0 });
  });
});

describe('lo apuntado', () => {
  const readings = {
    tape_waist: [
      { valor: 86, fecha: '2026-10-01T08:00:00.000Z' },
      { valor: 84.5, fecha: '2026-11-10T08:00:00.000Z' },
    ],
    tape_hip: [{ valor: 99, fecha: '2026-11-10T08:00:00.000Z' }],
    skinfold_chest: [{ valor: 12, fecha: '2026-11-10T08:00:00.000Z' }],
  };

  it('la última de cada sitio y el cambio desde la anterior, en el orden de los sitios', () => {
    const s = summarize(readings, 'tape');
    expect(s.map((x) => x.site.id)).toEqual(['waist', 'hip']);
    expect(s[0].latest.valor).toBe(84.5);
    expect(s[0].delta).toBe(-1.5);
    expect(s[1].previous).toBeNull();
    expect(s[1].delta).toBeNull();
    expect(summarize(readings).length).toBe(3);
  });

  it('la última vez con todos los pliegues de la estimación', () => {
    const r = {
      skinfold_chest: [
        { valor: 12, fecha: 'b' },
        { valor: 14, fecha: 'a' },
      ],
      skinfold_abdominal: [{ valor: 20, fecha: 'a' }],
      skinfold_thigh: [{ valor: 15, fecha: 'a' }],
    };
    expect(latestComplete(r, jp3Kinds('male'))).toEqual({ fecha: 'a', values: { skinfold_chest: 14, skinfold_abdominal: 20, skinfold_thigh: 15 } });
    expect(latestComplete(r, jp3Kinds('female'))).toBeNull();
  });
});

describe('la evolución', () => {
  const day = (d: string) => `2026-${d}T08:30:00.000Z`;
  const readings = {
    tape_waist: [
      { valor: 84.5, fecha: day('11-10') },
      { valor: 88, fecha: day('08-20') },
      { valor: 86, fecha: day('10-01') },
    ],
    skinfold_chest: [
      { valor: 14, fecha: day('08-20') },
      { valor: 12, fecha: day('11-10') },
    ],
    skinfold_abdominal: [
      { valor: 26, fecha: day('08-20') },
      { valor: 25, fecha: day('11-10') },
    ],
    skinfold_thigh: [
      { valor: 20, fecha: day('08-20') },
      { valor: 18, fecha: day('11-10') },
    ],
  };

  it('cada sitio, de lo más antiguo a lo más reciente, con el cambio total y el de cada vez', () => {
    const w = siteSeries(readings, 'tape_waist');
    expect(w.map((p) => p.valor)).toEqual([88, 86, 84.5]);
    expect(seriesChange(w)).toMatchObject({ delta: -3.5, first: { valor: 88 }, last: { valor: 84.5 } });
    expect(withSteps(w).map((p) => [p.valor, p.step])).toEqual([
      [84.5, -1.5],
      [86, -2],
      [88, null],
    ]);
    expect(seriesChange(siteSeries(readings, 'tape_hip'))).toBeNull();
  });

  it('dos veces el mismo día: cuenta la última que se apuntó', () => {
    const r = {
      tape_hip: [
        { valor: 99, fecha: day('11-10'), createdAt: '2026-11-10T09:00:00.000Z' },
        { valor: 98, fecha: day('11-10'), createdAt: '2026-11-10T10:00:00.000Z' },
      ],
    };
    expect(siteSeries(r, 'tape_hip')).toEqual([{ valor: 98, fecha: day('11-10') }]);
  });

  it('la grasa estimada solo en las fechas con los tres pliegues, y cintura / altura con la altura', () => {
    // 14 + 26 + 20 = 60 y 12 + 25 + 18 = 55, a los 30 años
    expect(fatSeries(readings, 'male', 30).map((p) => p.valor)).toEqual([17.9, jp3BodyFat('male', 30, 55)]);
    expect(fatSeries(readings, 'female', 30)).toEqual([]);
    expect(fatSeries(readings, undefined, 30)).toEqual([]);
    expect(whtrSeries(readings, 178).map((p) => p.valor)).toEqual([0.49, 0.48, 0.47]);
    expect(whtrSeries(readings, undefined)).toEqual([]);
  });
});

describe('grasa estimada por pliegues (JP3 + Siri)', () => {
  it('hombre y mujer, con las cifras de las ecuaciones', () => {
    expect(jp3BodyFat('male', 30, 60)).toBe(17.9);
    expect(jp3BodyFat('female', 30, 60)).toBe(24.1);
    expect(jp3BodyFat('male', 40, 45)).toBe(14.7);
    expect(jp3BodyFat('female', 25, 45)).toBe(18.8);
  });

  it('sin edad, menor de 18 o sin suma, nada', () => {
    expect(jp3BodyFat('male', null, 60)).toBeNull();
    expect(jp3BodyFat('male', 16, 60)).toBeNull();
    expect(jp3BodyFat('female', 30, 0)).toBeNull();
  });

  it('usa los tres pliegues de su sexo y dice lo que falta', () => {
    expect(foldEstimate('male', 30, { chest: 20, abdominal: 25, thigh: 15 })).toEqual({ kind: 'ok', pct: 17.9, sum: 60 });
    expect(foldEstimate('female', 30, { triceps: 20, suprailiac: 25, thigh: 15 })).toEqual({ kind: 'ok', pct: 24.1, sum: 60 });
    expect(foldEstimate('female', 30, { triceps: 20, thigh: 15 })).toEqual({ kind: 'missing', sites: ['suprailiac'] });
    expect(foldEstimate('other', 30, { chest: 20, abdominal: 25, thigh: 15 })).toEqual({ kind: 'needs_profile' });
    expect(foldEstimate('male', null, { chest: 20, abdominal: 25, thigh: 15 })).toEqual({ kind: 'needs_profile' });
  });
});

describe('cintura / altura e IMC', () => {
  it('cintura entre altura con dos decimales, solo con datos posibles', () => {
    expect(waistToHeight(84.5, 178)).toBe(0.47);
    expect(waistToHeight(90, 180)).toBe(0.5);
    expect(waistToHeight(84.5, undefined)).toBeNull();
    expect(waistToHeight(84.5, 60)).toBeNull();
    expect(waistToHeight(null, 178)).toBeNull();
  });

  it('el IMC del último peso: kg / m², con un decimal', () => {
    expect(bmi(82.4, 180)).toBe(25.4);
    expect(bmi(58, 165)).toBe(21.3);
    expect(bmi(82.4, null)).toBeNull();
  });
});

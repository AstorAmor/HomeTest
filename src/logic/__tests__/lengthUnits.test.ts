import { describe, expect, it } from 'vitest';
import { FOLD_SITES, parseMeasure, seriesChange, TAPE_SITES, withSteps } from '@/logic/bodyMeasures';
import { convertTyped, isLengthUnit, lengthDelta, lengthFromCm, parseLength, seriesInUnit } from '@/logic/lengthUnits';

// Medidas con cinta en cm o en pulgadas (fundador, 2026-11-16): se guarda siempre en cm con un decimal
const waist = TAPE_SITES.find((s) => s.id === 'waist')!;
const neck = TAPE_SITES.find((s) => s.id === 'neck')!;

describe('cm y pulgadas', () => {
  it('solo cm o in como preferencia', () => {
    expect(isLengthUnit('cm')).toBe(true);
    expect(isLengthUnit('in')).toBe(true);
    expect(isLengthUnit('mm')).toBe(false);
    expect(isLengthUnit(undefined)).toBe(false);
    expect(isLengthUnit(true)).toBe(false);
  });

  it('enseña los cm guardados en la unidad elegida, con un decimal', () => {
    expect(lengthFromCm(84.5, 'cm')).toBe(84.5);
    expect(lengthFromCm(84.5, 'in')).toBe(33.3);
    expect(lengthFromCm(2.54, 'in')).toBe(1);
    expect(lengthFromCm(100, 'in')).toBe(39.4);
  });

  it('lee lo escrito en pulgadas y lo guarda en cm con un decimal', () => {
    expect(parseLength(waist, '32,5', 'in')).toBe(82.6);
    expect(parseLength(waist, ' 33.3 ', 'in')).toBe(84.6);
    expect(parseLength(waist, '', 'in')).toBeNull();
    expect(parseLength(waist, 'abc', 'in')).toBeNull();
  });

  it('comprueba lo posible con los cm del sitio, también en pulgadas', () => {
    // Cintura: de 40 a 200 cm, es decir, de unas 15,7 a 78,7 in
    expect(parseLength(waist, '15.7', 'in')).toBeNull(); // 39,9 cm
    expect(parseLength(waist, '15.8', 'in')).toBe(40.1);
    expect(parseLength(waist, '78.7', 'in')).toBe(199.9);
    expect(parseLength(waist, '78.8', 'in')).toBeNull(); // 200,2 cm
    // 82 escrito en pulgadas serían 208 cm: no cuadra, aunque en cm sí
    expect(parseLength(waist, '82', 'in')).toBeNull();
    expect(parseLength(waist, '82', 'cm')).toBe(82);
  });

  it('en cm, igual que parseMeasure', () => {
    for (const raw of ['82,46', ' 90.0 ', '', '8', 'abc', '200', '200.04', '39.99']) {
      expect(parseLength(waist, raw, 'cm')).toBe(parseMeasure(waist, raw));
    }
  });

  it('ida y vuelta: lo escrito en pulgadas se vuelve a ver igual tras guardarse en cm', () => {
    expect(lengthFromCm(parseLength(waist, '32.5', 'in')!, 'in')).toBe(32.5);
    // Todas las cifras con un decimal de cada sitio de cinta
    for (const site of TAPE_SITES) {
      const from = Math.ceil((site.min / 2.54) * 10);
      const to = Math.floor((site.max / 2.54) * 10);
      for (let tenths = from; tenths <= to; tenths++) {
        const typed = tenths / 10;
        const cm = parseLength(site, String(typed), 'in');
        if (cm == null) continue; // el borde, si al redondear se sale
        expect(Math.round(cm * 10) / 10).toBe(cm);
        expect(lengthFromCm(cm, 'in'), `${site.id} ${typed} in`).toBe(typed);
      }
    }
  });

  it('al cambiar la unidad, lo escrito se pasa a la otra; lo que no es un número, no', () => {
    expect(convertTyped('82,5', 'cm', 'in')).toBe(32.5);
    expect(convertTyped('32.5', 'in', 'cm')).toBe(82.6);
    expect(convertTyped('84', 'cm', 'cm')).toBe(84);
    expect(convertTyped('', 'cm', 'in')).toBeNull();
    expect(convertTyped('.', 'in', 'cm')).toBeNull();
    // Lo que no cuadra se pasa igual (sigue marcado en la otra unidad)
    expect(convertTyped('8', 'cm', 'in')).toBe(3.1);
  });

  it('el cambio, en la unidad elegida y cuadrando con las cifras que se enseñan', () => {
    expect(lengthDelta(84.5, 86, 'cm')).toBe(-1.5);
    // 87,9 cm = 34,6 in y 84,6 cm = 33,3 in
    expect(lengthDelta(84.6, 87.9, 'in')).toBe(-1.3);
    expect(lengthDelta(86, 84.5, 'in')).toBe(0.6); // 33,9 − 33,3
    // Sin «−0» cuando en pulgadas no se nota
    expect(Object.is(lengthDelta(84.5, 84.6, 'in'), 0)).toBe(true);
  });

  it('la evolución en pulgadas: cada punto, el cambio total y el de cada vez', () => {
    const series = [
      { fecha: '2026-08-20', valor: 88 },
      { fecha: '2026-10-01', valor: 86 },
      { fecha: '2026-11-10', valor: 84.5 },
    ];
    expect(seriesInUnit(series, 'cm')).toBe(series);
    const inches = seriesInUnit(series, 'in');
    expect(inches.map((p) => p.valor)).toEqual([34.6, 33.9, 33.3]);
    expect(inches.map((p) => p.fecha)).toEqual(series.map((p) => p.fecha));
    expect(seriesChange(inches)?.delta).toBe(-1.3);
    expect(withSteps(inches).map((p) => p.step)).toEqual([-0.6, -0.7, null]);
    // No toca la serie de partida (sigue en cm)
    expect(series[0].valor).toBe(88);
  });

  it('los pliegues no tienen pulgadas: siguen en mm', () => {
    expect(FOLD_SITES.every((s) => s.unit === 'mm')).toBe(true);
    expect(TAPE_SITES.every((s) => s.unit === 'cm')).toBe(true);
    expect(neck.min).toBe(20);
  });
});

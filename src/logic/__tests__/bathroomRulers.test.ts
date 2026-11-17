import { describe, expect, it } from 'vitest';
import { rulerStopAt, STOOL_BROWN_SCALE, STOOL_OTHER_SCALE, stoolRulerPosition, stripIndexAt } from '@/logic/bathroom';
import { BRISTOL_TYPES, STOOL_COLORS } from '@/types/bathroom';

// Heces (fundador, 2026-11-17): el color en dos reglas (marrones y los demás) y la consistencia en una regla con
// los 7 tipos de Bristol. Se guarda lo mismo que antes, así que lo ya apuntado tiene que caer en su sitio.
describe('reglas de color de las heces', () => {
  it('cada color que ya se guardaba está en una de las dos reglas, y solo en una', () => {
    const all = [...STOOL_BROWN_SCALE, ...STOOL_OTHER_SCALE];
    expect([...all].sort()).toEqual(STOOL_COLORS.map((c) => c.id).sort());
    expect(new Set(all).size).toBe(all.length);
  });

  it('los marrones van de claro a muy oscuro', () => {
    expect(STOOL_BROWN_SCALE).toEqual(['light_brown', 'brown', 'dark_brown', 'black']);
    expect(STOOL_OTHER_SCALE).toEqual(['pale', 'yellow', 'green', 'red']);
  });

  it('un apunte de antes cae en su tramo', () => {
    expect(stoolRulerPosition('brown')).toEqual({ ruler: 'brown', index: 1 });
    expect(stoolRulerPosition('black')).toEqual({ ruler: 'brown', index: 3 });
    expect(stoolRulerPosition('pale')).toEqual({ ruler: 'other', index: 0 });
    expect(stoolRulerPosition('red')).toEqual({ ruler: 'other', index: 3 });
    expect(stoolRulerPosition(undefined)).toBeNull();
    for (const c of STOOL_COLORS) expect(stoolRulerPosition(c.id)).not.toBeNull();
  });

  it('el punto que se toca da el tramo, y fuera de la regla, el del extremo', () => {
    // 4 tramos en 320 px: 80 px cada uno
    expect(stripIndexAt(0, 320, 4)).toBe(0);
    expect(stripIndexAt(79, 320, 4)).toBe(0);
    expect(stripIndexAt(81, 320, 4)).toBe(1);
    expect(stripIndexAt(200, 320, 4)).toBe(2);
    expect(stripIndexAt(319, 320, 4)).toBe(3);
    expect(stripIndexAt(-30, 320, 4)).toBe(0);
    expect(stripIndexAt(900, 320, 4)).toBe(3);
    // Sin medir todavía, el primero
    expect(stripIndexAt(50, 0, 4)).toBe(0);
    // Tocar el tramo de un color da ese color
    expect(STOOL_BROWN_SCALE[stripIndexAt(250, 320, STOOL_BROWN_SCALE.length)]).toBe('black');
  });
});

describe('regla de la consistencia (Bristol)', () => {
  const n = BRISTOL_TYPES.length;
  const typeAt = (x: number, width = 328, pad = 14) => BRISTOL_TYPES[rulerStopAt(x, width, n, pad)].id;

  it('tiene los 7 tipos de siempre como paradas, de 1 (dura) a 7 (líquida)', () => {
    expect(BRISTOL_TYPES.map((b) => b.id)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('salta a la parada más cercana', () => {
    // De 14 a 314 px: una parada cada 50 px
    expect(typeAt(14)).toBe(1);
    expect(typeAt(38)).toBe(1);
    expect(typeAt(40)).toBe(2);
    expect(typeAt(164)).toBe(4);
    expect(typeAt(264)).toBe(6);
    expect(typeAt(314)).toBe(7);
  });

  it('fuera de la línea se queda en el extremo', () => {
    expect(typeAt(-20)).toBe(1);
    expect(typeAt(0)).toBe(1);
    expect(typeAt(328)).toBe(7);
    expect(typeAt(1000)).toBe(7);
  });

  it('cada tipo guardado tiene su parada y vuelve al mismo tipo', () => {
    const width = 328;
    const pad = 14;
    for (const b of BRISTOL_TYPES) {
      const x = pad + ((b.id - 1) / (n - 1)) * (width - 2 * pad);
      expect(typeAt(x, width, pad)).toBe(b.id);
    }
  });
});

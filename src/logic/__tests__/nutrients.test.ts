import { describe, expect, it } from 'vitest';
import { nutrientFocus } from '@/logic/nutrients';

const PERFORM_TIPS = ['A palm-sized portion of protein at each meal', 'A full meal after training', 'Fruit and vegetables every day'];

describe('Lo que conviene hoy', () => {
  it('sencillo: fruta y verdura y una ración de proteína primero, y como mucho 5 cosas', () => {
    const f = nutrientFocus(
      [
        { marker_id: 'ferritin', flag: 'bajo' },
        { marker_id: 'vitamin_d', flag: 'bajo' },
        { marker_id: 'ldl', flag: 'alto' },
        { marker_id: 'triglycerides', flag: 'alto' },
        { marker_id: 'glucose', flag: 'alto' },
      ],
      PERFORM_TIPS
    );
    expect(f.slice(0, 2).map((x) => x.id)).toEqual(['five_a_day', 'protein']);
    expect(f.length).toBeLessThanOrEqual(5);
  });

  it('con la creatinina alta no empuja la proteína (ni la suya ni la del plan)', () => {
    const f = nutrientFocus([{ marker_id: 'creatinine', flag: 'alto' }], PERFORM_TIPS);
    expect(f.some((x) => x.id === 'protein')).toBe(false);
    expect(f.some((x) => /protein/i.test(x.title))).toBe(false);
  });

  it('si su menú no lleva tentempiés, no habla de tentempiés', () => {
    const f = nutrientFocus([], [...PERFORM_TIPS, 'A protein-rich snack after training'], { snacks: false });
    expect(f.every((x) => !/snack/i.test(`${x.title} ${x.foods}`))).toBe(true);
    expect(f.find((x) => x.id === 'five_a_day')!.foods).toMatch(/dessert/);
  });
});

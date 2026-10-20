import { describe, expect, it } from 'vitest';
import { FOODS, foodName } from '@/data/diet/catalog';
import { DEFAULT_DIET_PREFS, newDietPlan, shoppingList } from '@/logic/dietPlanner';
import { menuToHtml, shoppingText } from '@/utils/menuPdf';

const plan = newDietPlan({ ...DEFAULT_DIET_PREFS, sex: 'male', age: 40, heightCm: 180, weightKg: 80 }, [{ marker: 'creatinine', status: 'high' }]);

describe('Menú y lista en PDF', () => {
  it('el PDF lleva la marca, los 7 días, la lista de la compra y el aviso para el médico', () => {
    const html = menuToHtml(plan);
    expect(html).toContain('aria-label="Kuova"');
    expect((html.split('<tbody>')[1].match(/<tr><th>/g) ?? []).length).toBe(7);
    expect(html).toContain('Shopping list · KUOVA');
    expect(html).toContain('To discuss with your doctor');
    expect(html).not.toMatch(/<script/i);
  });

  it('la lista que se comparte empieza con la marca y no manda lo ya comprado', () => {
    const all = shoppingText(plan);
    expect(all.startsWith('Shopping list · KUOVA')).toBe(true);
    const first = shoppingList(plan.days)[0].food;
    const line = `- ${foodName(FOODS[first])}:`;
    expect(all).toContain(line);
    expect(shoppingText(plan, [first])).not.toContain(line);
  });
});

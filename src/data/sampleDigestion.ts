import type { GutContext } from '@/logic/gutPatterns';
import { inferFoodGroups } from '@/logic/foodGroups';
import type { DigestionEntry } from '@/types/digestion';
import type { BowelEntry } from '@/types/bathroom';

// Un mes de ejemplo para Digestión en cuentas de prueba (como las semanas de ejemplo de glucosa o
// heces): se ve qué saca la app de las molestias con lo que se comió antes y de las heces. Los
// días pares el desayuno es café con leche y tostada y a las 2 h hay hinchazón y gases; alguna
// tarde suelta, una hinchazón leve tras la comida. Se marca como ejemplo.

const LUNCHES = ['Arroz con pollo', 'Pescado con patatas', 'Pollo al horno con verduras'];

export function sampleGutData(now = new Date()): GutContext {
  const at = (daysAgo: number, hh: number, mm = 0) => {
    const d = new Date(now);
    d.setDate(d.getDate() - daysAgo);
    d.setHours(hh, mm, 0, 0);
    return d.toISOString();
  };
  const food = (description: string, minutesBefore: number) => ({
    description,
    groups: inferFoodGroups(description).map((g) => g.group),
    minutesBefore,
    amount: 'normal' as const,
  });
  const digestion: DigestionEntry[] = [];
  const bowel: BowelEntry[] = [];
  for (let d = 1; d <= 28; d++) {
    const dairy = d % 2 === 0;
    const id = (s: string) => `sample-${s}-${d}`;
    if (dairy) {
      digestion.push({
        id: id('s'),
        fecha: at(d, 10, 30),
        createdAt: at(d, 10, 30),
        kind: 'symptoms',
        symptoms: { bloating: d % 4 === 0 ? 3 : 2, gas: 2 },
        food: food('Café con leche y tostada', 120),
      });
    } else if (d % 7 === 3) {
      digestion.push({
        id: id('s'),
        fecha: at(d, 17),
        createdAt: at(d, 17),
        kind: 'symptoms',
        symptoms: { bloating: 1 },
        food: food(LUNCHES[d % LUNCHES.length], 120),
      });
    }
    digestion.push({ id: id('ok'), fecha: at(d, 22), createdAt: at(d, 22), kind: 'day_ok' });
    const loose = dairy && d % 4 === 0;
    bowel.push({
      id: id('h'),
      fecha: at(d, 12),
      createdAt: at(d, 12),
      count: loose ? 2 : 1,
      color: 'brown',
      consistency: loose ? 6 : 4,
      movements: loose ? [{ at: at(d, 9, 30), consistency: 4 }, { at: at(d, 12, 15), consistency: 6, urgent: true }] : undefined,
    });
  }
  // Toma café todos los días (solo o con leche), pan casi siempre y leche algunos días
  const usual = { gluten: 'most', coffee: 'daily', lactose: 'weekly' } as const;
  return { digestion, bowel, usual, safety: { answeredAt: at(5, 12), answers: {} }, now };
}

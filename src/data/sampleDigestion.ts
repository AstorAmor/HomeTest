import type { GutContext, GutMeal } from '@/logic/gutPatterns';
import type { DigestionEntry } from '@/types/digestion';
import type { BowelEntry } from '@/types/bathroom';

// Un mes de ejemplo para Digestión en cuentas de prueba (como las semanas de ejemplo de glucosa o
// heces): se ve cómo la app cruza comidas, molestias y heces y qué saca. Los desayunos con leche
// dan hinchazón y gases a las 2 h; el resto de comidas, casi nunca. Se marca como ejemplo.

const BREAKFASTS = ['Café con leche y tostada', 'Café solo y tostada con tomate'];
const LUNCHES = ['Lentejas con verduras', 'Arroz con pollo', 'Pasta con atún', 'Pescado con patatas', 'Ensalada de garbanzos', 'Pollo al horno con verduras', 'Paella'];
const DINNERS = ['Tortilla francesa y ensalada', 'Crema de calabacín', 'Salmón con verduras', 'Pizza', 'Yogur natural y fruta', 'Sopa de fideos', 'Revuelto de setas'];

export function sampleGutData(now = new Date()): GutContext {
  const at = (daysAgo: number, hh: number, mm = 0) => {
    const d = new Date(now);
    d.setDate(d.getDate() - daysAgo);
    d.setHours(hh, mm, 0, 0);
    return d.toISOString();
  };
  const meals: GutMeal[] = [];
  const digestion: DigestionEntry[] = [];
  const bowel: BowelEntry[] = [];
  for (let d = 1; d <= 28; d++) {
    const dairy = d % 2 === 0;
    const id = (s: string) => `sample-${s}-${d}`;
    meals.push({ id: id('b'), fecha: at(d, 8, 15), description: BREAKFASTS[dairy ? 0 : 1] });
    meals.push({ id: id('l'), fecha: at(d, 14), description: LUNCHES[d % LUNCHES.length] });
    meals.push({ id: id('d'), fecha: at(d, 21, 15), description: DINNERS[d % DINNERS.length] });
    if (dairy) {
      digestion.push({ id: id('s'), fecha: at(d, 10, 30), createdAt: at(d, 10, 30), kind: 'symptoms', symptoms: { bloating: d % 4 === 0 ? 3 : 2, gas: 2 } });
    } else if (d % 7 === 3) {
      digestion.push({ id: id('s'), fecha: at(d, 17), createdAt: at(d, 17), kind: 'symptoms', symptoms: { bloating: 1 } });
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
  return { meals, digestion, bowel, safety: { answeredAt: at(5, 12), answers: {} }, now };
}

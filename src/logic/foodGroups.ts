// Qué llevaba una comida, deducido de lo que escribió el usuario en "Tus nutrientes" (no se le
// pregunta nada más). Lógica pura, sin React Native: se usa en la app y en los tests.
//
// Grupos que de verdad separan causas distintas de molestias digestivas:
// - lactose: lácteos con lactosa (leche, yogur, nata, quesos frescos). Los quesos curados, la
//   mozzarella, la mantequilla y lo "sin lactosa" van en dairy_low_lactose: casi no llevan lactosa
//   y sirven de comparación (si sientan bien y la leche no, apunta a la lactosa).
// - gluten: trigo, cebada y centeno. Ojo: el trigo también lleva fructanos (un FODMAP), así que un
//   patrón con "gluten" no distingue gluten de fructanos (Skodje et al., Gastroenterology 2018).
// - legumes (galactooligosacáridos), onion_garlic (fructanos), fructose (fructosa en exceso),
//   polyols (sorbitol, manitol...): los grupos FODMAP de la Universidad de Monash.
// - fatty, spicy, alcohol, coffee: desencadenantes habituales de dispepsia, reflujo y urgencia.
//
// Es un diccionario de platos y palabras en español (y algo de inglés), no IA: gratis, sin sacar
// datos del móvil y comprobable con tests. SUPUESTO (revisión clínica / dietista): qué grupos se
// asignan a cada plato (p. ej. "tomate frito" → cebolla/ajo, "queso" a secas → poca lactosa).

export type FoodGroup =
  | 'gluten'
  | 'lactose'
  | 'dairy_low_lactose'
  | 'legumes'
  | 'onion_garlic'
  | 'fructose'
  | 'polyols'
  | 'fatty'
  | 'spicy'
  | 'alcohol'
  | 'coffee';

export const FOOD_GROUPS: { id: FoodGroup; label: string }[] = [
  { id: 'gluten', label: 'Gluten' },
  { id: 'lactose', label: 'Dairy with lactose' },
  { id: 'dairy_low_lactose', label: 'Low-lactose dairy' },
  { id: 'legumes', label: 'Legumes' },
  { id: 'onion_garlic', label: 'Onion or garlic' },
  { id: 'fructose', label: 'Sweet fruit, juice or honey' },
  { id: 'polyols', label: 'Sugar-free sweets or polyols' },
  { id: 'fatty', label: 'Fried or fatty' },
  { id: 'spicy', label: 'Spicy' },
  { id: 'alcohol', label: 'Alcohol' },
  { id: 'coffee', label: 'Coffee' },
];

// Los que cuentan como FODMAP (para el patrón conjunto)
export const FODMAP_GROUPS: FoodGroup[] = ['lactose', 'gluten', 'legumes', 'onion_garlic', 'fructose', 'polyols'];

// Palabra o expresión (sin tildes, en minúsculas) → grupos. Se busca como palabra entera; las
// expresiones de varias palabras ganan a sus partes ("judias verdes" no es legumbre seca,
// "leche de avena" no es lactosa).
const DICT: [string, FoodGroup[]][] = [
  // Excepciones primero (no llevan lo que parece)
  ['judias verdes', []],
  ['leche de avena', []],
  ['leche de almendra', []],
  ['leche de almendras', []],
  ['leche de soja', []],
  ['leche de coco', []],
  ['leche de arroz', []],
  ['bebida vegetal', []],
  ['tortilla de patatas', []],
  ['tortilla de patata', []],
  ['tortilla francesa', []],
  ['tortilla espanola', []],
  ['pan de maiz', []],
  ['cafe con leche', ['coffee', 'lactose']],
  ['tortilla de trigo', ['gluten']],
  ['patatas bravas', ['fatty', 'spicy']],
  ['patatas fritas', ['fatty']],
  ['papas fritas', ['fatty']],
  ['tomate frito', ['onion_garlic']],
  ['pan rallado', ['gluten']],
  ['al ajillo', ['onion_garlic']],
  ['queso fresco', ['lactose']],
  ['queso de burgos', ['lactose']],
  ['queso crema', ['lactose']],
  ['queso de untar', ['lactose']],
  ['queso curado', ['dairy_low_lactose']],
  ['queso semicurado', ['dairy_low_lactose']],
  ['arroz con leche', ['lactose']],
  ['chocolate con leche', ['lactose']],
  ['leche condensada', ['lactose']],
  ['tinto de verano', ['alcohol']],
  ['caramelos sin azucar', ['polyols']],
  ['chicles sin azucar', ['polyols']],
  ['chocolate sin azucar', ['polyols']],
  ['galletas sin azucar', ['polyols', 'gluten']],
  ['golosinas sin azucar', ['polyols']],
  ['comida rapida', ['fatty']],
  ['a la romana', ['gluten', 'fatty']],
  ['pimenton picante', ['spicy']],
  ['salsa brava', ['spicy']],
  // Gluten (trigo, cebada, centeno)
  ['pan', ['gluten']],
  ['panes', ['gluten']],
  ['bocadillo', ['gluten']],
  ['bocata', ['gluten']],
  ['sandwich', ['gluten']],
  ['tostada', ['gluten']],
  ['tostadas', ['gluten']],
  ['baguette', ['gluten']],
  ['chapata', ['gluten']],
  ['pasta', ['gluten']],
  ['espaguetis', ['gluten']],
  ['espagueti', ['gluten']],
  ['spaghetti', ['gluten']],
  ['macarrones', ['gluten']],
  ['tallarines', ['gluten']],
  ['fideos', ['gluten']],
  ['fideua', ['gluten']],
  ['lasana', ['gluten', 'lactose']],
  ['lasagna', ['gluten', 'lactose']],
  ['canelones', ['gluten', 'lactose']],
  ['pizza', ['gluten', 'dairy_low_lactose']],
  ['empanada', ['gluten']],
  ['empanadas', ['gluten']],
  ['empanadilla', ['gluten', 'fatty']],
  ['empanadillas', ['gluten', 'fatty']],
  ['croqueta', ['gluten', 'lactose', 'fatty']],
  ['croquetas', ['gluten', 'lactose', 'fatty']],
  ['rebozado', ['gluten', 'fatty']],
  ['rebozados', ['gluten', 'fatty']],
  ['rebozada', ['gluten', 'fatty']],
  ['empanado', ['gluten', 'fatty']],
  ['empanados', ['gluten', 'fatty']],
  ['galleta', ['gluten']],
  ['galletas', ['gluten']],
  ['bolleria', ['gluten', 'fatty']],
  ['bollo', ['gluten']],
  ['bollos', ['gluten']],
  ['croissant', ['gluten', 'fatty']],
  ['cruasan', ['gluten', 'fatty']],
  ['magdalena', ['gluten']],
  ['magdalenas', ['gluten']],
  ['donut', ['gluten', 'fatty']],
  ['donuts', ['gluten', 'fatty']],
  ['tarta', ['gluten', 'lactose']],
  ['bizcocho', ['gluten']],
  ['pastel', ['gluten']],
  ['pasteles', ['gluten']],
  ['churros', ['gluten', 'fatty']],
  ['porras', ['gluten', 'fatty']],
  ['torrijas', ['gluten', 'lactose']],
  ['cerveza', ['gluten', 'alcohol']],
  ['cervezas', ['gluten', 'alcohol']],
  ['cana', ['gluten', 'alcohol']],
  ['canas', ['gluten', 'alcohol']],
  ['cuscus', ['gluten']],
  ['couscous', ['gluten']],
  ['seitan', ['gluten']],
  ['bulgur', ['gluten']],
  ['trigo', ['gluten']],
  ['cebada', ['gluten']],
  ['centeno', ['gluten']],
  ['harina', ['gluten']],
  ['hamburguesa', ['gluten', 'fatty']],
  ['hamburguesas', ['gluten', 'fatty']],
  ['burger', ['gluten', 'fatty']],
  ['kebab', ['gluten', 'fatty']],
  ['wrap', ['gluten']],
  ['burrito', ['gluten']],
  ['fajitas', ['gluten']],
  ['ramen', ['gluten']],
  ['udon', ['gluten']],
  ['gyozas', ['gluten']],
  ['salmorejo', ['gluten', 'onion_garlic']],
  ['cereales', ['gluten']],
  ['muesli', ['gluten']],
  ['bread', ['gluten']],
  ['toast', ['gluten']],
  ['noodles', ['gluten']],
  ['beer', ['gluten', 'alcohol']],
  // Lactosa
  ['leche', ['lactose']],
  ['cortado', ['coffee', 'lactose']],
  ['capuchino', ['coffee', 'lactose']],
  ['cappuccino', ['coffee', 'lactose']],
  ['latte', ['coffee', 'lactose']],
  ['colacao', ['lactose']],
  ['cola cao', ['lactose']],
  ['batido', ['lactose']],
  ['yogur', ['lactose']],
  ['yogures', ['lactose']],
  ['yogurt', ['lactose']],
  ['kefir', ['lactose']],
  ['nata', ['lactose', 'fatty']],
  ['helado', ['lactose']],
  ['helados', ['lactose']],
  ['flan', ['lactose']],
  ['natillas', ['lactose']],
  ['bechamel', ['lactose', 'gluten']],
  ['requeson', ['lactose']],
  ['ricotta', ['lactose']],
  ['mascarpone', ['lactose']],
  ['philadelphia', ['lactose']],
  ['cuajada', ['lactose']],
  ['milk', ['lactose']],
  ['yoghurt', ['lactose']],
  ['ice cream', ['lactose']],
  // Lácteos con poca lactosa
  ['queso', ['dairy_low_lactose']],
  ['quesos', ['dairy_low_lactose']],
  ['manchego', ['dairy_low_lactose']],
  ['parmesano', ['dairy_low_lactose']],
  ['cheddar', ['dairy_low_lactose']],
  ['mozzarella', ['dairy_low_lactose']],
  ['gouda', ['dairy_low_lactose']],
  ['emmental', ['dairy_low_lactose']],
  ['brie', ['dairy_low_lactose']],
  ['camembert', ['dairy_low_lactose']],
  ['feta', ['dairy_low_lactose']],
  ['mantequilla', ['dairy_low_lactose']],
  ['cheese', ['dairy_low_lactose']],
  // Legumbres
  ['lentejas', ['legumes']],
  ['garbanzos', ['legumes']],
  ['alubias', ['legumes']],
  ['judias', ['legumes']],
  ['frijoles', ['legumes']],
  ['habas', ['legumes']],
  ['guisantes', ['legumes']],
  ['hummus', ['legumes', 'onion_garlic']],
  ['humus', ['legumes', 'onion_garlic']],
  ['cocido', ['legumes', 'fatty']],
  ['fabada', ['legumes', 'fatty']],
  ['potaje', ['legumes']],
  ['falafel', ['legumes', 'onion_garlic', 'fatty']],
  ['edamame', ['legumes']],
  ['lentils', ['legumes']],
  ['chickpeas', ['legumes']],
  ['beans', ['legumes']],
  // Cebolla y ajo
  ['cebolla', ['onion_garlic']],
  ['cebolleta', ['onion_garlic']],
  ['ajo', ['onion_garlic']],
  ['ajos', ['onion_garlic']],
  ['ajillo', ['onion_garlic']],
  ['ajoblanco', ['onion_garlic']],
  ['puerro', ['onion_garlic']],
  ['puerros', ['onion_garlic']],
  ['chalota', ['onion_garlic']],
  ['sofrito', ['onion_garlic']],
  ['gazpacho', ['onion_garlic']],
  ['alioli', ['onion_garlic', 'fatty']],
  ['allioli', ['onion_garlic', 'fatty']],
  ['pisto', ['onion_garlic']],
  ['bolonesa', ['onion_garlic']],
  ['guacamole', ['onion_garlic', 'polyols']],
  ['onion', ['onion_garlic']],
  ['garlic', ['onion_garlic']],
  // Fructosa en exceso
  ['manzana', ['fructose', 'polyols']],
  ['manzanas', ['fructose', 'polyols']],
  ['pera', ['fructose', 'polyols']],
  ['peras', ['fructose', 'polyols']],
  ['mango', ['fructose']],
  ['sandia', ['fructose', 'polyols']],
  ['cerezas', ['fructose', 'polyols']],
  ['higos', ['fructose']],
  ['miel', ['fructose']],
  ['agave', ['fructose']],
  ['zumo', ['fructose']],
  ['zumos', ['fructose']],
  ['jugo', ['fructose']],
  ['smoothie', ['fructose']],
  ['compota', ['fructose']],
  ['apple', ['fructose', 'polyols']],
  ['pear', ['fructose', 'polyols']],
  ['honey', ['fructose']],
  ['juice', ['fructose']],
  // Polioles
  ['chicle', ['polyols']],
  ['chicles', ['polyols']],
  ['sorbitol', ['polyols']],
  ['xilitol', ['polyols']],
  ['maltitol', ['polyols']],
  ['melocoton', ['polyols']],
  ['ciruela', ['polyols']],
  ['ciruelas', ['polyols']],
  ['albaricoque', ['polyols']],
  ['albaricoques', ['polyols']],
  ['nectarina', ['polyols']],
  ['champinones', ['polyols']],
  ['champinon', ['polyols']],
  ['setas', ['polyols']],
  ['coliflor', ['polyols']],
  ['aguacate', ['polyols']],
  // Frito o graso
  ['frito', ['fatty']],
  ['fritos', ['fatty']],
  ['frita', ['fatty']],
  ['fritas', ['fatty']],
  ['fritura', ['fatty']],
  ['calamares', ['gluten', 'fatty']],
  ['tempura', ['gluten', 'fatty']],
  ['chorizo', ['fatty']],
  ['panceta', ['fatty']],
  ['beicon', ['fatty']],
  ['bacon', ['fatty']],
  ['torreznos', ['fatty']],
  ['morcilla', ['fatty']],
  ['embutido', ['fatty']],
  ['embutidos', ['fatty']],
  ['salchichon', ['fatty']],
  ['fuet', ['fatty']],
  ['salchicha', ['fatty']],
  ['salchichas', ['fatty']],
  ['perrito', ['gluten', 'fatty']],
  ['nuggets', ['gluten', 'fatty']],
  ['alitas', ['fatty']],
  ['costillas', ['fatty']],
  ['carbonara', ['lactose', 'fatty']],
  ['chicharrones', ['fatty']],
  ['grasiento', ['fatty']],
  ['grasienta', ['fatty']],
  ['fried', ['fatty']],
  ['fries', ['fatty']],
  // Picante
  ['picante', ['spicy']],
  ['picantes', ['spicy']],
  ['guindilla', ['spicy']],
  ['guindillas', ['spicy']],
  ['chile', ['spicy']],
  ['jalapeno', ['spicy']],
  ['jalapenos', ['spicy']],
  ['cayena', ['spicy']],
  ['tabasco', ['spicy']],
  ['sriracha', ['spicy']],
  ['curry', ['spicy']],
  ['bravas', ['fatty', 'spicy']],
  ['pilpil', ['spicy']],
  ['wasabi', ['spicy']],
  ['kimchi', ['spicy']],
  ['harissa', ['spicy']],
  ['spicy', ['spicy']],
  // Alcohol
  ['vino', ['alcohol']],
  ['vinos', ['alcohol']],
  ['tinto', ['alcohol']],
  ['cava', ['alcohol']],
  ['champan', ['alcohol']],
  ['vermut', ['alcohol']],
  ['sidra', ['alcohol']],
  ['copa', ['alcohol']],
  ['copas', ['alcohol']],
  ['gin', ['alcohol']],
  ['gintonic', ['alcohol']],
  ['ron', ['alcohol']],
  ['vodka', ['alcohol']],
  ['whisky', ['alcohol']],
  ['tequila', ['alcohol']],
  ['licor', ['alcohol']],
  ['mojito', ['alcohol']],
  ['sangria', ['alcohol']],
  ['calimocho', ['alcohol']],
  ['chupito', ['alcohol']],
  ['chupitos', ['alcohol']],
  ['coctel', ['alcohol']],
  ['wine', ['alcohol']],
  // Café
  ['cafe', ['coffee']],
  ['cafes', ['coffee']],
  ['espresso', ['coffee']],
  ['expreso', ['coffee']],
  ['descafeinado', ['coffee']],
  ['coffee', ['coffee']],
];

// "sin X" quita el grupo de X en ese trozo de la comida ("pan sin gluten", "cerveza sin alcohol");
// "sin lactosa" convierte la lactosa en lácteo con poca lactosa.
const NEGATIONS: [string, FoodGroup][] = [
  ['sin gluten', 'gluten'],
  ['sin lactosa', 'lactose'],
  ['sin alcohol', 'alcohol'],
  ['sin cebolla', 'onion_garlic'],
  ['sin ajo', 'onion_garlic'],
  ['sin picante', 'spicy'],
];

const normalize = (s: string) =>
  ` ${s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9,.\s]/g, ' ')
    .replace(/\s+/g, ' ')} `;

// Los trozos de una comida: "pizza sin gluten, cerveza y helado" → 3 trozos, para que "sin gluten"
// no quite el gluten de la cerveza
const splitParts = (text: string) =>
  normalize(text.replace(/0[,.]0/g, ' sin alcohol '))
    .split(/,| y | con | and | with | \+ /).map((p) => ` ${p.trim()} `);

// Más largas primero: "cafe con leche" antes que "cafe" y "leche"
const SORTED = [...DICT].sort((a, b) => b[0].length - a[0].length);

export interface InferredGroup {
  group: FoodGroup;
  because: string; // la palabra que lo delató, para enseñárselo al usuario ("pizza")
}

export function inferFoodGroups(description: string): InferredGroup[] {
  if (!description?.trim()) return [];
  const found = new Map<FoodGroup, string>();
  // "café con leche" se parte por "con": se busca antes en el texto entero
  const whole = normalize(description);
  const parts = [whole.includes(' cafe con leche ') ? ' cafe con leche ' : '', ...splitParts(description)];
  for (let part of parts) {
    if (!part.trim()) continue;
    const negated = new Set<FoodGroup>();
    for (const [phrase, group] of NEGATIONS) {
      if (part.includes(` ${phrase} `)) {
        negated.add(group);
        part = part.replace(phrase, ' ');
      }
    }
    for (const [word, groups] of SORTED) {
      const needle = ` ${word} `;
      if (!part.includes(needle)) continue;
      part = part.replace(needle, ' ');
      for (const g of groups) {
        if (negated.has(g)) {
          if (g === 'lactose' && !found.has('dairy_low_lactose')) found.set('dairy_low_lactose', word);
          continue;
        }
        if (!found.has(g)) found.set(g, word);
      }
    }
  }
  // Si hay lactosa, el "poca lactosa" del mismo plato no añade nada
  if (found.has('lactose')) found.delete('dairy_low_lactose');
  return FOOD_GROUPS.filter((g) => found.has(g.id)).map((g) => ({ group: g.id, because: found.get(g.id)! }));
}

// Los grupos de una comida: los que corrigió el usuario si lo hizo; si no, los deducidos
export function mealGroups(description: string, confirmed?: FoodGroup[] | null): FoodGroup[] {
  return confirmed ?? inferFoodGroups(description).map((g) => g.group);
}

export const isFodmap = (groups: FoodGroup[]) => groups.some((g) => FODMAP_GROUPS.includes(g));

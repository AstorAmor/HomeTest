"""Alimentos y recetas para los menús (src/data/diet/dietData.ts).

- Alimentos: ~140 ingredientes con su composición por 100 g de USDA FoodData Central, SR Legacy (04/2018),
  datos de dominio público (fdc.nal.usda.gov). Se fija el fdc_id de cada uno. Añadimos lo que USDA no
  trae: nombre en español, precio orientativo en España (€/kg, estimación de supermercado 2026, no es un
  dato oficial), tipo (vegetal, lácteo, huevo, pescado, marisco, carne), alérgenos (los 14 de la UE que
  aplican) y los grupos de Digestión (src/logic/foodGroups.ts) para "lo que me sienta mal".
- Recetas: escritas aquí (no hay una base pública buena en español con licencia clara). Gramos en crudo
  por ración; los nutrientes y el coste por ración los calcula este script.

Equivalencias aproximadas (no hay un equivalente exacto en USDA): queso fresco tipo Burgos = ricotta
semidesnatada; queso fresco batido = cottage 2 %; pescado blanco (merluza) = bacalao fresco; jamón
serrano = jamón curado magro; legumbres de bote = enjuagadas o bajas en sal (garbanzos enjuagados, alubias
negras bajas en sal, alubias blancas cocidas sin sal): se indica enjuagarlas.

Uso: python scripts/diet-catalog.py <carpeta con los CSV de SR Legacy>"""
import csv
import json
import sys
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / 'src' / 'data' / 'diet' / 'dietData.ts'

# Nutrientes (id de USDA → clave nuestra). Omega-3 = ALA + EPA + DHA; también EPA+DHA aparte.
NUTRIENTS = {
    '1008': 'kcal', '1003': 'protein', '1004': 'fat', '1258': 'satFat', '1005': 'carbs', '2000': 'sugars',
    '1079': 'fiber', '1093': 'sodium', '1092': 'potassium', '1087': 'calcium', '1089': 'iron',
    '1090': 'magnesium', '1162': 'vitC', '1114': 'vitD', '1178': 'b12', '1177': 'folate',
    '1253': 'cholesterol', '1404': 'ala', '1278': 'epa', '1272': 'dha',
}

# Tipo: P vegetal · D lácteo · E huevo · F pescado · S marisco · M carne
# Alérgenos: gluten, milk, egg, fish, crustaceans, molluscs, peanuts, nuts, soy, sesame, mustard, celery
# Grupos de Digestión: gluten, lactose, dairy_low_lactose, legumes, onion_garlic, fructose, polyols
# Marcas: red_meat, processed_meat, oily_fish, white_fish, shellfish, legume, whole_grain, nuts, purine
# (id, fdc, es, en, sección de la compra, €/kg, tipo, alérgenos, grupos, marcas, pieza (nombre es, en, g))
F = [
    # Cereales, pan y tubérculos
    ('oats', 173904, 'Copos de avena', 'Rolled oats', 'pantry', 1.8, 'P', 'gluten', 'gluten', 'whole_grain', None),
    ('ww_bread', 172688, 'Pan integral', 'Wholemeal bread', 'bakery', 3.5, 'P', 'gluten', 'gluten', 'whole_grain', ('rebanada', 'slice', 30)),
    ('baguette', 172675, 'Barra de pan', 'Baguette', 'bakery', 3.0, 'P', 'gluten', 'gluten', '', None),
    ('rice', 168877, 'Arroz', 'White rice', 'pantry', 1.5, 'P', '', '', '', None),
    ('brown_rice', 169703, 'Arroz integral', 'Brown rice', 'pantry', 2.2, 'P', '', '', 'whole_grain', None),
    ('pasta', 169736, 'Pasta', 'Pasta', 'pantry', 1.4, 'P', 'gluten', 'gluten', '', None),
    ('ww_pasta', 169738, 'Pasta integral', 'Wholewheat pasta', 'pantry', 2.0, 'P', 'gluten', 'gluten', 'whole_grain', None),
    ('couscous', 169699, 'Cuscús', 'Couscous', 'pantry', 2.5, 'P', 'gluten', 'gluten', '', None),
    ('quinoa', 168874, 'Quinoa', 'Quinoa', 'pantry', 6.0, 'P', '', '', 'whole_grain', None),
    ('ww_tortilla', 174081, 'Tortilla de trigo integral', 'Wholewheat wrap', 'bakery', 5.0, 'P', 'gluten', 'gluten', 'whole_grain', ('tortilla', 'wrap', 60)),
    ('rice_cakes', 170250, 'Tortitas de arroz', 'Rice cakes', 'pantry', 8.0, 'P', '', '', 'whole_grain', ('tortita', 'cake', 9)),
    ('granola', 171646, 'Granola', 'Granola', 'pantry', 6.0, 'P', 'gluten,nuts', 'gluten', '', None),
    ('ww_flour', 168893, 'Harina integral', 'Wholemeal flour', 'pantry', 1.5, 'P', 'gluten', 'gluten', 'whole_grain', None),
    ('potato', 170026, 'Patata', 'Potato', 'produce', 1.2, 'P', '', '', '', None),
    ('sweet_potato', 168482, 'Boniato', 'Sweet potato', 'produce', 2.0, 'P', '', '', '', None),
    # Legumbres y soja
    ('lentils', 172420, 'Lentejas', 'Lentils', 'pantry', 2.2, 'P', '', 'legumes', 'legume', None),
    ('chickpeas', 173801, 'Garbanzos cocidos (bote, enjuagados)', 'Cooked chickpeas (jar)', 'pantry', 2.0, 'P', '', 'legumes', 'legume', None),
    ('white_beans', 175203, 'Alubias blancas cocidas (bote, enjuagadas)', 'Cooked white beans (jar)', 'pantry', 2.2, 'P', '', 'legumes', 'legume', None),
    ('black_beans', 175238, 'Alubias negras cocidas (bote, enjuagadas)', 'Cooked black beans (jar)', 'pantry', 2.5, 'P', '', 'legumes', 'legume', None),
    ('peas', 170016, 'Guisantes congelados', 'Frozen peas', 'frozen', 2.2, 'P', '', 'legumes', 'legume', None),
    ('edamame', 168410, 'Edamame congelado', 'Frozen edamame', 'frozen', 6.0, 'P', 'soy', '', 'legume', None),
    ('tofu', 172475, 'Tofu firme', 'Firm tofu', 'chilled', 6.0, 'P', 'soy', '', 'legume', None),
    ('tempeh', 174272, 'Tempeh', 'Tempeh', 'chilled', 14.0, 'P', 'soy', '', 'legume', None),
    ('soy_milk', 172456, 'Bebida de soja enriquecida en calcio', 'Calcium-fortified soy drink', 'chilled', 1.3, 'P', 'soy', '', '', None),
    ('soy_yogurt', 175227, 'Yogur de soja natural', 'Plain soy yoghurt', 'chilled', 4.0, 'P', 'soy', '', '', ('yogur', 'pot', 125)),
    ('hummus', 174289, 'Hummus', 'Hummus', 'chilled', 8.0, 'P', 'sesame', 'legumes,onion_garlic', 'legume', None),
    # Lácteos y huevos
    ('egg', 171287, 'Huevo', 'Egg', 'chilled', 3.0, 'E', 'egg', '', '', ('huevo', 'egg', 55)),
    ('milk', 171267, 'Leche semidesnatada', 'Semi-skimmed milk', 'chilled', 0.9, 'D', 'milk', 'lactose', '', None),
    ('yogurt', 170886, 'Yogur natural', 'Plain yoghurt', 'chilled', 2.0, 'D', 'milk', 'lactose', '', ('yogur', 'pot', 125)),
    ('greek_yogurt', 170894, 'Yogur griego natural 0 %', 'Fat-free Greek yoghurt', 'chilled', 4.0, 'D', 'milk', 'lactose', '', None),
    ('kefir', 170904, 'Kéfir', 'Kefir', 'chilled', 3.0, 'D', 'milk', 'dairy_low_lactose', '', None),
    ('fresh_cheese', 171248, 'Queso fresco tipo Burgos', 'Fresh soft cheese', 'chilled', 6.0, 'D', 'milk', 'lactose', '', None),
    ('cottage', 172182, 'Queso fresco batido', 'Quark / cottage cheese', 'chilled', 3.5, 'D', 'milk', 'lactose', '', None),
    ('mozzarella', 170847, 'Mozzarella', 'Mozzarella', 'chilled', 7.0, 'D', 'milk', 'dairy_low_lactose', '', None),
    ('parmesan', 171247, 'Parmesano rallado', 'Grated parmesan', 'chilled', 18.0, 'D', 'milk', 'dairy_low_lactose', '', None),
    ('feta', 173420, 'Queso feta', 'Feta cheese', 'chilled', 11.0, 'D', 'milk', 'dairy_low_lactose', '', None),
    # Carne
    ('chicken_breast', 171077, 'Pechuga de pollo', 'Chicken breast', 'meat_fish', 7.5, 'M', '', '', '', None),
    ('chicken_thigh', 173627, 'Contramuslo de pollo deshuesado', 'Boneless chicken thigh', 'meat_fish', 5.5, 'M', '', '', '', None),
    ('turkey_breast', 174515, 'Pechuga de pavo', 'Turkey breast', 'meat_fish', 8.5, 'M', '', '', '', None),
    ('beef_mince', 174030, 'Carne picada de ternera magra', 'Lean beef mince', 'meat_fish', 9.0, 'M', '', '', 'red_meat,purine', None),
    ('beef', 174055, 'Ternera magra (filete o para guisar)', 'Lean beef', 'meat_fish', 16.0, 'M', '', '', 'red_meat,purine', None),
    ('pork_loin', 168251, 'Lomo de cerdo', 'Pork loin', 'meat_fish', 7.0, 'M', '', '', 'red_meat', None),
    ('cooked_ham', 173864, 'Jamón cocido', 'Cooked ham', 'chilled', 9.0, 'M', '', '', 'processed_meat', None),
    ('serrano_ham', 167876, 'Jamón serrano', 'Cured ham', 'chilled', 25.0, 'M', '', '', 'processed_meat', None),
    ('turkey_slices', 172941, 'Pechuga de pavo en lonchas', 'Sliced turkey breast', 'chilled', 10.0, 'M', '', '', 'processed_meat', None),
    # Pescado y marisco
    ('salmon', 175167, 'Salmón', 'Salmon', 'meat_fish', 14.0, 'F', 'fish', '', 'oily_fish', None),
    ('white_fish', 171955, 'Merluza o bacalao fresco', 'Hake or fresh cod', 'meat_fish', 9.0, 'F', 'fish', '', 'white_fish', None),
    ('sardines', 175139, 'Sardinas en aceite (lata)', 'Tinned sardines in oil', 'pantry', 9.0, 'F', 'fish', '', 'oily_fish,purine', None),
    ('tuna', 173709, 'Atún al natural (lata)', 'Tinned tuna in water', 'pantry', 9.0, 'F', 'fish', '', 'white_fish', None),
    ('mackerel', 175119, 'Caballa', 'Mackerel', 'meat_fish', 7.0, 'F', 'fish', '', 'oily_fish,purine', None),
    ('trout', 173717, 'Trucha', 'Trout', 'meat_fish', 8.0, 'F', 'fish', '', 'oily_fish', None),
    ('shrimp', 175179, 'Gambas peladas', 'Peeled prawns', 'frozen', 12.0, 'S', 'crustaceans', '', 'shellfish,purine', None),
    ('mussels', 174216, 'Mejillones (carne)', 'Mussels (meat)', 'meat_fish', 7.0, 'S', 'molluscs', '', 'shellfish,purine', None),
    ('squid', 174223, 'Calamar', 'Squid', 'frozen', 9.0, 'S', 'molluscs', '', 'shellfish', None),
    # Verduras
    ('tomato', 170457, 'Tomate', 'Tomato', 'produce', 2.0, 'P', '', '', '', ('tomate', 'tomato', 120)),
    ('canned_tomato', 170051, 'Tomate triturado (lata)', 'Crushed tomatoes (tin)', 'pantry', 1.5, 'P', '', '', '', None),
    ('onion', 170000, 'Cebolla', 'Onion', 'produce', 1.3, 'P', '', 'onion_garlic', '', ('cebolla', 'onion', 150)),
    ('garlic', 169230, 'Ajo', 'Garlic', 'produce', 5.0, 'P', '', 'onion_garlic', '', ('diente', 'clove', 4)),
    ('leek', 169246, 'Puerro', 'Leek', 'produce', 2.5, 'P', '', 'onion_garlic', '', None),
    ('red_pepper', 170108, 'Pimiento rojo', 'Red pepper', 'produce', 2.8, 'P', '', '', '', None),
    ('green_pepper', 170427, 'Pimiento verde', 'Green pepper', 'produce', 2.4, 'P', '', '', '', None),
    ('zucchini', 169291, 'Calabacín', 'Courgette', 'produce', 1.8, 'P', '', '', '', None),
    ('eggplant', 169228, 'Berenjena', 'Aubergine', 'produce', 2.0, 'P', '', '', '', None),
    ('carrot', 170393, 'Zanahoria', 'Carrot', 'produce', 1.1, 'P', '', '', '', None),
    ('spinach', 168462, 'Espinacas', 'Spinach', 'produce', 4.0, 'P', '', '', '', None),
    ('broccoli', 170379, 'Brócoli', 'Broccoli', 'produce', 3.0, 'P', '', '', '', None),
    ('cauliflower', 169986, 'Coliflor', 'Cauliflower', 'produce', 2.2, 'P', '', 'polyols', '', None),
    ('lettuce', 169247, 'Lechuga', 'Lettuce', 'produce', 2.5, 'P', '', '', '', None),
    ('arugula', 169387, 'Rúcula', 'Rocket', 'produce', 10.0, 'P', '', '', '', None),
    ('cucumber', 168409, 'Pepino', 'Cucumber', 'produce', 1.6, 'P', '', '', '', None),
    ('mushrooms', 169251, 'Champiñones', 'Mushrooms', 'produce', 4.0, 'P', '', 'polyols', '', None),
    ('green_beans', 169961, 'Judías verdes', 'Green beans', 'produce', 3.5, 'P', '', '', '', None),
    ('artichoke', 168387, 'Alcachofa congelada', 'Frozen artichoke', 'frozen', 4.0, 'P', '', 'onion_garlic', '', None),
    ('asparagus', 168389, 'Espárragos verdes', 'Green asparagus', 'produce', 6.0, 'P', '', 'fructose', '', None),
    ('pumpkin', 168448, 'Calabaza', 'Pumpkin', 'produce', 1.8, 'P', '', '', '', None),
    ('avocado', 171705, 'Aguacate', 'Avocado', 'produce', 5.0, 'P', '', 'polyols', '', None),
    ('olives', 169094, 'Aceitunas', 'Olives', 'pantry', 5.0, 'P', '', '', '', None),
    ('corn', 169214, 'Maíz dulce (lata)', 'Sweetcorn (tin)', 'pantry', 3.0, 'P', '', '', '', None),
    ('parsley', 170416, 'Perejil', 'Parsley', 'produce', 10.0, 'P', '', '', '', None),
    ('basil', 172232, 'Albahaca', 'Basil', 'produce', 20.0, 'P', '', '', '', None),
    ('ginger', 169231, 'Jengibre', 'Ginger', 'produce', 6.0, 'P', '', '', '', None),
    # Fruta
    ('apple', 171688, 'Manzana', 'Apple', 'produce', 2.0, 'P', '', 'fructose,polyols', '', ('manzana', 'apple', 150)),
    ('banana', 173944, 'Plátano', 'Banana', 'produce', 1.8, 'P', '', '', '', ('plátano', 'banana', 120)),
    ('orange', 169097, 'Naranja', 'Orange', 'produce', 1.5, 'P', '', '', '', ('naranja', 'orange', 180)),
    ('strawberries', 167762, 'Fresas', 'Strawberries', 'produce', 4.0, 'P', '', '', '', None),
    ('blueberries', 171711, 'Arándanos', 'Blueberries', 'produce', 12.0, 'P', '', '', '', None),
    ('kiwi', 168153, 'Kiwi', 'Kiwi', 'produce', 3.5, 'P', '', '', '', ('kiwi', 'kiwi', 75)),
    ('pear', 169118, 'Pera', 'Pear', 'produce', 2.2, 'P', '', 'fructose,polyols', '', ('pera', 'pear', 150)),
    ('pineapple', 169124, 'Piña', 'Pineapple', 'produce', 2.0, 'P', '', '', '', None),
    ('lemon', 167747, 'Limón (zumo)', 'Lemon (juice)', 'produce', 2.5, 'P', '', '', '', None),
    ('raisins', 168165, 'Pasas', 'Raisins', 'pantry', 7.0, 'P', '', 'fructose', '', None),
    ('dates', 168191, 'Dátiles', 'Dates', 'pantry', 10.0, 'P', '', 'fructose', '', ('dátil', 'date', 10)),
    # Frutos secos y semillas
    ('almonds', 170567, 'Almendras', 'Almonds', 'pantry', 14.0, 'P', 'nuts', '', 'nuts', None),
    ('walnuts', 170187, 'Nueces', 'Walnuts', 'pantry', 13.0, 'P', 'nuts', '', 'nuts', None),
    ('hazelnuts', 170581, 'Avellanas', 'Hazelnuts', 'pantry', 15.0, 'P', 'nuts', '', 'nuts', None),
    ('pistachios', 170184, 'Pistachos', 'Pistachios', 'pantry', 20.0, 'P', 'nuts', '', 'nuts', None),
    ('peanut_butter', 172470, 'Crema de cacahuete', 'Peanut butter', 'pantry', 10.0, 'P', 'peanuts', '', 'nuts', None),
    ('chia', 170554, 'Semillas de chía', 'Chia seeds', 'pantry', 10.0, 'P', '', '', '', None),
    ('pumpkin_seeds', 170556, 'Pipas de calabaza', 'Pumpkin seeds', 'pantry', 18.0, 'P', '', '', '', None),
    ('sesame', 170150, 'Sésamo', 'Sesame seeds', 'pantry', 8.0, 'P', 'sesame', '', '', None),
    # Despensa
    ('olive_oil', 171413, 'Aceite de oliva virgen extra', 'Extra virgin olive oil', 'pantry', 9.0, 'P', '', '', '', None),
    ('honey', 169640, 'Miel', 'Honey', 'pantry', 8.0, 'P', '', 'fructose', '', None),
    ('dark_chocolate', 170273, 'Chocolate negro 70-85 %', 'Dark chocolate 70-85%', 'pantry', 15.0, 'P', '', '', '', None),
    ('soy_sauce', 172473, 'Salsa de soja baja en sal', 'Low-salt soy sauce', 'pantry', 6.0, 'P', 'soy,gluten', 'gluten', '', None),
    ('vinegar', 173469, 'Vinagre', 'Vinegar', 'pantry', 2.0, 'P', '', '', '', None),
    ('veg_broth', 171583, 'Caldo de verduras', 'Vegetable stock', 'pantry', 1.5, 'P', 'celery', 'onion_garlic', '', None),
    ('paprika', 171329, 'Pimentón', 'Paprika', 'pantry', 20.0, 'P', '', '', '', None),
    ('cumin', 170923, 'Comino', 'Cumin', 'pantry', 20.0, 'P', '', '', '', None),
    ('oregano', 171328, 'Orégano', 'Oregano', 'pantry', 30.0, 'P', '', '', '', None),
    ('cinnamon', 171320, 'Canela', 'Cinnamon', 'pantry', 25.0, 'P', '', '', '', None),
    ('salt', 173468, 'Sal', 'Salt', 'pantry', 0.5, 'P', '', '', '', None),
]

# Recetas: (id, comidas, minutos, dificultad 1-3, marcas, ingredientes "id:g ...", es, en, pasos es, pasos en)
# comidas: b desayuno · l comida · d cena · s tentempié. marcas: batch (sirve para dos días), nocook
R = [
    # ── Desayunos ──
    ('porridge_banana', 'b', 10, 1, '', 'oats:50 milk:200 banana:100 cinnamon:1 walnuts:10',
     'Gachas de avena con plátano y nueces', 'Oat porridge with banana and walnuts',
     ['Calienta la leche con la avena y la canela 4-5 minutos, removiendo.', 'Corta el plátano en rodajas.', 'Sirve con el plátano y las nueces por encima.'],
     ['Simmer the oats in the milk with the cinnamon for 4-5 minutes, stirring.', 'Slice the banana.', 'Top with the banana and walnuts.']),
    ('porridge_soy_berries', 'b', 10, 1, '', 'oats:50 soy_milk:200 strawberries:80 chia:10',
     'Gachas de avena con bebida de soja y fresas', 'Oat porridge with soy drink and strawberries',
     ['Calienta la bebida de soja con la avena 4-5 minutos, removiendo.', 'Añade la chía al final.', 'Sirve con las fresas troceadas.'],
     ['Simmer the oats in the soy drink for 4-5 minutes, stirring.', 'Stir in the chia at the end.', 'Top with chopped strawberries.']),
    ('toast_tomato', 'b', 5, 1, 'nocook', 'ww_bread:70 tomato:80 olive_oil:10 salt:0.5',
     'Tostada con tomate y aceite', 'Toast with tomato and olive oil',
     ['Tuesta el pan.', 'Ralla el tomate y repártelo por encima.', 'Termina con el aceite y una pizca de sal.'],
     ['Toast the bread.', 'Grate the tomato over it.', 'Finish with the oil and a pinch of salt.']),
    ('toast_tomato_ham', 'b', 5, 1, 'nocook', 'ww_bread:70 tomato:60 olive_oil:8 serrano_ham:30',
     'Tostada con tomate y jamón', 'Toast with tomato and cured ham',
     ['Tuesta el pan.', 'Ralla el tomate por encima y añade el aceite.', 'Pon el jamón encima.'],
     ['Toast the bread.', 'Grate the tomato over it and add the oil.', 'Top with the ham.']),
    ('toast_avocado_egg', 'b', 10, 1, '', 'ww_bread:60 avocado:60 egg:55 lemon:5 salt:0.5',
     'Tostada de aguacate y huevo', 'Avocado toast with egg',
     ['Cuece el huevo 8 minutos (o hazlo a la plancha).', 'Machaca el aguacate con el limón y una pizca de sal.', 'Tuesta el pan, unta el aguacate y pon el huevo en rodajas encima.'],
     ['Boil the egg for 8 minutes (or fry it).', 'Mash the avocado with the lemon and a pinch of salt.', 'Toast the bread, spread the avocado and top with the sliced egg.']),
    ('yogurt_bowl', 'b', 5, 1, 'nocook', 'yogurt:250 oats:30 blueberries:60 walnuts:15 honey:5',
     'Yogur con avena, arándanos y nueces', 'Yoghurt with oats, blueberries and walnuts',
     ['Pon el yogur en un bol.', 'Añade la avena, los arándanos y las nueces.', 'Un hilo de miel por encima.'],
     ['Spoon the yoghurt into a bowl.', 'Add the oats, blueberries and walnuts.', 'Drizzle with the honey.']),
    ('greek_yogurt_kiwi', 'bs', 5, 1, 'nocook', 'greek_yogurt:200 kiwi:150 pumpkin_seeds:10',
     'Yogur griego con kiwi y pipas de calabaza', 'Greek yoghurt with kiwi and pumpkin seeds',
     ['Pela y trocea los kiwis.', 'Ponlos sobre el yogur.', 'Añade las pipas por encima.'],
     ['Peel and chop the kiwis.', 'Put them on the yoghurt.', 'Sprinkle with the seeds.']),
    ('soy_yogurt_granola', 'b', 5, 1, 'nocook', 'soy_yogurt:200 granola:30 strawberries:100',
     'Yogur de soja con granola y fresas', 'Soy yoghurt with granola and strawberries',
     ['Pon el yogur en un bol.', 'Añade las fresas troceadas.', 'Termina con la granola.'],
     ['Spoon the yoghurt into a bowl.', 'Add the chopped strawberries.', 'Top with the granola.']),
    ('omelette_spinach', 'b', 10, 1, '', 'egg:110 spinach:50 olive_oil:5 ww_bread:40 salt:0.5',
     'Tortilla francesa de espinacas con pan', 'Spinach omelette with bread',
     ['Saltea las espinacas 1 minuto con el aceite.', 'Bate los huevos con una pizca de sal y échalos encima.', 'Cuaja a fuego medio, dobla la tortilla y sirve con el pan.'],
     ['Wilt the spinach in the oil for 1 minute.', 'Beat the eggs with a pinch of salt and pour them over.', 'Cook over medium heat, fold and serve with the bread.']),
    ('tofu_scramble', 'b', 10, 1, '', 'tofu:150 tomato:80 olive_oil:5 paprika:1 ww_bread:50 salt:0.5',
     'Revuelto de tofu con tomate', 'Tofu scramble with tomato',
     ['Desmenuza el tofu con las manos.', 'Saltea el tomate troceado 2 minutos con el aceite y añade el tofu, el pimentón y la sal.', 'Cocina 3-4 minutos y sirve con el pan tostado.'],
     ['Crumble the tofu with your hands.', 'Fry the chopped tomato in the oil for 2 minutes, then add the tofu, paprika and salt.', 'Cook for 3-4 minutes and serve with toast.']),
    ('oat_pancakes', 'b', 15, 2, '', 'oats:50 egg:55 banana:100 milk:50 olive_oil:3 blueberries:50',
     'Tortitas de avena y plátano', 'Oat and banana pancakes',
     ['Tritura la avena, el huevo, el plátano y la leche hasta tener una masa.', 'Haz tortitas pequeñas en una sartén apenas engrasada, 1-2 minutos por lado.', 'Sirve con los arándanos.'],
     ['Blend the oats, egg, banana and milk into a batter.', 'Cook small pancakes in a lightly oiled pan, 1-2 minutes per side.', 'Serve with the blueberries.']),
    ('cottage_toast_strawberries', 'b', 5, 1, 'nocook', 'ww_bread:60 cottage:100 strawberries:80 honey:5',
     'Tostada con queso fresco batido y fresas', 'Toast with quark and strawberries',
     ['Tuesta el pan.', 'Unta el queso batido.', 'Pon las fresas en láminas y un poco de miel.'],
     ['Toast the bread.', 'Spread the quark.', 'Top with sliced strawberries and a little honey.']),
    ('green_smoothie', 'bs', 5, 1, 'nocook', 'banana:120 spinach:30 oats:30 soy_milk:250 peanut_butter:15',
     'Batido de plátano, espinacas y avena', 'Banana, spinach and oat smoothie',
     ['Pon todo en la batidora.', 'Tritura hasta que quede fino.', 'Sírvelo enseguida.'],
     ['Put everything in the blender.', 'Blend until smooth.', 'Drink straight away.']),
    ('toast_hummus', 'b', 5, 1, 'nocook', 'ww_bread:70 hummus:50 cucumber:60 sesame:3',
     'Tostada de hummus y pepino', 'Hummus and cucumber toast',
     ['Tuesta el pan.', 'Unta el hummus.', 'Pon el pepino en rodajas y el sésamo por encima.'],
     ['Toast the bread.', 'Spread the hummus.', 'Top with sliced cucumber and sesame.']),
    ('toast_fresh_cheese', 'b', 5, 1, 'nocook', 'ww_bread:60 fresh_cheese:80 tomato:80 olive_oil:5 orange:150',
     'Tostada de queso fresco y tomate con naranja', 'Fresh cheese and tomato toast with an orange',
     ['Tuesta el pan.', 'Pon el queso y el tomate en rodajas.', 'Aliña con el aceite y acompaña con la naranja.'],
     ['Toast the bread.', 'Top with the cheese and sliced tomato.', 'Dress with the oil and have the orange on the side.']),
    ('kefir_muesli', 'b', 5, 1, 'nocook', 'kefir:250 oats:35 raisins:15 almonds:15',
     'Kéfir con muesli casero', 'Kefir with homemade muesli',
     ['Mezcla la avena, las pasas y las almendras troceadas.', 'Échalo sobre el kéfir.', 'Deja reposar 5 minutos si te gusta más blando.'],
     ['Mix the oats, raisins and chopped almonds.', 'Pour the kefir over.', 'Leave for 5 minutes if you like it softer.']),
    ('rice_cakes_egg_avocado', 'b', 10, 1, '', 'rice_cakes:27 avocado:50 egg:55 tomato:60 salt:0.3',
     'Tortitas de arroz con aguacate y huevo', 'Rice cakes with avocado and egg',
     ['Cuece el huevo 8 minutos (o hazlo a la plancha).', 'Unta las tortitas con el aguacate machacado.', 'Pon el tomate y el huevo en rodajas, y una pizca de sal.'],
     ['Boil the egg for 8 minutes (or fry it).', 'Spread the rice cakes with mashed avocado.', 'Top with sliced tomato and egg and a pinch of salt.']),
    ('soy_yogurt_banana', 'b', 5, 1, 'nocook', 'soy_yogurt:200 banana:100 walnuts:15 chia:10',
     'Yogur de soja con plátano, nueces y chía', 'Soy yoghurt with banana, walnuts and chia',
     ['Pon el yogur en un bol con la chía.', 'Añade el plátano en rodajas.', 'Termina con las nueces troceadas.'],
     ['Stir the chia into the yoghurt.', 'Add the sliced banana.', 'Top with chopped walnuts.']),
    ('fruit_salad_seeds', 'bs', 10, 1, 'nocook', 'orange:150 kiwi:75 strawberries:100 soy_yogurt:125 pumpkin_seeds:10',
     'Macedonia con yogur de soja y pipas', 'Fruit salad with soy yoghurt and seeds',
     ['Pela y trocea la naranja y el kiwi, y corta las fresas.', 'Pon la fruta en un bol con el yogur.', 'Añade las pipas por encima.'],
     ['Peel and chop the orange and kiwi and slice the strawberries.', 'Put the fruit in a bowl with the yoghurt.', 'Sprinkle with the seeds.']),
    ('banana_peanut_smoothie', 'b', 5, 1, 'nocook', 'banana:120 soy_milk:250 peanut_butter:15 cinnamon:1',
     'Batido de plátano y cacahuete', 'Banana and peanut smoothie',
     ['Pon todo en la batidora.', 'Tritura hasta que quede fino.', 'Sírvelo frío.'],
     ['Put everything in the blender.', 'Blend until smooth.', 'Serve cold.']),
    ('toast_peanut_banana', 'b', 5, 1, 'nocook', 'ww_bread:60 peanut_butter:20 banana:100',
     'Tostada de crema de cacahuete y plátano', 'Peanut butter and banana toast',
     ['Tuesta el pan.', 'Unta la crema de cacahuete.', 'Pon el plátano en rodajas por encima.'],
     ['Toast the bread.', 'Spread the peanut butter.', 'Top with sliced banana.']),

    # ── Legumbres ──
    ('lentil_stew', 'ld', 50, 1, 'batch', 'lentils:80 potato:80 carrot:60 onion:50 green_pepper:40 canned_tomato:50 garlic:4 olive_oil:10 paprika:1 salt:1',
     'Lentejas estofadas con verduras', 'Lentil and vegetable stew',
     ['Sofríe la cebolla, el pimiento y el ajo picados con el aceite 5 minutos.', 'Añade el tomate y el pimentón, y luego las lentejas, la zanahoria y la patata troceadas.', 'Cubre con agua y cuece a fuego suave 35-40 minutos. Sala al final.'],
     ['Fry the chopped onion, pepper and garlic in the oil for 5 minutes.', 'Add the tomato and paprika, then the lentils, carrot and potato.', 'Cover with water and simmer for 35-40 minutes. Salt at the end.']),
    ('lentil_salad', 'ld', 30, 1, 'batch', 'lentils:70 red_pepper:60 onion:30 tomato:80 egg:55 olive_oil:10 vinegar:5 salt:0.5',
     'Ensalada de lentejas con pimiento y huevo', 'Lentil salad with pepper and egg',
     ['Cuece las lentejas 20-25 minutos y enfríalas (o usa lentejas de bote).', 'Cuece el huevo 10 minutos.', 'Mezcla con el pimiento, la cebolla y el tomate picados, y aliña con aceite, vinagre y sal.'],
     ['Boil the lentils for 20-25 minutes and cool them (or use tinned).', 'Hard-boil the egg for 10 minutes.', 'Mix with the chopped pepper, onion and tomato and dress with oil, vinegar and salt.']),
    ('chickpeas_spinach', 'ld', 20, 1, '', 'chickpeas:200 spinach:150 garlic:6 olive_oil:10 cumin:1 paprika:1 ww_bread:30 salt:0.5',
     'Garbanzos con espinacas', 'Chickpeas with spinach',
     ['Dora el ajo laminado en el aceite.', 'Añade las espinacas y deja que se reduzcan.', 'Incorpora los garbanzos escurridos, el comino y el pimentón; calienta 5 minutos y sirve con pan.'],
     ['Brown the sliced garlic in the oil.', 'Add the spinach and let it wilt.', 'Stir in the drained chickpeas, cumin and paprika, heat for 5 minutes and serve with bread.']),
    ('chickpea_tuna_salad', 'ld', 10, 1, 'nocook', 'chickpeas:160 tuna:60 tomato:100 cucumber:80 onion:30 olive_oil:10 lemon:10 salt:0.5',
     'Ensalada de garbanzos con atún', 'Chickpea and tuna salad',
     ['Escurre y enjuaga los garbanzos.', 'Pica el tomate, el pepino y la cebolla.', 'Mezcla todo con el atún y aliña con aceite, limón y sal.'],
     ['Drain and rinse the chickpeas.', 'Chop the tomato, cucumber and onion.', 'Mix everything with the tuna and dress with oil, lemon and salt.']),
    ('white_bean_stew', 'ld', 30, 1, 'batch', 'white_beans:220 carrot:60 leek:60 red_pepper:40 garlic:4 olive_oil:10 veg_broth:150 salt:0.5',
     'Alubias blancas con verduras', 'White beans with vegetables',
     ['Sofríe el puerro, el pimiento y el ajo picados con el aceite.', 'Añade la zanahoria en rodajas y el caldo, y cuece 10 minutos.', 'Incorpora las alubias escurridas y cuece 5 minutos más.'],
     ['Fry the chopped leek, pepper and garlic in the oil.', 'Add the sliced carrot and the stock and simmer for 10 minutes.', 'Add the drained beans and simmer 5 more minutes.']),
    ('black_bean_bowl', 'ld', 25, 1, '', 'black_beans:150 rice:60 avocado:50 corn:50 tomato:60 lemon:10 cumin:1 salt:0.5',
     'Bol de alubias negras, arroz y aguacate', 'Black bean, rice and avocado bowl',
     ['Cuece el arroz.', 'Calienta las alubias escurridas con el comino.', 'Monta el bol con el arroz, las alubias, el maíz, el tomate y el aguacate, y aliña con limón y sal.'],
     ['Cook the rice.', 'Warm the drained beans with the cumin.', 'Build the bowl with rice, beans, sweetcorn, tomato and avocado; dress with lemon and salt.']),
    ('lentil_curry', 'ld', 35, 2, 'batch', 'lentils:80 canned_tomato:100 onion:60 spinach:50 garlic:4 ginger:5 cumin:2 olive_oil:10 rice:50 salt:0.5',
     'Curry suave de lentejas con arroz', 'Mild lentil curry with rice',
     ['Sofríe la cebolla, el ajo y el jengibre picados con el aceite y el comino.', 'Añade las lentejas, el tomate y el doble de agua, y cuece 25 minutos.', 'Incorpora las espinacas al final y sirve con el arroz cocido.'],
     ['Fry the chopped onion, garlic and ginger in the oil with the cumin.', 'Add the lentils, tomato and twice their volume of water and simmer for 25 minutes.', 'Stir in the spinach at the end and serve with cooked rice.']),
    ('spinach_chickpea_salad', 'ld', 10, 1, 'nocook', 'spinach:80 chickpeas:120 apple:100 walnuts:15 olive_oil:10 vinegar:5 salt:0.5',
     'Ensalada de espinacas, garbanzos, manzana y nueces', 'Spinach, chickpea, apple and walnut salad',
     ['Lava las espinacas.', 'Trocea la manzana y las nueces, y escurre los garbanzos.', 'Mézclalo todo y aliña con aceite, vinagre y sal.'],
     ['Wash the spinach.', 'Chop the apple and walnuts and drain the chickpeas.', 'Toss everything with oil, vinegar and salt.']),
    ('pumpkin_cream', 'd', 35, 1, 'batch', 'pumpkin:300 carrot:60 onion:50 olive_oil:10 veg_broth:200 chickpeas:80 pumpkin_seeds:10 paprika:1 salt:0.5',
     'Crema de calabaza con garbanzos crujientes', 'Pumpkin soup with crispy chickpeas',
     ['Rehoga la cebolla con la mitad del aceite, añade la calabaza y la zanahoria troceadas y el caldo.', 'Cuece 20 minutos y tritura.', 'Tuesta los garbanzos en la sartén con el resto del aceite y el pimentón, y sírvelos por encima con las pipas.'],
     ['Soften the onion in half the oil, add the chopped pumpkin, carrot and stock.', 'Simmer for 20 minutes and blend.', 'Toast the chickpeas in a pan with the rest of the oil and the paprika and scatter them on top with the seeds.']),
    ('hummus_wrap', 'ld', 10, 1, 'nocook', 'ww_tortilla:60 hummus:60 carrot:50 red_pepper:50 spinach:30 cucumber:50',
     'Wrap integral de hummus y verduras', 'Hummus and vegetable wrap',
     ['Unta la tortilla con el hummus.', 'Pon la zanahoria rallada, el pimiento y el pepino en tiras y las espinacas.', 'Enrolla bien y corta por la mitad.'],
     ['Spread the hummus on the wrap.', 'Add the grated carrot, pepper and cucumber strips and the spinach.', 'Roll up tightly and cut in half.']),

    # ── Arroz, pasta y cereales ──
    ('chicken_rice', 'l', 45, 2, '', 'rice:75 chicken_thigh:120 red_pepper:50 green_beans:50 canned_tomato:50 garlic:4 olive_oil:10 paprika:1 veg_broth:250 salt:0.5',
     'Arroz con pollo y verduras', 'Rice with chicken and vegetables',
     ['Dora el pollo troceado en el aceite y apártalo.', 'Sofríe el pimiento, las judías y el ajo; añade el tomate y el pimentón.', 'Incorpora el arroz y el pollo, cubre con el caldo caliente y cuece 18 minutos sin remover. Reposa 5.'],
     ['Brown the diced chicken in the oil and set aside.', 'Fry the pepper, green beans and garlic; add the tomato and paprika.', 'Add the rice and chicken, pour in the hot stock and cook for 18 minutes without stirring. Rest for 5.']),
    ('seafood_rice', 'l', 45, 2, '', 'rice:75 shrimp:80 squid:80 red_pepper:40 canned_tomato:50 garlic:4 olive_oil:10 paprika:1 veg_broth:250 salt:0.5',
     'Arroz con gambas y calamar', 'Rice with prawns and squid',
     ['Saltea las gambas 1 minuto en el aceite y apártalas.', 'Sofríe el calamar troceado, el pimiento y el ajo; añade el tomate y el pimentón.', 'Incorpora el arroz y el caldo caliente; a los 15 minutos pon las gambas y cuece 3 más. Reposa 5.'],
     ['Fry the prawns in the oil for 1 minute and set aside.', 'Fry the chopped squid, pepper and garlic; add the tomato and paprika.', 'Add the rice and hot stock; after 15 minutes add the prawns and cook 3 more. Rest for 5.']),
    ('pasta_tuna_tomato', 'ld', 20, 1, '', 'ww_pasta:80 canned_tomato:150 tuna:60 onion:40 olive_oil:8 oregano:1 salt:0.5',
     'Macarrones integrales con tomate y atún', 'Wholewheat macaroni with tomato and tuna',
     ['Cuece la pasta según el paquete.', 'Sofríe la cebolla, añade el tomate y el orégano y deja 10 minutos.', 'Mezcla la pasta con la salsa y el atún escurrido.'],
     ['Cook the pasta as on the pack.', 'Fry the onion, add the tomato and oregano and simmer 10 minutes.', 'Toss the pasta with the sauce and the drained tuna.']),
    ('pasta_broccoli', 'ld', 20, 1, '', 'ww_pasta:80 broccoli:150 garlic:6 olive_oil:10 parmesan:15 salt:0.5',
     'Pasta integral con brócoli, ajo y parmesano', 'Wholewheat pasta with broccoli, garlic and parmesan',
     ['Cuece la pasta y, en los últimos 4 minutos, añade el brócoli en ramitos.', 'Dora el ajo laminado en el aceite.', 'Mezcla la pasta y el brócoli escurridos con el ajo y el parmesano.'],
     ['Cook the pasta and add the broccoli florets for the last 4 minutes.', 'Brown the sliced garlic in the oil.', 'Toss the drained pasta and broccoli with the garlic and parmesan.']),
    ('lentil_bolognese', 'ld', 35, 1, 'batch', 'pasta:80 lentils:40 carrot:40 onion:40 canned_tomato:150 olive_oil:8 oregano:1 salt:0.5',
     'Espaguetis con boloñesa de lentejas', 'Spaghetti with lentil bolognese',
     ['Sofríe la cebolla y la zanahoria picadas con el aceite.', 'Añade las lentejas, el tomate, el orégano y un vaso de agua, y cuece 25 minutos.', 'Sirve sobre la pasta cocida.'],
     ['Fry the chopped onion and carrot in the oil.', 'Add the lentils, tomato, oregano and a glass of water and simmer for 25 minutes.', 'Serve over the cooked pasta.']),
    ('beef_bolognese', 'ld', 30, 1, 'batch', 'pasta:80 beef_mince:100 canned_tomato:150 onion:40 carrot:40 olive_oil:6 salt:0.5',
     'Espaguetis a la boloñesa', 'Spaghetti bolognese',
     ['Sofríe la cebolla y la zanahoria picadas.', 'Añade la carne y dórala; luego el tomate, y cuece 15 minutos.', 'Sirve sobre la pasta cocida.'],
     ['Fry the chopped onion and carrot.', 'Add the mince and brown it, then the tomato, and simmer for 15 minutes.', 'Serve over the cooked pasta.']),
    ('quinoa_feta_salad', 'ld', 20, 1, 'batch', 'quinoa:60 cucumber:80 tomato:100 red_pepper:50 feta:30 olives:15 olive_oil:10 lemon:10',
     'Ensalada de quinoa con verduras y feta', 'Quinoa salad with vegetables and feta',
     ['Lava la quinoa y cuécela 12 minutos; enfríala.', 'Pica el pepino, el tomate y el pimiento.', 'Mezcla con la feta desmenuzada y las aceitunas, y aliña con aceite y limón.'],
     ['Rinse the quinoa and cook it for 12 minutes; let it cool.', 'Chop the cucumber, tomato and pepper.', 'Mix with the crumbled feta and olives and dress with oil and lemon.']),
    ('couscous_chickpeas', 'ld', 25, 1, '', 'couscous:60 chickpeas:120 zucchini:100 red_pepper:60 onion:40 olive_oil:10 cumin:1 salt:0.5',
     'Cuscús con garbanzos y verduras', 'Couscous with chickpeas and vegetables',
     ['Saltea la cebolla, el calabacín y el pimiento en dados con el aceite y el comino.', 'Hidrata el cuscús con el mismo volumen de agua caliente 5 minutos.', 'Mezcla el cuscús con las verduras y los garbanzos.'],
     ['Fry the diced onion, courgette and pepper in the oil with the cumin.', 'Soak the couscous in the same volume of hot water for 5 minutes.', 'Mix the couscous with the vegetables and chickpeas.']),
    ('rice_tuna_salad', 'ld', 20, 1, 'batch', 'rice:60 tuna:60 corn:50 egg:55 tomato:80 lettuce:40 olive_oil:10 salt:0.5',
     'Ensalada de arroz con atún, maíz y huevo', 'Rice salad with tuna, sweetcorn and egg',
     ['Cuece el arroz y el huevo; enfríalos.', 'Pica el tomate y la lechuga.', 'Mezcla todo con el atún y el maíz, y aliña.'],
     ['Cook the rice and hard-boil the egg; let them cool.', 'Chop the tomato and lettuce.', 'Mix everything with the tuna and sweetcorn and dress.']),
    ('tofu_rice_bowl', 'ld', 30, 1, '', 'brown_rice:60 tofu:150 broccoli:100 carrot:60 soy_sauce:10 sesame:5 olive_oil:8',
     'Bol de arroz integral con tofu y verduras', 'Brown rice bowl with tofu and vegetables',
     ['Cuece el arroz integral.', 'Dora el tofu en dados con el aceite y añade la salsa de soja.', 'Saltea el brócoli y la zanahoria 4 minutos y monta el bol con sésamo por encima.'],
     ['Cook the brown rice.', 'Brown the diced tofu in the oil and add the soy sauce.', 'Stir-fry the broccoli and carrot for 4 minutes and build the bowl; top with sesame.']),
    ('potato_omelette', 'ld', 35, 2, '', 'potato:200 egg:110 onion:50 olive_oil:15 lettuce:60 tomato:80 salt:1',
     'Tortilla de patatas con ensalada', 'Spanish omelette with salad',
     ['Corta la patata y la cebolla finas y cuécelas a fuego suave en el aceite 20 minutos, tapadas.', 'Escúrrelas y mézclalas con los huevos batidos y la sal.', 'Cuaja la tortilla por los dos lados y sirve con la ensalada.'],
     ['Slice the potato and onion thinly and cook them gently in the oil, covered, for 20 minutes.', 'Drain and mix with the beaten eggs and salt.', 'Set the omelette on both sides and serve with the salad.']),
    ('mushroom_risotto', 'ld', 35, 3, '', 'rice:75 mushrooms:150 onion:40 parmesan:15 olive_oil:8 veg_broth:300 salt:0.5',
     'Risotto de champiñones', 'Mushroom risotto',
     ['Sofríe la cebolla picada y los champiñones laminados con el aceite.', 'Añade el arroz, remueve 1 minuto y ve añadiendo el caldo caliente poco a poco, sin dejar de remover, 18 minutos.', 'Fuera del fuego, añade el parmesano y deja reposar 2 minutos.'],
     ['Fry the chopped onion and sliced mushrooms in the oil.', 'Add the rice, stir for 1 minute, then add the hot stock a little at a time, stirring, for 18 minutes.', 'Off the heat, stir in the parmesan and rest for 2 minutes.']),
    ('pasta_caprese_salad', 'ld', 20, 1, 'batch', 'pasta:70 tomato:100 mozzarella:50 arugula:30 olives:15 olive_oil:10 salt:0.5',
     'Ensalada de pasta con tomate, mozzarella y rúcula', 'Pasta salad with tomato, mozzarella and rocket',
     ['Cuece la pasta y enfríala.', 'Trocea el tomate y la mozzarella.', 'Mezcla con la rúcula y las aceitunas, y aliña.'],
     ['Cook the pasta and let it cool.', 'Chop the tomato and mozzarella.', 'Toss with the rocket and olives and dress.']),

    # ── Pescado y marisco ──
    ('salmon_potato_asparagus', 'ld', 30, 1, '', 'salmon:140 potato:200 asparagus:120 olive_oil:8 lemon:10 salt:0.5',
     'Salmón al horno con patata y espárragos', 'Baked salmon with potato and asparagus',
     ['Hornea la patata en rodajas con la mitad del aceite a 200 °C 15 minutos.', 'Añade el salmón y los espárragos con el resto del aceite y la sal.', 'Hornea 12 minutos más y sirve con limón.'],
     ['Roast the sliced potato with half the oil at 200 °C for 15 minutes.', 'Add the salmon and asparagus with the rest of the oil and the salt.', 'Roast 12 more minutes and serve with lemon.']),
    ('fish_papillote', 'ld', 30, 1, '', 'white_fish:170 zucchini:100 carrot:60 leek:50 olive_oil:8 lemon:10 brown_rice:50 salt:0.5',
     'Merluza en papillote con verduras', 'Hake en papillote with vegetables',
     ['Cuece el arroz integral.', 'Pon el pescado sobre las verduras en tiras en papel de horno, con el aceite, el limón y la sal, y ciérralo.', 'Hornea a 200 °C 15 minutos y sirve con el arroz.'],
     ['Cook the brown rice.', 'Put the fish on the vegetable strips on baking paper with the oil, lemon and salt and seal it.', 'Bake at 200 °C for 15 minutes and serve with the rice.']),
    ('sardine_salad', 'ld', 10, 1, 'nocook', 'sardines:90 tomato:150 onion:30 lettuce:60 olive_oil:5 ww_bread:50',
     'Ensalada de sardinas y tomate con pan', 'Sardine and tomato salad with bread',
     ['Corta el tomate, la cebolla y la lechuga.', 'Pon las sardinas escurridas por encima.', 'Aliña con el aceite y acompaña con el pan.'],
     ['Cut the tomato, onion and lettuce.', 'Top with the drained sardines.', 'Dress with the oil and serve with bread.']),
    ('mackerel_potato', 'ld', 30, 1, '', 'mackerel:150 potato:180 green_beans:100 olive_oil:8 vinegar:5 salt:0.5',
     'Caballa a la plancha con patata y judías', 'Grilled mackerel with potato and green beans',
     ['Cuece la patata y las judías verdes 15 minutos.', 'Haz la caballa a la plancha 3 minutos por lado.', 'Sirve con las verduras aliñadas con aceite y vinagre.'],
     ['Boil the potato and green beans for 15 minutes.', 'Grill the mackerel for 3 minutes per side.', 'Serve with the vegetables dressed with oil and vinegar.']),
    ('trout_almonds', 'ld', 30, 1, '', 'trout:170 green_beans:150 potato:120 almonds:10 olive_oil:8 lemon:10 salt:0.5',
     'Trucha al horno con almendras', 'Baked trout with almonds',
     ['Cuece la patata y las judías 15 minutos.', 'Hornea la trucha con el aceite y la sal a 200 °C 12 minutos, con las almendras laminadas por encima.', 'Sirve con las verduras y el limón.'],
     ['Boil the potato and green beans for 15 minutes.', 'Bake the trout with the oil and salt at 200 °C for 12 minutes, topped with flaked almonds.', 'Serve with the vegetables and lemon.']),
    ('mussels_tomato', 'ld', 20, 1, '', 'mussels:150 canned_tomato:120 onion:40 garlic:4 olive_oil:8 ww_bread:50',
     'Mejillones en salsa de tomate', 'Mussels in tomato sauce',
     ['Sofríe la cebolla y el ajo picados con el aceite y añade el tomate; deja 10 minutos.', 'Abre los mejillones al vapor en una olla tapada 3-4 minutos.', 'Mézclalos con la salsa y sirve con el pan.'],
     ['Fry the chopped onion and garlic in the oil, add the tomato and simmer 10 minutes.', 'Steam the mussels in a covered pot for 3-4 minutes until open.', 'Toss them in the sauce and serve with bread.']),
    ('garlic_prawns_zucchini', 'ld', 15, 1, '', 'shrimp:120 zucchini:200 garlic:8 olive_oil:10 parsley:5 ww_bread:50 salt:0.5',
     'Gambas al ajillo con calabacín', 'Garlic prawns with courgette',
     ['Saltea el calabacín en dados con la mitad del aceite 5 minutos y apártalo.', 'Dora el ajo laminado en el resto del aceite y añade las gambas 2 minutos.', 'Junta todo con el perejil y sirve con pan.'],
     ['Fry the diced courgette in half the oil for 5 minutes and set aside.', 'Brown the sliced garlic in the rest of the oil and add the prawns for 2 minutes.', 'Combine with the parsley and serve with bread.']),
    ('cod_chickpea_stew', 'ld', 30, 1, 'batch', 'chickpeas:160 white_fish:120 spinach:100 onion:40 garlic:4 olive_oil:8 paprika:1 salt:0.5',
     'Potaje de garbanzos con bacalao y espinacas', 'Chickpea stew with cod and spinach',
     ['Sofríe la cebolla y el ajo con el aceite y el pimentón.', 'Añade los garbanzos con un poco de agua y las espinacas; cuece 10 minutos.', 'Pon el pescado en trozos los últimos 5 minutos.'],
     ['Fry the onion and garlic in the oil with the paprika.', 'Add the chickpeas with a little water and the spinach and simmer for 10 minutes.', 'Add the fish in chunks for the last 5 minutes.']),
    ('salmon_quinoa_bowl', 'ld', 25, 1, '', 'salmon:120 quinoa:50 avocado:50 cucumber:80 edamame:50 soy_sauce:8 sesame:3',
     'Bol de salmón, quinoa y aguacate', 'Salmon, quinoa and avocado bowl',
     ['Cuece la quinoa 12 minutos y el edamame 4.', 'Haz el salmón a la plancha y desmígalo.', 'Monta el bol con el aguacate y el pepino, y aliña con la soja y el sésamo.'],
     ['Cook the quinoa for 12 minutes and the edamame for 4.', 'Pan-fry the salmon and flake it.', 'Build the bowl with avocado and cucumber; dress with soy sauce and sesame.']),
    ('potato_tuna_salad', 'ld', 25, 1, 'batch', 'potato:200 tuna:60 egg:55 tomato:100 green_pepper:40 onion:30 olives:15 olive_oil:10 vinegar:5 salt:0.5',
     'Ensalada campera', 'Spanish potato salad',
     ['Cuece la patata en dados 12 minutos y el huevo 10.', 'Pica el tomate, el pimiento y la cebolla.', 'Mezcla todo con el atún y las aceitunas, y aliña con aceite, vinagre y sal.'],
     ['Boil the diced potato for 12 minutes and the egg for 10.', 'Chop the tomato, pepper and onion.', 'Mix everything with the tuna and olives; dress with oil, vinegar and salt.']),
    ('grilled_squid', 'ld', 15, 1, '', 'squid:180 lettuce:80 tomato:100 garlic:4 parsley:5 olive_oil:10 ww_bread:50 salt:0.5',
     'Calamares a la plancha con ensalada', 'Grilled squid with salad',
     ['Corta el calamar en anillas y hazlo a la plancha muy caliente 3-4 minutos.', 'Aliña con el ajo y el perejil picados en el aceite.', 'Sirve con la ensalada y el pan.'],
     ['Cut the squid into rings and sear on a very hot pan for 3-4 minutes.', 'Dress with chopped garlic and parsley in the oil.', 'Serve with the salad and bread.']),
    ('tuna_sandwich', 'ld', 5, 1, 'nocook', 'baguette:90 tuna:70 tomato:60 lettuce:30 olive_oil:5',
     'Bocadillo de atún, tomate y lechuga', 'Tuna, tomato and lettuce sandwich',
     ['Abre el pan y riégalo con el aceite.', 'Pon el tomate en rodajas y la lechuga.', 'Añade el atún escurrido y cierra.'],
     ['Split the bread and drizzle with the oil.', 'Add sliced tomato and lettuce.', 'Top with the drained tuna and close.']),

    # ── Carne ──
    ('chicken_salad_potato', 'ld', 25, 1, '', 'chicken_breast:150 potato:200 lettuce:80 tomato:100 olive_oil:10 salt:0.5',
     'Pollo a la plancha con ensalada y patata', 'Grilled chicken with salad and potato',
     ['Cuece la patata 15 minutos.', 'Haz la pechuga a la plancha 4-5 minutos por lado.', 'Sirve con la ensalada aliñada.'],
     ['Boil the potato for 15 minutes.', 'Grill the chicken breast for 4-5 minutes per side.', 'Serve with the dressed salad.']),
    ('chicken_curry', 'ld', 30, 2, 'batch', 'chicken_breast:140 rice:70 onion:60 canned_tomato:80 yogurt:50 cumin:2 ginger:5 olive_oil:8 salt:0.5',
     'Pollo al curry suave con arroz', 'Mild chicken curry with rice',
     ['Sofríe la cebolla y el jengibre picados con el aceite y el comino.', 'Añade el pollo en dados y el tomate, y cuece 15 minutos.', 'Fuera del fuego, añade el yogur y sirve con el arroz cocido.'],
     ['Fry the chopped onion and ginger in the oil with the cumin.', 'Add the diced chicken and the tomato and simmer for 15 minutes.', 'Off the heat, stir in the yoghurt and serve with cooked rice.']),
    ('chicken_stirfry', 'ld', 25, 1, '', 'chicken_breast:130 brown_rice:60 broccoli:100 red_pepper:60 carrot:50 soy_sauce:10 ginger:3 olive_oil:8',
     'Salteado de pollo con verduras y arroz integral', 'Chicken stir-fry with vegetables and brown rice',
     ['Cuece el arroz integral.', 'Saltea el pollo en tiras con el aceite y el jengibre.', 'Añade las verduras troceadas y la soja y saltea 4 minutos a fuego fuerte.'],
     ['Cook the brown rice.', 'Stir-fry the chicken strips in the oil with the ginger.', 'Add the chopped vegetables and soy sauce and stir-fry for 4 minutes over high heat.']),
    ('chicken_wrap', 'ld', 15, 1, '', 'ww_tortilla:60 chicken_breast:110 avocado:40 lettuce:40 tomato:60 greek_yogurt:30 salt:0.5',
     'Wrap de pollo, aguacate y lechuga', 'Chicken, avocado and lettuce wrap',
     ['Haz el pollo a la plancha y córtalo en tiras.', 'Unta la tortilla con el yogur y pon la lechuga, el tomate y el aguacate.', 'Añade el pollo, enrolla y corta.'],
     ['Grill the chicken and slice it.', 'Spread the yoghurt on the wrap and add lettuce, tomato and avocado.', 'Add the chicken, roll up and cut.']),
    ('turkey_meatballs', 'ld', 40, 2, 'batch', 'turkey_breast:140 egg:20 ww_bread:15 canned_tomato:150 onion:40 olive_oil:8 rice:60 salt:0.5',
     'Albóndigas de pavo en salsa de tomate', 'Turkey meatballs in tomato sauce',
     ['Pica el pavo y mézclalo con el huevo, el pan desmigado y la sal; forma bolitas.', 'Dóralas en el aceite y apártalas; sofríe la cebolla y añade el tomate.', 'Cuece las albóndigas en la salsa 15 minutos y sirve con el arroz.'],
     ['Mince the turkey and mix with the egg, crumbled bread and salt; shape into balls.', 'Brown them in the oil and set aside; fry the onion and add the tomato.', 'Simmer the meatballs in the sauce for 15 minutes and serve with rice.']),
    ('beef_stew', 'ld', 75, 2, 'batch', 'beef:140 potato:180 carrot:80 onion:60 peas:50 olive_oil:10 veg_broth:200 salt:0.5',
     'Estofado de ternera con patata y zanahoria', 'Beef stew with potato and carrot',
     ['Dora la carne en dados con el aceite y añade la cebolla picada.', 'Cubre con el caldo y cuece tapado a fuego suave 45 minutos.', 'Añade la patata, la zanahoria y los guisantes, y cuece 20 minutos más.'],
     ['Brown the diced beef in the oil and add the chopped onion.', 'Cover with the stock and simmer, covered, for 45 minutes.', 'Add the potato, carrot and peas and cook 20 more minutes.']),
    ('pork_peppers', 'ld', 25, 1, '', 'pork_loin:140 red_pepper:100 green_pepper:60 potato:180 olive_oil:10 salt:0.5',
     'Lomo a la plancha con pimientos y patata', 'Grilled pork loin with peppers and potato',
     ['Cuece o asa la patata.', 'Saltea los pimientos en tiras con el aceite 10 minutos.', 'Haz el lomo a la plancha 2-3 minutos por lado y sirve con todo.'],
     ['Boil or roast the potato.', 'Fry the sliced peppers in the oil for 10 minutes.', 'Grill the pork for 2-3 minutes per side and serve together.']),
    ('beef_burger', 'ld', 30, 1, '', 'beef_mince:130 baguette:60 lettuce:40 tomato:80 onion:20 sweet_potato:150 olive_oil:6 salt:0.5',
     'Hamburguesa casera con boniato asado', 'Homemade burger with roast sweet potato',
     ['Asa el boniato en bastones con el aceite a 200 °C 25 minutos.', 'Forma la hamburguesa con la carne y la sal, y hazla a la plancha 3-4 minutos por lado.', 'Monta en el pan con la lechuga, el tomate y la cebolla.'],
     ['Roast the sweet potato wedges with the oil at 200 °C for 25 minutes.', 'Shape the mince into a patty with the salt and grill it 3-4 minutes per side.', 'Assemble in the bread with lettuce, tomato and onion.']),
    ('chicken_chickpea_stew', 'ld', 40, 1, 'batch', 'chicken_thigh:120 chickpeas:120 carrot:60 onion:50 canned_tomato:80 olive_oil:8 paprika:1 veg_broth:150 salt:0.5',
     'Guiso de pollo con garbanzos', 'Chicken and chickpea stew',
     ['Dora el pollo troceado en el aceite.', 'Añade la cebolla, la zanahoria, el tomate y el pimentón, y sofríe 5 minutos.', 'Incorpora los garbanzos y el caldo, y cuece 20 minutos.'],
     ['Brown the chicken pieces in the oil.', 'Add the onion, carrot, tomato and paprika and fry for 5 minutes.', 'Add the chickpeas and stock and simmer for 20 minutes.']),
    ('stuffed_peppers', 'ld', 50, 2, 'batch', 'red_pepper:200 beef_mince:90 rice:40 onion:40 canned_tomato:80 olive_oil:6 salt:0.5',
     'Pimientos rellenos de carne y arroz', 'Peppers stuffed with beef and rice',
     ['Cuece el arroz 10 minutos.', 'Sofríe la cebolla con la carne, añade el tomate y el arroz.', 'Rellena los pimientos vaciados y hornea a 180 °C 30 minutos.'],
     ['Par-boil the rice for 10 minutes.', 'Fry the onion with the mince, then add the tomato and rice.', 'Fill the hollowed peppers and bake at 180 °C for 30 minutes.']),
    ('roast_chicken_veg', 'ld', 50, 1, 'batch', 'chicken_thigh:160 potato:150 onion:60 red_pepper:60 zucchini:80 olive_oil:10 oregano:1 salt:0.5',
     'Pollo al horno con verduras', 'Roast chicken with vegetables',
     ['Corta la patata y las verduras en trozos grandes.', 'Ponlas en la bandeja con el pollo, el aceite, el orégano y la sal.', 'Hornea a 200 °C 40 minutos, dándole la vuelta a mitad.'],
     ['Cut the potato and vegetables into large chunks.', 'Put them in a tray with the chicken, oil, oregano and salt.', 'Roast at 200 °C for 40 minutes, turning halfway.']),
    ('turkey_sandwich', 'ld', 5, 1, 'nocook', 'baguette:80 turkey_slices:60 fresh_cheese:40 tomato:60',
     'Bocadillo de pavo, queso fresco y tomate', 'Turkey, fresh cheese and tomato sandwich',
     ['Abre el pan.', 'Pon el tomate en rodajas, el queso y el pavo.', 'Cierra y listo.'],
     ['Split the bread.', 'Add sliced tomato, the cheese and the turkey.', 'Close and enjoy.']),

    # ── Huevo y verdura ──
    ('zucchini_omelette', 'ld', 20, 1, '', 'egg:110 zucchini:150 onion:50 olive_oil:10 ww_bread:40 salt:0.5',
     'Tortilla de calabacín y cebolla', 'Courgette and onion omelette',
     ['Pocha el calabacín y la cebolla en dados con el aceite 10 minutos.', 'Mézclalos con los huevos batidos y la sal.', 'Cuaja la tortilla por los dos lados y sirve con pan.'],
     ['Soften the diced courgette and onion in the oil for 10 minutes.', 'Mix with the beaten eggs and salt.', 'Set the omelette on both sides and serve with bread.']),
    ('pisto_egg', 'ld', 40, 1, 'batch', 'zucchini:150 eggplant:100 red_pepper:60 onion:60 canned_tomato:120 olive_oil:12 egg:55 ww_bread:40 salt:0.5',
     'Pisto con huevo', 'Spanish ratatouille with egg',
     ['Pocha la cebolla y el pimiento con el aceite 10 minutos.', 'Añade el calabacín y la berenjena en dados, y luego el tomate; cuece 20 minutos.', 'Sirve con un huevo a la plancha y pan.'],
     ['Soften the onion and pepper in the oil for 10 minutes.', 'Add the diced courgette and aubergine, then the tomato, and cook for 20 minutes.', 'Serve with a fried egg and bread.']),
    ('stuffed_sweet_potato', 'ld', 45, 1, '', 'sweet_potato:250 chickpeas:100 greek_yogurt:50 spinach:40 olive_oil:6 cumin:1 salt:0.5',
     'Boniato asado relleno de garbanzos', 'Roast sweet potato stuffed with chickpeas',
     ['Asa el boniato entero a 200 °C 40 minutos (o 8 en el microondas).', 'Saltea las espinacas y los garbanzos con el aceite y el comino.', 'Abre el boniato, rellénalo y pon el yogur por encima.'],
     ['Roast the whole sweet potato at 200 °C for 40 minutes (or 8 in the microwave).', 'Fry the spinach and chickpeas in the oil with the cumin.', 'Split the sweet potato, fill it and top with the yoghurt.']),
    ('mushroom_scramble', 'ld', 15, 1, '', 'mushrooms:150 spinach:80 egg:110 garlic:4 olive_oil:8 ww_bread:50 salt:0.5',
     'Revuelto de champiñones y espinacas', 'Mushroom and spinach scrambled eggs',
     ['Saltea los champiñones laminados y el ajo con el aceite 5 minutos.', 'Añade las espinacas y, cuando se reduzcan, los huevos batidos con la sal.', 'Remueve hasta que cuajen y sirve con pan.'],
     ['Fry the sliced mushrooms and garlic in the oil for 5 minutes.', 'Add the spinach and, once wilted, the eggs beaten with salt.', 'Stir until just set and serve with bread.']),
    ('caprese', 'ld', 10, 1, 'nocook', 'tomato:200 mozzarella:80 arugula:30 basil:5 olive_oil:10 ww_bread:50 salt:0.5',
     'Ensalada caprese con pan', 'Caprese salad with bread',
     ['Corta el tomate y la mozzarella en rodajas.', 'Colócalos sobre la rúcula con la albahaca.', 'Aliña con aceite y sal y acompaña con pan.'],
     ['Slice the tomato and mozzarella.', 'Arrange them on the rocket with the basil.', 'Dress with oil and salt and serve with bread.']),
    ('tofu_curry', 'ld', 30, 1, 'batch', 'tofu:150 cauliflower:120 canned_tomato:100 onion:50 soy_milk:80 ginger:5 cumin:2 olive_oil:8 rice:60 salt:0.5',
     'Curry de tofu y coliflor con arroz', 'Tofu and cauliflower curry with rice',
     ['Sofríe la cebolla y el jengibre con el aceite y el comino.', 'Añade la coliflor en ramitos, el tomate y la bebida de soja, y cuece 15 minutos.', 'Incorpora el tofu en dados 5 minutos y sirve con el arroz.'],
     ['Fry the onion and ginger in the oil with the cumin.', 'Add the cauliflower florets, tomato and soy drink and simmer for 15 minutes.', 'Add the diced tofu for 5 minutes and serve with rice.']),
    ('tempeh_stirfry', 'ld', 25, 2, '', 'tempeh:120 quinoa:50 broccoli:100 red_pepper:60 soy_sauce:10 sesame:3 olive_oil:8',
     'Salteado de tempeh con verduras y quinoa', 'Tempeh stir-fry with vegetables and quinoa',
     ['Cuece la quinoa 12 minutos.', 'Dora el tempeh en dados con el aceite.', 'Añade las verduras y la soja, saltea 4 minutos y sirve con la quinoa y el sésamo.'],
     ['Cook the quinoa for 12 minutes.', 'Brown the diced tempeh in the oil.', 'Add the vegetables and soy sauce, stir-fry 4 minutes and serve with the quinoa and sesame.']),
    ('zucchini_cream', 'd', 30, 1, 'batch', 'zucchini:300 potato:80 leek:60 olive_oil:8 cottage:60 ww_bread:40 salt:0.5',
     'Crema de calabacín con queso fresco', 'Courgette soup with fresh cheese',
     ['Rehoga el puerro con el aceite, añade el calabacín y la patata troceados y cubre con agua.', 'Cuece 20 minutos y tritura con el queso.', 'Sirve con pan tostado.'],
     ['Soften the leek in the oil, add the chopped courgette and potato and cover with water.', 'Simmer for 20 minutes and blend with the cheese.', 'Serve with toast.']),
    ('gazpacho_egg', 'ld', 15, 1, 'nocook', 'tomato:250 cucumber:60 green_pepper:40 garlic:2 olive_oil:12 vinegar:8 ww_bread:40 egg:55 salt:0.5',
     'Gazpacho con huevo duro', 'Gazpacho with hard-boiled egg',
     ['Tritura el tomate, el pepino, el pimiento, el ajo, el vinagre y la sal; añade el aceite al final.', 'Enfríalo en la nevera.', 'Sirve con el huevo duro picado y el pan.'],
     ['Blend the tomato, cucumber, pepper, garlic, vinegar and salt; add the oil at the end.', 'Chill in the fridge.', 'Serve with the chopped hard-boiled egg and bread.']),
    ('vegetable_menestra', 'ld', 35, 1, 'batch', 'green_beans:100 artichoke:100 peas:70 carrot:60 potato:100 garlic:4 olive_oil:10 egg:55 salt:0.5',
     'Menestra de verduras con huevo', 'Mixed vegetable stew with egg',
     ['Cuece la patata, la zanahoria y las judías 12 minutos; añade la alcachofa y los guisantes 5 minutos más.', 'Escurre y saltea con el ajo y el aceite.', 'Sirve con el huevo duro en cuartos.'],
     ['Boil the potato, carrot and green beans for 12 minutes; add the artichoke and peas for 5 more.', 'Drain and fry with the garlic and oil.', 'Serve with the hard-boiled egg in quarters.']),
    ('greek_salad', 'ld', 10, 1, 'nocook', 'lettuce:60 tomato:120 cucumber:80 onion:20 feta:40 olives:20 olive_oil:10 ww_bread:40 oregano:1',
     'Ensalada griega con pan', 'Greek salad with bread',
     ['Trocea la lechuga, el tomate, el pepino y la cebolla.', 'Añade la feta y las aceitunas.', 'Aliña con aceite y orégano y acompaña con pan.'],
     ['Chop the lettuce, tomato, cucumber and onion.', 'Add the feta and olives.', 'Dress with oil and oregano and serve with bread.']),
    ('shakshuka', 'ld', 25, 1, '', 'egg:110 canned_tomato:200 red_pepper:80 onion:50 olive_oil:10 cumin:1 ww_bread:50 salt:0.5',
     'Huevos con tomate y pimiento (shakshuka)', 'Eggs in tomato and pepper (shakshuka)',
     ['Pocha la cebolla y el pimiento con el aceite y el comino 8 minutos.', 'Añade el tomate y cuece 10 minutos.', 'Haz dos huecos, casca los huevos y tapa hasta que cuajen. Sirve con pan.'],
     ['Soften the onion and pepper in the oil with the cumin for 8 minutes.', 'Add the tomato and simmer for 10 minutes.', 'Make two wells, crack in the eggs and cover until set. Serve with bread.']),
    ('broccoli_cauli_bake', 'd', 30, 1, '', 'broccoli:150 cauliflower:150 milk:100 mozzarella:40 cooked_ham:40 olive_oil:5 salt:0.5',
     'Brócoli y coliflor gratinados con jamón', 'Broccoli and cauliflower gratin with ham',
     ['Cuece el brócoli y la coliflor en ramitos 6 minutos.', 'Ponlos en una fuente con el jamón picado y la leche.', 'Cubre con la mozzarella y gratina 10 minutos a 220 °C.'],
     ['Boil the broccoli and cauliflower florets for 6 minutes.', 'Put them in a dish with the chopped ham and the milk.', 'Top with the mozzarella and grill at 220 °C for 10 minutes.']),

    # ── Tentempiés ──
    ('fruit_almonds', 's', 1, 1, 'nocook', 'apple:150 almonds:20', 'Manzana y almendras', 'Apple and almonds',
     ['Lava la manzana.', 'Acompáñala con un puñado de almendras.'], ['Wash the apple.', 'Have it with a handful of almonds.']),
    ('yogurt_walnuts', 's', 1, 1, 'nocook', 'yogurt:125 walnuts:15', 'Yogur natural con nueces', 'Plain yoghurt with walnuts',
     ['Pon las nueces troceadas sobre el yogur.'], ['Top the yoghurt with chopped walnuts.']),
    ('hummus_carrots', 's', 5, 1, 'nocook', 'hummus:60 carrot:120', 'Hummus con palitos de zanahoria', 'Hummus with carrot sticks',
     ['Corta la zanahoria en bastones.', 'Mójalos en el hummus.'], ['Cut the carrot into sticks.', 'Dip them in the hummus.']),
    ('banana_peanut', 's', 1, 1, 'nocook', 'banana:120 peanut_butter:15', 'Plátano con crema de cacahuete', 'Banana with peanut butter',
     ['Corta el plátano en rodajas.', 'Úntalas con la crema de cacahuete.'], ['Slice the banana.', 'Spread with the peanut butter.']),
    ('cottage_pineapple', 's', 3, 1, 'nocook', 'cottage:150 pineapple:100', 'Queso fresco batido con piña', 'Quark with pineapple',
     ['Trocea la piña.', 'Mézclala con el queso batido.'], ['Chop the pineapple.', 'Mix it with the quark.']),
    ('chocolate_hazelnuts', 's', 1, 1, 'nocook', 'dark_chocolate:20 hazelnuts:15', 'Chocolate negro y avellanas', 'Dark chocolate and hazelnuts',
     ['Dos onzas de chocolate y un puñado pequeño de avellanas.'], ['Two squares of chocolate and a small handful of hazelnuts.']),
    ('rice_cakes_avocado', 's', 3, 1, 'nocook', 'rice_cakes:20 avocado:40 tomato:40 salt:0.3', 'Tortitas de arroz con aguacate y tomate', 'Rice cakes with avocado and tomato',
     ['Unta las tortitas con el aguacate machacado.', 'Pon el tomate en rodajas y una pizca de sal.'], ['Spread the rice cakes with mashed avocado.', 'Top with sliced tomato and a pinch of salt.']),
    ('kefir_blueberries', 's', 1, 1, 'nocook', 'kefir:200 blueberries:60', 'Kéfir con arándanos', 'Kefir with blueberries',
     ['Sirve el kéfir con los arándanos.'], ['Serve the kefir with the blueberries.']),
    ('edamame_snack', 's', 5, 1, '', 'edamame:120 salt:0.5', 'Edamame con sal', 'Salted edamame',
     ['Cuece el edamame 4 minutos.', 'Escúrrelo y ponle sal gruesa.'], ['Boil the edamame for 4 minutes.', 'Drain and sprinkle with sea salt.']),
    ('orange_pistachios', 's', 2, 1, 'nocook', 'orange:180 pistachios:15', 'Naranja y pistachos', 'Orange and pistachios',
     ['Pela la naranja.', 'Acompáñala con los pistachos.'], ['Peel the orange.', 'Have it with the pistachios.']),
    ('soy_yogurt_chia', 's', 2, 1, 'nocook', 'soy_yogurt:125 chia:10 kiwi:75', 'Yogur de soja con chía y kiwi', 'Soy yoghurt with chia and kiwi',
     ['Mezcla la chía con el yogur.', 'Añade el kiwi troceado.'], ['Stir the chia into the yoghurt.', 'Add the chopped kiwi.']),
    ('dates_almonds', 's', 1, 1, 'nocook', 'dates:30 almonds:15', 'Dátiles con almendras', 'Dates with almonds',
     ['Abre los dátiles y pon una almendra dentro de cada uno.'], ['Open the dates and put an almond inside each.']),
    ('egg_tomatoes', 's', 10, 1, '', 'egg:55 tomato:100 salt:0.3', 'Huevo duro con tomate', 'Hard-boiled egg with tomato',
     ['Cuece el huevo 10 minutos.', 'Sírvelo con el tomate en gajos y una pizca de sal.'], ['Hard-boil the egg for 10 minutes.', 'Serve with tomato wedges and a pinch of salt.']),
    ('pear_cheese', 's', 2, 1, 'nocook', 'pear:150 fresh_cheese:50', 'Pera con queso fresco', 'Pear with fresh cheese',
     ['Corta la pera en gajos.', 'Acompáñala con el queso.'], ['Cut the pear into wedges.', 'Have it with the cheese.']),
]

KIND = {'P': 'plant', 'D': 'dairy', 'E': 'egg', 'F': 'fish', 'S': 'seafood', 'M': 'meat'}
MEALS = {'b': 'breakfast', 'l': 'lunch', 'd': 'dinner', 's': 'snack'}


def main():
    d = Path(sys.argv[1])
    ids = {str(row[1]) for row in F}
    per100 = {i: {} for i in ids}
    with open(d / 'food_nutrient.csv', encoding='utf-8') as f:
        for r in csv.DictReader(f):
            if r['fdc_id'] in ids and r['nutrient_id'] in NUTRIENTS:
                per100[r['fdc_id']][NUTRIENTS[r['nutrient_id']]] = float(r['amount'] or 0)

    foods = {}
    for (fid, fdc, es, en, section, eur, kind, allergens, groups, flags, piece) in F:
        if fid in foods:
            sys.exit(f'Repetido: {fid}')
        n = per100[str(fdc)]
        if 'kcal' not in n:
            sys.exit(f'Sin energía en USDA: {fid} ({fdc})')
        nut = {k: n.get(k, 0.0) for k in ['kcal', 'protein', 'fat', 'satFat', 'carbs', 'sugars', 'fiber', 'sodium', 'potassium',
                                          'calcium', 'iron', 'magnesium', 'vitC', 'vitD', 'b12', 'folate', 'cholesterol']}
        nut['omega3'] = n.get('ala', 0) + n.get('epa', 0) + n.get('dha', 0)
        nut['epaDha'] = n.get('epa', 0) + n.get('dha', 0)
        foods[fid] = {
            'id': fid, 'fdc': fdc, 'name': {'es': es, 'en': en}, 'section': section, 'eurKg': eur, 'kind': KIND[kind],
            'allergens': [x for x in allergens.split(',') if x], 'groups': [x for x in groups.split(',') if x],
            'flags': [x for x in flags.split(',') if x],
            **({'piece': {'es': piece[0], 'en': piece[1], 'g': piece[2]}} if piece else {}),
            'per100': {k: round(v, 3) for k, v in nut.items()},
        }

    recipes = []
    seen = set()
    for (rid, meals, minutes, skill, tags, ing, es, en, steps_es, steps_en) in R:
        if rid in seen:
            sys.exit(f'Receta repetida: {rid}')
        seen.add(rid)
        items = []
        for tok in ing.split():
            fid, g = tok.split(':')
            if fid not in foods:
                sys.exit(f'{rid}: no existe el alimento {fid}')
            items.append({'food': fid, 'g': float(g)})
        tot = {}
        cost = 0.0
        kinds, allergens, groups, flags = set(), set(), set(), set()
        for it in items:
            fo = foods[it['food']]
            for k, v in fo['per100'].items():
                tot[k] = tot.get(k, 0) + v * it['g'] / 100
            cost += fo['eurKg'] * it['g'] / 1000
            kinds.add(fo['kind'])
            allergens.update(fo['allergens'])
            groups.update(fo['groups'])
            flags.update(fo['flags'])
        # Tipo de dieta que admite el plato
        if kinds <= {'plant'}:
            diet = 'vegan'
        elif kinds <= {'plant', 'dairy', 'egg'}:
            diet = 'vegetarian'
        elif kinds <= {'plant', 'dairy', 'egg', 'fish', 'seafood'}:
            diet = 'pescatarian'
        else:
            diet = 'omnivore'
        # Graso: más del 40 % de la energía en grasa y más de 25 g (para "lo frito o graso me sienta mal")
        if tot['fat'] * 9 > 0.4 * tot['kcal'] and tot['fat'] > 25:
            groups.add('fatty')
        recipes.append({
            'id': rid, 'meals': [MEALS[m] for m in meals], 'minutes': minutes, 'skill': skill,
            'tags': [x for x in tags.split(',') if x], 'name': {'es': es, 'en': en},
            'ingredients': items, 'steps': {'es': steps_es, 'en': steps_en},
            'diet': diet, 'allergens': sorted(allergens), 'groups': sorted(groups), 'flags': sorted(flags),
            'cost': round(cost, 2), 'nutrients': {k: round(v, 2) for k, v in tot.items()},
        })

    head = (
        '// GENERADO por scripts/diet-catalog.py: no editar a mano. Composición: USDA FoodData Central, SR Legacy\n'
        '// (04/2018), dominio público. Precios orientativos (estimación). Recetas propias de Kuova.\n'
        "import type { DietFood, Recipe } from './types';\n\n"
    )
    body = 'export const FOOD_DATA: DietFood[] = [\n' + '\n'.join('  ' + json.dumps(f, ensure_ascii=False) + ',' for f in foods.values()) + '\n];\n\n'
    body += 'export const RECIPE_DATA: Recipe[] = [\n' + '\n'.join('  ' + json.dumps(r, ensure_ascii=False) + ',' for r in recipes) + '\n];\n'
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(head + body, encoding='utf-8')
    by_meal = {m: sum(1 for r in recipes if m in r['meals']) for m in MEALS.values()}
    by_diet = {k: sum(1 for r in recipes if r['diet'] == k) for k in ['vegan', 'vegetarian', 'pescatarian', 'omnivore']}
    print(f'{len(foods)} alimentos, {len(recipes)} recetas -> {OUT}')
    print('por comida', by_meal, 'por dieta', by_diet)
    for r in recipes:
        n = r['nutrients']
        print(f"  {r['id']:28} {n['kcal']:6.0f} kcal  P{n['protein']:5.1f}  F{n['fiber']:4.1f}  {r['cost']:.2f} €  {r['diet']}")


if __name__ == '__main__':
    main()

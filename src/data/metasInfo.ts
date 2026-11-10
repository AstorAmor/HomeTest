// Lo que dice la (i) de cada meta: qué es una ración (o una unidad) y lo que está estudiado, con su nivel.
// Del prototipo v3 (2026-11-04). PENDIENTE de revisión médica (backlog clínico); en la app no se dice.
// En inglés; el español, en src/i18n/metasEs.ts.

export type Evidence = 'Well studied' | 'Studied' | 'Little studied';

export const SERVING_INFO: Record<string, [string, string]> = {
  fruta: ['What a piece is', 'A medium piece (apple, orange, banana) or a handful of small fruit, like strawberries or grapes: about 150 g.'],
  verdura: ['What a serving is', 'A plate of cooked vegetables or a medium salad: about 150-200 g.'],
  frutos: ['What a serving is', 'A handful, about 25-30 g: some 20 almonds, 7 walnuts or 2 tablespoons of peanuts. Better plain or roasted, without salt.'],
  legumbre: ['What a serving is', 'A plate of cooked pulses, about 150-200 g (60-80 g dry).'],
  embutido: ['What a serving is', 'About 50 g: 3-4 slices of ham or turkey, or 10-12 thin slices of chorizo or salami. Sausages, bacon and cold cuts count too.'],
  carne: ['What a serving is', 'A steak or a piece of 100-125 g of beef, pork or lamb. Burgers and minced meat count too.'],
  tabaco: ['The units', 'A pack is 20 cigarettes and a carton, 10 packs. You log it in the one you choose.'],
  alcohol: ['What counts as one', 'A small beer, a glass of wine or a shot carry roughly the same alcohol. A mixed drink or a glass of spirits, twice as much.'],
  // EFSA (2015): un espresso ~80 mg, una taza de café de filtro ~90 mg, té negro ~50 mg, una lata de cola ~40 mg y una
  // bebida energética de 250 ml ~80 mg
  cafeina: ['What counts as a coffee', 'Each coffee, black, with a dash of milk or with milk, counts as one. A cup of tea or a can of cola is about half; a small energy drink (250 ml), about one.'],
};

export const META_EVIDENCE: Record<string, [Evidence, string][]> = {
  pasos: [
    ['Well studied', 'More steps a day are linked to lower mortality. The benefit grows up to about 6,000-8,000 steps in people over 60 and 8,000-10,000 in younger people (meta-analysis, 2022).'],
    ['Studied', 'Moving more during the day helps with weight and glucose.'],
  ],
  cardio: [
    ['Well studied', 'The WHO recommends 150-300 min a week of moderate activity: brisk walking, cycling, swimming.'],
    ['Studied', 'It improves fitness (VO2max) and blood pressure, and raises HDL a little.'],
  ],
  fuerza: [
    ['Well studied', 'The WHO recommends strength exercises at least 2 days a week.'],
    ['Studied', 'It helps keep muscle and bone as you age, and to control glucose.'],
  ],
  fruta: [
    ['Well studied', 'Eating more fruit and vegetables is linked to less heart disease. The WHO recommends at least 400 g a day of both together, about 5 servings.'],
    ['Studied', 'Its fibre helps digestion.'],
  ],
  verdura: [
    ['Well studied', 'Eating more fruit and vegetables is linked to less heart disease. The WHO recommends at least 400 g a day of both together, about 5 servings.'],
    ['Studied', 'It fills you up with few calories.'],
  ],
  frutos: [
    ['Studied', 'A handful a day, about 30 g, is linked to less heart disease.'],
    ['Studied', 'In trials, it lowers LDL cholesterol a little.'],
  ],
  legumbre: [
    ['Studied', 'Its soluble fibre lowers LDL cholesterol a little.'],
    ['Studied', 'It fills you up and helps control glucose.'],
  ],
  embutido: [
    ['Well studied', 'Processed meat (cured meats, sausages, bacon) is linked to more colorectal cancer; the WHO classifies it as carcinogenic.'],
    ['Studied', 'It usually has a lot of salt and saturated fat, which raise blood pressure and LDL.'],
  ],
  carne: [['Studied', 'Eating a lot of red meat is linked to more colorectal cancer; guidelines advise no more than about 3 servings a week.']],
  tabaco: [
    ['Well studied', 'Quitting smoking is what improves health the most, at any age.'],
    ['Studied', 'Smoking less helps little on its own; it is mostly a step towards quitting. Your doctor can help you.'],
  ],
  sinhumo: [
    ['Well studied', 'Quitting smoking is what improves health the most, at any age.'],
    ['Well studied', 'With support from your doctor or a quit-smoking service, more people manage to quit.'],
  ],
  cafeina: [
    ['Well studied', 'For healthy adults, the European Food Safety Authority (EFSA) considers up to 400 mg of caffeine a day safe, about 4 coffees. In pregnancy, up to 200 mg.'],
    ['Studied', 'Caffeine in the 6 hours before going to bed can shorten your sleep and make it worse.'],
  ],
  alcohol: [
    ['Well studied', 'Less is better: according to the WHO, there is no amount of alcohol that improves health.'],
    ['Studied', 'Drinking worsens sleep, even if it helps you fall asleep.'],
  ],
  paseo: [
    ['Studied', 'Walking 10-15 min after eating lowers the glucose peak (small trials).'],
    ['Little studied', 'It may help digestion.'],
  ],
  hora: [['Studied', 'Going to bed at similar times is linked to better sleep and better mood.']],
  dormir: [
    ['Well studied', 'Adults are advised to sleep 7 h or more.'],
    ['Studied', 'Sleeping little is linked to more hunger, worse mood and worse glucose.'],
  ],
  checkin: [['Little studied', 'Stopping to look at how you are helps you see patterns.']],
};

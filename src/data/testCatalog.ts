// Tienda de pruebas (Lab → Solicitar una prueba). Fuente: el catálogo de Kuova del 28/10/2026
// (OneDrive/2. Entrepreneurship/03 Partners/Catalogos/Kuova_Catalogo_productos.xlsx, el mismo de la
// solicitud v3 al laboratorio del 5/11): la suscripción (análisis anual Kuova Baseline y seguimiento
// fijo a los 6 meses) y cuatro niveles de pruebas sueltas: añadir a tu seguimiento, confirmar y
// ampliar, objetivos y lo que pida un médico. Composiciones por validar con el asesor médico.
// Lo que no ofrecemos (y por qué) está en la hoja «No ofrecemos» del Excel.
//
// Los costes de laboratorio del Excel son internos y NUNCA van aquí. Precio de venta: ninguno por ahora.
// Las pruebas sueltas no tienen precio decidido y, desde el 2026-11-09, el fundador quita también el de
// las suscripciones (Basic 365 €/año está en el business case; Premium tenía 700 € en la app, sin decidir).
// Sin `price`, la app enseña «Precio por confirmar» y simula la solicitud.
// Cuando el fundador decida uno, ponlo aquí y en supabase/functions/_shared/products.ts (el servidor
// cobra con esa tabla, nunca con el precio que envía la app). `npm run check:prices` compara ambas.

import { getLang } from '@/i18n';
import { CATEGORY_INTRO_ES, CATEGORY_LABEL_ES, DELIVERY_ES, SAMPLE_ES, TEST_COPY_ES } from '@/i18n/testCatalogEs';
import { TEST_GUIDE_ES } from '@/i18n/testGuideEs';
import { TEST_GUIDE } from './testGuide';

export type TestCategory = 'membership' | 'followup' | 'confirm' | 'hormonal' | 'digestive' | 'sexual' | 'other' | 'genetic' | 'doctor';

export const CATEGORY_LABEL: Record<TestCategory, string> = {
  membership: 'Subscriptions',
  followup: 'Add to your follow-up',
  confirm: 'Confirm and look further',
  hormonal: 'Hormones and fertility',
  digestive: 'Digestive health',
  sexual: 'Sexual health (STI)',
  other: 'Sport, allergies and omega-3',
  genetic: 'Genetic tests',
  doctor: 'If your doctor asks for it',
};

// Una línea bajo el título de cada grupo de la tienda: cuándo tiene sentido ese nivel
export const CATEGORY_INTRO: Partial<Record<TestCategory, string>> = {
  followup:
    "For markers that came out of range in your yearly analysis and that the follow-up doesn't repeat. They're measured in your follow-up blood draw, with no extra visit.",
  confirm:
    'One result out of range is not enough on its own. These modules confirm it and add what helps to read it, with your follow-up or in a separate visit.',
  hormonal: "For a specific question about your cycle, your fertility or your hormones. What your yearly analysis already measures isn't repeated.",
  digestive: 'If you often have digestive symptoms. If one comes out positive, the next step is taking the result to your doctor: Kuova does not prescribe treatment.',
  sexual: 'Confidential: only you see the results. If anything comes out positive, the next step is your doctor.',
  other: 'For a specific goal: training, allergies or omega-3.',
  genetic:
    'They look at specific variants of your DNA. By law they need a doctor to request them, your written consent and genetic counselling before and after the test: they start with a consultation, not with an order.',
  doctor: 'Tests that your own doctor, or a doctor on the platform, asks you to take.',
};

export interface CatalogTest {
  id: string;
  category: TestCategory;
  name: string;
  price?: number; // € de venta. Sin poner: precio por confirmar (no hay uno decidido)
  description: string;
  includes: string[];
  sample: string;
  delivery: string; // dónde y cómo se hace, y plazo esperable
  notes?: string; // «Ten en cuenta»: preparación y cómo leer el resultado
  withFollowUp?: boolean; // solo con la suscripción: se mide en la extracción del seguimiento
  orderable?: false; // solo informativo (las pruebas que pida un médico): sin botón de pedir
  counselling?: true; // genéticas: consulta de asesoramiento genético antes y después (RD 942/2025); nunca se piden directamente
  only?: 'female' | 'male';
  discreet?: boolean;
  icon?: string; // MaterialCommunityIcons; si falta, el de la categoría
  perYear?: boolean; // planes anuales
  markerLines?: number; // planes: cuántas de las primeras líneas de «Qué incluye» abren la comparativa de marcadores
  // Para qué puede servir y cada cuánto repetirlo (src/data/testGuide.ts); lo rellena localizeTest
  useful?: string;
  repeat?: string;
}

// Iconos (MaterialCommunityIcons). El símbolo de mujer u hombre solo en pruebas para un sexo.
export const CATEGORY_ICON: Record<TestCategory, string> = {
  membership: 'star',
  followup: 'calendar-sync',
  confirm: 'magnify-plus-outline',
  hormonal: 'hexagon-multiple-outline',
  digestive: 'food-apple',
  sexual: 'lock',
  other: 'run',
  genetic: 'dna',
  doctor: 'stethoscope',
};

const FEMALE = 'gender-female';
const MALE = 'gender-male';

export const testIcon = (t: CatalogTest) => t.icon ?? CATEGORY_ICON[t.category];

// Toda la extracción, en centros del laboratorio (decisión del fundador, 27/10); a domicilio, más adelante
const CENTRE_DELIVERY = 'Blood draw at a lab centre near you, fasting and in the morning · results in the app within a few working days';
const FOLLOW_UP_DELIVERY = 'Measured in your follow-up blood draw, with no extra visit';
const CONFIRM_DELIVERY = 'With your follow-up blood draw, or in a separate visit to the lab centre';
const BREATH_DELIVERY = "Breath test: the lab tells you how to prepare and whether it's done at home or at its centre";
const SWAB_DELIVERY = 'The lab tells you whether you collect the sample at home or at its centre';
const PLAN_DELIVERY = 'First appointment at a lab centre within 7 days of joining';
const PLAN_SAMPLE = 'Blood and urine, at a lab centre near you';
const GENETIC_DELIVERY = 'After the first consultation · the result is explained to you in the second one';
const GENETIC_SAMPLE = 'Cheek swab or blood';
const COUNSELLING = 'Genetic counselling consultation before and after the test';
// Las pruebas genéticas, como en el consentimiento informado de Kuova (00 Empresa y legal/Consentimientos): por ley
// necesitan petición médica, consentimiento escrito y asesoramiento genético antes y después (RD 942/2025, arts.
// 10, 11 y 19.5; Ley 14/2007). Sin precio decidido y sin botón de pedir: se empieza por la consulta.
const genetic = (t: Omit<CatalogTest, 'category' | 'sample' | 'delivery' | 'counselling' | 'orderable'>): CatalogTest => ({
  ...t,
  category: 'genetic',
  sample: GENETIC_SAMPLE,
  delivery: GENETIC_DELIVERY,
  counselling: true,
  orderable: false,
});

export const MEMBERSHIP: CatalogTest = {
  id: 'membership',
  category: 'membership',
  name: 'Kuova Basic subscription',
  // Sin médico ni videoconsultas en las suscripciones (fundador, 2026-10-17)
  description:
    'Your yearly Kuova Baseline analysis and a fixed follow-up 6 months later, your own lab reports scanned and explained, and your personalised plan in the app.',
  includes: [
    'Yearly Kuova Baseline analysis: 31 lab tests (plus Lp(a) the first year)',
    'Follow-up at 6 months: 23 lab tests, always the same',
    'Scan your own lab reports and see them explained',
    'Personalised plan, trends and reminders',
  ],
  sample: PLAN_SAMPLE,
  delivery: PLAN_DELIVERY,
  perYear: true,
  markerLines: 2,
};

export const PREMIUM: CatalogTest = {
  id: 'premium',
  category: 'membership',
  name: 'Kuova Premium subscription',
  // El análisis anual de Premium es el «Kuova Pro (Complete)» del catálogo del 28/10 (composición a validar
  // con el asesor médico): todo el Baseline + tiroides completo, hormonas, ácido fólico y albúmina en orina
  description:
    'Everything in Basic with a more complete yearly analysis, Kuova Premium (full thyroid, your hormones, folic acid and albumin in urine), and the follow-up every 3 months instead of every 6.',
  includes: [
    'Yearly Kuova Premium analysis: 42 lab tests (plus Lp(a) the first year)',
    'On top of Basic: full thyroid, your hormones, folic acid and albumin in urine',
    'Follow-up every 3 months (3 a year): 23 lab tests, always the same',
    'Scan your own lab reports and see them explained',
    'Personalised plan, trends and reminders',
  ],
  sample: PLAN_SAMPLE,
  delivery: PLAN_DELIVERY,
  icon: 'crown',
  perYear: true,
  markerLines: 3,
};

export const PLANS = [MEMBERSHIP, PREMIUM];

const followUp = (t: Omit<CatalogTest, 'category' | 'sample' | 'delivery'>): CatalogTest => ({
  category: 'followup',
  sample: 'Blood',
  delivery: FOLLOW_UP_DELIVERY,
  withFollowUp: true,
  ...t,
});

export const CATALOG: CatalogTest[] = [
  // 1. Añadir a tu seguimiento: lo que salió fuera del rango y el seguimiento fijo no repite
  followUp({ id: 'vitamin_d', name: 'Vitamin D', description: 'Measure your vitamin D again in your follow-up if it came out below the range.', includes: ['Vitamin D (25-OH)'] }),
  followUp({
    id: 'b12_folate',
    name: 'B12 and folic acid',
    description: 'B12 and folic acid again in your follow-up, if your B12 came out low or your red blood cells came out large.',
    includes: ['Vitamin B12', 'Folic acid'],
  }),
  followUp({
    id: 'magnesium',
    name: 'Magnesium',
    description: 'Measure your magnesium again in your follow-up if it came out below the range.',
    includes: ['Magnesium'],
    notes: "A low value tells you something; one within the range doesn't rule out a shortage, because almost all magnesium is inside the cells.",
  }),
  followUp({ id: 'calcium', name: 'Calcium', description: 'Confirm your calcium in your follow-up if it came out of range.', includes: ['Total calcium'] }),
  followUp({
    id: 'sodium_potassium',
    name: 'Sodium and potassium',
    description: 'Sodium and potassium again in your follow-up, if they came out of range or you take blood pressure medication.',
    includes: ['Sodium', 'Potassium'],
  }),
  followUp({
    id: 'insulin',
    name: 'Insulin (HOMA-IR)',
    description: 'Fasting insulin again in your follow-up, to see the trend alongside glucose and HbA1c.',
    includes: ['Fasting insulin', 'HOMA-IR (calculated with glucose)'],
    notes: "Strictly fasting. There's no universal HOMA-IR cut-off: it's read as a trend, in the same lab.",
  }),
  followUp({
    id: 'psa',
    name: 'Total PSA',
    description: 'For men aged 50 or over who choose prostate screening after reading its pros and cons.',
    includes: ['Total PSA'],
    notes: 'PSA screening has pros and cons (false alarms, tests you may not need): decide it informed, ideally with your doctor.',
    only: 'male',
    icon: MALE,
  }),

  // 2. Confirmar y ampliar: un resultado fuera del rango se confirma antes de sacar conclusiones
  {
    id: 'thyroid',
    category: 'confirm',
    name: 'Thyroid: confirm and look further',
    description: 'If your TSH came out of range: it confirms it and adds free T4 and thyroid antibodies.',
    includes: ['TSH', 'Free T4', 'Anti-TPO antibodies'],
    sample: 'Blood',
    delivery: CONFIRM_DELIVERY,
    notes: 'If you take biotin, tell the lab: it can change the TSH result.',
  },
  {
    id: 'low_testosterone',
    category: 'confirm',
    name: 'Low testosterone: confirm and look further',
    description: 'If your testosterone came out below the range and you notice symptoms: it confirms it and adds what helps to understand it.',
    includes: ['Total testosterone (repeated)', 'SHBG', 'LH', 'FSH', 'Prolactin'],
    sample: 'Blood',
    delivery: CONFIRM_DELIVERY,
    notes: "In the morning and fasting. If you take it with your follow-up, testosterone is already included and you don't pay for it twice.",
    only: 'male',
    icon: MALE,
  },
  {
    id: 'androgens',
    category: 'confirm',
    name: 'Androgens: confirm and look further',
    description: 'If your testosterone came out above the range or your cycles are irregular: it adds SHBG, DHEA-S and prolactin.',
    includes: ['Total testosterone', 'SHBG', 'DHEA-S', 'Prolactin'],
    sample: 'Blood',
    delivery: CONFIRM_DELIVERY,
    notes: 'Polycystic ovary syndrome is diagnosed by a doctor, with your cycle and an ultrasound: the blood test helps, it does not decide.',
    only: 'female',
    icon: FEMALE,
  },
  {
    id: 'urine_albumin',
    category: 'confirm',
    name: 'Albumin in urine',
    description: "Measures the albumin that passes into your urine, something creatinine and eGFR in blood don't show.",
    includes: ['Urine microalbumin', 'Urine creatinine (albumin/creatinine ratio)'],
    sample: 'Urine',
    delivery: CONFIRM_DELIVERY,
    notes: 'It varies from one day to the next: if it comes out above the range, it is confirmed with another sample.',
  },

  // 3. Objetivos: pruebas sueltas para una pregunta concreta, sin repetir lo que ya mide el análisis anual
  {
    id: 'ovarian_reserve',
    category: 'hormonal',
    name: 'Ovarian reserve',
    description: 'A picture of your ovarian reserve today, with the hormones that help to read it.',
    includes: ['AMH (anti-Müllerian hormone)', 'FSH', 'LH', 'Oestradiol', 'Prolactin'],
    sample: 'Blood',
    delivery: CENTRE_DELIVERY,
    notes:
      "AMH estimates your reserve but doesn't predict whether you'll get pregnant naturally. FSH, LH and oestradiol are measured between days 2 and 5 of your cycle. Hormonal contraceptives change these hormones.",
    only: 'female',
    icon: FEMALE,
  },
  {
    id: 'hormones_f',
    category: 'hormonal',
    name: "Women's hormonal health",
    description: 'The hormones of your cycle, in two blood draws timed to your cycle.',
    includes: ['LH', 'FSH', 'Oestradiol', 'Progesterone', 'Prolactin', 'Total testosterone', 'SHBG', 'DHEA-S', 'AMH'],
    sample: 'Blood · 2 draws',
    delivery: CENTRE_DELIVERY,
    notes:
      'Two blood draws: between days 2 and 5 of your cycle, and about 7 days before your period. Hormonal contraceptives change the result. Without symptoms, the result rarely changes what you can do.',
    only: 'female',
    icon: FEMALE,
  },
  {
    id: 'hormones_m',
    category: 'hormonal',
    name: "Men's hormonal health",
    description: 'Testosterone and the hormones that regulate it, in one morning blood draw.',
    includes: ['Total testosterone', 'SHBG', 'LH', 'FSH', 'Oestradiol', 'Prolactin', 'DHEA-S', 'Total PSA'],
    sample: 'Blood',
    delivery: CENTRE_DELIVERY,
    notes:
      'In the morning and fasting. Without symptoms, the result rarely changes what you can do. If testosterone comes out low, it is confirmed with another blood draw.',
    only: 'male',
    icon: MALE,
  },
  {
    id: 'preconception',
    category: 'hormonal',
    name: 'Before trying for a baby',
    description: 'Your immunity to infections that matter in pregnancy, basic serologies and your blood group.',
    includes: ['Rubella IgG', 'Toxoplasma IgG', 'Chickenpox IgG', 'HIV', 'Syphilis', 'Hepatitis B', 'Hepatitis C', 'Blood group and Rh'],
    sample: 'Blood',
    delivery: CENTRE_DELIVERY,
    notes: "What your yearly analysis already measures (blood count, ferritin, TSH, vitamin D, B12) isn't repeated here.",
    icon: 'human-pregnant',
  },
  {
    id: 'coeliac',
    category: 'digestive',
    name: 'Coeliac disease',
    description: 'Antibodies that appear when the body reacts to gluten.',
    includes: ['Anti-tissue transglutaminase IgA', 'Total IgA'],
    sample: 'Blood',
    delivery: CENTRE_DELIVERY,
    notes: "It only works while you're eating gluten: don't cut it out before the test without talking to your doctor. The diagnosis is confirmed by a gastroenterologist.",
  },
  {
    id: 'sibo',
    category: 'digestive',
    name: 'Breath test: SIBO',
    description: 'Looks for bacterial overgrowth in the small intestine.',
    includes: ['Lactulose breath test (hydrogen and methane)'],
    sample: 'Breath',
    delivery: BREATH_DELIVERY,
    notes: 'It only makes sense with symptoms. If it comes out positive, treatment is decided by a doctor: Kuova does not prescribe.',
  },
  {
    id: 'lactose',
    category: 'digestive',
    name: 'Breath test: lactose',
    description: 'Shows whether you absorb the lactose in dairy well.',
    includes: ['Lactose breath test (hydrogen and methane)'],
    sample: 'Breath',
    delivery: BREATH_DELIVERY,
  },
  {
    id: 'fructose',
    category: 'digestive',
    name: 'Breath test: fructose',
    description: 'Shows whether you absorb fructose (fruit, juice, sweets) well.',
    includes: ['Fructose breath test (hydrogen and methane)'],
    sample: 'Breath',
    delivery: BREATH_DELIVERY,
    notes: 'It is a less established test than the lactose one.',
  },
  {
    id: 'hpylori',
    category: 'digestive',
    name: 'Breath test: Helicobacter pylori',
    description: 'Looks for Helicobacter pylori in the stomach.',
    includes: ['Urea breath test'],
    sample: 'Breath',
    delivery: BREATH_DELIVERY,
    notes:
      'Antibiotics and stomach protectors taken in the previous weeks can change the result: if you take them, tell your doctor before ordering it. If it comes out positive, treatment is decided by a doctor.',
  },
  {
    id: 'sti_basic',
    category: 'sexual',
    name: 'STI: 6 infections by PCR',
    description: 'Six sexually transmitted infections in a urine sample or a swab.',
    includes: ['Chlamydia', 'Gonorrhoea', 'Trichomoniasis', 'Mycoplasma genitalium', 'Mycoplasma hominis', 'Ureaplasma'],
    sample: 'Urine (men) or vaginal swab (women)',
    delivery: SWAB_DELIVERY,
    discreet: true,
  },
  {
    id: 'sti_full',
    category: 'sexual',
    name: 'STI: complete',
    description: 'The 6 infections of the basic test plus blood serologies.',
    includes: ['The 6 infections of the basic test', 'HIV', 'Syphilis', 'Hepatitis B', 'Hepatitis C'],
    sample: 'Blood + urine or swab',
    delivery: CENTRE_DELIVERY,
    discreet: true,
  },
  {
    id: 'training_load',
    category: 'other',
    name: 'Performance: training load',
    description: 'CK and cortisol, to see how you are coping with your training load.',
    includes: ['CK (creatine kinase)', 'Cortisol'],
    sample: 'Blood',
    delivery: CENTRE_DELIVERY,
    notes:
      'CK reflects the training of the days before: leave 72 h without hard training before the blood draw. A single cortisol value does not measure overtraining.',
  },
  {
    id: 'omega3',
    category: 'other',
    name: 'Omega-3 index',
    description: 'How much omega-3 (EPA and DHA) there is in your red blood cells.',
    includes: ['Omega-3 index (EPA + DHA in red blood cells)'],
    sample: 'Blood',
    delivery: CENTRE_DELIVERY,
    notes: 'It is linked to cardiovascular risk in observational studies; trials with supplements give mixed results.',
    icon: 'fish',
  },
  {
    id: 'allergy_alex',
    category: 'other',
    name: 'Allergies (ALEX, 295 allergens)',
    description: 'Shows which allergens your body is sensitised to.',
    includes: ['IgE to 295 allergens (foods, pollens, mites, animals…)'],
    sample: 'Blood',
    delivery: CENTRE_DELIVERY,
    notes: 'Being sensitised is not the same as being allergic: an allergist reads the result together with your symptoms.',
    icon: 'flower-pollen',
  },

  // 4. Lo que pida un médico (el tuyo o uno de la plataforma): Kuova no pide pruebas por su cuenta
  genetic({
    id: 'gen_carrier',
    name: 'Carrier test',
    description:
      'Whether you carry variants of hereditary conditions that give you no symptoms but could pass to your children. Highly recommended if you are thinking about having children.',
    includes: [
      COUNSELLING,
      'Panel of recessive and X-linked hereditary conditions (for example cystic fibrosis, spinal muscular atrophy or fragile X syndrome)',
    ],
    notes:
      'Carrying a variant without knowing it is common. What matters is whether both members of the couple carry one for the same condition: then, for most of these conditions, each child has a 1 in 4 chance of having it. That is why it is best for both to take it, ideally before the pregnancy. Which conditions the panel covers depends on the lab.',
  }),
  genetic({
    id: 'gen_coeliac',
    name: 'Genetic coeliac disease (HLA-DQ2 / DQ8)',
    description: 'Whether you have the genetic predisposition that makes coeliac disease possible.',
    includes: [COUNSELLING, 'HLA-DQ2', 'HLA-DQ8'],
    notes:
      'If you do not have it, coeliac disease is very unlikely. Having it is common and does not mean you are coeliac: that is what the antibody test (Coeliac disease) looks at.',
  }),
  genetic({
    id: 'gen_intolerance',
    name: 'Genetic intolerances',
    description:
      'Whether your genes favour lactose intolerance in adulthood, hereditary fructose intolerance or lower activity of the DAO enzyme.',
    includes: [COUNSELLING, 'Lactase (LCT / MCM6)', 'Hereditary fructose intolerance (ALDOB)', 'DAO enzyme (AOC1)', 'HLA-DQ2 / DQ8 (coeliac predisposition)'],
    notes:
      'Hereditary fructose intolerance is a serious condition that also matters for your family. The link between AOC1 variants and symptoms has limited scientific evidence.',
  }),
  genetic({
    id: 'gen_hfe',
    name: 'Haemochromatosis (HFE gene)',
    description: 'Whether you have the variants linked to hereditary haemochromatosis, which makes the body store too much iron.',
    includes: [COUNSELLING, 'HFE gene: C282Y', 'HFE gene: H63D'],
    notes:
      'Having the variants does not mean you will develop it. The result is read together with your ferritin and transferrin saturation, which your yearly analysis already measures.',
  }),
  genetic({
    id: 'gen_thrombophilia',
    name: 'Thrombophilia',
    description: 'Whether you have variants that raise the risk of venous thrombosis.',
    includes: [COUNSELLING, 'Factor V Leiden (F5)', 'Prothrombin (F2 G20210A)'],
    notes:
      'It helps you decide with your doctor about hormonal contraception, pregnancy or surgery. MTHFR is not included: on its own it has little clinical use, and guidelines advise against testing it for thrombosis.',
  }),
  genetic({
    id: 'gen_apoe',
    name: 'APOE',
    description: "Your combination of the ε2, ε3 and ε4 variants, linked to how your body handles fats and to the risk of Alzheimer's disease.",
    includes: [COUNSELLING, 'APOE genotype: ε2, ε3 and ε4'],
    notes:
      "Alzheimer's has no curative treatment today. Having ε4 raises the risk but does not mean you will develop it, and not having it does not rule it out. That is why counselling before and after the test is mandatory.",
  }),
  {
    id: 'doctor_request',
    category: 'doctor',
    name: 'Tests your doctor asks for',
    description: 'If your doctor, or a doctor on the platform, asks you for other tests, you can take them with us.',
    includes: ["Any test in the lab's catalogue (more than 400)"],
    sample: 'Depends on the test',
    delivery: 'With your follow-up blood draw (one visit fewer), or in a separate visit',
    notes: 'Kuova does not prescribe or order tests on its own: these are requested by your doctor.',
    orderable: false,
  },
];

export const findTest = (id: string) => [...PLANS, ...CATALOG].find((x) => x.id === id);

// Precio en el formato del idioma: €124.99 en inglés, 124,99 € en español.
export const formatPrice = (p: number) => {
  const n = p.toFixed(2).replace(/\.00$/, '');
  return getLang() === 'en' ? `€${n}` : `${n.replace('.', ',')} €`;
};

// Suma de precios, o null si alguno está por confirmar
export const totalPrice = (tests: CatalogTest[]): number | null =>
  tests.some((p) => p.price == null) ? null : tests.reduce((sum, p) => sum + (p.price ?? 0), 0);

export const categoryLabel = (c: TestCategory) => (getLang() === 'es' ? CATEGORY_LABEL_ES[c] : CATEGORY_LABEL[c]);
export const categoryIntro = (c: TestCategory) => (getLang() === 'es' ? CATEGORY_INTRO_ES[c] : CATEGORY_INTRO[c]);

const DELIVERY_TO_ES: Record<string, string> = {
  [CENTRE_DELIVERY]: DELIVERY_ES.centre,
  [FOLLOW_UP_DELIVERY]: DELIVERY_ES.followUp,
  [CONFIRM_DELIVERY]: DELIVERY_ES.confirm,
  [BREATH_DELIVERY]: DELIVERY_ES.breath,
  [SWAB_DELIVERY]: DELIVERY_ES.swab,
  [PLAN_DELIVERY]: DELIVERY_ES.plan,
  [GENETIC_DELIVERY]: DELIVERY_ES.genetic,
};
const deliveryEs = (d: string) => DELIVERY_TO_ES[d] ?? d;

// El producto con sus textos en el idioma de la app (los datos de arriba están en inglés).
export function localizeTest<T extends CatalogTest>(test: T): T {
  if (getLang() !== 'es') return { ...test, ...TEST_GUIDE[test.id] };
  const es = TEST_COPY_ES[test.id];
  if (!es) return { ...test, ...TEST_GUIDE[test.id] };
  return {
    ...test,
    ...(TEST_GUIDE_ES[test.id] ?? TEST_GUIDE[test.id]),
    name: es.name,
    description: es.description,
    includes: es.includes,
    notes: es.notes ?? test.notes,
    sample: es.sample ?? SAMPLE_ES[test.sample] ?? test.sample,
    delivery: es.delivery ?? deliveryEs(test.delivery),
  };
}

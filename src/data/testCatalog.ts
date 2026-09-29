// Tienda de tests (Lab → Request a new test). Fuente: hoja "Catalogo" de
// OneDrive/2. Entrepreneurship/Fase0/business_case_v2.xlsx (precios de Ailin
// replicados, decisión del fundador) + la membresía anual (S01, 365 €/año).
// Si cambian precios o tests, actualizarlos aquí, en el business case y en
// supabase/functions/_shared/products.ts (el servidor cobra con esa tabla, nunca
// con el precio que envía la app). `npm run check:prices` compara ambas.

export type TestCategory = 'membership' | 'blood' | 'hormonal' | 'preventive' | 'digestive' | 'sexual' | 'consultation';

export const CATEGORY_LABEL: Record<TestCategory, string> = {
  membership: 'Membership',
  blood: 'Blood panels',
  hormonal: 'Hormonal health',
  preventive: 'Preventive health',
  digestive: 'Digestive health',
  sexual: 'Sexual health (STI)',
  consultation: 'Consultations',
};

export interface CatalogTest {
  id: string;
  category: TestCategory;
  name: string;
  price: number; // €
  description: string;
  includes: string[];
  sample: string;
  delivery: string; // plazo esperable
  block: 1 | 2 | 3; // bloque de catálogo / persona del business case
  discreet?: boolean;
  icon?: string; // MaterialCommunityIcons; si falta, el de la categoría
  perYear?: boolean; // planes anuales
}

// Iconos (MaterialCommunityIcons). Hormonas: estructura hexagonal; el símbolo
// femenino solo en tests exclusivamente femeninos (icono propio en el test).
export const CATEGORY_ICON: Record<TestCategory, string> = {
  membership: 'star',
  blood: 'water',
  hormonal: 'hexagon-multiple-outline',
  preventive: 'shield-check',
  digestive: 'food-apple',
  sexual: 'lock',
  consultation: 'video',
};

const FEMALE = 'gender-female';
const HEART = 'heart';
const APPLE = 'food-apple';

export const testIcon = (t: CatalogTest) => t.icon ?? CATEGORY_ICON[t.category];

const BLOOD_DELIVERY = 'Kit at home in 24-48 h · results 3-5 working days after the lab receives your sample';
const BREATH_DELIVERY = 'Kit at home in 24-48 h · results in 7-10 days';
const CONSULT_DELIVERY = 'Online video call · first slots usually within 48 h';

export const MEMBERSHIP: CatalogTest = {
  id: 'membership',
  category: 'membership',
  name: 'HomeTest annual membership',
  price: 365,
  description: 'Two complete blood analyses a year (full panel at the start, follow-up at 6 months), doctor review of every result and your personalised plan in the app. €1 a day.',
  includes: ['Full panel (~100 markers) + 6-month follow-up (~60 markers)', 'A doctor reviews each result (≈15 min)', 'Personalised plan, trends and reminders'],
  sample: 'Home blood collection or partner clinic',
  delivery: 'First kit or appointment within 7 days of joining',
  block: 1,
  perYear: true,
};

export const PREMIUM: CatalogTest = {
  id: 'premium',
  category: 'membership',
  name: 'HomeTest Premium Health',
  price: 700,
  description: 'Everything in the annual membership, with a blood test every 3 months instead of 6 and 5 video consultations with our professionals included.',
  includes: [
    'Full panel + 3 follow-ups a year (every 3 months)',
    'A doctor reviews each result (≈15 min)',
    '5 video consultations included (doctor, dietitian, trainer…)',
    'Personalised plan, trends and reminders',
  ],
  sample: 'Home blood collection or partner clinic',
  delivery: 'First kit or appointment within 7 days of joining',
  block: 1,
  icon: 'crown',
  perYear: true,
};

export const PLANS = [MEMBERSHIP, PREMIUM];

export const CATALOG: CatalogTest[] = [
  // Paneles de sangre
  { id: 'essential', category: 'blood', name: 'Essential blood test', price: 124.99, description: 'Lipid, liver, kidney and thyroid profile plus glucose.', includes: ['Glucose', 'Lipid profile', 'Liver (ALT, AST, GGT)', 'Kidney (creatinine, eGFR)', 'TSH'], sample: 'Blood', delivery: BLOOD_DELIVERY, block: 3 },
  { id: 'weight', category: 'blood', name: 'Weight management', price: 89, description: 'Hormonal causes that can slow down weight loss.', includes: ['Insulin', 'Glucose', 'TSH', 'Cortisol'], sample: 'Blood', delivery: BLOOD_DELIVERY, block: 2 },
  { id: 'performance', category: 'blood', name: 'Sports performance', price: 99.99, description: 'Recovery, inflammation and hormonal status for people who train.', includes: ['CK', 'hs-CRP', 'Testosterone', 'Cortisol', 'Ferritin'], sample: 'Blood', delivery: BLOOD_DELIVERY, block: 2 },
  { id: 'vitamin_d', category: 'blood', name: 'Vitamin D', price: 39.99, description: 'Vitamin D levels with medical interpretation.', includes: ['25-OH vitamin D'], sample: 'Blood', delivery: BLOOD_DELIVERY, block: 2 },
  { id: 'vitamin_b', category: 'blood', name: 'B vitamins', price: 59.99, description: 'B12 and folate deficiencies.', includes: ['Vitamin B12', 'Folate'], sample: 'Blood', delivery: BLOOD_DELIVERY, block: 2 },
  { id: 'vitamins', category: 'blood', name: 'Essential vitamins', price: 69.99, description: 'Vitamin D, B12 and folate with medical interpretation.', includes: ['Vitamin D', 'Vitamin B12', 'Folate'], sample: 'Blood', delivery: BLOOD_DELIVERY, block: 2 },
  // Hormonal
  { id: 'cycle_hormones', category: 'hormonal', name: 'Hormonal cycle tracking', price: 139.99, description: 'Two kits to measure hormones at the key phases of your cycle.', includes: ['Oestradiol', 'Progesterone', 'LH', 'FSH'], sample: 'Blood · 2 kits', delivery: 'Two kits at home in 24-48 h · results 3-5 working days after each sample', block: 1, icon: FEMALE },
  { id: 'cortisol', category: 'hormonal', name: 'Cortisol', price: 49.99, description: 'Cortisol levels to assess stress.', includes: ['Morning cortisol'], sample: 'Blood', delivery: BLOOD_DELIVERY, block: 2 },
  { id: 'stress', category: 'hormonal', name: 'Stress', price: 79.99, description: 'The impact of chronic stress: cortisol, TSH and CRP.', includes: ['Cortisol', 'TSH', 'CRP'], sample: 'Blood', delivery: BLOOD_DELIVERY, block: 2 },
  { id: 'fertility_f', category: 'hormonal', name: 'Female fertility', price: 94.99, description: 'Ovarian reserve and thyroid.', includes: ['AMH', 'TSH', 'FSH'], sample: 'Blood', delivery: BLOOD_DELIVERY, block: 1, icon: FEMALE },
  { id: 'thyroid', category: 'hormonal', name: 'Thyroid function', price: 44.99, description: 'TSH and free T4.', includes: ['TSH', 'Free T4'], sample: 'Blood', delivery: BLOOD_DELIVERY, block: 1 },
  { id: 'thyroid_adv', category: 'hormonal', name: 'Advanced thyroid function', price: 124.99, description: 'Thyroid hormones and autoimmune antibodies.', includes: ['TSH', 'Free T4', 'Free T3', 'Anti-TPO', 'Anti-thyroglobulin'], sample: 'Blood', delivery: BLOOD_DELIVERY, block: 1 },
  { id: 'amh', category: 'hormonal', name: 'Ovarian reserve (AMH)', price: 74.99, description: 'AMH: your current ovarian reserve and fertility.', includes: ['AMH'], sample: 'Blood', delivery: BLOOD_DELIVERY, block: 1, icon: FEMALE },
  { id: 'testosterone', category: 'hormonal', name: 'Testosterone', price: 54.99, description: 'Testosterone changes behind fatigue, libido or mood.', includes: ['Total testosterone'], sample: 'Blood', delivery: BLOOD_DELIVERY, block: 2 },
  // Preventiva
  { id: 't1d_antibodies', category: 'preventive', name: 'Type 1 diabetes antibodies', price: 189, description: 'Risk of type 1 diabetes before symptoms appear.', includes: ['Diabetes-related autoantibodies'], sample: 'Blood', delivery: BLOOD_DELIVERY, block: 1 },
  { id: 'cardio', category: 'preventive', name: 'Cardiovascular check', price: 79.99, description: 'Key cardiovascular markers and cholesterol.', includes: ['Lipid profile', 'ApoB', 'hs-CRP'], sample: 'Blood', delivery: BLOOD_DELIVERY, block: 1, icon: HEART },
  { id: 'diabetes', category: 'preventive', name: 'Diabetes', price: 74.99, description: 'HbA1c and kidney function.', includes: ['HbA1c', 'Glucose', 'Creatinine', 'eGFR'], sample: 'Blood', delivery: BLOOD_DELIVERY, block: 1 },
  { id: 'psa', category: 'preventive', name: 'Prostate cancer screening', price: 54.99, description: 'Total PSA for early detection.', includes: ['Total PSA'], sample: 'Blood', delivery: BLOOD_DELIVERY, block: 1 },
  { id: 'lpa', category: 'preventive', name: 'Cardiovascular risk: Lp(a)', price: 69.99, description: 'Lipoprotein(a), a genetic marker of heart risk. Usually only needs testing once.', includes: ['Lipoprotein(a)'], sample: 'Blood', delivery: BLOOD_DELIVERY, block: 1, icon: HEART },
  { id: 'coeliac', category: 'preventive', name: 'Coeliac disease', price: 69.99, description: 'Screening test for coeliac disease endorsed by the Spanish Ministry of Health.', includes: ['Anti-tissue transglutaminase IgA', 'Total IgA'], sample: 'Blood', delivery: BLOOD_DELIVERY, block: 1, icon: APPLE },
  // Digestiva (aliento)
  { id: 'fructose', category: 'digestive', name: 'Fructose intolerance', price: 59, description: 'Breath test.', includes: ['Hydrogen/methane breath test (fructose)'], sample: 'Breath', delivery: BREATH_DELIVERY, block: 1 },
  { id: 'lactose', category: 'digestive', name: 'Lactose intolerance', price: 59, description: 'Breath test.', includes: ['Hydrogen/methane breath test (lactose)'], sample: 'Breath', delivery: BREATH_DELIVERY, block: 1 },
  { id: 'lactose_fructose', category: 'digestive', name: 'Lactose and fructose', price: 99, description: 'Tolerance to lactose and fructose.', includes: ['Lactose breath test', 'Fructose breath test'], sample: 'Breath', delivery: BREATH_DELIVERY, block: 1 },
  { id: 'sibo', category: 'digestive', name: 'SIBO', price: 68, description: 'Small intestinal bacterial overgrowth.', includes: ['Lactulose breath test'], sample: 'Breath', delivery: BREATH_DELIVERY, block: 1 },
  { id: 'digestive_pack', category: 'digestive', name: 'Digestive pack', price: 153, description: 'SIBO plus lactose and fructose intolerance in a single pack.', includes: ['SIBO', 'Lactose', 'Fructose'], sample: 'Breath', delivery: BREATH_DELIVERY, block: 1 },
  // ITS
  { id: 'sti_4', category: 'sexual', name: '4 STI test', price: 89.99, description: 'HIV, syphilis, hepatitis B and C, with a medical report.', includes: ['HIV 1/2', 'Syphilis', 'Hepatitis B', 'Hepatitis C'], sample: 'Blood', delivery: `Discreet packaging · ${BLOOD_DELIVERY}`, block: 3, discreet: true },
  { id: 'sti_7', category: 'sexual', name: '7 STI test', price: 119.99, description: 'HIV, syphilis, hepatitis B and C, chlamydia, gonorrhoea and trichomoniasis.', includes: ['HIV 1/2', 'Syphilis', 'Hepatitis B', 'Hepatitis C', 'Chlamydia', 'Gonorrhoea', 'Trichomoniasis'], sample: 'Blood + urine', delivery: `Discreet packaging · ${BLOOD_DELIVERY}`, block: 3, discreet: true },
  { id: 'sti_11', category: 'sexual', name: '11 STI test', price: 149.99, description: '11 infections tested in blood and urine.', includes: ['HIV', 'Syphilis', 'Hepatitis B and C', 'Chlamydia', 'Gonorrhoea', 'Trichomoniasis', 'Mycoplasma', 'Ureaplasma', 'Herpes 1/2'], sample: 'Blood + urine', delivery: `Discreet packaging · ${BLOOD_DELIVERY}`, block: 3, discreet: true },
  // Consultas
  { id: 'consult_digestive', category: 'consultation', name: 'Digestive and intolerance consultation', price: 98, description: 'Online review of intolerance or SIBO results. Prescription included if needed.', includes: ['Video consultation', 'Prescription if needed'], sample: '—', delivery: CONSULT_DELIVERY, block: 1 },
  { id: 'consult_sti', category: 'consultation', name: 'STI medical consultation', price: 50, description: 'Online review of STI results. Prescription included if needed.', includes: ['Video consultation', 'Prescription if needed'], sample: '—', delivery: CONSULT_DELIVERY, block: 3, discreet: true },
];

export const formatPrice = (p: number) => `€${p.toFixed(2).replace(/\.00$/, '')}`;

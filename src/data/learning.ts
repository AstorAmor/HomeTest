import { SpecialistCard } from './planImages';
import { ART_PALETTES } from '@/components/BlobArt';
import { t } from '@/i18n';

// "Keep learning" (Today): temas de salud con una pequeña guía cada uno. Al fundador no le
// convencían las fotos: de momento cada tema se ilustra con un icono sobre un degradado con
// manchas (BlobArt: icon + palette); las fotos siguen en assets/images/learning/ por si vuelven.
// Los `featured` salen en el carrusel; todos, en la cuadrícula "More" (/learn-all).
// Contenido general y divulgativo, pendiente de revisión por el equipo médico.

export interface LearningTopic extends SpecialistCard {
  icon: string; // MaterialCommunityIcons de la ilustración
  palette: [string, string, string];
  featured?: boolean; // sale en el carrusel de Today (todos, en "More": /learn-all)
  intro: string;
  lessons: { title: string; body: string }[];
  action?: { label: string; href: string; params?: Record<string, string> };
  sources?: { label: string; url: string }[];
}

export const LEARNING_TOPICS: LearningTopic[] = [
  {
    id: 'reproductive_health',
    icon: 'flower-outline',
    palette: [...ART_PALETTES.rose],
    featured: true,
    label: t('Reproductive health'),
    subtitle: t('Cycle, fertility, hormones'),
    image: require('../../assets/images/learning/reproductive_health.jpg'),
    intro: 'Your cycle is a monthly report on your health. Knowing its phases helps you plan training, food and rest.',
    lessons: [
      { title: 'The four phases', body: 'Menstrual, follicular, ovulation and luteal. Energy tends to rise in the first half of the cycle and dip before your period.' },
      { title: 'What counts as regular', body: 'Cycles between 21 and 35 days are usually considered normal. Big changes are worth discussing with a professional.' },
      { title: 'Markers that matter', body: 'Iron (ferritin), vitamin D and thyroid (TSH) often explain tiredness around your period.' },
    ],
    action: { label: t('Log your period'), href: '/log-cycle' },
  },
  {
    id: 'training',
    icon: 'run',
    palette: [...ART_PALETTES.terracotta],
    featured: true,
    label: t('Training'),
    subtitle: t('Strength and cardio'),
    image: require('../../assets/images/learning/training.jpg'),
    intro: 'Muscle is one of the best tools for long-term health: it improves blood sugar control, bones and metabolism.',
    lessons: [
      { title: 'Two to three strength sessions a week', body: 'Full-body routines with squats, hinges, pushes and pulls are enough to start.' },
      { title: 'Move every day', body: 'Walking after meals lowers glucose spikes. Aim for around 8,000 steps.' },
      { title: 'Progress slowly', body: 'Add a little weight or a few reps each week, and keep 1-2 reps in reserve.' },
    ],
  },
  {
    id: 'meditation',
    icon: 'meditation',
    palette: [...ART_PALETTES.night],
    featured: true,
    label: t('Meditation'),
    subtitle: t('Calm your nervous system'),
    image: require('../../assets/images/learning/meditation.jpg'),
    intro: 'A few minutes of slow breathing shift your body towards recovery and can raise your HRV over time.',
    lessons: [
      { title: 'Start with 3 minutes', body: 'Consistency beats length. A short daily practice is better than a long one once a week.' },
      { title: 'Box breathing', body: 'Breathe in for 4, hold for 4, out for 4, hold for 4. Repeat for a few rounds.' },
    ],
    action: { label: t('Try box breathing'), href: '/exercise', params: { id: 'box_breathing' } },
  },
  {
    id: 'yoga',
    icon: 'yoga',
    palette: [...ART_PALETTES.sage],
    featured: true,
    label: t('Yoga'),
    subtitle: t('Mobility and breath'),
    image: require('../../assets/images/learning/yoga.jpg'),
    intro: 'Yoga combines mobility, strength and breathing. Gentle flows help with stiffness and stress.',
    lessons: [
      { title: 'Short flows count', body: 'Ten minutes of stretching in the morning improves how you move all day.' },
      { title: 'Listen to your body', body: 'Stretch to mild tension, never pain, and breathe slowly through each pose.' },
    ],
    action: { label: t('Do a 5-minute stretch'), href: '/exercise', params: { id: 'stretch' } },
  },
  {
    id: 'nutrition',
    icon: 'food-apple-outline',
    palette: [...ART_PALETTES.sage],
    featured: true,
    label: t('Nutrition'),
    subtitle: t('Eat for your markers'),
    image: require('../../assets/images/learning/nutrition.jpg'),
    intro: 'What you eat shows up in your blood tests: glucose, cholesterol, iron and vitamins.',
    lessons: [
      { title: 'Build your plate', body: 'Half vegetables, a quarter protein, a quarter whole grains, plus some healthy fat.' },
      { title: 'Oily fish twice a week', body: 'Salmon, sardines or mackerel help your omega-3 index and triglycerides.' },
      { title: 'Watch added sugar', body: 'Sugary drinks are the easiest place to cut back.' },
    ],
    action: { label: t('Log a meal'), href: '/log-meal' },
  },
  {
    id: 'sleep',
    icon: 'sleep',
    palette: [...ART_PALETTES.night],
    featured: true,
    label: t('Sleep'),
    subtitle: t('Recover better'),
    image: require('../../assets/images/learning/sleep.jpg'),
    intro: 'Short or irregular sleep raises cortisol and glucose the next day. Regularity matters as much as hours.',
    lessons: [
      { title: 'Same wake-up time', body: 'Keep it within 30 minutes every day, weekends included.' },
      { title: 'Wind down', body: 'No screens 30 minutes before bed, and keep the room cool and dark.' },
    ],
    action: { label: t('Body scan before bed'), href: '/exercise', params: { id: 'body_scan' } },
  },
  {
    id: 'heart_health',
    icon: 'heart-pulse',
    palette: [...ART_PALETTES.rose],
    featured: true,
    label: t('Heart health'),
    subtitle: t('Blood pressure and lipids'),
    image: require('../../assets/images/learning/heart_health.jpg'),
    intro: 'Blood pressure, LDL, ApoB and Lp(a) tell you a lot about your cardiovascular risk.',
    lessons: [
      { title: 'Measure at home', body: 'Take your blood pressure seated, after 5 minutes of rest, twice in a row.' },
      { title: 'Know your numbers', body: 'Ask a doctor what your LDL target should be: it depends on your overall risk.' },
    ],
    action: { label: t('Log blood pressure'), href: '/log-blood-pressure' },
  },
  {
    id: 'stress',
    icon: 'head-heart-outline',
    palette: [...ART_PALETTES.forest],
    featured: true,
    label: t('Stress'),
    subtitle: t('Cortisol and energy'),
    image: require('../../assets/images/learning/stress.jpg'),
    intro: 'Chronic stress keeps cortisol high and HRV low. Small daily breaks make a measurable difference.',
    lessons: [
      { title: 'Notice it early', body: 'A quick check-in helps you spot stressful days before they pile up.' },
      { title: 'Move it out', body: 'A brisk 10-minute walk lowers tension and improves your mood.' },
    ],
    action: { label: t('Check in now'), href: '/check-in' },
  },
  {
    id: 'genetics',
    label: t('Genetics'),
    subtitle: t('What runs in your family'),
    icon: 'dna',
    palette: [...ART_PALETTES.forest],
    intro: 'Your genes are not your destiny, but your family history is one of the most useful things a doctor can know about you.',
    lessons: [
      { title: 'Family history counts', body: 'Cancer or heart disease in close relatives, especially at a young age, can change when you should start screening.' },
      { title: 'When a genetic test makes sense', body: 'When the pattern in your family meets clinical criteria. A genetic counsellor helps you choose the right test and understand the result.' },
    ],
    action: { label: t('Know your roots'), href: '/know-your-roots' },
  },
  {
    id: 'hydration',
    label: t('Hydration'),
    subtitle: t('Water and your energy'),
    icon: 'cup-water',
    palette: [...ART_PALETTES.ocean],
    intro: 'Even mild dehydration can leave you tired and less focused. The colour of your urine is a simple daily guide.',
    lessons: [
      { title: 'How much', body: 'The European Food Safety Authority sets about 2 litres of water a day for women and 2.5 for men, counting all drinks and food (about a fifth comes from food). More with heat or exercise.' },
      { title: 'Check the colour', body: 'Pale straw is the goal. Dark yellow usually means you need to drink more; some vitamins turn it bright yellow.' },
      { title: 'Spread it out', body: 'A glass with each meal and one between meals is easier than drinking a lot at once.' },
    ],
    action: { label: t('Log your bladder'), href: '/log-urine' },
    sources: [{ label: 'EFSA. Dietary reference values for water. EFSA Journal 2010', url: 'https://doi.org/10.2903/j.efsa.2010.1459' }],
  },
  {
    id: 'strength',
    label: t('Strength training'),
    subtitle: t('Why muscle matters'),
    icon: 'dumbbell',
    palette: [...ART_PALETTES.terracotta],
    intro: 'Strength training is linked to a lower risk of death, heart disease, cancer and diabetes, on top of what cardio does.',
    lessons: [
      { title: 'About an hour a week', body: 'In a review of 16 large studies, the biggest benefit appeared with 30 to 60 minutes of strength work a week.' },
      { title: 'Two days or more', body: 'The WHO recommends strength exercises for all major muscle groups on at least two days a week.' },
      { title: 'Add cardio', body: 'People who did both strength and aerobic exercise had the lowest risk.' },
    ],
    action: { label: t('Log a workout'), href: '/log-workout' },
    sources: [
      { label: 'Momma H et al. Muscle-strengthening activities and mortality. Br J Sports Med 2022', url: 'https://doi.org/10.1136/bjsports-2021-105061' },
      { label: 'Bull FC et al. WHO 2020 guidelines on physical activity. Br J Sports Med 2020', url: 'https://doi.org/10.1136/bjsports-2020-102955' },
    ],
  },
  {
    id: 'biomarkers',
    label: t('Why measure'),
    subtitle: t('What your blood tells you'),
    icon: 'test-tube',
    palette: [...ART_PALETTES.gold],
    intro: 'Many changes start silently: blood sugar, cholesterol, iron or vitamin D can drift for years before you notice anything.',
    lessons: [
      { title: 'Catch it early', body: 'A rising HbA1c or LDL is much easier to turn around with habits than a diagnosis years later.' },
      { title: 'Trends beat single values', body: 'One result is a snapshot. Measuring again shows whether your changes are working. Small differences can be normal variation, so we compare each value with your own previous ones.' },
    ],
    action: { label: t('See your results'), href: '/report-summary' },
  },
  {
    id: 'sauna',
    label: t('Sauna'),
    subtitle: t('Heat and your heart'),
    icon: 'fire',
    palette: [...ART_PALETTES.terracotta],
    intro: 'In a Finnish study of 2,315 middle-aged men followed for about 20 years, those who used the sauna 4 to 7 times a week had fewer fatal heart events than those who went once a week.',
    lessons: [
      { title: 'A link, not proof', body: 'People who use the sauna often may be different in other ways. It is a promising habit, not a treatment.' },
      { title: 'Safety first', body: 'Skip it after alcohol, when you feel unwell or in pregnancy, and ask your doctor first if you have heart disease or uncontrolled blood pressure. Drink water afterwards.' },
    ],
    sources: [{ label: 'Laukkanen T et al. Sauna bathing and mortality. JAMA Intern Med 2015', url: 'https://doi.org/10.1001/jamainternmed.2014.8187' }],
  },
  {
    id: 'cold_water',
    label: t('Cold water'),
    subtitle: t('Ice baths and recovery'),
    icon: 'snowflake',
    palette: [...ART_PALETTES.ocean],
    intro: 'Cold water immersion can slightly reduce muscle soreness after exercise. Studies point to water at about 11–15 °C for 11–15 minutes.',
    lessons: [
      { title: 'Not after every strength session', body: 'In a 12-week trial, men who took a cold bath after strength training gained less muscle and strength than those who did an active recovery.' },
      { title: 'Start gently', body: 'Begin with cold showers or short dips, never alone in open water, and ask your doctor first if you have a heart condition.' },
    ],
    sources: [
      { label: 'Machado AF et al. Cold water immersion and muscle soreness. Sports Med 2016', url: 'https://doi.org/10.1007/s40279-015-0431-7' },
      { label: 'Roberts LA et al. Cold water immersion and strength training adaptations. J Physiol 2015', url: 'https://doi.org/10.1113/JP270570' },
    ],
  },
  {
    id: 'creatine',
    label: t('Creatine'),
    subtitle: t('Strength, and beyond'),
    icon: 'flask-outline',
    palette: [...ART_PALETTES.gold],
    intro: 'Creatine is one of the most studied supplements. It helps with short, intense efforts and with how you adapt to training.',
    lessons: [
      { title: 'How much', body: '3–5 g a day, at any time. A loading phase is optional.' },
      { title: 'Is it safe?', body: 'Studies of up to five years in healthy people show it is well tolerated. It raises blood creatinine without harming the kidneys, so tell your doctor before a blood test.' },
    ],
    action: { label: t('Add it to your supplements'), href: '/medication-setup', params: { mode: 'regular' } },
    sources: [{ label: 'Kreider RB et al. ISSN position stand on creatine. J Int Soc Sports Nutr 2017', url: 'https://doi.org/10.1186/s12970-017-0173-z' }],
  },
  {
    id: 'turmeric',
    label: t('Turmeric'),
    subtitle: t('Curcumin, honestly'),
    icon: 'leaf',
    palette: [...ART_PALETTES.sand],
    intro: 'Curcumin, the main compound in turmeric, has anti-inflammatory and antioxidant effects in studies, but on its own the body absorbs very little of it.',
    lessons: [
      { title: 'Absorption', body: 'Black pepper (piperine) greatly increases how much curcumin you absorb, which is why many supplements combine them.' },
      { title: 'Food or supplement', body: 'As a spice it is safe. Ask before taking high-dose supplements if you take blood thinners or are pregnant.' },
    ],
    sources: [{ label: 'Hewlings SJ, Kalman DS. Curcumin: a review of its effects on human health. Foods 2017', url: 'https://doi.org/10.3390/foods6100092' }],
  },
  {
    id: 'coffee',
    label: t('Coffee'),
    subtitle: t('How much is good'),
    icon: 'coffee-outline',
    palette: [...ART_PALETTES.forest],
    intro: 'A large review of the evidence found coffee more often linked to benefit than harm, with the biggest risk reduction at around 3–4 cups a day.',
    lessons: [
      { title: 'Not in pregnancy', body: 'In pregnancy, more coffee was linked to low birth weight and pregnancy loss: keep caffeine low.' },
      { title: 'Mind your sleep', body: 'Caffeine lasts for hours. If you sleep badly, keep coffee to the morning.' },
    ],
    sources: [{ label: 'Poole R et al. Coffee consumption and health: umbrella review. BMJ 2017', url: 'https://doi.org/10.1136/bmj.j5024' }],
  },
];

export const findTopic = (id?: string) => LEARNING_TOPICS.find((t) => t.id === id) ?? LEARNING_TOPICS[0];

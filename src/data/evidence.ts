// "How Kuova works": cómo calculamos cada cosa y en qué estudios y guías nos basamos. Lo abre el
// icono (i) junto a cada número o recomendación, y More → How Kuova works lo lista entero.
// Mantener en la misma línea que la web pública (HomeTest-web/content/answers*.json).

export interface EvidenceSource {
  label: string;
  url?: string;
}

export interface EvidenceTopic {
  id: string;
  title: string;
  summary: string; // una frase
  body: string[]; // párrafos cortos
  sources: EvidenceSource[];
  status?: 'validated' | 'pending'; // pending = pendiente de validación clínica
}

export const EVIDENCE: EvidenceTopic[] = [
  {
    id: 'notifications',
    title: 'How we decide what to send you',
    summary: 'Clear rules, a minimum gap between reminders and at most two a day.',
    body: [
      'Each notification follows a written rule: for example, no records of any kind for 7 days, or three low-energy check-ins in a row.',
      'The same reminder never repeats before its minimum gap, and you get at most two a day, health-related ones first.',
      'You can mute any of them for 7 days, 1 month, 3 months or for good, from the notification itself or from More → Notifications.',
      'We test these rules with simulated users at different moments before they reach you.',
    ],
    sources: [],
    status: 'validated',
  },
  {
    id: 'readiness',
    title: 'Daily readiness',
    summary: 'A daily score from your sleep, resting heart rate and HRV compared with your own usual values.',
    body: [
      'We compare last night with your recent average: more sleep, lower resting heart rate and higher heart rate variability than usual raise the score.',
      'It is a guide to how hard to push today, not a medical measure. The formula is simple on purpose and is being reviewed by our medical team.',
    ],
    sources: [],
    status: 'pending',
  },
  {
    id: 'change_is_real',
    title: 'When a change is real',
    summary: 'Every result varies a little from day to day. We only call a change real when it is bigger than that natural variation.',
    body: [
      'Two blood tests of the same person can differ even if nothing changed: the body varies (biological variation) and so does the lab (analytical variation).',
      'Combining both gives the minimum change that is meaningful. For example, LDL cholesterol needs to move about 23% and triglycerides about 56% between two single tests.',
      'This is why we suggest retesting at the right time and, for small effects, more than one measurement.',
    ],
    sources: [{ label: 'Biological variation database (Ricos / Westgard)', url: 'https://westgard.com/biodatabase1.htm' }],
    status: 'validated',
  },
  {
    id: 'supplements',
    title: 'Supplements and your blood tests',
    summary: 'What can be measured, how long it takes to show and what can distort a result.',
    body: [
      'Correcting a deficiency shows clearly: vitamin D, ferritin (iron stores), B12, folate and the Omega-3 Index can rise 50–150% when you start low.',
      'Vitamin D needs about 3 months to settle after changing the dose; the Omega-3 Index about 4 months; ferritin keeps rising for around 3 months.',
      'Iron taken every other day is absorbed as well as daily and upsets the stomach less.',
      'Creatine raises blood creatinine without harming the kidneys, and high-dose biotin can falsify thyroid and other hormone tests: tell us before a test.',
    ],
    sources: [
      { label: 'Stoffel et al. Lancet Haematology 2017 (iron on alternate days)', url: 'https://doi.org/10.1016/S2352-3026(17)30182-5' },
      { label: 'von Siebenthal et al. eClinicalMedicine 2023 (iron, 6-month trial)', url: 'https://doi.org/10.1016/j.eclinm.2023.102286' },
      { label: 'Flock et al. JAHA 2013 (Omega-3 Index dose response)', url: 'https://doi.org/10.1161/JAHA.113.000513' },
      { label: 'Hultman et al. J Appl Physiol 1996 (muscle creatine loading)', url: 'https://doi.org/10.1152/jappl.1996.81.1.232' },
      { label: 'FDA: biotin can interfere with lab tests', url: 'https://labtestsonline.org/news/fda-warns-biotin-may-affect-some-lab-test-results' },
      { label: 'EFSA 2023: upper limit for vitamin B6', url: 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC10189633/' },
    ],
    status: 'validated',
  },
  {
    id: 'projections',
    title: 'How your markers could change',
    summary: 'Each marker follows its own response curve, not a straight line.',
    body: [
      'Some markers react in weeks (triglycerides, vitamin D starts), others take months (HbA1c reflects about 3 months; ferritin builds slowly).',
      'The timings are estimates from studies and are being validated by our medical team.',
    ],
    sources: [],
    status: 'pending',
  },
  {
    id: 'digestion',
    title: 'Your digestion notes',
    summary: 'Frequency, colour and consistency compared with what is usual, asking first what could explain a change.',
    body: [
      'Going from three times a day to three times a week is usual. Consistency uses the Bristol stool scale (types 1–7), which reflects how fast food moves through the gut.',
      'Red or black colours are often caused by food or supplements (beetroot, red dragon fruit, iron). We ask before suggesting a doctor.',
      'See a doctor if a change lasts 3 weeks or more, or straight away with black sticky stools, a lot of blood or strong pain.',
    ],
    sources: [
      { label: 'Lewis & Heaton. Scand J Gastroenterol 1997 (Bristol stool scale)', url: 'https://pubmed.ncbi.nlm.nih.gov/9299672/' },
      { label: 'NHS: bleeding from the bottom', url: 'https://www.nhs.uk/conditions/rectal-bleeding/' },
    ],
    status: 'pending',
  },
  {
    id: 'urine',
    title: 'Your urine notes',
    summary: 'Colour shows hydration; pale straw is the target.',
    body: [
      'Clear to pale straw means you are well hydrated; dark yellow or amber means you need to drink more.',
      'Red, pink or brown may not be about water: food (beetroot, blackberries) can cause it, otherwise it needs checking.',
      'Most adults pass 200–400 ml each time and about 0.8–2 litres a day. A one-off bottle check, or a 24-hour container from the pharmacy, gives you a real number.',
    ],
    sources: [
      { label: 'Swansea Bay NHS: urine colour guide', url: 'https://sbuhb.nhs.wales/files/community-healthy-bladder-and-bowel-service1/urine-colour-guide/' },
      { label: 'Royal Devon NHS: keep hydrated, stay well', url: 'https://www.royaldevon.nhs.uk/news/keep-hydrated-stay-well/' },
    ],
    status: 'pending',
  },
  {
    id: 'fertility',
    title: 'When to see a doctor about fertility',
    summary: 'After 12 months of trying if you are under 35, after 6 months from 35, and straight away from 40.',
    body: [
      'Most couples conceive within a year. Guidelines recommend a fertility check after 12 months of regular unprotected sex if you are under 35, after 6 months from 35, and without waiting from 40.',
      'With irregular or absent periods, or known conditions such as PCOS or endometriosis, it is worth going earlier.',
      'Sex every 2 to 3 days covers the fertile days without needing to time it exactly.',
    ],
    sources: [
      { label: 'NICE QS73: referral for specialist consultation', url: 'https://www.nice.org.uk/guidance/qs73/chapter/Quality-statement-2-Referral-for-specialist-consultation' },
      { label: 'American Society for Reproductive Medicine (ASRM) recommendations' },
    ],
    status: 'validated',
  },
  {
    id: 'temperature',
    title: 'Morning temperature and ovulation',
    summary: 'Your temperature rises 0.2–0.5 °C after ovulation and stays up until your period.',
    body: [
      'We use the "three over six" rule: three temperatures in a row above the highest of the six before, the third at least 0.2 °C higher. Ovulation was most likely the day before.',
      'It confirms ovulation after it happens; it does not predict it. Illness, alcohol or a short night can raise a reading.',
      'Wearables that measure skin temperature at night also capture the shift in most cycles, but less precisely than a thermometer, so we mark them as lower confidence.',
    ],
    sources: [
      { label: 'Wrist wearables capture menstrual-cycle temperature changes (Shilaih et al., 2018)', url: 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC6265623/' },
    ],
    status: 'validated',
  },
  {
    id: 'cycle_prediction',
    title: 'Period predictions',
    summary: 'Based on the median of your last cycles, with a window that grows when they vary.',
    body: [
      'We use the median length of up to your last 6 cycles, which is less affected by one unusual cycle than the average.',
      'The more periods you log, the narrower and more reliable the window. Kuova is not a contraceptive method.',
    ],
    sources: [],
    status: 'pending',
  },
  {
    id: 'medication',
    title: 'Medication reminders',
    summary: 'Reminders follow the schedule you set. We never change your treatment.',
    body: [
      'You choose what to track, when, and whether you want reminders. Each one can be muted or turned off on its own.',
      'The usual patterns we suggest (for example, levothyroxine on an empty stomach) come from the product leaflets: your prescription always wins.',
    ],
    sources: [],
    status: 'validated',
  },
];

export const evidenceTopic = (id: string) => EVIDENCE.find((t) => t.id === id);

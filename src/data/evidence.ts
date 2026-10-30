// "How KUOVA works": cómo calculamos cada cosa y en qué estudios y guías nos basamos. Lo abre el
// icono (i) junto a cada número o recomendación, y More → How KUOVA works lo lista entero.
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
    id: 'plan',
    title: 'How we build your plan',
    summary: 'From what you tell us at the start, and from your blood tests once they arrive.',
    body: [
      'Before your first test, your plan starts from your answers: how active you are, how many days a week you do strength and cardio, how many steps you walk, how you sleep, your habits, your goals, any condition you have and your age.',
      'Each possible action gets points for how much it can help you. Sitting most of the day or wanting to lose weight move walking up; sleeping under 6 hours or wanting more energy move sleep up; high blood pressure turns the food action into eating less salt. We keep the 3 or 4 actions with the most points.',
      'Targets start a step above where you are, not at an ideal: 6,000 steps if you mostly sit, two short strength sessions a week if you are starting out.',
      'Once your watch and the app have a couple of weeks of your data, they come first: your average steps and sleep over the last 14 days, how much your bedtime and wake-up time vary, the strength and cardio workouts and calm sessions you logged in the last 4 weeks, the stress you mark in your check-ins, the added sugar in the meals you log, what you drink and the doses you mark. Each action is a goal, with how far you have got; your full plan tells you where you are and what the guidelines recommend. If you already meet a target, that action leaves your plan and shows under "Already on track".',
      'Strength follows the WHO: 2 or more days a week. Cardio too: at least 150 minutes a week of moderate activity, where your walks also count. Water, check-ins and doses only enter your plan if you log them, and check-ins and doses only show in your full plan, not on Today.',
      'Regular sleep times only enter your plan if they really vary: when your bedtime or wake-up time moves more than ±45 minutes from night to night (the standard deviation over the last 2 weeks). The aim is under ±30 minutes, the most regular group in the MESA study.',
      'When your results arrive, the plan adds what your markers show, and at your next test you see how they moved.',
    ],
    sources: [
      { label: 'WHO 2020 guidelines on physical activity and sedentary behaviour (Bull et al., Br J Sports Med 2020)', url: 'https://doi.org/10.1136/bjsports-2020-102955' },
      { label: 'Daily steps and all-cause mortality, 15 cohorts (Paluch et al., Lancet Public Health 2022)', url: 'https://doi.org/10.1016/S2468-2667(21)00302-9' },
      { label: 'Recommended amount of sleep for adults: 7 hours or more (Watson et al., Sleep 2015)', url: 'https://doi.org/10.5665/sleep.4716' },
      { label: 'Sleep irregularity and risk of cardiovascular events, MESA (Huang et al., J Am Coll Cardiol 2020)', url: 'https://doi.org/10.1016/j.jacc.2019.12.054' },
    ],
    status: 'pending',
  },
  {
    id: 'checkin',
    title: 'Your daily check-in',
    summary: 'How your energy and mood change over time, compared with your own usual.',
    body: [
      'Each check-in records your energy from 1 to 5, your mood and, if you want, a note. We draw them as a line so you see your own pattern, not a comparison with other people.',
      'Three days in a row at 2 out of 5 or lower bring a gentle note. If it lasts two weeks or more, we suggest talking to a professional.',
      'Nobody else sees your check-ins unless you choose to share them.',
    ],
    sources: [],
    status: 'pending',
  },
  {
    id: 'wearables',
    title: 'Your wearable data',
    summary: 'Sleep, heart rate, HRV, steps and temperature, compared with your own usual values.',
    body: [
      'We read what your watch or ring already measures, through Health Connect or its own app. We never change your data.',
      'Resting heart rate and HRV vary a lot from one person to another, so we compare each day with your own recent average instead of a population value.',
      'Temperature is shown against a usual range of 36.1 to 37.2 °C. Wearables measure the skin at night, so small differences from a thermometer are normal.',
    ],
    sources: [],
    status: 'pending',
  },
  {
    id: 'badges',
    title: 'How badges work',
    summary: 'For things you actually do, never just for receiving something.',
    body: [
      'Badges mark streaks and milestones you reach yourself: days logged in a row, steps, breathing or strength sessions.',
      'There are no badges for receiving your results or your plan, and nothing is taken away if a streak breaks.',
    ],
    sources: [],
    status: 'validated',
  },
  {
    id: 'specialists',
    title: 'When we suggest a specialist',
    summary: 'Only when your data or your goals point to someone who can help.',
    body: [
      'We suggest a doctor when a rule says something needs checking, for example a very high blood pressure reading or black stools without an explanation.',
      'We suggest a dietitian, trainer, physio or psychologist when it fits your goals or your plan.',
      'Booking is always your choice, and you decide what they can see and for how long.',
    ],
    sources: [],
    status: 'pending',
  },
  {
    id: 'learning',
    title: 'Where our reads come from',
    summary: 'Short reads written from guidelines and studies, linked to what you see in your results.',
    body: [
      'Each read explains one idea in plain words, such as why a marker varies from one test to the next or when it is worth testing again.',
      'They are written from clinical guidelines and studies, are being reviewed by our medical team, and never replace a professional.',
    ],
    sources: [],
    status: 'pending',
  },
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
      'Each part is compared with your own last four weeks, not with an average person: how far today’s HRV and resting heart rate are from your usual, measured in your own day-to-day spread. A normal day scores around 65; it takes a clearly better day than usual to go above 90.',
      'Sleep is compared with your sleep goal (Your daily goals): reaching it scores 90, and each 10% short takes off 15.',
      'If you log your periods, in the luteal phase we allow for the slightly higher resting heart rate and lower HRV that are normal then.',
      'It is a guide to how hard to push today, not a medical measure. The formula is being reviewed by our medical team.',
    ],
    sources: [
      { label: 'HRV-guided training: daily values compared with your own rolling baseline (Plews et al., Sports Med 2013)', url: 'https://doi.org/10.1007/s40279-013-0071-8' },
      { label: 'Wrist wearables capture menstrual-cycle temperature changes (Shilaih et al., 2018)', url: 'https://doi.org/10.1038/s41598-018-20796-9' },
    ],
    status: 'pending',
  },
  {
    id: 'daily_goals',
    title: 'Your daily goals',
    summary: 'Steps and sleep from your plan or your age; active calories and distance from those steps, your sex, weight and height.',
    body: [
      'Steps: 8,000 a day before 60 and 7,000 from 60. In 15 studies with 47,000 adults, the benefit kept growing up to 8,000-10,000 steps a day before 60 and up to 6,000-8,000 from 60.',
      'Sleep: 7 h 30. Adults need 7 hours or more; teenagers, 8 to 10.',
      'Active calories: what those steps burn for your weight (about 0.5 kcal per kg and km walked) plus 30 minutes of moderate activity a day, which is how the WHO recommendation of 150-300 minutes a week works out. It is an estimate: each watch measures it its own way.',
      'Distance: your steps times your stride, worked out from your height (about 41% of it).',
      'Water: 1.6 L a day from drinks for women and 2 L for men. EFSA sets an adequate intake of 2 L of water a day for women and 2.5 L for men, and about a fifth of it comes from food. You need more when it is hot or you exercise; with a kidney or heart condition, follow what your doctor tells you.',
      'If your plan has a steps or sleep target, we use that one. You can change any goal, and the circles fill up with yours.',
    ],
    sources: [
      { label: 'WHO 2020 guidelines on physical activity and sedentary behaviour (Bull et al., Br J Sports Med 2020)', url: 'https://doi.org/10.1136/bjsports-2020-102955' },
      { label: 'Daily steps and all-cause mortality, 15 cohorts (Paluch et al., Lancet Public Health 2022)', url: 'https://doi.org/10.1016/S2468-2667(21)00302-9' },
      { label: 'Recommended amount of sleep for adults: 7 hours or more (Watson et al., Sleep 2015)', url: 'https://doi.org/10.5665/sleep.4716' },
      { label: 'Sleep duration recommendations by age (Hirshkowitz et al., Sleep Health 2015)', url: 'https://doi.org/10.1016/j.sleh.2014.12.010' },
      { label: 'Compendium of Physical Activities: energy cost of each activity (Ainsworth et al., Med Sci Sports Exerc 2011)', url: 'https://doi.org/10.1249/MSS.0b013e31821ece12' },
      { label: 'Dietary Reference Values for water (EFSA Panel on Dietetic Products, Nutrition and Allergies, EFSA Journal 2010)', url: 'https://doi.org/10.2903/j.efsa.2010.1459' },
    ],
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
    id: 'gut_patterns',
    title: 'What we see in your digestion',
    summary: 'We compare what you ate before each symptom with how often you usually have it, and say how sure we are.',
    body: [
      'When you log a symptom in Digestion, we ask what you ate before: what it was, what it had (gluten, dairy, legumes, onion and garlic, sweet fruit, polyols, fried food, spicy food, alcohol, coffee), how long before and how much. We never ask before anything happens, and we do not use the meals in Your nutrients. The first time a food shows up, we ask how often you usually have it.',
      'Then we compare: if dairy came before 9 of your 10 logs and you have it a few times a week, that is far more than chance. Doctors call this a case-crossover design with your usual frequency (Maclure, 1991). A symptom only counts for a meal that fits by the time: heaviness, heartburn and nausea up to 3 hours after eating; bloating, gas and pain from 30 minutes to 8 hours; loose stools from 1 to 12 hours.',
      'Symptoms follow the GSRS questionnaire in plain words, with three levels, and we only look at pairs that make clinical sense (for example dairy and bloating, alcohol and reflux). We need at least 5 logs with what you ate. A pattern is "likely" with 5 logs, the food at least 25 points above what you usually eat and a binomial test under 0.05; "quite clear" with 8 logs, 30 points above and under 0.005. When two foods always go together, we say so, unless you eat one of them far more often without trouble (bread at almost every meal, symptoms only with milk). We always show the numbers.',
      'Frequent symptoms follow Rome IV (heaviness 3 days a week, pain with changes in your stools 1 day a week) and the Montreal definition of reflux. Rome IV asks for 3 months.',
      'Before any test we ask about warning signs (weight loss, blood, anaemia, symptoms at night, trouble swallowing, starting after 50, family history). With any of them, we suggest a doctor instead of a test.',
      'We do not recommend IgG "food intolerance" tests: allergy societies advise against using them for diagnosis. This is guidance from your own notes, not a diagnosis.',
    ],
    sources: [
      { label: 'Svedlund et al. Dig Dis Sci 1988 (GSRS)', url: 'https://pubmed.ncbi.nlm.nih.gov/3123181/' },
      { label: 'Maclure. Am J Epidemiol 1991 (case-crossover design)', url: 'https://pubmed.ncbi.nlm.nih.gov/1985444/' },
      { label: 'Drossman. Gastroenterology 2016 (Rome IV)', url: 'https://pubmed.ncbi.nlm.nih.gov/27144617/' },
      { label: 'Vakil et al. Am J Gastroenterol 2006 (Montreal definition of reflux)', url: 'https://pubmed.ncbi.nlm.nih.gov/16928254/' },
      { label: 'Rezaie et al. Am J Gastroenterol 2017 (breath testing, North American consensus)', url: 'https://pubmed.ncbi.nlm.nih.gov/28323273/' },
      { label: 'NICE NG20: coeliac disease', url: 'https://www.nice.org.uk/guidance/ng20' },
      { label: 'Vasant et al. Gut 2021 (BSG guideline on irritable bowel)', url: 'https://pubmed.ncbi.nlm.nih.gov/33903147/' },
      { label: 'Malfertheiner et al. Gut 2022 (Maastricht VI, Helicobacter pylori)', url: 'https://pubmed.ncbi.nlm.nih.gov/35944925/' },
      { label: 'Stapel et al. Allergy 2008 (EAACI: IgG tests for food)', url: 'https://pubmed.ncbi.nlm.nih.gov/18489614/' },
      { label: 'Monash University: FODMAP groups', url: 'https://www.monashfodmap.com/about-fodmap-and-ibs/' },
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
    id: 'family_history',
    title: 'Know your roots: your family history',
    summary: 'The questions a genetic counsellor asks at a first visit, scored with three validated tools. Guidance, not a diagnosis.',
    body: [
      'First, a quick check with yes/no questions. If nothing comes up, you finish in about a minute. If something does, we ask who it was, which cancer and at what age, because that is what changes the risk.',
      'We then score your answers with three tools doctors use to decide who to refer: the Pedigree Assessment Tool (referral from 8 points on either side of the family), the Ontario Family History Assessment Tool (from 10 points, about double the usual lifetime risk of breast cancer) and the Manchester Scoring System (15 points ≈ a 10% chance of a BRCA1/2 variant in the affected relative; the NHS uses 20 for relatives without cancer). For bowel and womb cancers we look for the Amsterdam II and revised Bethesda patterns of Lynch syndrome.',
      'Each side of the family is scored separately, and the result is the highest level reached by any of them. Where people rarely know a detail (for example, whether an aunt was premenopausal) we use a cautious approximation and say so. An unknown age scores the minimum and we remind you to ask.',
      'Heart: a parent, brother, sister or child with heart disease before 55 (men) or 65 (women) is a risk-enhancing factor in the 2018 AHA/ACC cholesterol guideline, and a reason to measure Lp(a). It appears in its own card and does not change the cancer result.',
      'This is not a diagnosis. Only a genetic test, interpreted by a professional, can say whether there is an inherited change in your family. Your answers are special-category health data: only you see them unless you decide to share them.',
    ],
    sources: [
      { label: 'Hoskins KF et al. Pedigree Assessment Tool. Cancer 2006', url: 'https://doi.org/10.1002/cncr.22202' },
      { label: 'Teller P et al. Validation of the PAT in BRCA1/2 families. Ann Surg Oncol 2010', url: 'https://doi.org/10.1245/s10434-009-0697-9' },
      { label: 'Gilpin CA et al. Ontario Family History Assessment Tool. Clin Genet 2000', url: 'https://doi.org/10.1034/j.1399-0004.2000.580408.x' },
      { label: 'Evans DG et al. Manchester Scoring System. J Med Genet 2004', url: 'https://doi.org/10.1136/jmg.2003.017996' },
      { label: 'Evans DG et al. Pathology update to the Manchester Scoring System. J Med Genet 2017', url: 'https://doi.org/10.1136/jmedgenet-2017-104584' },
      { label: 'Vasen HF et al. Amsterdam II criteria for Lynch syndrome. Gastroenterology 1999', url: 'https://doi.org/10.1016/s0016-5085(99)70510-x' },
      { label: 'Umar A et al. Revised Bethesda Guidelines. J Natl Cancer Inst 2004', url: 'https://doi.org/10.1093/jnci/djh034' },
      { label: 'US Preventive Services Task Force. BRCA-related cancer risk assessment. JAMA 2019', url: 'https://doi.org/10.1001/jama.2019.10987' },
      { label: 'USPSTF evidence review, Appendix C1: familial risk assessment tools (2019)', url: 'https://www.ncbi.nlm.nih.gov/books/NBK545866/' },
      { label: 'NCCN Guidelines: Genetic/Familial High-Risk Assessment (breast, ovarian, pancreatic, prostate; colorectal, endometrial, gastric)', url: 'https://www.nccn.org/guidelines/category_2' },
      { label: 'Bennett RL et al. NSGC standardized pedigree nomenclature. J Genet Couns 2008 (updated 2022)', url: 'https://doi.org/10.1007/s10897-008-9169-9' },
      { label: 'Grundy SM et al. 2018 AHA/ACC guideline on blood cholesterol. Circulation 2019', url: 'https://doi.org/10.1161/CIR.0000000000000625' },
    ],
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

// Para qué puede servir cada producto de la tienda y cada cuánto tiene sentido repetirlo,
// por id de src/data/testCatalog.ts. Orientativo y sin diagnosticar: lo revisa el asesor
// médico (ver el backlog de revisión clínica). Las frecuencias siguen la guía de paneles de
// Kuova («Rutina» frente a «Repetir tras un cambio»). La versión en español está en
// src/i18n/testGuideEs.ts.

export interface TestGuide {
  useful: string;
  repeat: string;
}

const STI: TestGuide = {
  useful: 'If you have a new partner or had sex without a condom, or simply to know where you stand. Many infections cause no symptoms.',
  repeat: 'After each possible exposure (some take a few weeks to show up), and every 3-12 months if you have new partners.',
};

const GENETIC_REPEAT = 'Once: your DNA does not change.';
const BREATH_REPEAT = 'Once. It is only repeated if your symptoms change or your doctor asks for it.';

export const TEST_GUIDE: Record<string, TestGuide> = {
  membership: {
    useful:
      'To see how you are doing overall and follow it over time: cholesterol and ApoB, blood sugar, inflammation, liver enzymes, creatinine, iron and vitamins, TSH, testosterone and your KUOVA age.',
    repeat: 'Already built in: the Baseline analysis every year and the same follow-up 6 months later, so you can see whether what you changed is working.',
  },
  premium: {
    useful:
      "If you want a fuller picture once a year (thyroid, hormones, kidneys), or you're making changes (diet, training, treatment) and want to see their effect sooner.",
    repeat: 'Already built in: the Kuova Premium analysis every year and a follow-up every 3 months.',
  },

  // Añadir a tu seguimiento
  vitamin_d: {
    useful: 'If your vitamin D came out below the lab range and you want to see whether what you have changed (sun, diet) has made a difference.',
    repeat: 'In your follow-up, 6 months later. Bear in mind the season changes in between: vitamin D goes up in summer and down in winter.',
  },
  b12_folate: {
    useful: 'If your B12 came out below the range or your MCV (the size of your red blood cells) came out above it. Also if you eat little or no meat.',
    repeat: 'In your follow-up. If it is still below the range, the next step is talking to your doctor to look for the cause.',
  },
  magnesium: {
    useful: 'If your magnesium came out below the lab range.',
    repeat: 'In your follow-up, 6 months later.',
  },
  calcium: {
    useful: 'If your calcium came out of range, to confirm it with a second measurement.',
    repeat: 'In your follow-up. If it comes out above the range twice, talk to your doctor about it.',
  },
  sodium_potassium: {
    useful: 'If they came out of range, or you take blood pressure medication or diuretics, which can move them.',
    repeat: 'In your follow-up. If they are still out of range, talk to your doctor: they are the one who adjusts your medication.',
  },
  insulin: {
    useful: 'If your fasting insulin or your HOMA-IR came out above the range, to see the trend next to your glucose and HbA1c.',
    repeat: 'In your follow-up, 6 months later, in the same lab.',
  },
  psa: {
    useful: 'For men aged 50 or over (45 with a family history) who choose prostate screening after reading its pros and cons.',
    repeat: 'If you choose it, how often is something to decide with your doctor, depending on your age and your result.',
  },

  // Confirmar y ampliar
  thyroid: {
    useful:
      'If your TSH came out of the lab range (one measurement is not enough), or if your doctor monitors your thyroid and you want it in the same blood draw as your follow-up.',
    repeat: 'Once, to confirm. If your doctor monitors your thyroid, they set how often.',
  },
  low_testosterone: {
    useful:
      'For men whose testosterone came out below the lab range and who notice symptoms such as tiredness or lower sex drive. Testosterone changes from one day to the next, so it is confirmed with another morning blood draw.',
    repeat: 'Once, to confirm. If it is confirmed below the range, the next step is your doctor.',
  },
  androgens: {
    useful: 'For women whose testosterone came out above the lab range, or who have marked irregular cycles.',
    repeat: 'Once. With the result, it is worth talking it over with your gynaecologist.',
  },
  urine_albumin: {
    useful: 'If your eGFR came out below the range or there was protein in your urine, or if you have marked diabetes, prediabetes or high blood pressure.',
    repeat: 'With diabetes or high blood pressure, guidelines ask for it at least once a year. If it comes out above the range, it is confirmed with another sample.',
  },

  // Objetivos
  ovarian_reserve: {
    useful: 'If you want to know your ovarian reserve, for example to plan when to try for a baby, and talk it over with your gynaecologist.',
    repeat: 'Only when you have a specific question. It is not repeated routinely.',
  },
  hormones_f: {
    useful: 'If your cycle is irregular, you have symptoms that change with your cycle, or you want to understand your hormones and talk it over with your gynaecologist.',
    repeat: 'Only with a specific question, or when your cycle or your symptoms change.',
  },
  hormones_m: {
    useful: 'If you notice tiredness, lower sex drive or changes in mood and want to look at your hormones.',
    repeat: 'Only with symptoms or a specific question. Anything out of range is repeated to confirm it.',
  },
  preconception: {
    useful: 'If you are planning a pregnancy. With the result, your doctor tells you whether any vaccine is worth having before trying.',
    repeat: 'Once, before trying for a baby.',
  },
  coeliac: {
    useful: 'If you often have digestive symptoms, low iron with no clear cause, or a first-degree relative with coeliac disease.',
    repeat: 'Once. It is only repeated if your symptoms change or your doctor asks for it.',
  },
  sibo: {
    useful: 'If you have had frequent bloating or wind for weeks (for example, logged in Digestion).',
    repeat: BREATH_REPEAT,
  },
  lactose: {
    useful: 'If you notice discomfort, bloating or diarrhoea after dairy.',
    repeat: BREATH_REPEAT,
  },
  fructose: {
    useful: 'If you notice discomfort or bloating after fruit, juice or sweets.',
    repeat: BREATH_REPEAT,
  },
  hpylori: {
    useful: 'If you often have stomach discomfort (burning, pain or heaviness in the upper abdomen).',
    repeat: 'Once. After treatment, only if your doctor asks for it.',
  },
  sti_basic: STI,
  sti_full: STI,
  training_load: {
    useful:
      'If you train a lot and notice you recover worse. What matters most for sport (blood count, ferritin, vitamin D, magnesium, testosterone) is already in your yearly analysis.',
    repeat: 'Every 3-6 months, ideally at the same point of your season.',
  },
  omega3: {
    useful: 'If you want to know whether your diet has enough oily fish, or to see the effect of a change in your diet.',
    repeat: 'About 4 months after a change in your diet: that is how long it takes to show.',
  },
  allergy_alex: {
    useful: 'If you have allergy symptoms (sneezing, itchy eyes or skin, discomfort with a food) and want to take the result to your allergist.',
    repeat: 'Once. It is only repeated if your allergist asks for it.',
  },
  gen_carrier: {
    useful: "If you are thinking about having children, ideally before the pregnancy, or if there is a hereditary condition in your family or your partner's.",
    repeat: GENETIC_REPEAT,
  },
  gen_coeliac: {
    useful:
      'If you have relatives with coeliac disease, or to rule it out when you already eat gluten-free and the antibody test can no longer be read.',
    repeat: GENETIC_REPEAT,
  },
  gen_intolerance: {
    useful:
      'If dairy, fruit or some foods often disagree with you and you want to know whether there is a genetic part. The breath tests show how you absorb them today.',
    repeat: GENETIC_REPEAT,
  },
  gen_hfe: {
    useful: 'If your ferritin and transferrin saturation come out high, or a close relative has haemochromatosis.',
    repeat: GENETIC_REPEAT,
  },
  gen_thrombophilia: {
    useful:
      'If you or a close relative have had a thrombosis, especially when young, before starting hormonal contraception or planning a pregnancy.',
    repeat: GENETIC_REPEAT,
  },
  gen_apoe: {
    useful: 'If you want to know it after thinking it through with a professional: the result can affect you and your family.',
    repeat: GENETIC_REPEAT,
  },
  doctor_request: {
    useful: 'If your doctor has asked you for tests: taking them in your follow-up blood draw saves you a visit.',
    repeat: 'When your doctor tells you.',
  },
};

// Para qué puede servir cada producto de la tienda y cada cuánto tiene sentido repetirlo,
// por id de src/data/testCatalog.ts. Orientativo y sin diagnosticar: lo revisa el asesor
// médico (ver el backlog de revisión clínica). La versión en español está en
// src/i18n/testGuideEs.ts.

export interface TestGuide {
  useful: string;
  repeat: string;
}

const STI: TestGuide = {
  useful: 'If you have a new partner or had sex without a condom, or simply to know where you stand. Many infections cause no symptoms.',
  repeat: 'After each possible exposure (some take a few weeks to show up), and every 3-12 months if you have new partners.',
};

export const TEST_GUIDE: Record<string, TestGuide> = {
  membership: {
    useful: 'To know how your whole body is doing and follow it over time, not just one thing.',
    repeat: 'Already built in: a full panel when you join and a follow-up 6 months later.',
  },
  premium: {
    useful: "If you're making changes (diet, training, treatment) and want to see their effect soon.",
    repeat: 'Already built in: a blood test every 3 months.',
  },
  essential: {
    useful: "A general check-up if it's been a while since your last blood test, or if you don't feel right and don't know why.",
    repeat: 'Once a year, or 3 months after changing habits if something came out of range.',
  },
  weight: {
    useful: "If losing weight is hard even though you eat well and move, or your weight has changed for no clear reason.",
    repeat: '3-6 months after making changes, to see whether the values improve.',
  },
  performance: {
    useful: 'If you train often and notice you recover worse, get injured more or perform below your usual level.',
    repeat: 'Every 3-6 months, ideally at the same point of your season.',
  },
  vitamin_d: {
    useful: "If you get little sun (autumn and winter, working indoors), feel low on energy or mood, or want to check your supplement is working.",
    repeat: 'Once a year, ideally at the end of winter; 3 months after starting or changing a supplement.',
  },
  vitamin_b: {
    useful: "If you eat little or no meat, feel low on energy, notice tingling, or have been taking metformin or omeprazole for a while.",
    repeat: 'Once a year; 3 months after starting a supplement.',
  },
  vitamins: {
    useful: 'If you feel low on energy, follow a restrictive diet or get little sun: it checks the three vitamins that are most often low.',
    repeat: 'Once a year; 3 months after starting supplements.',
  },
  iron: {
    useful: "If you feel low on energy, are losing more hair, have heavy periods or eat little meat: it's the first thing to rule out when energy drops.",
    repeat: "Once a year; 3 months after starting iron, to check it's working.",
  },
  cycle_hormones: {
    useful: 'If your cycle is irregular, you have strong premenstrual symptoms or you want to understand how your hormones change through the month.',
    repeat: 'When your cycle or symptoms change, or when your doctor advises.',
  },
  cortisol: {
    useful: "If you've been through a stressful time, sleep badly or wake up without energy.",
    repeat: '3 months after making changes (sleep, stress, routine). The sample is taken in the morning.',
  },
  stress: {
    useful: 'If stress has lasted weeks or months and you notice it in your sleep, energy or mood.',
    repeat: 'Every 3-6 months while you work on it.',
  },
  fertility_f: {
    useful: "If you're thinking about getting pregnant now or in the next few years and want a picture of your fertility.",
    repeat: "Once a year while you're planning.",
  },
  thyroid: {
    useful: "If you feel low on energy or cold, your weight or mood has changed or you're losing more hair: the thyroid is behind these more often than you'd think.",
    repeat: 'Once a year; 6-8 weeks after a change in thyroid medication, if your doctor asks for it.',
  },
  thyroid_adv: {
    useful: 'If there are thyroid problems in your family or a previous TSH came out of range: the antibodies show whether it is autoimmune.',
    repeat: 'Hormones once a year; the antibodies are usually needed only once, unless your doctor says otherwise.',
  },
  amh: {
    useful: "To know your ovarian reserve if you're thinking about when to have children or about freezing eggs.",
    repeat: "Once a year if you're planning.",
  },
  testosterone: {
    useful: 'If you notice less energy, less sexual desire or a low mood, or you lose muscle more easily.',
    repeat: '3-6 months after making changes. The sample is taken in the morning.',
  },
  t1d_antibodies: {
    useful: 'If a parent, brother, sister or child has type 1 diabetes: it can show the risk years before symptoms appear.',
    repeat: 'Usually once; your doctor will tell you if it needs repeating.',
  },
  cardio: {
    useful: 'If there is heart disease in your family, your cholesterol has been high, you smoke or you take medication for cholesterol or blood pressure.',
    repeat: 'Once a year; 3 months after changing your diet or medication.',
  },
  diabetes: {
    useful: "If you're thirstier or go to the toilet more, there is diabetes in your family, or you've put on weight or move little.",
    repeat: "Once a year; every 3-6 months if you've had high values.",
  },
  psa: {
    useful: 'For men from 50 (or 45 with a family history) who have talked to their doctor about prostate screening.',
    repeat: 'Every 1-2 years, as agreed with your doctor.',
  },
  lpa: {
    useful: "If someone in your family had a heart attack or a stroke young: Lp(a) is inherited and a normal cholesterol doesn't rule it out.",
    repeat: 'Usually once in your life: it barely changes.',
  },
  coeliac: {
    useful: 'If you have bloating, diarrhoea or low iron for no clear reason, or someone in your family is coeliac. Keep eating gluten before the test.',
    repeat: 'If symptoms continue or a relative is diagnosed.',
  },
  fructose: {
    useful: 'If fruit, juice or honey give you gas, bloating or diarrhoea.',
    repeat: 'Usually once.',
  },
  lactose: {
    useful: 'If milk or dairy give you gas, bloating or diarrhoea.',
    repeat: 'Usually once.',
  },
  lactose_fructose: {
    useful: "If you feel bloated after eating and don't know whether it's dairy, fruit or both.",
    repeat: 'Usually once.',
  },
  sibo: {
    useful: 'If you feel bloated almost every day, especially soon after eating, or have gas and changes in your bowel habits.',
    repeat: 'After treatment, if your doctor asks for it.',
  },
  digestive_pack: {
    useful: 'If your digestion is bothering you and you want to rule out the three most common causes in one go.',
    repeat: 'Usually once; SIBO again after treatment if your doctor asks for it.',
  },
  sti_4: STI,
  sti_7: STI,
  sti_11: STI,
  consult_digestive: {
    useful: 'When you have your intolerance or SIBO results and want a doctor to explain them and tell you the next steps.',
    repeat: 'Whenever you have new results.',
  },
  consult_sti: {
    useful: 'When you have your STI results and want a doctor to explain them and tell you the next steps.',
    repeat: 'Whenever you have new results.',
  },
};

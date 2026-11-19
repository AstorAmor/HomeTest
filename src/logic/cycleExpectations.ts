import type { CyclePhaseId } from '@/utils/cyclePhase';

// Qué puede notarse en cada fase del ciclo (fundador, 2026-11-17: «que en la fase en la que está, explique un poco lo
// que se podría esperar de energía, ánimo…»). Son tendencias medias y en tono neutro: cada persona varía y las
// diferencias medias entre fases son pequeñas.
// Fuentes: rendimiento, McNulty et al. 2020 (Sports Med, metaanálisis: diferencia media trivial, peor al inicio de la
// fase folicular); sueño y temperatura, Baker y Driver 2007 (Sleep Med); pulso y VFC en la fase lútea, Schmalenberger
// et al. 2019 (Psychoneuroendocrinology); gasto en reposo y apetito, Benton et al. 2020 (Br J Nutr); ejercicio y dolor
// de regla, Armour et al. 2019 (Cochrane). Fertilidad (fundador, 2026-11-18: «y consideraciones de la fertilidad también
// en lo del ciclo»): la ventana fértil son los 5 días antes de la ovulación y ese día, con la probabilidad máxima en los
// 2 días antes y el propio día, Wilcox, Weinberg y Baird 1995 (N Engl J Med); su momento varía mucho de un ciclo a otro,
// incluso con ciclos regulares, Wilcox et al. 2000 (BMJ): por eso lo de abajo avisa de que no es un anticonceptivo.
// Pendiente de revisión clínica (kuova-clinical-review-backlog).

export interface PhaseExpectation {
  area: string; // etiqueta corta (se traduce): «Energía», «Ánimo»…
  text: string;
}

export const PHASE_EXPECT: Record<CyclePhaseId, PhaseExpectation[]> = {
  menstrual: [
    { area: 'Energy', text: 'It can be lower in the first days, especially with pain or heavy bleeding.' },
    { area: 'Mood', text: 'Premenstrual symptoms usually ease once your period starts.' },
    { area: 'Sleep', text: 'Period pain can make sleep lighter on the first nights.' },
    { area: 'Training', text: 'You can train as usual if you feel well; gentle exercise may ease period pain.' },
    { area: 'Fertility', text: 'Pregnancy is unlikely in these days, but possible with short cycles: sperm can survive up to 5 days.' },
  ],
  follicular: [
    { area: 'Energy', text: 'It usually rises as oestrogen rises.' },
    { area: 'Mood', text: 'Often the most stable part of the cycle.' },
    { area: 'Sleep', text: 'Usually steadier than in the days before your period.' },
    { area: 'Training', text: 'A good moment for intense or strength sessions, if you feel well.' },
    { area: 'Fertility', text: 'The fertile window opens about 5 days before ovulation; the chance of pregnancy rises day by day.' },
  ],
  ovulation: [
    { area: 'Energy', text: 'Many people notice their highest energy and sex drive.' },
    { area: 'Mood', text: 'Usually good.' },
    { area: 'Body', text: 'There can be mild pain on one side of the lower abdomen and clearer, stretchy discharge.' },
    { area: 'Temperature', text: 'After ovulation, morning temperature rises 0.2–0.5 °C and stays up until your period.' },
    { area: 'Fertility', text: 'The most fertile days: the chance is highest in the 2 days before ovulation and on the day itself.' },
  ],
  luteal: [
    { area: 'Energy', text: 'It usually holds in the first week and can drop in the days before your period.' },
    { area: 'Mood', text: 'In the last days there can be irritability, more sensitivity or low mood (premenstrual symptoms).' },
    { area: 'Sleep', text: 'Body temperature is slightly higher and sleep can be lighter before your period.' },
    { area: 'Appetite', text: 'It may increase: energy use at rest rises slightly.' },
    { area: 'Your watch', text: 'Resting heart rate often rises 1–3 bpm and HRV drops. Kuova allows for it in your daily readiness.' },
    { area: 'Training', text: 'With higher temperature and pulse, effort can feel harder; adjust intensity to how you feel.' },
    { area: 'Fertility', text: 'From about a day after ovulation, pregnancy is unlikely until the next cycle. If your period is late, a pregnancy test can clear it up.' },
  ],
};

// Debajo, siempre: que son medias. Y, con regla o antes de ella, a quién consultar si molesta mucho
export const PHASE_EXPECT_NOTE = 'Average trends: each person varies. With your daily check-in you will see your own pattern.';
export const PHASE_FERTILITY_NOTE = 'Fertile days are estimated from your cycles and are not a contraceptive method.';
export const PHASE_EXPECT_SAFETY = 'If pain or symptoms before your period disrupt your daily life, talk to your doctor.';
export const showPhaseSafety = (phase: CyclePhaseId) => phase === 'menstrual' || phase === 'luteal';

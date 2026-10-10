import { t } from '@/i18n';
// Lógica de fertilidad y temperatura basal. Pura (sin React Native), compartida por la app,
// el simulador y los tests. Orientativa y PENDIENTE DE VALIDACIÓN CLÍNICA: Kuova no es un
// método anticonceptivo ni diagnostica infertilidad.

export type TryingFor = 'under_6m' | '6_12m' | '1_2y' | 'over_2y';
export type SexFrequency = 'several_week' | 'weekly' | 'less';
export type Timing = 'yes' | 'sometimes' | 'no';

export interface FertilityInput {
  age: number | null;
  tryingFor: TryingFor;
  regularCycles: 'yes' | 'no' | 'unsure';
  frequency?: SexFrequency;
  timing?: Timing;
  knownConditions?: string[]; // p. ej. 'pcos', 'endometriosis', 'pelvic_infection'
}

export type FertilityLevel = 'keep_trying' | 'see_doctor' | 'see_doctor_now';

export interface FertilityAdvice {
  level: FertilityLevel;
  title: string;
  body: string;
  tips: string[];
}

const MONTHS: Record<TryingFor, number> = { under_6m: 3, '6_12m': 9, '1_2y': 18, over_2y: 30 };

// Guías de referencia: ASRM (y la Sociedad Española de Fertilidad) recomiendan consultar tras 12
// meses intentándolo con menos de 35 años, tras 6 meses de 35 a 39 y sin esperar desde los 40 o si
// hay ciclos irregulares o causas conocidas (SOP, endometriosis, infección pélvica previa). NICE
// (CG156/QS73) dice 1 año, con derivación antes desde los 36. Usamos el corte más prudente (35).
export function fertilityAdvice(input: FertilityInput): FertilityAdvice {
  const months = MONTHS[input.tryingFor];
  const age = input.age;
  const tips: string[] = [];

  if (input.frequency === 'less' && input.timing !== 'yes') {
    tips.push(t('Having sex every 2 to 3 days covers your fertile days without needing to time it exactly.'));
  }
  if (input.timing === 'no' || input.timing === 'sometimes') {
    tips.push(t('Your most fertile days are the 5 days before ovulation and the day of ovulation.'));
  }
  tips.push(t('Logging your morning temperature helps confirm when you ovulate.'));
  tips.push(t('Folic acid (400 µg a day) is recommended from before you conceive.'));

  const known = (input.knownConditions ?? []).length > 0;
  if ((age != null && age >= 40) || input.regularCycles === 'no' || known) {
    return {
      level: 'see_doctor_now',
      title: t('We recommend talking to a doctor'),
      body:
        age != null && age >= 40
          ? t('From 40, guidelines suggest seeing a fertility specialist early rather than waiting. It is a routine step, and there is a lot they can help with.')
          : t('With irregular cycles or a known condition, it can help to see a doctor early instead of waiting a year. It is a routine step, and there is a lot they can help with.'),
      tips,
    };
  }
  if (age != null && age >= 35 && months >= 6) {
    return {
      level: 'see_doctor',
      title: t('It may be a good moment to talk to a doctor'),
      body: t('From 35, guidelines suggest a fertility check after 6 months of trying. It is very common, and there is a lot that can help.'),
      tips,
    };
  }
  if (months >= 12) {
    return {
      level: 'see_doctor',
      title: t('It may be a good moment to talk to a doctor'),
      body: t('After a year of trying, guidelines suggest a fertility check for you and your partner. It is very common, and there is a lot that can help.'),
      tips,
    };
  }
  return {
    level: 'keep_trying',
    title: t('Keep going, you are on track'),
    body:
      age != null && age >= 35
        ? t('Most couples conceive within a year. From 35, we will suggest seeing a doctor if it has not happened after 6 months.')
        : t('Most couples conceive within a year. We will suggest seeing a doctor if it has not happened by then.'),
    tips,
  };
}

// ---------------------------------------------------------------------------------------------
// Subida de temperatura tras la ovulación (regla "3 sobre 6"): tres temperaturas seguidas por
// encima de la más alta de las 6 anteriores, y la tercera al menos 0,2 °C por encima. La
// ovulación suele haber sido el día anterior a la primera de las tres.
// La temperatura basal de la mañana (termómetro) es la referencia; la del wearable (de noche,
// en la piel) sirve de apoyo y se marca con menos confianza.

export interface TempReading {
  date: string; // YYYY-MM-DD
  celsius: number;
  source: 'manual' | 'wearable';
}

export interface TempShift {
  shiftDate: string; // primer día de las tres temperaturas altas
  likelyOvulation: string; // día anterior
  coverline: number;
  source: 'manual' | 'wearable';
  confidence: 'high' | 'low';
}

const addDays = (date: string, n: number) => {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

// Una lectura por día y fuente: si hay manual, gana la manual
export function dailyTemps(readings: TempReading[]): TempReading[] {
  const byDay = new Map<string, TempReading>();
  for (const r of readings) {
    const prev = byDay.get(r.date);
    if (!prev || (prev.source === 'wearable' && r.source === 'manual')) byDay.set(r.date, r);
  }
  return [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date));
}

// `since`: inicio del ciclo actual, para no confundir la subida con la de un ciclo anterior
export function detectTempShift(readings: TempReading[], since?: string): TempShift | null {
  const days = dailyTemps(readings).filter((d) => !since || d.date >= since);
  for (let i = 6; i + 2 < days.length; i++) {
    const before = days.slice(i - 6, i).map((d) => d.celsius);
    const coverline = Math.max(...before);
    const [a, b, c] = days.slice(i, i + 3);
    if (a.celsius > coverline && b.celsius > coverline && c.celsius >= coverline + 0.2) {
      const manual = [a, b, c].every((d) => d.source === 'manual');
      return {
        shiftDate: a.date,
        likelyOvulation: addDays(a.date, -1),
        coverline: Math.round(coverline * 100) / 100,
        source: manual ? 'manual' : 'wearable',
        confidence: manual ? 'high' : 'low',
      };
    }
  }
  return null;
}

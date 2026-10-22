import { CycleEntry } from '@/types/cycle';
import { CycleGoalAnswers } from '@/types/cycleGoal';

export type CyclePhaseId = 'menstrual' | 'follicular' | 'ovulation' | 'luteal';

// Cuándo llegaría la próxima regla según sus registros. Los textos van en inglés (se pasan por t()).
export type NextPeriodStatus = 'upcoming' | 'due' | 'late' | 'stale';

export interface NextPeriodEstimate {
  date: string; // YYYY-MM-DD (día local) en que llegaría
  daysLeft: number; // 0 = hoy; negativo = la fecha ya pasó
  windowDays: number; // margen ±, como la predicción del detalle del ciclo
  basis: 'cycles' | 'questionnaire'; // sus ciclos apuntados, o su última regla + la duración que dijo en la encuesta
  cyclesUsed: number; // ciclos completos usados (0 con la duración de la encuesta)
  status: NextPeriodStatus; // falta / por estos días (dentro del margen) / se esperaba hace días / sin registros recientes
  text: string;
  vars: Record<string, number>;
  note: string | null; // cuánto fiarse: método hormonal, ciclos que varían o pocos ciclos
  noteVars: Record<string, number>;
}

export interface CyclePhaseInfo {
  day: number; // día del ciclo (1 = primer día de regla)
  length: number;
  phase: CyclePhaseId;
  label: string;
  hint: string;
  isSample: boolean;
  next: NextPeriodEstimate | null; // null en el ejemplo de la demo o sin datos suyos
}

export const PHASE_COLORS: Record<CyclePhaseId, string> = {
  menstrual: '#E06B9E',
  follicular: '#9B8CFF',
  ovulation: '#3ECDB8',
  luteal: '#F0B84D',
};

const PHASE_TEXT: Record<CyclePhaseId, { label: string; hint: string }> = {
  menstrual: { label: 'Menstrual phase', hint: 'Energy can be lower. Be kind to yourself.' },
  follicular: { label: 'Follicular phase', hint: 'Energy usually rises. Good moment for harder training.' },
  ovulation: { label: 'Ovulation window', hint: 'Often peak energy and mood.' },
  luteal: { label: 'Luteal phase', hint: 'Sleep and mood can dip. Prioritise recovery.' },
};

const DAY_MS = 24 * 3600 * 1000;

// Día del calendario local, para contar días enteros (antes el día del ciclo cambiaba a mediodía)
const dayIndex = (d: Date) => Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DAY_MS);
const dayKey = (index: number) => new Date(index * DAY_MS).toISOString().slice(0, 10);

// Mediana y redondeo "del banquero" como predictCycle (supabase/functions/_shared/cycle.ts), para
// que la fecha y el margen coincidan con la predicción que muestra el detalle del ciclo.
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};
const roundHalfEven = (x: number) => {
  const r = Math.round(x);
  return Math.abs(x % 1) === 0.5 && r % 2 !== 0 ? r - 1 : r;
};

// Límites de fase para un ciclo de longitud L (aproximación estándar:
// ovulación ~14 días antes del siguiente periodo).
export function phaseBoundaries(length: number) {
  const ovulationDay = Math.max(10, length - 14);
  return { menstrualEnd: 5, ovulationStart: ovulationDay - 1, ovulationEnd: ovulationDay + 1 };
}

// Lo que dijo en la encuesta del ciclo que cambia cuánto fiarse de la estimación
type CycleAnswers = Pick<CycleGoalAnswers, 'regularCycles' | 'hormonalContraception'>;

// Día y fase del ciclo a partir de los registros de inicio de regla. Longitud =
// mediana de los últimos ciclos; si no hay suficientes, la que dijo en la encuesta del ciclo
// (`typicalLength`) o 28. Sin registros, se usa un ejemplo para la demo.
// Si la regla se retrasa, el día sigue contando (día 31 de un ciclo de 28) en vez de volver a empezar;
// solo pasado un ciclo entero sin apuntar ninguna se vuelve a dar la vuelta (estimación de la fase).
export function currentCyclePhase(
  entries: CycleEntry[],
  today = new Date(),
  typicalLength?: number | null,
  answers?: CycleAnswers | null
): CyclePhaseInfo {
  const starts = entries.map((e) => dayIndex(new Date(e.fecha))).sort((a, b) => a - b);
  const isSample = starts.length === 0;
  const todayIndex = dayIndex(today);
  const lastStart = isSample ? todayIndex - 11 : starts[starts.length - 1];

  const statedLength = typicalLength && typicalLength >= 15 && typicalLength <= 60 ? typicalLength : null;
  const gaps = starts.slice(1).map((s, i) => s - starts[i]).slice(-6);
  const length = Math.max(1, gaps.length ? roundHalfEven(median(gaps)) : (statedLength ?? 28));

  const daysSince = todayIndex - lastStart;
  const stale = daysSince >= 2 * length;
  const day = (stale ? daysSince % length : daysSince) + 1;
  const { menstrualEnd, ovulationStart, ovulationEnd } = phaseBoundaries(length);
  const phase: CyclePhaseId =
    day <= menstrualEnd
      ? 'menstrual'
      : day < ovulationStart
        ? 'follicular'
        : day <= ovulationEnd
          ? 'ovulation'
          : 'luteal';

  // Solo con datos suyos: ciclos apuntados, o una regla apuntada y la duración que dijo en la encuesta
  const next =
    isSample || (!gaps.length && !statedLength) ? null : nextPeriod(lastStart, todayIndex, length, gaps, answers ?? null);

  return { day, length, phase, ...PHASE_TEXT[phase], isSample, next };
}

const UPCOMING = {
  cycles: {
    many: 'Based on your last cycles, your next period would come in about {n} days.',
    tomorrow: 'Based on your last cycles, your next period would come around tomorrow.',
    today: 'Based on your last cycles, your next period would come around today.',
    due: 'Based on your last cycles, your period would come around these days.',
    late: 'Based on your last cycles, your period was expected {n} days ago. If it has started, log it.',
  },
  questionnaire: {
    many: 'Based on the cycle length you told us, your next period would come in about {n} days.',
    tomorrow: 'Based on the cycle length you told us, your next period would come around tomorrow.',
    today: 'Based on the cycle length you told us, your next period would come around today.',
    due: 'Based on the cycle length you told us, your period would come around these days.',
    late: 'Based on the cycle length you told us, your period was expected {n} days ago. If it has started, log it.',
  },
};
const STALE = 'Your last logged period was {n} days ago. If you have had one since, log it to estimate the next one.';

function nextPeriod(lastStart: number, todayIndex: number, length: number, gaps: number[], answers: CycleAnswers | null): NextPeriodEstimate {
  const basis = gaps.length ? 'cycles' : 'questionnaire';
  const avg = gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : 0;
  const sd = gaps.length > 1 ? Math.sqrt(gaps.reduce((a, b) => a + (b - avg) ** 2, 0) / gaps.length) : 0;
  const saidIrregular = answers?.regularCycles === 'no';
  const windowDays = gaps.length ? Math.max(2, Math.min(7, roundHalfEven(sd))) : saidIrregular ? 7 : 2;

  const expected = lastStart + length;
  const daysLeft = expected - todayIndex;
  const status: NextPeriodStatus =
    daysLeft >= 0 ? 'upcoming' : -daysLeft <= windowDays ? 'due' : -daysLeft < length ? 'late' : 'stale';

  const texts = UPCOMING[basis];
  const [text, vars]: [string, Record<string, number>] =
    status === 'stale'
      ? [STALE, { n: todayIndex - lastStart }]
      : status === 'late'
        ? [texts.late, { n: -daysLeft }]
        : status === 'due'
          ? [texts.due, {}]
          : daysLeft === 0
            ? [texts.today, {}]
            : daysLeft === 1
              ? [texts.tomorrow, {}]
              : [texts.many, { n: daysLeft }];

  // Una sola nota, la que más pesa. Si ya pasó la fecha, el texto pide apuntarla y basta.
  const spread = gaps.length > 1 ? Math.max(...gaps) - Math.min(...gaps) : 0;
  const hormonal = !!answers?.hormonalContraception && answers.hormonalContraception !== 'none';
  const [note, noteVars]: [string | null, Record<string, number>] =
    status === 'late' || status === 'stale'
      ? [null, {}]
      : hormonal
        ? ['You marked hormonal contraception, which changes how the cycle behaves: take it as a rough guide.', {}]
        : spread > 7
          ? ['Your last cycles differ by up to {n} days, so it may come earlier or later.', { n: spread }]
          : saidIrregular && gaps.length < 3
            ? ['You marked that your cycles are irregular: take it as a rough guide.', {}]
            : basis === 'questionnaire'
              ? ['It will get more accurate as you log your periods.', {}]
              : gaps.length === 1
                ? ['It is based on a single cycle: it will get more accurate as you log more periods.', {}]
                : gaps.length === 2
                  ? ['It is based on {n} cycles: it will get more accurate as you log more periods.', { n: 2 }]
                  : [null, {}];

  return { date: dayKey(expected), daysLeft, windowDays, basis, cyclesUsed: gaps.length, status, text, vars, note, noteVars };
}

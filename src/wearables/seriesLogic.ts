import { DailyWearableRecord, SleepDetailMetric, WearableMetric } from './types';
import { PHONE_SOURCE } from './sources';

// Lógica pura de las series diarias de wearables (sin React Native, con tests en __tests__).

export interface DailyPoint {
  date: string; // YYYY-MM-DD
  value: number;
}

export type DailySeries = Partial<Record<WearableMetric, DailyPoint[]>>;

const pad2 = (n: number) => String(n).padStart(2, '0');
export const localDayKey = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

// Valor de HOY (o null si el último dato es de otro día)
export const todayValue = (points?: DailyPoint[]) => {
  const last = points?.length ? points[points.length - 1] : null;
  return last && last.date === localDayKey(new Date()) ? last.value : null;
};

// Si un día tiene varias fuentes para la misma métrica, ¿cuál manda? El reloj antes que el teléfono;
// el pulso en reposo que da el reloj antes que el estimado; en lo que se acumula (pasos, calorías,
// distancia), la que más ha contado (la que llevabas encima).
const CUMULATIVE: WearableMetric[] = ['steps', 'active_energy', 'distance'];
const better = (a: DailyWearableRecord, b: DailyWearableRecord) => {
  const phone = (r: DailyWearableRecord) => Number(r.sourceName === PHONE_SOURCE);
  if (phone(a) !== phone(b)) return phone(a) < phone(b);
  const estimated = (r: DailyWearableRecord) => Number(r.rawTypeId.includes(':'));
  if (estimated(a) !== estimated(b)) return estimated(a) < estimated(b);
  return CUMULATIVE.includes(a.metric) ? a.value > b.value : false;
};

export const SLEEP_DETAIL: readonly SleepDetailMetric[] = [
  'sleep_deep',
  'sleep_light',
  'sleep_rem',
  'sleep_awake',
  'sleep_out_of_bed',
  'sleep_start',
  'sleep_end',
];
export const isSleepDetail = (m: WearableMetric) => (SLEEP_DETAIL as readonly string[]).includes(m);

// Las fases y las horas del sueño van con la noche elegida (la misma fuente que la duración), para no
// mezclar el sueño profundo de una app con la hora de dormir de otra. Sin duración ese día, no cuentan.
export function pickPerDay(records: DailyWearableRecord[]): DailyWearableRecord[] {
  const best = new Map<string, DailyWearableRecord>();
  for (const r of records) {
    if (isSleepDetail(r.metric)) continue;
    const key = `${r.metric}|${r.date}`;
    const cur = best.get(key);
    if (!cur || better(r, cur)) best.set(key, r);
  }
  for (const r of records) {
    if (!isSleepDetail(r.metric)) continue;
    const night = best.get(`sleep_duration|${r.date}`);
    if (night && night.sourceName === r.sourceName && night.provider === r.provider) best.set(`${r.metric}|${r.date}`, r);
  }
  return [...best.values()];
}

// Agrupa los registros por métrica (una fuente por día, ver pickPerDay) y los ordena ascendente.
export function toDailySeries(records: DailyWearableRecord[]): DailySeries {
  const out: DailySeries = {};
  for (const r of pickPerDay(records)) (out[r.metric] ??= []).push({ date: r.date, value: r.value });
  for (const metric of Object.keys(out) as WearableMetric[]) {
    out[metric]!.sort((a, b) => a.date.localeCompare(b.date));
  }
  return out;
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / (xs.length || 1);
const clamp = (v: number) => Math.max(0, Math.min(100, v));

export type ReadinessPart = 'sleep' | 'hrv' | 'restingHr';

export interface Readiness {
  score: number;
  label: string;
  sleep: number | null;
  hrv: number | null;
  restingHr: number | null;
  // Lo que no ha llegado hoy y por tanto no cuenta (el resto se reparte su peso)
  missing: ReadinessPart[];
}

// Daily readiness (0-100), versión simple y explicable:
// sueño de anoche frente a 8 h, VFC y pulso en reposo de hoy frente a su media de los días
// anteriores (hasta 14). Pesos 40/35/25; si falta alguna parte, las demás se reparten su peso.
// Hace falta el sueño de anoche o el pulso en reposo de hoy. Pendiente de validar con el médico.
export function computeReadiness(series: DailySeries, now = new Date()): Readiness | null {
  const today = localDayKey(now);
  const todayOf = (pts?: DailyPoint[]) => pts?.find((p) => p.date === today)?.value ?? null;
  const baseOf = (pts?: DailyPoint[]) => {
    const prev = (pts ?? []).filter((p) => p.date < today).slice(-14);
    return prev.length >= 2 ? mean(prev.map((p) => p.value)) : null;
  };

  const lastSleep = todayOf(series.sleep_duration);
  const hrvToday = todayOf(series.hrv);
  const hrvBase = baseOf(series.hrv);
  const rhrToday = todayOf(series.resting_heart_rate);
  const rhrBase = baseOf(series.resting_heart_rate);

  const sleepScore = lastSleep != null ? clamp((lastSleep / 480) * 100) : null;
  const hrvScore = hrvToday != null && hrvBase ? clamp(70 + ((hrvToday - hrvBase) / hrvBase) * 200) : null;
  const rhrScore = rhrToday != null && rhrBase ? clamp(70 - ((rhrToday - rhrBase) / rhrBase) * 300) : null;
  if (sleepScore == null && rhrScore == null) return null;

  const parts: [ReadinessPart, number | null, number][] = [
    ['sleep', sleepScore, 0.4],
    ['hrv', hrvScore, 0.35],
    ['restingHr', rhrScore, 0.25],
  ];
  const used = parts.filter(([, v]) => v != null) as [ReadinessPart, number, number][];
  const weight = used.reduce((a, [, , w]) => a + w, 0);
  const score = Math.round(used.reduce((a, [, v, w]) => a + v * w, 0) / weight);

  const label = score >= 80 ? 'Ready to go' : score >= 60 ? 'Take it steady' : 'Prioritise recovery';
  return {
    score,
    label,
    sleep: sleepScore,
    hrv: hrvScore,
    restingHr: rhrScore,
    missing: parts.filter(([, v]) => v == null).map(([k]) => k),
  };
}


// ---------------------------------------------------------------------------
// Sueño de cada noche: fases y horas
// ---------------------------------------------------------------------------

// Fases de SleepSessionRecord en Health Connect. AWAKE_IN_BED (7) no está en las constantes de
// react-native-health-connect, pero Android lo manda.
export const SLEEP_STAGE = { UNKNOWN: 0, AWAKE: 1, SLEEPING: 2, OUT_OF_BED: 3, LIGHT: 4, DEEP: 5, REM: 6, AWAKE_IN_BED: 7 } as const;

export interface SleepSessionInput {
  startTime: string; // instantes ISO
  endTime: string;
  stages?: { startTime: string; endTime: string; stage: number }[];
  source: string; // nombre visible de la app (originName)
}

// Minutos en cada fase
export interface SleepStages {
  deep: number;
  light: number;
  rem: number;
  awake: number;
  outOfBed: number;
}

export interface SleepNightSummary {
  date: string; // día en que te despiertas
  source: string;
  asleep: number; // minutos dormido, sin los ratos despierto ni fuera de la cama
  start: number; // hora de dormirte: minutos desde la medianoche de `date` (negativo = la víspera)
  end: number; // hora de despertarte, igual
  stages: SleepStages | null; // null si la fuente no manda fases (solo la sesión, o solo "dormido")
}

const msOf = (iso: string) => new Date(iso).getTime();
const minutesBetween = (a: string, b: string) => Math.max(0, msOf(b) - msOf(a)) / 60000;
const dayNumber = (key: string) => Date.UTC(+key.slice(0, 4), +key.slice(5, 7) - 1, +key.slice(8, 10)) / 86400000;

// Hora de reloj de un instante en minutos desde la medianoche local de `day`. Va por la hora de reloj y
// no por el tiempo transcurrido, para que la noche del cambio de hora no la desplace.
export const clockMinutesFrom = (iso: string, day: string) => {
  const d = new Date(iso);
  return (dayNumber(localDayKey(d)) - dayNumber(day)) * 1440 + d.getHours() * 60 + d.getMinutes();
};

// Entre dos sesiones de la misma noche (te levantas un rato) hay menos de una hora
const SAME_SLEEP_GAP_MS = 60 * 60000;

// Una noche por día en que te despiertas y por fuente. El tiempo dormido y las fases suman todas las
// sesiones de ese día (siestas incluidas); la hora de dormirte y de despertarte salen del bloque con más
// sueño (sesiones casi seguidas), para que una siesta no las cambie.
export function summarizeSleepSessions(sessions: SleepSessionInput[]): SleepNightSummary[] {
  const groups = new Map<string, SleepSessionInput[]>();
  for (const s of sessions) {
    const key = `${localDayKey(new Date(s.endTime))}|${s.source}`;
    groups.set(key, [...(groups.get(key) ?? []), s]);
  }

  const out: SleepNightSummary[] = [];
  for (const [key, list] of groups) {
    const date = key.slice(0, 10);
    const st: SleepStages = { deep: 0, light: 0, rem: 0, awake: 0, outOfBed: 0 };
    const asleepOf = (s: SleepSessionInput) => {
      if (!s.stages?.length) return minutesBetween(s.startTime, s.endTime);
      let asleep = 0;
      for (const g of s.stages) {
        const m = minutesBetween(g.startTime, g.endTime);
        if (g.stage === SLEEP_STAGE.AWAKE || g.stage === SLEEP_STAGE.AWAKE_IN_BED) st.awake += m;
        else if (g.stage === SLEEP_STAGE.OUT_OF_BED) st.outOfBed += m;
        else {
          asleep += m;
          if (g.stage === SLEEP_STAGE.DEEP) st.deep += m;
          else if (g.stage === SLEEP_STAGE.LIGHT) st.light += m;
          else if (g.stage === SLEEP_STAGE.REM) st.rem += m;
        }
      }
      return asleep;
    };

    const blocks: { start: string; end: string; asleep: number }[] = [];
    for (const s of [...list].sort((a, b) => msOf(a.startTime) - msOf(b.startTime))) {
      const asleep = asleepOf(s);
      const last = blocks[blocks.length - 1];
      if (last && msOf(s.startTime) - msOf(last.end) <= SAME_SLEEP_GAP_MS) {
        if (msOf(s.endTime) > msOf(last.end)) last.end = s.endTime;
        last.asleep += asleep;
      } else blocks.push({ start: s.startTime, end: s.endTime, asleep });
    }
    const main = blocks.reduce((a, b) => (b.asleep > a.asleep ? b : a));

    out.push({
      date,
      source: key.slice(11),
      asleep: blocks.reduce((a, b) => a + b.asleep, 0),
      start: clockMinutesFrom(main.start, date),
      end: clockMinutesFrom(main.end, date),
      stages: st.deep + st.light + st.rem > 0 ? st : null,
    });
  }
  return out;
}

// Lo que enseña el detalle del sueño de cada noche, a partir de las series guardadas
export interface SleepNight {
  date: string; // día en que te despiertas
  asleep: number; // minutos
  start: number | null; // como en SleepNightSummary
  end: number | null;
  // `other`: dormido sin fase (p. ej. una siesta de una fuente que no da fases ese día)
  stages: (SleepStages & { other: number }) | null;
}

export function sleepNights(series: DailySeries): SleepNight[] {
  const byDate = (m: WearableMetric) => new Map((series[m] ?? []).map((p) => [p.date, p.value]));
  const [deep, light, rem, awake, outOfBed, start, end] = (
    ['sleep_deep', 'sleep_light', 'sleep_rem', 'sleep_awake', 'sleep_out_of_bed', 'sleep_start', 'sleep_end'] as const
  ).map(byDate);
  return (series.sleep_duration ?? []).map(({ date, value }) => {
    const staged = deep.has(date) || light.has(date) || rem.has(date);
    const d = deep.get(date) ?? 0;
    const l = light.get(date) ?? 0;
    const r = rem.get(date) ?? 0;
    // Por el redondeo de cada fase pueden sobrar uno o dos minutos: eso no es "sin fase"
    const other = value - d - l - r >= 3 ? value - d - l - r : 0;
    return {
      date,
      asleep: value,
      start: start.get(date) ?? null,
      end: end.get(date) ?? null,
      stages: staged ? { deep: d, light: l, rem: r, awake: awake.get(date) ?? 0, outOfBed: outOfBed.get(date) ?? 0, other } : null,
    };
  });
}

// "23:15" a partir de minutos desde una medianoche (negativo = la víspera)
export const formatClock = (minutes: number) => {
  const m = ((Math.round(minutes) % 1440) + 1440) % 1440;
  return `${pad2(Math.floor(m / 60))}:${pad2(m % 60)}`;
};

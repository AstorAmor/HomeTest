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
  // En la fase lútea se descuenta lo que suben el pulso y baja la VFC por el ciclo
  cycleAdjusted: boolean;
}

export interface ReadinessOptions {
  sleepNeedMin?: number; // su objetivo de sueño (Tus objetivos del día); 7 h 30 si no hay
  luteal?: boolean; // fase lútea según sus reglas apuntadas (no la de ejemplo)
}

const sd = (xs: number[]) => {
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
};

// Lo que cambian de media en la fase lútea frente a la folicular (Shilaih 2018: pulso en reposo unos
// 2 lpm más; la VFC, algo más baja): se descuenta para no restar por algo propio del ciclo
const LUTEAL_RHR_BPM = 2;
const LUTEAL_HRV_LN = 0.07;

// Daily readiness (0-100). Como hacen Oura o WHOOP, cada parte frente a lo TUYO, no frente a una media:
// - VFC (en escala logarítmica, como se analiza en deporte) y pulso en reposo de hoy frente a tus 28
//   días anteriores: cuántas desviaciones típicas te separan de lo habitual (z). Un día normal da 65 y
//   cada desviación suma o resta 15: hace falta un día claramente mejor de lo normal para pasar de 90.
//   Con menos de 5 días de historia se usa una variación «típica» fija (10 % en la VFC, 5 % en el pulso,
//   lo habitual de un día a otro), que es también el mínimo para que un día tranquilo no salte de golpe.
//   Con menos de 14 días de historia, la diferencia cuenta en proporción (7 días, la mitad): con un reloj
//   recién conectado aún no sabemos qué es lo normal en ti.
// - Sueño de anoche frente a tu objetivo: llegar da 90; por cada 10 % que falta, 15 menos.
// Pesos 40 (sueño) / 35 (VFC) / 25 (pulso); si falta alguna, las demás se reparten su peso. Hace falta
// el sueño de anoche o el pulso de hoy. Pendiente de validar con el médico.
export function computeReadiness(series: DailySeries, now = new Date(), opts: ReadinessOptions = {}): Readiness | null {
  const today = localDayKey(now);
  const todayOf = (pts?: DailyPoint[]) => pts?.find((p) => p.date === today)?.value ?? null;
  const prevOf = (pts?: DailyPoint[]) => (pts ?? []).filter((p) => p.date < today && p.value > 0).slice(-28).map((p) => p.value);
  const fromZ = (z: number, n: number) => clamp(65 + 15 * z * Math.min(1, n / 14));
  const luteal = !!opts.luteal;

  const lastSleep = todayOf(series.sleep_duration);
  const need = opts.sleepNeedMin && opts.sleepNeedMin > 0 ? opts.sleepNeedMin : 450;
  const sleepScore = lastSleep != null ? (lastSleep >= need ? 90 : clamp(90 - (1 - lastSleep / need) * 150)) : null;

  const hrvToday = todayOf(series.hrv);
  const hrvPrev = prevOf(series.hrv).map(Math.log);
  let hrvScore: number | null = null;
  if (hrvToday != null && hrvToday > 0 && hrvPrev.length >= 2) {
    const spread = Math.max(hrvPrev.length >= 5 ? sd(hrvPrev) : 0, 0.1);
    hrvScore = fromZ((Math.log(hrvToday) + (luteal ? LUTEAL_HRV_LN : 0) - mean(hrvPrev)) / spread, hrvPrev.length);
  }

  const rhrToday = todayOf(series.resting_heart_rate);
  const rhrPrev = prevOf(series.resting_heart_rate);
  let rhrScore: number | null = null;
  if (rhrToday != null && rhrPrev.length >= 2) {
    const base = mean(rhrPrev);
    const spread = Math.max(rhrPrev.length >= 5 ? sd(rhrPrev) : 0, base * 0.05, 2);
    rhrScore = fromZ(-(rhrToday - (luteal ? LUTEAL_RHR_BPM : 0) - base) / spread, rhrPrev.length);
  }
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
    cycleAdjusted: luteal && (hrvScore != null || rhrScore != null),
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

// Apple Salud no tiene "sesiones" de sueño: cada muestra es un tramo (en la cama, dormido, despierto,
// sueño básico, profundo o REM) y cada app escribe los suyos. Esto junta, por fuente, los tramos casi
// seguidos en una sesión con sus fases, para que una noche que empieza antes de las 12 cuente entera
// para el día en que te despiertas. "En la cama" no es dormir ni estar despierto (se solapa con las
// fases): no cuenta, y una sesión que solo tiene eso se descarta.
const APPLE_SLEEP_STAGE: Record<number, number> = {
  1: SLEEP_STAGE.SLEEPING, // asleepUnspecified
  2: SLEEP_STAGE.AWAKE,
  3: SLEEP_STAGE.LIGHT, // asleepCore: lo que Apple llama sueño básico
  4: SLEEP_STAGE.DEEP,
  5: SLEEP_STAGE.REM,
};

export interface AppleSleepSample {
  startTime: string; // instantes ISO
  endTime: string;
  value: number; // CategoryValueSleepAnalysis de HealthKit (0 = en la cama)
  source: string; // nombre visible (appleSourceName)
}

export function appleSleepSessions(samples: AppleSleepSample[]): SleepSessionInput[] {
  const bySource = new Map<string, AppleSleepSample[]>();
  for (const s of samples) if (APPLE_SLEEP_STAGE[s.value] !== undefined) bySource.set(s.source, [...(bySource.get(s.source) ?? []), s]);
  const out: SleepSessionInput[] = [];
  for (const [source, list] of bySource) {
    let cur: SleepSessionInput | null = null;
    for (const s of [...list].sort((a, b) => msOf(a.startTime) - msOf(b.startTime))) {
      const stage = { startTime: s.startTime, endTime: s.endTime, stage: APPLE_SLEEP_STAGE[s.value] };
      if (cur && msOf(s.startTime) - msOf(cur.endTime) <= SAME_SLEEP_GAP_MS) {
        cur.stages!.push(stage);
        if (msOf(s.endTime) > msOf(cur.endTime)) cur.endTime = s.endTime;
      } else {
        cur = { startTime: s.startTime, endTime: s.endTime, stages: [stage], source };
        out.push(cur);
      }
    }
  }
  return out;
}

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

// Desde qué día entra un periodo de `days` días que acaba hoy
export const sinceDay = (days: number, now = new Date()) => localDayKey(new Date(now.getTime() - (days - 1) * 86400000));

// En 6M, por semanas de calendario que acaban hoy (la última, los 7 últimos días): la media de cada
// una, fechada en su primer día. Solo las semanas con datos.
export function weeklyAverages(points: DailyPoint[], now = new Date()): DailyPoint[] {
  const today = dayNumber(localDayKey(now));
  const buckets = new Map<number, number[]>();
  for (const p of points) {
    const k = Math.floor((today - dayNumber(p.date)) / 7);
    (buckets.get(k) ?? buckets.set(k, []).get(k)!).push(p.value);
  }
  return [...buckets.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([k, vs]) => ({ date: localDayKey(new Date(now.getTime() - (k * 7 + 6) * 86400000)), value: mean(vs) }));
}

// Lo mismo para las noches: fases, horas y duración medias de cada semana
export function weeklyNights(nights: SleepNight[], now = new Date()): SleepNight[] {
  const today = dayNumber(localDayKey(now));
  const buckets = new Map<number, SleepNight[]>();
  for (const n of nights) {
    const k = Math.floor((today - dayNumber(n.date)) / 7);
    (buckets.get(k) ?? buckets.set(k, []).get(k)!).push(n);
  }
  const avg = (xs: (number | null | undefined)[]) => {
    const ok = xs.filter((x): x is number => x != null);
    return ok.length ? mean(ok) : null;
  };
  return [...buckets.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([k, ns]) => {
      const staged = ns.filter((n) => n.stages);
      const stage = (key: keyof NonNullable<SleepNight['stages']>) => mean(staged.map((n) => n.stages![key]));
      return {
        ...ns[ns.length - 1],
        date: localDayKey(new Date(now.getTime() - (k * 7 + 6) * 86400000)),
        asleep: mean(ns.map((n) => n.asleep)),
        start: avg(ns.map((n) => n.start)),
        end: avg(ns.map((n) => n.end)),
        stages: staged.length
          ? { deep: stage('deep'), light: stage('light'), rem: stage('rem'), other: stage('other'), awake: stage('awake'), outOfBed: stage('outOfBed') }
          : null,
      } as SleepNight;
    });
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

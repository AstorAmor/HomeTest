import { bowelObservations, urineObservations } from '@/logic/bathroom';
import { fertilityAdvice } from '@/logic/fertility';
import { dosesForDay, isReminderMuted } from '@/logic/medication';
import { NudgeCheck, NudgeContext, NudgeRule } from './types';

// Reglas de los avisos. Para cambiar un umbral, un texto o el tiempo mínimo entre avisos, se
// toca aquí: la app, el simulador (npm run simulate) y los tests leen esta misma tabla.
// El orden es la prioridad cuando hay más avisos que el máximo diario: primero lo de salud.

const DAY = 24 * 3600 * 1000;

const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const localDay = (iso: string) => dayKey(new Date(iso));
const daysAgoKey = (now: Date, n: number) => dayKey(new Date(now.getTime() - n * DAY));
const daysSince = (iso: string, now: Date) => Math.floor((now.getTime() - new Date(iso).getTime()) / DAY);
const upToNow = <T extends { fecha: string }>(list: T[], now: Date) =>
  list.filter((e) => new Date(e.fecha).getTime() <= now.getTime());
const latestIso = (dates: string[]) =>
  dates.reduce<string | null>((a, d) => (!a || new Date(d) > new Date(a) ? d : a), null);

const no = (reason: string): NudgeCheck => ({ due: false, reason });

// Mediana de la duración de los últimos ciclos (días entre inicios de regla)
function medianCycleLength(starts: string[]): number | null {
  const sorted = [...starts].sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
  const lengths: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const len = Math.round((new Date(sorted[i]).getTime() - new Date(sorted[i - 1]).getTime()) / DAY);
    if (len >= 15 && len <= 60) lengths.push(len);
  }
  const last = lengths.slice(-6).sort((a, b) => a - b);
  if (!last.length) return null;
  const mid = Math.floor(last.length / 2);
  return last.length % 2 ? last[mid] : Math.round((last[mid - 1] + last[mid]) / 2);
}


// --- Medidas que se repiten durante semanas -------------------------------------------------
// Umbrales de las medidas en casa. PENDIENTES de revisión por el médico asesor.
//   Tensión: ESH 2023, media en casa >= 135/85 mmHg = alta; >= 180/110 = muy alta.
//   Glucosa: ADA Standards of Care, objetivo después de comer < 180 mg/dL (el glucómetro de la
//   app no dice si fue en ayunas, así que se usa el umbral de después de comer).
//   Sueño: AASM/SRS 2015, los adultos necesitan 7 h o más.
export const MEASURE_LIMITS = {
  bpHigh: { systolic: 135, diastolic: 85 },
  bpVeryHigh: { systolic: 180, diastolic: 110 },
  glucoseHigh: 180,
  shortSleepMinutes: 360,
  // A partir de cuántas semanas seguidas el aviso pide ir al médico (antes solo informa)
  doctorAfterWeeks: 4,
};

const inWindow = (iso: string, from: Date, to: Date) => {
  const t = new Date(iso).getTime();
  return t > from.getTime() && t <= to.getTime();
};

// Semanas seguidas, contando hacia atrás desde hoy en bloques de 7 días, en las que `test` da
// true. Una semana sin datos (null) corta la racha igual que una semana normal (false).
function weeksInARow(now: Date, test: (from: Date, to: Date) => boolean | null, max = 26): number {
  let n = 0;
  for (let w = 0; w < max; w++) {
    const to = new Date(now.getTime() - w * 7 * DAY);
    const from = new Date(to.getTime() - 7 * DAY);
    if (test(from, to) !== true) break;
    n++;
  }
  return n;
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

// Tensión: semanas seguidas con la media por encima de 135/85
export function bpHighStreak(ctx: NudgeContext) {
  const bp = upToNow(ctx.bloodPressure ?? [], ctx.now);
  const { systolic, diastolic } = MEASURE_LIMITS.bpHigh;
  const weeks = weeksInARow(ctx.now, (from, to) => {
    const r = bp.filter((x) => inWindow(x.fecha, from, to));
    if (!r.length) return null;
    return mean(r.map((x) => x.systolic)) >= systolic || mean(r.map((x) => x.diastolic)) >= diastolic;
  });
  const since = new Date(ctx.now.getTime() - weeks * 7 * DAY);
  const readings = bp.filter((x) => inWindow(x.fecha, since, ctx.now));
  return {
    weeks,
    readings: readings.length,
    sys: readings.length ? Math.round(mean(readings.map((x) => x.systolic))) : 0,
    dia: readings.length ? Math.round(mean(readings.map((x) => x.diastolic))) : 0,
  };
}

// Glucosa: semanas seguidas en las que al menos la mitad de las lecturas pasan de 180 mg/dL
export function glucoseHighStreak(ctx: NudgeContext) {
  const g = upToNow(ctx.glucose ?? [], ctx.now);
  const weeks = weeksInARow(ctx.now, (from, to) => {
    const r = g.filter((x) => inWindow(x.fecha, from, to));
    if (!r.length) return null;
    return r.filter((x) => x.mgdl >= MEASURE_LIMITS.glucoseHigh).length >= r.length / 2;
  });
  const since = new Date(ctx.now.getTime() - weeks * 7 * DAY);
  const high = g.filter((x) => inWindow(x.fecha, since, ctx.now) && x.mgdl >= MEASURE_LIMITS.glucoseHigh).length;
  return { weeks, high };
}

// Energía: semanas seguidas en las que la mitad o más de los días con check-in fueron de 2/5 o menos
export function lowEnergyStreak(ctx: NudgeContext) {
  const minByDay = new Map<string, { at: string; energy: number }>();
  for (const c of upToNow(ctx.checkIns, ctx.now)) {
    if (c.energy == null) continue;
    const k = localDay(c.fecha);
    const prev = minByDay.get(k);
    if (!prev || c.energy < prev.energy) minByDay.set(k, { at: c.fecha, energy: c.energy });
  }
  const days = [...minByDay.values()];
  const weeks = weeksInARow(ctx.now, (from, to) => {
    const r = days.filter((d) => inWindow(d.at, from, to));
    if (r.length < 2) return null;
    return r.filter((d) => d.energy <= 2).length >= r.length / 2;
  });
  return { weeks };
}

// Sueño: semanas seguidas con una media de menos de 6 h (con al menos 4 noches del wearable)
export function shortSleepStreak(ctx: NudgeContext) {
  const nights = ctx.sleepNights.filter((n) => n.date <= dayKey(ctx.now));
  const weeks = weeksInARow(ctx.now, (from, to) => {
    const r = nights.filter((n) => n.date > dayKey(from) && n.date <= dayKey(to));
    if (r.length < 4) return null;
    return mean(r.map((n) => n.minutes)) < MEASURE_LIMITS.shortSleepMinutes;
  });
  const since = dayKey(new Date(ctx.now.getTime() - weeks * 7 * DAY));
  const r = nights.filter((n) => n.date > since && n.date <= dayKey(ctx.now));
  return { weeks, avg: r.length ? Math.round(mean(r.map((n) => n.minutes))) : 0 };
}

const weeksText = (w: number) => (w === 1 ? 'this week' : `for ${w} weeks`);
const hm = (min: number) => `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')} min`;

export const NUDGE_RULES: NudgeRule[] = [
  {
    id: 'bp_very_high',
    category: 'measurements',
    label: 'Very high blood pressure',
    cooldownDays: 1,
    evaluate: (ctx) => {
      const { systolic, diastolic } = MEASURE_LIMITS.bpVeryHigh;
      const today = upToNow(ctx.bloodPressure ?? [], ctx.now).filter((r) => ctx.now.getTime() - new Date(r.fecha).getTime() < DAY);
      const top = today.find((r) => r.systolic >= systolic || r.diastolic >= diastolic);
      if (!top)
        return no(
          today.length
            ? `${today.length} reading(s) in the last 24 h, none at ${systolic}/${diastolic} or above`
            : 'No blood pressure reading in the last 24 h'
        );
      return {
        due: true,
        reason: `${top.systolic}/${top.diastolic} mmHg in the last 24 h (${systolic}/${diastolic} or above)`,
        title: 'Very high blood pressure reading',
        body: 'Sit and rest for 5 minutes, then measure again. If it stays this high, call your doctor today. With chest pain, shortness of breath, weakness or trouble speaking, call 112.',
        route: '/blood-pressure-detail',
      };
    },
  },
  {
    id: 'bp_high_weeks',
    category: 'measurements',
    label: 'High blood pressure over time',
    cooldownDays: 14,
    evaluate: (ctx) => {
      const s = bpHighStreak(ctx);
      const { systolic, diastolic } = MEASURE_LIMITS.bpHigh;
      if (!s.weeks) return no(`Home average this week under ${systolic}/${diastolic}, or no readings`);
      if (s.readings < 3) return no(`High so far, but only ${s.readings} reading(s): waiting for 3`);
      const doctor = s.weeks >= MEASURE_LIMITS.doctorAfterWeeks;
      return {
        due: true,
        reason: `Home average ${s.sys}/${s.dia} mmHg over ${s.readings} readings, high ${s.weeks} week(s) in a row`,
        title: doctor ? `High blood pressure for ${s.weeks} weeks` : 'Your blood pressure is running high',
        body: doctor
          ? `Your home readings have stayed above ${systolic}/${diastolic} for ${s.weeks} weeks (average ${s.sys}/${s.dia}). Book a check with your doctor and bring your readings.`
          : `Your home readings average ${s.sys}/${s.dia} mmHg ${weeksText(s.weeks)}. Measure twice in the morning and twice in the evening for 7 days so your doctor can see the full picture.`,
        route: '/blood-pressure-detail',
      };
    },
  },
  {
    id: 'fertility_doctor',
    category: 'cycle',
    label: 'Fertility check reminder',
    cooldownDays: 30,
    evaluate: (ctx) => {
      const g = ctx.cycleGoal;
      if (!g || g.goal !== 'conceive' || !g.tryingFor) return no('Not trying to conceive');
      const advice = fertilityAdvice({
        age: ctx.profile.age ?? null,
        tryingFor: g.tryingFor,
        regularCycles: g.regularCycles,
        frequency: g.frequency,
        timing: g.timing,
        knownConditions: (ctx.profile.conditions ?? []).filter((c) => ['pcos', 'endometriosis'].includes(c)),
      });
      if (advice.level === 'keep_trying') return no(`Trying ${g.tryingFor}, age ${ctx.profile.age ?? '?'}: not yet`);
      return { due: true, reason: `Guideline threshold met (${advice.level})`, title: advice.title, body: advice.body, route: '/cycle-detail' };
    },
  },
  {
    id: 'medication_missed',
    category: 'medication',
    label: 'Missed dose',
    cooldownDays: 1,
    evaluate: (ctx) => {
      const meds = (ctx.medications ?? []).filter((m) => m.reminders && !isReminderMuted(m, ctx.now));
      if (!meds.length) return no('No medication with reminders on');
      // Tomas de hoy que ya pasaron hace más de una hora y no están marcadas
      const missed = dosesForDay(meds, ctx.now, ctx.doses ?? []).filter(
        (d) => !d.log && d.at.getTime() <= ctx.now.getTime() - 3600 * 1000
      );
      if (!missed.length) return no("All of today's doses so far are marked");
      const first = missed[0];
      const hhmm = `${String(first.at.getHours()).padStart(2, '0')}:${String(first.at.getMinutes()).padStart(2, '0')}`;
      return {
        due: true,
        reason: `${missed.length} dose(s) today not marked (first: ${first.name} at ${hhmm})`,
        title: missed.length === 1 ? `Did you take your ${first.name}?` : `${missed.length} doses not marked today`,
        body: `It was due at ${hhmm}. Mark it as taken or skipped so your record stays right.`,
        route: '/medications',
      };
    },
  },
  {
    id: 'stool_colour',
    category: 'digestive',
    label: 'Unusual stool colour',
    cooldownDays: 3,
    evaluate: (ctx) => {
      const recent = upToNow(ctx.bowel, ctx.now).filter(
        (e) => daysSince(e.fecha, ctx.now) <= 2 && ['red', 'black', 'pale'].includes(e.color ?? '') && !e.explainedBy
      );
      if (!recent.length) return no('No unexplained red, black or pale stools in the last 2 days');
      return {
        due: true,
        reason: `${recent[0].color} logged ${daysSince(recent[0].fecha, ctx.now)} day(s) ago, not explained`,
        title: 'About the colour you logged',
        body: 'One quick question can tell us if it was something you ate.',
        route: '/digestive',
      };
    },
  },
  {
    id: 'period_late',
    category: 'cycle',
    label: 'Late period',
    cooldownDays: 7,
    evaluate: (ctx) => {
      if (ctx.profile.sex !== 'female') return no('Not a female profile');
      const starts = upToNow(ctx.cycleStarts, ctx.now).map((c) => c.fecha);
      const median = medianCycleLength(starts);
      if (starts.length < 2 || !median) return no('Fewer than 2 periods logged: no reliable cycle length yet');
      const last = latestIso(starts)!;
      const late = daysSince(last, ctx.now) - median;
      if (late < 5) return no(`Day ${daysSince(last, ctx.now) + 1} of a ~${median}-day cycle`);
      if (late > 60) return no('Very long gap: probably stopped logging');
      const conceive = ctx.cycleGoal?.goal === 'conceive';
      return {
        due: true,
        reason: `${late} days past the expected start (cycle ~${median} days)`,
        title: `Your period is ${late} days late`,
        body: conceive
          ? 'If you have been trying, a pregnancy test now can give you an answer.'
          : 'Stress, travel and illness can delay it. Log it when it comes.',
        route: '/cycle-detail',
      };
    },
  },
  {
    id: 'urine_dark',
    category: 'urinary',
    label: 'Dark urine',
    cooldownDays: 3,
    evaluate: (ctx) => {
      const last3 = upToNow(ctx.urine, ctx.now).filter((e) => daysSince(e.fecha, ctx.now) <= 2);
      const dark = last3.filter((e) => e.color === 'dark' || e.color === 'amber').length;
      if (dark < 2) return no(`${dark} dark day(s) in the last 3`);
      return {
        due: true,
        reason: `${dark} of the last 3 days dark or amber`,
        title: 'Your urine has been dark',
        body: 'Have a glass of water now and keep a bottle nearby today.',
        route: '/digestive',
      };
    },
  },
  {
    id: 'bowel_none_3d',
    category: 'digestive',
    label: 'No bowel movement',
    cooldownDays: 4,
    evaluate: (ctx) => {
      const byDay = new Map(upToNow(ctx.bowel, ctx.now).map((e) => [localDay(e.fecha), e.count]));
      if (!byDay.size) return no('Not tracking digestion');
      const zeros = [0, 1, 2].filter((n) => byDay.get(daysAgoKey(ctx.now, n)) === 0).length;
      if (zeros < 3) return no(`Logged 0 on ${zeros} of the last 3 days`);
      return {
        due: true,
        reason: 'Logged no bowel movement today, yesterday and the day before',
        title: 'No bowel movement for 3 days',
        body: 'Water, fibre and moving every day usually help. We have a couple of questions for you.',
        route: '/digestive',
      };
    },
  },
  {
    id: 'glucose_high_weeks',
    category: 'measurements',
    label: 'High glucose over time',
    cooldownDays: 14,
    evaluate: (ctx) => {
      const s = glucoseHighStreak(ctx);
      const limit = MEASURE_LIMITS.glucoseHigh;
      if (!s.weeks) return no(`Most readings this week under ${limit} mg/dL, or no readings`);
      if (s.high < 3) return no(`Only ${s.high} reading(s) at ${limit} mg/dL or more: waiting for 3`);
      const doctor = s.weeks >= MEASURE_LIMITS.doctorAfterWeeks;
      return {
        due: true,
        reason: `${s.high} readings at ${limit} mg/dL or more, ${s.weeks} week(s) in a row`,
        title: doctor ? `High glucose for ${s.weeks} weeks` : 'Several high glucose readings',
        body: doctor
          ? `Your readings have often been above ${limit} mg/dL for ${s.weeks} weeks. Book a visit with your doctor: an HbA1c blood test shows your average over the last months.`
          : `${s.high} readings above ${limit} mg/dL ${weeksText(s.weeks)}. Note what you ate and when you measured: it helps to read them.`,
        route: '/glucose-detail',
      };
    },
  },
  {
    id: 'low_energy_weeks',
    category: 'wellbeing',
    label: 'Low energy over time',
    cooldownDays: 14,
    evaluate: (ctx) => {
      const { weeks } = lowEnergyStreak(ctx);
      if (weeks < 2) return no(weeks ? 'Low energy this week only' : 'Energy mostly fine this week, or too few check-ins');
      const doctor = weeks >= MEASURE_LIMITS.doctorAfterWeeks;
      return {
        due: true,
        reason: `Half or more of check-in days at 2/5 or lower, ${weeks} weeks in a row`,
        title: `Low energy for ${weeks} weeks`,
        body: doctor
          ? 'This has lasted a while. Book a visit with your doctor: a blood test can rule out common causes such as low iron or a thyroid problem.'
          : 'Most of your recent check-ins show low energy. Sleep, stress and food all play a part, and a professional can help you find out what is behind it.',
        route: '/professionals',
      };
    },
  },
  {
    id: 'short_sleep_weeks',
    category: 'wellbeing',
    label: 'Short sleep over time',
    cooldownDays: 14,
    evaluate: (ctx) => {
      const { weeks, avg } = shortSleepStreak(ctx);
      if (weeks < 2) return no(weeks ? 'Short sleep this week only' : 'Sleep average fine this week, or fewer than 4 nights');
      const doctor = weeks >= MEASURE_LIMITS.doctorAfterWeeks;
      return {
        due: true,
        reason: `Average ${hm(avg)} a night, under 6 h ${weeks} weeks in a row`,
        title: `Short sleep for ${weeks} weeks`,
        body: doctor
          ? `You have averaged ${hm(avg)} a night for ${weeks} weeks. If you sleep badly despite trying, talk to a professional: months of short sleep affect energy, mood and blood sugar.`
          : `You have averaged ${hm(avg)} a night. Most adults need 7 hours or more: try moving your bedtime 20 minutes earlier this week.`,
        route: '/metric?kind=sleep_duration',
      };
    },
  },
  {
    id: 'low_energy_3d',
    category: 'wellbeing',
    label: 'Low energy',
    cooldownDays: 7,
    evaluate: (ctx) => {
      const minByDay = new Map<string, number>();
      for (const c of upToNow(ctx.checkIns, ctx.now)) {
        if (c.energy == null) continue;
        const k = localDay(c.fecha);
        minByDay.set(k, Math.min(minByDay.get(k) ?? 5, c.energy));
      }
      const low = [0, 1, 2].filter((n) => (minByDay.get(daysAgoKey(ctx.now, n)) ?? 5) <= 2).length;
      if (low < 3) return no(`${low} low-energy day(s) of the last 3`);
      if (lowEnergyStreak(ctx).weeks >= 2) return no('Weeks-long pattern: the low-energy-over-time reminder covers it');
      return {
        due: true,
        reason: 'Energy 2/5 or lower in check-ins on 3 days in a row',
        title: 'Three low-energy days in a row',
        body: 'Sleep, stress and food all play a part. A short breathing session may help, or talk it through with a specialist.',
        route: '/professionals',
      };
    },
  },
  {
    id: 'short_sleep_3n',
    category: 'wellbeing',
    label: 'Short sleep',
    cooldownDays: 7,
    evaluate: (ctx) => {
      const nights = [...ctx.sleepNights]
        .filter((n) => n.date <= dayKey(ctx.now))
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(-3);
      if (nights.length < 3) return no('Fewer than 3 nights of wearable sleep');
      // Solo noches recientes: si el wearable deja de sincronizar, no se avisa con datos viejos
      if (nights[2].date < daysAgoKey(ctx.now, 1)) return no(`No wearable sleep since ${nights[2].date}`);
      const short = nights.filter((n) => n.minutes < 360).length;
      if (short < 3) return no(`${short} of the last 3 nights under 6 h`);
      if (shortSleepStreak(ctx).weeks >= 2) return no('Weeks-long pattern: the short-sleep-over-time reminder covers it');
      return {
        due: true,
        reason: 'Under 6 hours of sleep 3 nights in a row',
        title: 'Short nights lately',
        body: 'Three nights under 6 hours. An earlier wind-down tonight could help your energy tomorrow.',
        route: '/metric?kind=sleep_duration',
      };
    },
  },
  {
    id: 'temperature_reminder',
    category: 'cycle',
    label: 'Morning temperature',
    cooldownDays: 2,
    evaluate: (ctx) => {
      if (ctx.cycleGoal?.goal !== 'conceive' || !ctx.cycleGoal.logTemperature)
        return no('Temperature logging not switched on');
      const manual = upToNow(ctx.temperatures, ctx.now).filter((t) => t.source === 'manual');
      const last = latestIso(manual.map((t) => t.fecha));
      const since = last ? daysSince(last, ctx.now) : null;
      if (since != null && since < 2) return no(`Last temperature ${since} day(s) ago`);
      // Recordatorio corto: tras una semana sin registrar se deja de insistir hasta que vuelva
      const sinceAnswer = daysSince(ctx.cycleGoal.answeredAt, ctx.now);
      if ((since ?? sinceAnswer) >= 7) return no('A week without logging: reminders stop until she logs again');
      return {
        due: true,
        reason: last ? `No temperature for ${since} days` : 'Switched on but never logged',
        title: 'Log your morning temperature',
        body: 'Take it before getting up, at the same time each day. It helps us confirm when you ovulate.',
        route: '/log-temperature',
      };
    },
  },
  {
    id: 'bathroom_weekly',
    category: 'digestive',
    label: 'Weekly gut and bladder summary',
    cooldownDays: 7,
    evaluate: (ctx) => {
      const bowel = upToNow(ctx.bowel, ctx.now);
      const urine = upToNow(ctx.urine, ctx.now);
      const weekBowel = bowel.filter((e) => daysSince(e.fecha, ctx.now) < 7).length;
      const weekUrine = urine.filter((e) => daysSince(e.fecha, ctx.now) < 7).length;
      if (weekBowel < 3 && weekUrine < 3) return no(`Only ${Math.max(weekBowel, weekUrine)} day(s) logged this week`);
      const first = [...bowelObservations(bowel, ctx.now), ...urineObservations(urine, ctx.now)].find(
        (o) => o.level !== 'good' && !o.id.endsWith('need_more')
      );
      return {
        due: true,
        reason: `${weekBowel} gut and ${weekUrine} bladder day(s) logged this week`,
        title: 'Your weekly gut and bladder summary',
        body: first ? `${first.title}. Tap to see what we noticed.` : 'Everything looks regular this week.',
        route: '/digestive',
      };
    },
  },
  {
    id: 'checkin_missed_3d',
    category: 'engagement',
    label: 'Missed check-ins',
    cooldownDays: 5,
    evaluate: (ctx) => {
      const checkIns = upToNow(ctx.checkIns, ctx.now);
      const last = latestIso(checkIns.map((c) => c.fecha));
      if (!last) return no('Never checked in');
      const since = daysSince(last, ctx.now);
      if (since < 3) return no(`Last check-in ${since} day(s) ago`);
      if (since >= 7) return no('7+ days: the inactivity reminder covers it');
      const habitDays = new Set(
        checkIns.filter((c) => daysSince(c.fecha, ctx.now) >= 3 && daysSince(c.fecha, ctx.now) < 13).map((c) => localDay(c.fecha))
      ).size;
      if (habitDays < 4) return no(`Not a regular habit yet (${habitDays} days in the 10 before)`);
      return {
        due: true,
        reason: `Checked in on ${habitDays} of 10 days, then nothing for ${since} days`,
        title: 'How have you been?',
        body: 'You were checking in regularly. 30 seconds keeps your trends going.',
        route: '/check-in',
      };
    },
  },
  {
    id: 'inactive_7d',
    category: 'engagement',
    label: 'Inactivity reminder',
    cooldownDays: 7,
    evaluate: (ctx) => {
      const all = [
        ...ctx.checkIns,
        ...ctx.workouts,
        ...ctx.meals,
        ...ctx.cycleStarts,
        ...ctx.temperatures.filter((t) => t.source === 'manual'),
        ...ctx.bowel,
        ...ctx.urine,
      ];
      const last = latestIso(upToNow(all, ctx.now).map((e) => e.fecha));
      if (!last) return no('No records yet');
      const since = daysSince(last, ctx.now);
      if (since < 7) return no(`Last record ${since} day(s) ago`);
      return {
        due: true,
        reason: `No records of any kind for ${since} days`,
        title: 'We have not heard from you in a while',
        body: 'A 30-second check-in keeps your trends and your plan useful.',
        route: '/check-in',
      };
    },
  },
];

// Como mucho estos avisos al día (el resto espera al día siguiente si sigue tocando)
export const MAX_NUDGES_PER_DAY = 2;

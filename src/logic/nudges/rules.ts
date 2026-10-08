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

export const NUDGE_RULES: NudgeRule[] = [
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

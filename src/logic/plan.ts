// «Tu plan personalizado» en Today, el plan completo y la presentación del plan tras el onboarding.
// Sin datos todavía, sale de lo que el usuario contó: actividad, sueño, hábitos, objetivos,
// condiciones y edad. En cuanto hay datos (planHabits: reloj, entrenos, sesiones de calma, check-ins
// y comidas), cada acción dice dónde está de verdad frente a lo recomendable («Has registrado 3 en
// las últimas 4 semanas; lo recomendable son 2 o más a la semana») y lo que ya cumple sale del plan
// (planKept). Nada de consejos genéricos: el sueño regular solo entra si sus horas varían de verdad.
// Se eligen las 3-4 acciones que más le pueden aportar, con metas un paso por encima de donde está,
// y el "por qué" le dice qué de sus respuestas o de sus datos lo ha decidido. Cuando llegue la
// analítica, el motor de recomendaciones añadirá lo que digan sus marcadores.
// Reglas PENDIENTES de revisión médica. Fuentes en src/data/evidence.ts (tema "plan").
import { dateLocale, num, t } from '@/i18n';
import { formatClock } from '@/wearables/seriesLogic';
import type { LoggedPerWeek, PlanHabits, SleepTiming } from './planHabits';

export type PlanItemKind = 'strength' | 'steps' | 'nutrition' | 'sleep' | 'mindfulness';

export interface PlanItem {
  kind: PlanItemKind;
  title: string;
  subtitle: string;
  target: number; // meta en la unidad del tipo (sesiones/semana, pasos/día, comidas/día, horas, sesiones/semana)
  why: string; // por qué está en tu plan
  how: string[]; // recomendaciones concretas
  detail?: string; // dónde estás frente a lo recomendable, con tus datos («Haces 6.100 pasos de media…»)
  short?: string; // lo mismo en corto, para Hoy («6.100 al día · meta 8.000»); la explicación va en el plan completo
}

// Lo que ya cumples según tus datos: no entra en el plan, se enseña aparte («Ya cumples»)
export interface PlanKept {
  kind: PlanItemKind;
  text: string;
  short: string; // para Hoy («Pasos: 8.800 al día · meta 8.000»)
}

// Lo que usa el plan del perfil (UserProfile cumple esta forma)
export interface PlanProfile {
  goals?: string[];
  activity?: string;
  sleep?: string;
  smoking?: string;
  alcohol?: string;
  conditions?: string[];
  dateOfBirth?: string;
  sex?: string;
  heightCm?: number;
  weightKg?: number;
}

// Umbrales con datos. Sueño: AASM/SRS 2015, los adultos necesitan 7 h o más. Regularidad: en el
// estudio MESA (Huang 2020) el grupo de referencia variaba 30 min o menos de una noche a otra (la
// desviación típica de la hora); a partir de 45 min lo damos por destacable y entra en el plan.
export const PLAN_LIMITS = { sleepNeedMin: 420, shortSleepMin: 360, timingSdNotable: 45, timingSdAim: 30, calmPerWeek: 3 };

const ageOf = (dob?: string) => {
  if (!dob) return null;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  if (now.getMonth() < d.getMonth() || (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())) age--;
  return age;
};
const fmtSteps = (n: number) => Math.round(n).toLocaleString(dateLocale());
const list = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);
const hm = (min: number) => {
  const m = Math.round(min);
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min`;
};
const perWeekText = (v: number) => num(Math.round(v * 10) / 10);
// Horas de reloj redondeadas a 5 min («23:25», no «23:31»)
const clock = (minutes: number) => formatClock(Math.round(minutes / 5) * 5);
const inWeeks = (w: number) => (w === 1 ? t('in the last week') : t('in the last {n} weeks', { n: w }));
// Lo que falta para la meta, en sesiones enteras (nunca 0: si estuviera cumplida no entraría)
const missing = (target: number, done: LoggedPerWeek) => Math.max(1, Math.round(target - done.perWeek));

interface Candidate {
  kind: PlanItemKind;
  score: number;
  item?: PlanItem; // sin item: nada que proponer (p. ej. duerme bien y a horas regulares)
  kept?: string; // ya lo cumple según sus datos
  keptShort?: string;
  measured?: boolean; // la acción sale de un hueco medido en sus datos, no de un consejo general
}

function steps(p: PlanProfile, age: number | null, has: (g: string) => boolean, cond: (c: string) => boolean, h?: PlanHabits['steps']): Candidate {
  const older = age != null && age >= 60;
  const target =
    p.activity === 'sedentary'
      ? age != null && age >= 70
        ? 5000
        : 6000
      : p.activity === 'light' || !p.activity
        ? p.activity
          ? 7500
          : 8000
        : older
          ? 8000
          : 9000;
  const why: string[] = [];
  let score = 2;
  if (h) {
    // Con el reloj manda lo que caminas de verdad, no la actividad que marcaste al empezar
    const gap = target - h.avg;
    score += gap >= 3000 ? 3 : gap >= 1500 ? 2 : gap > 0 ? 1 : 0;
  } else {
    if (p.activity === 'sedentary') why.push(t('You told us you spend most of the day sitting, so moving more is where you can gain the most.'));
    else if (p.activity === 'light') why.push(t('You already move a bit: a few thousand more steps a day is a small change with a big payoff.'));
    if (p.activity === 'sedentary') score += 3;
    if (p.activity === 'light') score += 2;
    if (p.activity === 'very_active') score -= 3;
  }
  const reasons = ['hypertension', 'diabetes', 'prediabetes', 'high_cholesterol'].filter(cond);
  if (reasons.length) why.push(t('Walking lowers blood pressure, blood sugar and triglycerides.'));
  why.push(
    t(
      older
        ? 'In a study of 47,000 adults, the benefit kept growing up to 6,000-8,000 steps a day from age 60.'
        : 'In a study of 47,000 adults, the benefit kept growing up to 8,000-10,000 steps a day before age 60.'
    )
  );
  if (has('lose_weight')) score += 2;
  if (has('general_health') || has('longevity') || has('prevent_disease')) score += 1;
  if (reasons.length) score += 2;

  const how = [t('A 10-min walk after each main meal'), t('Take calls on foot and use the stairs')];
  // El bache de la semana, si lo hay (entre semana o el fin de semana)
  if (h?.weekday != null && h.weekend != null && Math.abs(h.weekday - h.weekend) >= 1500)
    how.unshift(
      h.weekend < h.weekday
        ? t('At weekends you drop to {n} steps a day: plan a long walk on Saturday or Sunday', { n: fmtSteps(h.weekend) })
        : t('On weekdays you drop to {n} steps a day: walk part of the way to work or after lunch', { n: fmtSteps(h.weekday) })
    );
  else how.push(target <= 6000 ? t('Once this feels easy, we will raise the goal') : t('Your wearable updates progress automatically'));

  const more = h ? Math.max(500, Math.ceil((target - h.avg) / 500) * 500) : 0;
  return {
    kind: 'steps',
    score,
    measured: !!h,
    kept: h && h.avg >= target ? t('{n} steps a day on average (your goal: {target})', { n: fmtSteps(h.avg), target: fmtSteps(target) }) : undefined,
    keptShort: h ? t('Steps: {n} a day · goal {target}', { n: fmtSteps(h.avg), target: fmtSteps(target) }) : undefined,
    item: {
      kind: 'steps',
      title: h ? t('Walk {n} more steps a day', { n: fmtSteps(more) }) : t('Walk {n} steps a day', { n: fmtSteps(target) }),
      subtitle: t('Updated from your wearable'),
      target,
      why: why.join(' '),
      how: how.slice(0, 3),
      detail: h ? t('You average {n} steps a day (last {d} days); your goal is {target}.', { n: fmtSteps(h.avg), d: h.days, target: fmtSteps(target) }) : undefined,
      short: h ? t('{n} a day · goal {target}', { n: fmtSteps(h.avg), target: fmtSteps(target) }) : undefined,
    },
  };
}

function strength(p: PlanProfile, age: number | null, has: (g: string) => boolean, cond: (c: string) => boolean, h?: PlanHabits['strength']): Candidate {
  const beginner = p.activity === 'sedentary' || p.activity === 'light' || !p.activity;
  const target = has('performance') || p.activity === 'very_active' ? 3 : beginner ? 2 : 3;
  const why: string[] = [];
  if (has('performance')) why.push(t('You want to perform better: strength is the base for speed, power and fewer injuries.'));
  if (has('lose_weight')) why.push(t('Keeping muscle while you lose weight keeps your metabolism up.'));
  if (cond('diabetes') || cond('prediabetes')) why.push(t('Muscle is your biggest sink for blood sugar, so it helps control it.'));
  if (age != null && age >= 50) why.push(t('From your 50s, muscle and bone are lost faster unless you train them.'));
  why.push(t('The WHO recommends strength training on 2 or more days a week for every adult.'));
  let score = 2;
  if (has('performance')) score += 3;
  if (has('lose_weight')) score += 2;
  if (has('longevity')) score += 2;
  if (has('more_energy')) score += 1;
  if (age != null && age >= 50) score += 1;
  if (cond('diabetes') || cond('prediabetes')) score += 2;
  if (h) score += h.count === 0 ? 2 : h.perWeek < target ? 1 : 0;
  const older = age != null && age >= 65;
  const how = [
    t('{n} sessions of {min} min on non-consecutive days', { n: target, min: beginner ? '20-30' : '30-45' }),
    older ? t('Include balance work: standing on one leg, step-ups') : t('Full body: squats, hinges, pushes, pulls'),
    t('Finish each set with 1-2 reps left in the tank'),
  ];
  if (h?.count && h.lastDaysAgo != null && h.lastDaysAgo >= 7)
    how.unshift(t('Your last strength session was {n} days ago: put the next one in your calendar', { n: h.lastDaysAgo }));
  const recommended = target === 2 ? t('2 or more a week is the recommendation') : t('for your goal, aim for 3 a week');
  const add = h ? missing(target, h) : 0;
  return {
    kind: 'strength',
    score,
    measured: !!h,
    kept:
      h && h.perWeek >= target
        ? t('{n} strength sessions {window} (your goal: {target} a week)', { n: h.count, window: inWeeks(h.weeks), target })
        : undefined,
    keptShort: h ? t('Strength: {v} a week · goal {target}', { v: perWeekText(h.perWeek), target }) : undefined,
    item: {
      kind: 'strength',
      title: !h
        ? t('{n} strength sessions a week', { n: target })
        : h.count === 0
          ? t('Start with {n} strength sessions a week', { n: target })
          : add === 1
            ? t('Add 1 strength session a week')
            : t('Add {n} strength sessions a week', { n: add }),
      subtitle: t(beginner ? 'Start light: 20-30 minutes is enough' : 'Supports muscle, bones and blood sugar'),
      target,
      why: why.join(' '),
      how: how.slice(0, 3),
      detail: !h
        ? undefined
        : h.count === 0
          ? t('You have not logged any {window}; {recommended}.', { window: inWeeks(h.weeks), recommended })
          : t('You have logged {n} {window} ({v} a week); {recommended}.', { n: h.count, window: inWeeks(h.weeks), v: perWeekText(h.perWeek), recommended }),
      short: h ? t('{v} a week · goal {target}', { v: perWeekText(h.perWeek), target }) : undefined,
    },
  };
}

function nutrition(p: PlanProfile, has: (g: string) => boolean, cond: (c: string) => boolean, meals?: PlanHabits['meals']): Candidate {
  const c = nutritionByAnswers(p, has, cond);
  // El azúcar añadido de las comidas que apunta (con 5 o más en 2 semanas)
  if (meals) {
    const sugary = meals.sugar * 3 >= meals.logged; // un tercio o más
    c.item!.detail = t('Added sugar in {n} of your last {m} logged meals.', { n: meals.sugar, m: meals.logged });
    c.item!.short = t('Added sugar in {n} of {m} meals', { n: meals.sugar, m: meals.logged });
    if (sugary) c.score += 2;
    if (sugary && c.specific === false)
      c.item = {
        ...c.item!,
        title: t('Cut down on added sugar'),
        why: t('Less added sugar keeps your energy and your blood sugar steadier. Start with drinks and desserts.'),
      };
  } else if (c.specific) c.item!.detail = c.item!.short = c.item!.title; // la acción ya es la tuya (sal, azúcar, proteína…)
  return { kind: 'nutrition', score: c.score, item: c.item, measured: !!meals && meals.sugar * 3 >= meals.logged };
}

// La acción de comida según condiciones y objetivos; `specific` = sale de algo que contó (no la general)
function nutritionByAnswers(p: PlanProfile, has: (g: string) => boolean, cond: (c: string) => boolean): Candidate & { specific: boolean } {
  const drinks = p.alcohol === 'daily' || p.alcohol === 'weekly';
  const alcoholTip = drinks ? [t('At least 4 alcohol-free days a week')] : [];
  let score = 2;
  if (has('lose_weight')) score += 2;
  if (has('more_energy')) score += 1;
  if (has('prevent_disease') || has('longevity')) score += 1;
  if (drinks) score += 1;
  const base = { kind: 'nutrition' as const, subtitle: t('Snap your meals to track it'), target: 3 };

  if (cond('diabetes') || cond('prediabetes'))
    return {
      kind: 'nutrition',
      specific: true,
      score: score + 3,
      item: {
        ...base,
        title: t('Keep added sugar under 25 g a day'),
        why: t(cond('diabetes') ? 'You told us about diabetes. Added sugar and refined flour drive glucose spikes; meals built on protein, fibre and vegetables keep it steady.' : 'You told us about prediabetes. Added sugar and refined flour drive glucose spikes; meals built on protein, fibre and vegetables keep it steady.'),
        how: [t('Half the plate vegetables, a quarter protein'), t('Swap sugary drinks for water or sparkling water'), ...alcoholTip, t('Snap your meals: we track added sugar for you')].slice(0, 3),
      },
    };
  if (cond('hypertension'))
    return {
      kind: 'nutrition',
      specific: true,
      score: score + 3,
      item: {
        ...base,
        title: t('Keep salt under 5 g a day'),
        why: t('You told us about high blood pressure. Less salt lowers it within weeks; the WHO advises under 5 g a day, about a teaspoon.'),
        how: [t('Cook from scratch most days'), t('Check labels: bread, cured meats and ready meals hide most salt'), ...alcoholTip, t('Season with herbs, lemon or spices')].slice(0, 3),
      },
    };
  if (cond('high_cholesterol') || cond('heart_disease'))
    return {
      kind: 'nutrition',
      specific: true,
      score: score + 3,
      item: {
        ...base,
        title: t('Eat the Mediterranean way'),
        why: t(cond('heart_disease') ? 'You told us about heart disease. Olive oil, nuts, legumes and fish instead of processed meat and butter lower LDL cholesterol and heart risk.' : 'You told us about high cholesterol. Olive oil, nuts, legumes and fish instead of processed meat and butter lower LDL cholesterol and heart risk.'),
        how: [t('Olive oil as your main fat'), t('Legumes 3 times a week, oily fish twice'), ...alcoholTip, t('Processed meat and pastries only occasionally')].slice(0, 3),
      },
    };
  if (has('performance') && !has('lose_weight'))
    return {
      kind: 'nutrition',
      specific: true,
      score,
      item: {
        ...base,
        title: t('Protein at every meal'),
        why: t('You want to perform better. Spreading protein across your meals helps your muscles recover and adapt to training.'),
        how: [t('A palm-sized portion of protein at each meal'), t('A full meal after training'), ...alcoholTip, t('Fruit and vegetables every day')].slice(0, 3),
      },
    };
  return {
    kind: 'nutrition',
    specific: has('lose_weight'),
    score,
    item: {
      ...base,
      title: t(has('lose_weight') ? 'Protein and vegetables first' : 'Build your plate around real food'),
      why: t(
        has('lose_weight')
          ? 'You want to lose weight. Starting meals with protein and vegetables keeps you full for longer, so eating less does not feel like a fight.'
          : 'Most of what you eat shapes your energy and your blood markers. Simple plate rules beat strict diets.'
      ),
      how: [t('Half the plate vegetables, a quarter protein'), t('Swap sugary drinks for water or sparkling water'), ...alcoholTip, t('Snap your meals to see your week')].slice(0, 3),
    },
  };
}

function sleepItem(p: PlanProfile, has: (g: string) => boolean, h?: PlanHabits['sleep']): Candidate | null {
  let score = 0;
  if (p.sleep === 'lt6') score += 5;
  if (p.sleep === '6to7') score += 2;
  // Ya duerme bastante: el sueño solo entra si quiere dormir mejor
  if (p.sleep === 'gt8' && !has('sleep_better')) score -= 3;
  if (p.sleep === '7to8' && !has('sleep_better')) score -= 1;
  if (has('sleep_better')) score += 4;
  if (has('more_energy')) score += 2;
  if (has('reduce_stress')) score += 1;
  if (h) return sleepFromData(p, has, h, score);
  // Sin el reloj no sabemos si sus horarios son irregulares: a quien ya duerme 7 h o más no le
  // damos un «mantén horarios regulares» genérico
  if (p.sleep === '7to8' || p.sleep === 'gt8') return null;
  const why: string[] = [];
  if (p.sleep === 'lt6') why.push(t('You told us you usually sleep under 6 hours.'));
  else if (p.sleep === '6to7') why.push(t('You usually sleep 6-7 hours, just under what most adults need.'));
  if (has('sleep_better')) why.push(t('Sleeping better is one of your goals.'));
  if (has('more_energy')) why.push(t('More sleep is the fastest way to more energy.'));
  why.push(t('Adults need 7 hours or more: short sleep raises next-day glucose and cortisol and lowers HRV.'));
  return {
    kind: 'sleep',
    score,
    item: {
      kind: 'sleep',
      title: t(p.sleep === 'lt6' ? 'Get to 7 hours of sleep' : 'Sleep 7-8 hours'),
      subtitle: t('Measured by your wearable'),
      target: p.sleep === 'lt6' ? 7 : 7.5,
      why: why.join(' '),
      how: [
        p.sleep === 'lt6' ? t('Move your bedtime 20 minutes earlier each week') : t('Same wake-up time every day, weekends included'),
        t('No screens 30 min before bed'),
        t('Keep the bedroom cool and dark'),
      ],
    },
  };
}

// Con el reloj: primero las horas (menos de 7 h de media); si llegan, la regularidad, pero solo si
// la hora de acostarse o de levantarse varía de verdad. Si todo está bien, «Ya cumples».
function sleepFromData(p: PlanProfile, has: (g: string) => boolean, h: NonNullable<PlanHabits['sleep']>, base: number): Candidate {
  const nights = t('last {n} nights', { n: h.nights });
  const timings = [
    h.bed && { bed: true, x: h.bed },
    h.wake && { bed: false, x: h.wake },
  ].filter((o): o is { bed: boolean; x: SleepTiming } => !!o);
  const irregular = timings.filter((o) => o.x.sd >= PLAN_LIMITS.timingSdNotable).sort((a, b) => b.x.sd - a.x.sd)[0];
  const sd = (x: SleepTiming) => Math.round(x.sd);

  if (h.avg < PLAN_LIMITS.sleepNeedMin) {
    const more = Math.max(15, Math.ceil((PLAN_LIMITS.sleepNeedMin - h.avg) / 5) * 5);
    const why: string[] = [];
    if (has('sleep_better')) why.push(t('Sleeping better is one of your goals.'));
    if (has('more_energy')) why.push(t('More sleep is the fastest way to more energy.'));
    why.push(t('Adults need 7 hours or more: short sleep raises next-day glucose and cortisol and lowers HRV.'));
    return {
      kind: 'sleep',
      measured: true,
      score: Math.max(base, 0) + (h.avg < PLAN_LIMITS.shortSleepMin ? 6 : 4),
      item: {
        kind: 'sleep',
        title: t('Sleep {time} more a night', { time: hm(more) }),
        subtitle: t('Measured by your wearable'),
        target: 7,
        why: why.join(' '),
        how: [
          h.bed
            ? t('Go to bed 20 min earlier each week: start at {time} instead of {now}', { time: clock(h.bed.mean - 20), now: clock(h.bed.mean) })
            : t('Move your bedtime 20 minutes earlier each week'),
          irregular
            ? t(irregular.bed ? 'Your bedtime also varies ±{sd} min from night to night: fix it first' : 'Your wake-up time also varies ±{sd} min from day to day: fix it first', { sd: sd(irregular.x) })
            : t('No screens 30 min before bed'),
          t('Keep the bedroom cool and dark'),
        ],
        detail: t('You sleep {avg} a night on average ({window}); adults need 7 h or more.', { avg: hm(h.avg), window: nights }),
        short: t('{avg} a night · goal 7 h', { avg: hm(h.avg) }),
      },
    };
  }

  if (irregular) {
    const { bed, x } = irregular;
    const how: string[] = [];
    if (x.weekday != null && x.weekend != null && Math.abs(x.weekend - x.weekday) >= 45)
      how.push(
        t(bed ? 'On weekdays you go to bed around {a} and at weekends around {b}: try to bring them closer' : 'On weekdays you get up around {a} and at weekends around {b}: try to bring them closer', {
          a: clock(x.weekday),
          b: clock(x.weekend),
        })
      );
    how.push(
      bed
        ? t('Set a reminder to start winding down at {time}', { time: clock((x.weekday ?? x.mean) - 30) })
        : t('Set your alarm for {time} every day, weekends included', { time: clock(x.weekday ?? x.mean) })
    );
    how.push(t('Daylight in the first hour after waking'));
    return {
      kind: 'sleep',
      measured: true,
      score: Math.max(base, 0) + (x.sd >= 60 ? 5 : 4),
      item: {
        kind: 'sleep',
        title: t(bed ? 'Go to bed at the same time every night' : 'Get up at the same time every day'),
        subtitle: t('Measured by your wearable'),
        target: p.sleep === 'gt8' ? 8 : 7.5,
        why: [
          t('You already sleep {avg} on average, so the gain is not in more hours but in steadier ones.', { avg: hm(h.avg) }),
          t('Going to bed and waking up at the same times makes the same hours more restful, and very irregular times are linked to poorer metabolic and heart health.'),
        ].join(' '),
        how,
        detail: t(bed ? 'Your bedtime varies ±{sd} min from night to night ({window}); the aim is under ±{aim} min.' : 'Your wake-up time varies ±{sd} min from day to day ({window}); the aim is under ±{aim} min.', {
          sd: sd(x),
          window: nights,
          aim: PLAN_LIMITS.timingSdAim,
        }),
        short: t(bed ? 'Bedtime: ±{sd} min · goal ±{aim}' : 'Wake-up time: ±{sd} min · goal ±{aim}', { sd: sd(x), aim: PLAN_LIMITS.timingSdAim }),
      },
    };
  }

  const steady = timings.length > 0 && timings.every((o) => o.x.sd < PLAN_LIMITS.timingSdAim);
  return {
    kind: 'sleep',
    score: 0,
    kept: steady
      ? t('{avg} of sleep on average, at steady times (±{sd} min)', { avg: hm(h.avg), sd: Math.max(...timings.map((o) => sd(o.x))) })
      : t('{avg} of sleep on average', { avg: hm(h.avg) }),
    keptShort: steady ? t('Sleep: {avg}, at steady times', { avg: hm(h.avg) }) : t('Sleep: {avg} on average', { avg: hm(h.avg) }),
  };
}

function mindfulness(has: (g: string) => boolean, cond: (c: string) => boolean, calm?: PlanHabits['calm'], stress?: PlanHabits['stress']): Candidate {
  const target = PLAN_LIMITS.calmPerWeek;
  // Estrés alto (4-5 de 5, o ánimo estresado o ansioso) en un tercio o más de sus check-ins
  const stressed = !!stress && stress.high * 3 >= stress.of;
  const stressLine = stressed ? t('You marked high stress in {n} of your last {m} check-ins.', { n: stress!.high, m: stress!.of }) : '';
  let score = 0;
  if (has('reduce_stress')) score += 5;
  if (has('sleep_better')) score += 1;
  if (has('more_energy')) score += 1;
  if (cond('hypertension') || cond('heart_disease')) score += 1;
  if (stressed) score += 3;
  const why = [
    has('reduce_stress') ? t('You want to reduce stress.') : '',
    calm ? stressLine : '', // sin sesiones registradas, el estrés ya va en el detalle
    t('Chronic stress keeps cortisol high and HRV low. A few minutes of slow breathing measurably shifts your nervous system towards recovery.'),
  ].filter(Boolean);
  const add = calm ? missing(target, calm) : 0;
  return {
    kind: 'mindfulness',
    score,
    measured: stressed,
    kept: calm && calm.perWeek >= target ? t('{n} calm sessions {window}', { n: calm.count, window: inWeeks(calm.weeks) }) : undefined,
    keptShort: calm ? t('Calm: {v} a week', { v: perWeekText(calm.perWeek) }) : undefined,
    item: {
      kind: 'mindfulness',
      title: !calm || calm.count === 0 ? t('3 short calm sessions a week') : add === 1 ? t('Add 1 short calm session a week') : t('Add {n} short calm sessions a week', { n: add }),
      subtitle: t('Breathing or body scan, 3-10 min'),
      target,
      why: why.join(' '),
      how: [t('Box breathing when you feel tense'), t('Body scan before bed'), t('Start from a check-in: we suggest the right one')],
      detail: calm
        ? calm.count === 0
          ? t('You have not done any {window}; 3 a week is the aim.', { window: inWeeks(calm.weeks) })
          : t('You have done {n} {window} ({v} a week); 3 a week is the aim.', { n: calm.count, window: inWeeks(calm.weeks), v: perWeekText(calm.perWeek) })
        : stressLine || undefined,
      short: calm
        ? t('{v} a week · goal {target}', { v: perWeekText(calm.perWeek), target })
        : stressed
          ? t('High stress in {n} of {m} check-ins', { n: stress!.high, m: stress!.of })
          : undefined,
    },
  };
}

function candidates(profile: PlanProfile | null | undefined, habits: PlanHabits): Candidate[] {
  const p = profile ?? {};
  const goals = p.goals ?? [];
  const conditions = p.conditions ?? [];
  const has = (g: string) => goals.includes(g);
  const cond = (c: string) => conditions.includes(c);
  const age = ageOf(p.dateOfBirth);
  return [
    steps(p, age, has, cond, habits.steps),
    strength(p, age, has, cond, habits.strength),
    nutrition(p, has, cond, habits.meals),
    sleepItem(p, has, habits.sleep),
    mindfulness(has, cond, habits.calm, habits.stress),
  ].filter((c): c is Candidate => !!c);
}

// Plan por defecto (sin perfil ni datos): lo que más beneficio da a casi cualquiera. Con datos
// (planHabits), lo que ya cumple no entra.
export function buildPlan(profile?: PlanProfile | null, habits: PlanHabits = {}): PlanItem[] {
  // Las de más puntos primero: hasta 3 que aporten algo (más de 0 puntos) y una cuarta si aporta
  // mucho (4+) o sale de un hueco medido en sus datos. Sin puntos no se rellena con consejos genéricos.
  const sorted = candidates(profile, habits)
    .filter((c) => c.item && !c.kept)
    .sort((a, b) => b.score - a.score);
  return sorted.filter((c, i) => c.score > 0 && (i < 3 || (i < 4 && (c.score >= 4 || c.measured)))).map((c) => c.item!);
}

// Lo que ya cumple según sus datos (pasos, fuerza, sueño, calma), para «Ya cumples»
export const planKept = (profile?: PlanProfile | null, habits: PlanHabits = {}): PlanKept[] =>
  candidates(profile, habits)
    .filter((c) => c.kept)
    .map((c) => ({ kind: c.kind, text: c.kept!, short: c.keptShort ?? c.kept! }));

// Qué de las respuestas ha decidido el plan, para enseñarlo al elegir objetivos (vista previa)
export const planSummary = (profile?: PlanProfile | null) => list(buildPlan(profile).map((i) => i.title.toLowerCase()));

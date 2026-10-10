import { BowelEntry, UrineEntry, VOID_VOLUMES } from '@/types/bathroom';

import { t } from '@/i18n';
// Observaciones semanales del registro digestivo y urinario. Lógica pura (sin React Native) para
// poder usarla en la app, en el simulador y en los tests.
//
// Criterio: primero preguntar por lo que suele explicar un cambio (comidas, suplementos, agua,
// viajes) y solo después recomendar el médico. Umbrales orientativos de guías de divulgación
// (NHS, sociedades de digestivo y urología); PENDIENTES DE VALIDACIÓN CLÍNICA.

export type ObservationLevel = 'good' | 'tip' | 'ask' | 'see_doctor';

export interface Observation {
  id: string;
  level: ObservationLevel;
  title: string;
  body: string;
  // Pregunta de contexto: según la respuesta, la observación se cierra o pasa a "see_doctor"
  question?: { text: string; yes: string; no: string };
}

const DAY = 24 * 3600 * 1000;
const inLastDays = <T extends { fecha: string }>(entries: T[], now: Date, days: number) =>
  entries.filter((e) => {
    const t = new Date(e.fecha).getTime();
    return t <= now.getTime() && now.getTime() - t < days * DAY;
  });
const byDateAsc = <T extends { fecha: string }>(entries: T[]) =>
  [...entries].sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());

// Días seguidos (hasta el último apunte) que cumplen la condición
const trailingRun = <T>(list: T[], test: (e: T) => boolean) => {
  let n = 0;
  for (let i = list.length - 1; i >= 0 && test(list[i]); i--) n++;
  return n;
};

export const MIN_DAYS_FOR_OBSERVATIONS = 3;

export function bowelObservations(entries: BowelEntry[], now = new Date()): Observation[] {
  const week = byDateAsc(inLastDays(entries, now, 7));
  const out: Observation[] = [];
  if (week.length < MIN_DAYS_FOR_OBSERVATIONS) {
    return [
      {
        id: 'bowel_need_more',
        level: 'tip',
        title: t('Log a few more days'),
        body: t('With {n} or more days this week we can tell you how your digestion is doing.', { n: MIN_DAYS_FOR_OBSERVATIONS }),
      },
    ];
  }

  // Colores llamativos en los últimos días que el usuario aún no ha explicado
  const recent = inLastDays(entries, now, 3);
  const unexplained = (color: string) => recent.some((e) => e.color === color && !e.explainedBy);
  if (unexplained('red')) {
    out.push({
      id: 'stool_red',
      level: 'ask',
      title: t('About the reddish colour'),
      body: t('Red foods often do this. If nothing explains it, red can mean a little bleeding lower in the gut (often minor, like haemorrhoids), and it is worth checking with a doctor.'),
      question: {
        text: t('In the last two days, have you eaten beetroot, red dragon fruit (pitaya), tomato soup, cranberries or red-coloured drinks or sweets?'),
        yes: t('That is the most likely reason. It should look normal again within a day or two; if it does not, talk to a doctor.'),
        no: t('Please talk to a doctor in the next few days. Get urgent help if there is a lot of blood or you feel faint.'),
      },
    });
  }
  if (unexplained('black')) {
    out.push({
      id: 'stool_black',
      level: 'ask',
      title: t('About the very dark colour'),
      body: t('Iron tablets and some stomach medicines turn stools black. Without a reason, black and sticky stools can mean bleeding higher in the gut.'),
      question: {
        text: t('Are you taking iron supplements or bismuth (such as Pepto-Bismol), or have you eaten a lot of black liquorice or blueberries?'),
        yes: t('That explains it. It is harmless and goes back to normal when you stop.'),
        no: t('Please see a doctor soon. If you also feel dizzy, weak or short of breath, get urgent help.'),
      },
    });
  }
  const paleDays = week.filter((e) => e.color === 'pale').length;
  if (paleDays >= 2) {
    out.push({
      id: 'stool_pale',
      level: 'see_doctor',
      title: t('Pale stools more than once'),
      body: t('Pale or clay-coloured stools can be related to how bile flows from the liver. Please mention it to a doctor, especially if your urine is dark too.'),
    });
  }

  // Frecuencia: lo habitual va de 3 veces al día a 3 veces por semana
  const total = week.reduce((a, e) => a + e.count, 0);
  const perLoggedDay = total / week.length;
  const zeroRun = trailingRun(week, (e) => e.count === 0);
  const withType = week.filter((e) => e.consistency);
  const hard = withType.filter((e) => e.consistency! <= 2).length;
  const loose = withType.filter((e) => e.consistency! >= 6).length;

  if (zeroRun >= 3 || (week.length >= 5 && total < 3)) {
    out.push({
      id: 'bowel_infrequent',
      level: 'ask',
      title: zeroRun >= 3 ? t('No bowel movement for {n} days', { n: zeroRun }) : t('Fewer than 3 times this week'),
      body: t('Going less often than usual is common when routines change. More water, fibre (fruit, vegetables, wholegrains, legumes) and moving every day usually help.'),
      question: {
        text: t('Have you changed anything lately: travelling, eating differently, drinking less water, new medicines or less exercise?'),
        yes: t('That is a likely reason. Give it a few days with water, fibre and movement. See a doctor if it lasts more than 3 weeks or hurts.'),
        no: t('Try water, fibre and movement for a week. If it does not improve, or there is pain, blood or weight loss without trying, talk to a doctor.'),
      },
    });
  } else if (perLoggedDay > 3) {
    out.push({
      id: 'bowel_frequent',
      level: 'tip',
      title: t('Going more often than usual'),
      body: t('More than 3 times a day for several days is worth keeping an eye on. Drink enough to replace lost fluids.'),
    });
  }

  if (withType.length >= 3 && hard >= Math.ceil(withType.length / 2)) {
    out.push({
      id: 'stool_hard',
      level: 'tip',
      title: t('Mostly hard stools'),
      body: t('Hard or lumpy stools usually mean you need more fluid and fibre. Add them gradually and keep moving.'),
    });
  }
  if (loose >= 3) {
    out.push({
      id: 'stool_loose',
      level: loose >= 5 ? 'see_doctor' : 'ask',
      title: loose >= 5 ? t('Loose stools most of the week') : t('Several days of loose stools'),
      body: t('Drink plenty to stay hydrated. Diarrhoea usually settles within a week; see a doctor if it lasts longer, or sooner with fever, blood or strong pain.'),
      question:
        loose >= 5
          ? undefined
          : {
              text: t('Have you eaten something unusual, travelled, or started a new medicine or supplement (like magnesium)?'),
              yes: t('That is a common cause. Keep hydrated and it should settle in a few days.'),
              no: t('Keep hydrated and keep logging. If it lasts more than a week, talk to a doctor.'),
            },
    });
  }

  if (!out.length) {
    out.push({
      id: 'bowel_ok',
      level: 'good',
      title: t('Your digestion looks regular'),
      body: t('Frequency, colour and consistency are within the usual range this week.'),
    });
  }
  return out;
}

export function urineObservations(entries: UrineEntry[], now = new Date()): Observation[] {
  const week = byDateAsc(inLastDays(entries, now, 7));
  const out: Observation[] = [];
  if (week.length < MIN_DAYS_FOR_OBSERVATIONS) {
    return [
      {
        id: 'urine_need_more',
        level: 'tip',
        title: t('Log a few more days'),
        body: t('With {n} or more days this week we can tell you how you are doing.', { n: MIN_DAYS_FOR_OBSERVATIONS }),
      },
    ];
  }
  const last3 = week.slice(-3);
  const recent = inLastDays(entries, now, 3);

  if (recent.some((e) => e.color === 'red' && !e.explainedBy)) {
    out.push({
      id: 'urine_red',
      level: 'ask',
      title: t('About the pink or red colour'),
      body: t('Some foods and medicines colour urine. Without a reason, blood in the urine always needs checking.'),
      question: {
        text: t('In the last day or two, have you eaten beetroot, blackberries or rhubarb, or started a new medicine?'),
        yes: t('That is the likely cause and it should clear within a day. If it does not, see a doctor.'),
        no: t('Please see a doctor soon, even if it does not hurt.'),
      },
    });
  }
  if (recent.some((e) => e.color === 'brown')) {
    out.push({
      id: 'urine_brown',
      level: 'see_doctor',
      title: t('Brown urine'),
      body: t('Brown or cola-coloured urine that does not clear with more water should be checked by a doctor.'),
    });
  }
  if (last3.filter((e) => e.color === 'dark' || e.color === 'amber').length >= 2) {
    out.push({
      id: 'urine_dark',
      level: 'tip',
      title: t('Darker than ideal'),
      body: t('Dark yellow or amber usually means you need to drink more. Aim for pale straw. If it stays dark even when you drink more, talk to a doctor.'),
    });
  }
  if (recent.some((e) => e.burning)) {
    out.push({
      id: 'urine_burning',
      level: 'see_doctor',
      title: t('Burning when you pee'),
      body: t('Burning or pain, especially with cloudy urine or needing to go often, can be a urine infection. A pharmacist or doctor can check it.'),
    });
  }

  const counted = week.filter((e) => e.count != null);
  if (counted.length >= 3) {
    const avg = counted.reduce((a, e) => a + (e.count ?? 0), 0) / counted.length;
    if (avg > 10) {
      out.push({
        id: 'urine_frequent',
        level: 'ask',
        title: t('Peeing very often'),
        body: t('More than 10 times a day is more than usual.'),
        question: {
          text: t('Have you been drinking a lot more than usual (water, coffee, tea, alcohol)?'),
          yes: t('That explains it. It should settle when you go back to your usual amount.'),
          no: t('Mention it to a doctor, especially if you are also very thirsty or tired.'),
        },
      });
    } else if (avg < 4) {
      out.push({
        id: 'urine_infrequent',
        level: 'tip',
        title: t('Not peeing much'),
        body: t('Fewer than 4 times a day often means you are not drinking enough.'),
      });
    }
  }
  const nights = week.filter((e) => (e.nightCount ?? 0) >= 2).length;
  if (nights >= 3) {
    out.push({
      id: 'urine_nights',
      level: 'ask',
      title: t('Waking up at night to pee'),
      body: t('Getting up twice or more most nights affects sleep.'),
      question: {
        text: t('Do you drink a lot (or coffee, tea or alcohol) in the evening?'),
        yes: t('Try moving most of your drinks earlier in the day.'),
        no: t('If it keeps happening, mention it to a doctor.'),
      },
    });
  }

  if (!out.length) {
    out.push({
      id: 'urine_ok',
      level: 'good',
      title: t('Hydration looks good'),
      body: t('Colour and frequency are within the usual range this week.'),
    });
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Prueba de volumen: una micción en una botella de 500 ml, como primera aproximación. Se propone
// la primera vez, cada 3 meses, o antes si cambia la frecuencia. Si el volumen no es el habitual,
// se repite otro día y, si hay dudas, se sugiere el bote de orina de 24 h de la farmacia.

export const VOLUME_CHECK_EVERY_DAYS = 90;

export type VolumeCheckSuggestion =
  | { kind: 'first' }
  | { kind: 'periodic'; daysSince: number }
  | { kind: 'repeat' } // el último volumen no era el habitual
  | { kind: 'collect_24h' } // ya se repitió y sigue sin ser el habitual
  | null;

export function volumeCheckSuggestion(entries: UrineEntry[], now = new Date()): VolumeCheckSuggestion {
  const checks = byDateAsc(entries.filter((e) => e.voidVolume)).reverse();
  if (!checks.length) return entries.length ? { kind: 'first' } : null;
  const [last, previous] = checks;
  if (last.volumeUsual === 'no') {
    return previous && previous.volumeUsual === 'no' ? { kind: 'collect_24h' } : { kind: 'repeat' };
  }
  const daysSince = Math.floor((now.getTime() - new Date(last.fecha).getTime()) / DAY);
  return daysSince >= VOLUME_CHECK_EVERY_DAYS ? { kind: 'periodic', daysSince } : null;
}

export const voidVolumeMl = (v: UrineEntry['voidVolume']) => VOID_VOLUMES.find((o) => o.id === v)?.ml ?? null;

// Total de 24 h: lo habitual con 1,5–2 litros de bebida ronda 0,8–2 litros
export function dailyTotalNote(ml: number): Observation {
  if (ml < 500)
    return { id: 'total_low', level: 'see_doctor', title: t('Very little in 24 hours'), body: t('Less than half a litre a day is low. Drink more and, if it stays low, see a doctor.') };
  if (ml < 800)
    return { id: 'total_lowish', level: 'tip', title: t('A bit low for a day'), body: t('Under 0.8 litres a day usually means you could drink more. Try again on a normal day.') };
  if (ml > 3000)
    return { id: 'total_high', level: 'see_doctor', title: t('A lot in 24 hours'), body: t('More than 3 litres a day is a lot unless you drink that much. Mention it to a doctor.') };
  return { id: 'total_ok', level: 'good', title: t('A usual daily amount'), body: t('Between about 0.8 and 2 litres a day is typical.') };
}

// --- Hidratación de hoy y consejo al guardar la orina --------------------------------------

// Escala de hidratación por el color (de más a menos hidratado). Marrón, rojo y turbio no
// hablan de hidratación: tienen su propio consejo.
export const HYDRATION_SCALE: NonNullable<UrineEntry['color']>[] = ['clear', 'pale', 'yellow', 'dark', 'amber'];

export interface Hydration {
  position: number | null; // 0 (muy hidratado) … 4 (deshidratado), para la regla de Today
  label: string;
  level: 'good' | 'tip' | 'low' | 'check' | 'unknown';
}

export function hydrationFromUrine(e?: Pick<UrineEntry, 'color' | 'count'> | null): Hydration {
  if (!e) return { position: null, label: 'Tap to log', level: 'unknown' };
  const fewTimes = e.count != null && e.count <= 3;
  if (e.color && !HYDRATION_SCALE.includes(e.color)) return { position: null, label: 'See note', level: 'check' };
  if (!e.color) {
    return fewTimes
      ? { position: 3, label: 'Could drink a bit more', level: 'tip' }
      : { position: null, label: 'Add the colour', level: 'unknown' };
  }
  // Pocas veces al día empuja un punto hacia "deshidratado"
  const position = Math.min(4, HYDRATION_SCALE.indexOf(e.color) + (fewTimes ? 1 : 0));
  const labels: Record<number, Hydration> = {
    0: { position: 0, label: 'Very well hydrated', level: 'good' },
    1: { position: 1, label: 'Well hydrated', level: 'good' },
    2: { position: 2, label: 'Hydrated', level: 'good' },
    3: { position: 3, label: 'Could drink a bit more', level: 'tip' },
    // Tono suave (pidió el fundador): describe lo que vemos, sin órdenes
    4: { position: 4, label: 'Signs of dehydration', level: 'low' },
  };
  return labels[position];
}

export interface UrineAdvice {
  level: 'tip' | 'low' | 'see_doctor';
  title: string;
  body: string;
}

// Lo que se le dice al guardar el apunte del día (null = nada que decir, se cierra sin más).
// Textos orientativos; PENDIENTES DE VALIDACIÓN CLÍNICA.
export function urineAdvice(e: Pick<UrineEntry, 'color' | 'count' | 'burning' | 'explainedBy'>): UrineAdvice | null {
  if (e.color === 'red' && !e.explainedBy)
    return {
      level: 'see_doctor',
      title: t('Please see a doctor soon'),
      body: t('Pink or red urine that no food or medicine explains can be blood, and that always needs checking. Get urgent help if there is a lot of blood or you cannot pee.'),
    };
  if (e.color === 'brown')
    return {
      level: 'see_doctor',
      title: t('Keep an eye on this colour'),
      body: t('Brown urine can come from severe dehydration, some foods or medicines, but also from the liver or the muscles. Drinking some water may help; if it is not lighter within a day, see a doctor.'),
    };
  if (e.burning)
    return {
      level: 'see_doctor',
      title: t('Burning when you pee'),
      body: t('Burning or pain, especially if you also need to go often, is usually a urine infection. Drink water and talk to a doctor or pharmacist if it lasts more than a day, or straight away if you have fever or back pain.'),
    };
  if (e.color === 'amber')
    return {
      level: 'low',
      title: t('You may be dehydrated'),
      body: t('Amber or honey-coloured urine usually means your body is short of water. A large glass of water and regular sips through the day usually help: it should get lighter within a few hours. If it is still this dark tomorrow even though you are drinking, or you feel dizzy or confused, talk to a doctor.'),
    };
  if (e.color === 'dark')
    return {
      level: 'tip',
      title: t('You could drink a bit more'),
      body: t('Dark yellow is an early sign of mild dehydration. A glass of water and a bottle nearby today usually help. Heat, exercise and coffee all add to it.'),
    };
  if (e.count != null && e.count <= 3)
    return {
      level: 'tip',
      title: t('Not many times today'),
      body: t('Going 3 times or fewer in a day often means you are not drinking enough. It is probably worth drinking a bit more today and seeing how you are tomorrow.'),
    };
  if (e.color === 'cloudy')
    return {
      level: 'tip',
      title: t('Cloudy urine'),
      body: t('It is often harmless, for example after a meal. If it keeps happening, or comes with burning, a strong smell or fever, talk to a doctor.'),
    };
  return null;
}

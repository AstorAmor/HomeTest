import { describe, expect, it } from 'vitest';
import {
  applyDailyLimit,
  diffPending,
  doseReminders,
  evaluateNudges,
  MAX_NUDGES_PER_DAY,
  mergeFiredLog,
  PHONE_ID_PREFIX,
  PHONE_REMINDERS,
  PhonePlanInput,
  planPhoneReminders,
  reminderData,
  resolvedPresented,
  temperatureReminders,
  usualMorningTime,
  weighInReminders,
  checkinReminders,
} from '@/logic/nudges';
import { NudgeContext } from '@/logic/nudges/types';
import { MedicationItem } from '@/types/medication';
import { es } from '@/i18n/es';

// Recordatorios del móvil con la app cerrada (src/logic/nudges/phone.ts). Fechas en hora local.
const at = (s: string) => new Date(s);
const iso = (s: string) => new Date(s).toISOString();

const ctxAt = (now: string, over: Partial<NudgeContext> = {}): NudgeContext => ({
  now: at(now),
  profile: { sex: 'female', age: 32 },
  checkIns: [],
  workouts: [],
  meals: [],
  cycleStarts: [],
  temperatures: [],
  bowel: [],
  urine: [],
  sleepNights: [],
  ...over,
});

const ALL_ON = { medication: true, cycle: true, checkin: true };

const input = (ctx: NudgeContext, over: Partial<PhonePlanInput> = {}): PhonePlanInput => ({
  ctx,
  prefs: { muted: {} },
  log: [],
  weighIns: [],
  sections: ALL_ON,
  ...over,
});

const med = (over: Partial<MedicationItem> = {}): MedicationItem => ({
  id: 'vitd',
  fecha: iso('2026-10-01T08:00:00'),
  createdAt: iso('2026-10-01T08:00:00'),
  name: 'Vitamina D',
  kind: 'supplement',
  schedule: { type: 'times', times: ['09:00', '21:00'] },
  course: { type: 'ongoing' },
  reminders: true,
  ...over,
});

const hours = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
const day = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

describe('tomas de medicación y suplementos', () => {
  it('programa cada toma futura de la próxima semana a su hora', () => {
    const r = doseReminders(input(ctxAt('2026-10-20T10:00:00', { medications: [med()] })));
    // Hoy solo queda la de las 21:00; luego 6 días con 2 tomas
    expect(r).toHaveLength(1 + 6 * 2);
    expect(day(r[0].at)).toBe('2026-10-20');
    expect(hours(r[0].at)).toBe('21:00');
    expect(r.every((x) => x.kind === 'dose' && x.route === '/medications' && x.medIds?.[0] === 'vitd')).toBe(true);
    expect(r.every((x) => x.at.getTime() > at('2026-10-20T10:00:00').getTime())).toBe(true);
  });

  it('las horas siguen siendo las del reloj tras el cambio de hora (25 de octubre)', () => {
    const r = doseReminders(input(ctxAt('2026-10-23T22:00:00', { medications: [med()] })));
    expect(r.filter((x) => day(x.at) === '2026-10-26').map((x) => hours(x.at))).toEqual(['09:00', '21:00']);
  });

  it('al marcar la toma (tomada u omitida) desaparece su aviso, y el diff lo cancela', () => {
    const ctx = ctxAt('2026-10-20T10:00:00', { medications: [med()] });
    const before = doseReminders(input(ctx));
    const tonight = before[0];
    const marked = doseReminders(
      input({
        ...ctx,
        doses: [{ id: 'd1', fecha: iso('2026-10-20T20:55:00'), createdAt: iso('2026-10-20T20:55:00'), medId: 'vitd', scheduledFor: tonight.at.toISOString(), status: 'skipped' }],
      })
    );
    expect(marked.find((x) => x.id === tonight.id)).toBeUndefined();
    expect(marked).toHaveLength(before.length - 1);
    const diff = diffPending(before.map((x) => x.id), marked);
    expect(diff.cancel).toEqual([tonight.id]);
    expect(diff.add).toEqual([]);
  });

  it('nada si el recordatorio está apagado, la pauta es «cuando lo necesite» o la sección está apagada', () => {
    const now = '2026-10-20T10:00:00';
    expect(doseReminders(input(ctxAt(now, { medications: [med({ reminders: false })] })))).toEqual([]);
    expect(doseReminders(input(ctxAt(now, { medications: [med({ schedule: { type: 'as_needed' } })] })))).toEqual([]);
    expect(doseReminders(input(ctxAt(now, { medications: [med()] }), { sections: { ...ALL_ON, medication: false } }))).toEqual([]);
  });

  it('respeta el silencio del medicamento y vuelve a avisar cuando acaba', () => {
    const r = doseReminders(input(ctxAt('2026-10-20T10:00:00', { medications: [med({ remindersMutedUntil: iso('2026-10-23T00:00:00') })] })));
    expect(r.length).toBeGreaterThan(0);
    expect(r.every((x) => x.at.getTime() >= at('2026-10-23T00:00:00').getTime())).toBe(true);
  });

  it('un tratamiento puntual solo avisa los días que dura', () => {
    const short = med({ id: 'amox', name: 'Amoxicilina', kind: 'medication', schedule: { type: 'every_hours', hours: 8, firstTime: '07:00' }, course: { type: 'short', startDate: '2026-10-19', days: 3 } });
    const r = doseReminders(input(ctxAt('2026-10-20T10:00:00', { medications: [short] })));
    // Quedan las 15:00 y 23:00 de hoy y las tres de mañana (el tratamiento acaba el 22)
    expect(r.map((x) => `${day(x.at)} ${hours(x.at)}`)).toEqual([
      '2026-10-20 15:00',
      '2026-10-20 23:00',
      '2026-10-21 07:00',
      '2026-10-21 15:00',
      '2026-10-21 23:00',
    ]);
  });

  it('dos cosas a la misma hora van en un solo aviso', () => {
    const r = doseReminders(
      input(ctxAt('2026-10-20T10:00:00', { medications: [med({ schedule: { type: 'times', times: ['21:00'] } }), med({ id: 'mg', name: 'Magnesio', schedule: { type: 'times', times: ['21:00'] } })] }))
    );
    expect(r[0].medIds).toEqual(['vitd', 'mg']);
    expect(r[0].title).toBe('Your 21:00 doses');
    expect(r[0].body).toContain('Vitamina D, Magnesio');
    expect(r).toHaveLength(7);
  });
});

describe('pesarse una vez por semana', () => {
  it('por la mañana, una semana después de la última pesada', () => {
    const r = weighInReminders(input(ctxAt('2026-10-20T10:00:00'), { weighIns: [{ valor: 72, fecha: iso('2026-10-15T07:50:00') }] }));
    expect(r.map((x) => `${day(x.at)} ${hours(x.at)}`)).toEqual(['2026-10-22 08:00']);
    expect(r[0].reminderId).toBe('weigh_in');
    expect(r[0].route).toBe('/log-weight');
  });

  it('si no se pesó el día que tocaba, vuelve a la semana siguiente (no cada día)', () => {
    const r = weighInReminders(input(ctxAt('2026-10-20T10:00:00'), { weighIns: [{ valor: 72, fecha: iso('2026-10-10T07:50:00') }] }));
    expect(r.map((x) => day(x.at))).toEqual(['2026-10-24']);
  });

  it('tras 4 semanas sin pesarse deja de insistir', () => {
    expect(weighInReminders(input(ctxAt('2026-10-20T10:00:00'), { weighIns: [{ valor: 72, fecha: iso('2026-09-18T07:50:00') }] }))).toEqual([]);
  });

  it('nada si nunca se ha pesado en la app o si lo ha apagado', () => {
    expect(weighInReminders(input(ctxAt('2026-10-20T10:00:00')))).toEqual([]);
    const muted = input(ctxAt('2026-10-20T10:00:00'), {
      weighIns: [{ valor: 72, fecha: iso('2026-10-15T07:50:00') }],
      prefs: { muted: { weigh_in: { until: null, setAt: iso('2026-10-16T10:00:00') } } },
    });
    expect(weighInReminders(muted)).toEqual([]);
  });
});

describe('temperatura de la mañana', () => {
  const goal = { goal: 'conceive' as const, regularCycles: 'yes' as const, tryingFor: 'under_6m' as const, logTemperature: true, answeredAt: iso('2026-10-01T10:00:00') };
  const temps = (...when: string[]) => when.map((w) => ({ fecha: iso(w), celsius: 36.4, source: 'manual' as const }));

  it('cada mañana a la hora de costumbre, hasta una semana después de la última', () => {
    const ctx = ctxAt('2026-10-20T06:00:00', {
      cycleGoal: goal,
      temperatures: temps('2026-10-17T07:00:00', '2026-10-18T07:10:00', '2026-10-19T07:20:00'),
    });
    const r = temperatureReminders(input(ctx));
    expect(r.map((x) => day(x.at))).toEqual(['2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25']);
    expect(r.every((x) => hours(x.at) === '07:10')).toBe(true);
    expect(r[0].reminderId).toBe('temperature_reminder');
  });

  it('si ya la ha apuntado hoy, hoy no avisa', () => {
    const ctx = ctxAt('2026-10-20T08:00:00', { cycleGoal: goal, temperatures: temps('2026-10-20T07:05:00') });
    const r = temperatureReminders(input(ctx));
    expect(r[0] && day(r[0].at)).toBe('2026-10-21');
    expect(hours(r[0].at)).toBe(PHONE_REMINDERS.temperatureTime);
  });

  it('nada sin buscar embarazo con la temperatura encendida, con la sección del ciclo apagada o silenciada', () => {
    const now = '2026-10-20T06:00:00';
    expect(temperatureReminders(input(ctxAt(now, { cycleGoal: { ...goal, logTemperature: false } })))).toEqual([]);
    expect(temperatureReminders(input(ctxAt(now, { cycleGoal: { ...goal, goal: 'track' } })))).toEqual([]);
    expect(temperatureReminders(input(ctxAt(now, { cycleGoal: goal, temperatures: temps('2026-10-19T07:00:00') }), { sections: { ...ALL_ON, cycle: false } }))).toEqual([]);
    const muted = { muted: { temperature_reminder: { until: iso('2026-10-22T12:00:00'), setAt: iso('2026-10-19T12:00:00') } } };
    const r = temperatureReminders(input(ctxAt(now, { cycleGoal: goal, temperatures: temps('2026-10-19T07:00:00') }), { prefs: muted }));
    expect(r.map((x) => day(x.at))[0]).toBe('2026-10-23');
  });

  it('hora de costumbre: mediana de las tomas de por la mañana, redondeada a 5 minutos', () => {
    expect(usualMorningTime([at('2026-10-17T06:52:00'), at('2026-10-18T07:13:00'), at('2026-10-19T07:01:00')])).toBe('07:00');
    expect(usualMorningTime([at('2026-10-18T07:13:00'), at('2026-10-19T07:01:00')])).toBeNull();
    expect(usualMorningTime([at('2026-10-17T22:00:00'), at('2026-10-18T23:00:00'), at('2026-10-19T21:00:00')])).toBeNull();
  });
});

describe('check-in', () => {
  // Check-in cada día del 8 al 17 a las 21:00 y luego nada
  const habit = Array.from({ length: 10 }, (_, i) => ({ fecha: iso(`2026-10-${String(8 + i).padStart(2, '0')}T21:00:00`), energy: 4 }));

  it('a quien lo hacía a menudo y lo deja, un solo aviso a las 20:00 cuando lleva 3 días sin hacerlo', () => {
    const r = checkinReminders(input(ctxAt('2026-10-18T22:00:00', { checkIns: habit })));
    // La regla toca del 3.º al 6.º día sin check-in (a partir del 7.º ya lo cubre el aviso de inactividad)
    expect(r.map((x) => `${day(x.at)} ${hours(x.at)}`)).toEqual(['2026-10-21 20:00', '2026-10-22 20:00', '2026-10-23 20:00', '2026-10-24 20:00']);
    // Con el tiempo entre avisos de la regla (5 días) queda uno
    const plan = planPhoneReminders(input(ctxAt('2026-10-18T22:00:00', { checkIns: habit })));
    expect(plan.filter((x) => x.kind === 'checkin').map((x) => day(x.at))).toEqual(['2026-10-21']);
    expect(plan[0].route).toBe('/check-in');
  });

  it('nada si no tenía costumbre o si tiene el check-in apagado', () => {
    const few = habit.slice(-2);
    expect(planPhoneReminders(input(ctxAt('2026-10-18T22:00:00', { checkIns: few })))).toEqual([]);
    expect(planPhoneReminders(input(ctxAt('2026-10-18T22:00:00', { checkIns: habit }), { sections: { ...ALL_ON, checkin: false } }))).toEqual([]);
  });

  it('si ya salió en la bandeja, espera los 5 días de la regla', () => {
    const plan = planPhoneReminders(input(ctxAt('2026-10-18T22:00:00', { checkIns: habit }), { log: [{ id: 'checkin_missed_3d', at: iso('2026-10-18T09:00:00') }] }));
    expect(plan.map((x) => day(x.at))).toEqual(['2026-10-23']);
  });

  it('silenciado, no sale', () => {
    const prefs = { muted: { checkin_missed_3d: { until: null, setAt: iso('2026-10-01T10:00:00') } } };
    expect(planPhoneReminders(input(ctxAt('2026-10-18T22:00:00', { checkIns: habit }), { prefs }))).toEqual([]);
  });
});

describe('máximo diario', () => {
  it(`como mucho ${MAX_NUDGES_PER_DAY} avisos al día contando la bandeja; las tomas no cuentan`, () => {
    const ctx = ctxAt('2026-10-21T06:00:00', {
      medications: [med({ schedule: { type: 'times', times: ['09:00'] } })],
      cycleGoal: { goal: 'conceive', regularCycles: 'yes', logTemperature: true, answeredAt: iso('2026-10-20T10:00:00') },
    });
    const plan = planPhoneReminders(
      input(ctx, { log: [{ id: 'bp_high_weeks', at: iso('2026-10-21T00:30:00') }, { id: 'urine_dark', at: iso('2026-10-21T00:40:00') }] })
    );
    const today = plan.filter((x) => day(x.at) === '2026-10-21');
    expect(today.map((x) => x.kind)).toEqual(['dose']);
    expect(plan.some((x) => x.kind === 'temperature' && day(x.at) === '2026-10-22')).toBe(true);
  });

  it('si coinciden tres el mismo día, se queda fuera el check-in', () => {
    const mk = (kind: 'temperature' | 'weigh_in' | 'checkin', time: string) => ({
      id: `${PHONE_ID_PREFIX}${kind}`,
      kind,
      reminderId: kind === 'temperature' ? ('temperature_reminder' as const) : kind === 'checkin' ? ('checkin_missed_3d' as const) : ('weigh_in' as const),
      at: at(`2026-10-22T${time}:00`),
      title: kind,
      body: '',
      route: '/',
    });
    const kept = applyDailyLimit([mk('checkin', '20:00'), mk('weigh_in', '08:00'), mk('temperature', '07:30')], []);
    expect(kept.map((x) => x.kind)).toEqual(['temperature', 'weigh_in']);
  });

  it('la bandeja cuenta lo que ya saltó en el móvil para su máximo diario', () => {
    const now = at('2026-10-21T19:00:00');
    const ctx = ctxAt('2026-10-21T19:00:00', { checkIns: [], workouts: [{ fecha: iso('2026-10-10T10:00:00') }] }); // 11 días sin nada
    const phone = mergeFiredLog([], [{ reminderId: 'weigh_in', at: iso('2026-10-21T08:00:00') }, { reminderId: 'temperature_reminder', at: iso('2026-10-21T07:30:00') }], now);
    const d = evaluateNudges(ctx, { muted: {} }, phone).find((x) => x.id === 'inactive_7d')!;
    expect(d.status).toBe('daily_limit');
  });

  it('no deja más de los que caben en iOS', () => {
    const many = Array.from({ length: 6 }, (_, i) =>
      med({ id: `m${i}`, name: `Med ${i}`, schedule: { type: 'times', times: ['08:00', '12:00', '16:00', '20:00'].map((h) => h.replace(':00', `:0${i}`)) } })
    );
    const plan = planPhoneReminders(input(ctxAt('2026-10-20T06:00:00', { medications: many })));
    expect(plan).toHaveLength(PHONE_REMINDERS.maxPending);
    expect(day(plan[plan.length - 1].at) < '2026-10-27').toBe(true);
    expect(plan.every((x, i) => i === 0 || plan[i - 1].at.getTime() <= x.at.getTime())).toBe(true);
  });
});

describe('ids estables y reprogramar', () => {
  it('mismos datos = mismos ids (no se reprograma nada); otro texto = otro id', () => {
    const ctx = ctxAt('2026-10-20T10:00:00', { medications: [med()] });
    const a = planPhoneReminders(input(ctx));
    const b = planPhoneReminders(input({ ...ctx, now: at('2026-10-20T10:05:00') }));
    expect(diffPending(a.map((x) => x.id), b)).toEqual({ cancel: [], add: [] });
    const renamed = planPhoneReminders(input({ ...ctx, medications: [med({ name: 'Vitamina D3' })] }));
    expect(diffPending(a.map((x) => x.id), renamed).cancel).toHaveLength(a.length);
    expect(a.every((x) => x.id.startsWith(PHONE_ID_PREFIX))).toBe(true);
  });

  it('el diff no toca notificaciones que no son de Kuova', () => {
    expect(diffPending(['otra-app-1'], []).cancel).toEqual([]);
  });
});

describe('quitar de la barra lo que ya está hecho', () => {
  it('la toma marcada, la temperatura y el peso apuntados; lo demás se queda', () => {
    const ctx = ctxAt('2026-10-20T10:00:00', { medications: [med()] });
    const tonight = doseReminders(input(ctx))[0];
    const presented = [
      { id: tonight.id, data: reminderData(tonight) },
      { id: `${PHONE_ID_PREFIX}temperature-x`, data: { kind: 'temperature' as const, at: iso('2026-10-20T07:30:00'), route: '/log-temperature' } },
      { id: `${PHONE_ID_PREFIX}weigh_in-x`, data: { kind: 'weigh_in' as const, at: iso('2026-10-20T08:00:00'), route: '/log-weight' } },
      { id: 'otra-app', data: { kind: 'dose' as const, at: tonight.at.toISOString(), route: '/', medIds: ['vitd'] } },
    ];
    const state = {
      ctx: {
        ...ctx,
        doses: [{ id: 'd', fecha: iso('2026-10-20T21:02:00'), createdAt: iso('2026-10-20T21:02:00'), medId: 'vitd', scheduledFor: tonight.at.toISOString(), status: 'taken' as const }],
        temperatures: [{ fecha: iso('2026-10-20T07:45:00'), celsius: 36.5, source: 'manual' as const }],
      },
      weighIns: [{ valor: 71.8, fecha: iso('2026-10-19T08:00:00') }], // del día anterior: no cuenta
    };
    expect(resolvedPresented(presented, state)).toEqual([tonight.id, `${PHONE_ID_PREFIX}temperature-x`]);
  });
});

describe('historial de lo que ya saltó', () => {
  it('lo programado que ya pasó cuenta como enviado; lo futuro no; sin repetir; 14 días', () => {
    const now = at('2026-10-20T12:00:00');
    const planned = [
      { reminderId: 'weigh_in' as const, at: iso('2026-10-20T08:00:00') },
      { reminderId: 'temperature_reminder' as const, at: iso('2026-10-21T07:30:00') },
      { at: iso('2026-10-20T09:00:00') },
    ];
    const fired = mergeFiredLog([{ id: 'weigh_in', at: iso('2026-10-20T08:00:00') }, { id: 'checkin_missed_3d', at: iso('2026-10-01T20:00:00') }], planned, now);
    expect(fired).toEqual([{ id: 'weigh_in', at: iso('2026-10-20T08:00:00') }]);
  });
});

describe('textos', () => {
  // Las claves nuevas tienen su español y no diagnostican ni hablan de dosis
  const KEYS = [
    '{name}: your {time} dose',
    'Your {time} doses',
    'Mark it in Kuova when you take it.',
    '{names}. Mark them in Kuova when you take them.',
    'Time for your weekly weigh-in',
    'In the morning, after the toilet and before breakfast: that way one week compares with the next.',
    'At the time of each dose with reminders on.',
    'Weigh-in, morning temperature and check-in.',
    'On your phone',
    'Get your reminders even when the app is closed.',
    'Kuova notifications are off in your phone settings.',
    'Open settings',
    'On, even with the app closed. Dose reminders do not count towards the two a day.',
    'Next reminders',
    'Turn off on this phone',
    'Nothing scheduled for the next few days.',
    'Medication and supplement doses',
    'At their time, for each one with reminders on. You choose them in Medication & supplements.',
    'Weekly weigh-in',
    'A morning reminder a week after your last weigh-in.',
    'Reminders on your phone?',
    'We can remind you to weigh in once a week, even with the app closed. You can change it in Settings → Notifications.',
    'If you go a few days without a check-in, we can send you a reminder, even with the app closed. You can change it in Settings → Notifications.',
    'Yes, remind me',
    // Reutilizadas de la bandeja
    'Log your morning temperature',
    'Take it before getting up, at the same time each day. It helps us confirm when you ovulate.',
    'How have you been?',
    'Medication & supplements',
    'Reminders',
  ];
  const BANNED = /\b(diagn|enfermedad|disease|tienes (un|una)|padeces|mg\b|µg|comprimidos?|dosis|deja de tomar|empieza a tomar|stop taking|start taking)/i;

  it('todas traducidas al español', () => {
    const dict = es as Record<string, string>;
    expect(KEYS.filter((k) => !dict[k])).toEqual([]);
  });

  it('sin diagnósticos, sin dosis y sin pedir que empiece o deje nada', () => {
    const dict = es as Record<string, string>;
    expect(KEYS.flatMap((k) => [k, dict[k] ?? '']).filter((s) => BANNED.test(s))).toEqual([]);
  });
});

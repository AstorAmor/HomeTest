import { t } from '@/i18n';
import { dosesForDay, isReminderMuted } from '@/logic/medication';
import { WEIGH_EVERY_DAYS, WeighIn } from '@/logic/weight';
import { isMuted } from './engine';
import { MAX_NUDGES_PER_DAY, NUDGE_RULES } from './rules';
import { NudgeContext, NudgeLogEntry, NudgePrefs, ReminderId } from './types';

// Recordatorios que llegan al móvil aunque la app esté cerrada: notificaciones locales programadas
// (expo-notifications, sin servidor). Lógica pura: con lo que hay ahora, decide qué avisos dejar
// programados para los próximos días. La app lo vuelve a calcular al abrirse y tras cada cambio
// (src/data/phoneReminders.ts), así una toma marcada o una temperatura apuntada quitan su aviso.
// Sin el módulo nativo (APK antiguo, web) no se programa nada y siguen solo los avisos de la bandeja.
//
// - Tomas de medicación y suplementos: a su hora, solo las que tienen el recordatorio encendido y
//   sin silenciar. Son alarmas que pide el usuario, así que no cuentan para el máximo diario.
// - Pesarse: por la mañana, una semana después de la última pesada (WEIGH_EVERY_DAYS). Si no se
//   pesa, se repite a la semana siguiente, y tras 4 semanas se deja de insistir.
// - Temperatura basal: cada mañana mientras la registra, a la hora a la que suele apuntarla. Tras una
//   semana sin apuntarla se deja de insistir, como el aviso de la bandeja.
// - Check-in: la regla de la bandeja «checkin_missed_3d» evaluada en las próximas tardes (solo a
//   quien lo hacía a menudo y lleva 3 días sin hacerlo; una vez y no vuelve en 5 días).
// Las tres últimas respetan sus interruptores, sus silencios y MAX_NUDGES_PER_DAY, contando lo que
// ya salió ese día (bandeja y móvil).

export type PhoneReminderKind = 'dose' | 'temperature' | 'weigh_in' | 'checkin';

export interface PhoneReminder {
  id: string; // identificador estable en el sistema: misma hora y mismo texto = mismo aviso
  kind: PhoneReminderKind;
  reminderId?: ReminderId; // el interruptor que lo controla (las tomas van por medicamento)
  at: Date;
  title: string;
  body: string;
  route: string; // pantalla que abre al tocarlo
  medIds?: string[];
}

export interface PhonePlanInput {
  ctx: NudgeContext; // ctx.now = ahora
  prefs: NudgePrefs;
  log: NudgeLogEntry[]; // avisos que ya salieron: bandeja + recordatorios del móvil que ya saltaron
  weighIns: WeighIn[];
  sections: { medication: boolean; cycle: boolean; checkin: boolean }; // secciones de la app encendidas
}

export const PHONE_REMINDERS = {
  days: 7, // se programa una semana: cada vez que se abre la app se vuelve a calcular
  maxPending: 60, // iOS guarda como mucho 64 avisos programados por app
  weighInTime: '08:00',
  temperatureTime: '07:30', // hasta que haya costumbre (3 tomas o más por la mañana)
  checkinTime: '20:00',
  weighInStopAfterWeeks: 4,
  temperatureStopAfterDays: 7,
};

export const PHONE_ID_PREFIX = 'kuova-';

// Si dos avisos caen el mismo día y ya no caben, primero lo que tiene hora (la temperatura se toma
// antes de levantarse) y lo último el check-in.
const PRIORITY: PhoneReminderKind[] = ['temperature', 'weigh_in', 'checkin'];

const DAY = 864e5;
const pad = (n: number) => String(n).padStart(2, '0');
const hhmm = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
// Día `plus` a partir de `base`, a una hora local (con new Date(y, m, d…) los cambios de hora no lo descuadran)
const dayAt = (base: Date, plus: number, time: string) => {
  const [h, m] = time.split(':').map(Number);
  return new Date(base.getFullYear(), base.getMonth(), base.getDate() + plus, h, m || 0);
};
const calendarDays = (from: Date, to: Date) => Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / DAY);
const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const stamp = (d: Date) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}`;
const latest = (dates: Date[]) => dates.reduce<Date | null>((a, d) => (!a || d > a ? d : a), null);

// Hash corto (djb2) del contenido: si cambia el texto (idioma, nombre del medicamento) cambia el id
function hash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

const make = (r: Omit<PhoneReminder, 'id'>): PhoneReminder => ({
  ...r,
  id: `${PHONE_ID_PREFIX}${r.kind}-${stamp(r.at)}-${hash([r.title, r.body, r.route, ...(r.medIds ?? [])].join('|'))}`,
});

const horizon = (now: Date, days: number) => ({ from: now.getTime(), to: dayAt(now, days, '00:00').getTime() });
const inWindow = (at: Date, w: { from: number; to: number }) => at.getTime() > w.from && at.getTime() < w.to;

// Hora a la que suele apuntar la temperatura (mediana de las últimas 14 tomas de por la mañana,
// redondeada a 5 minutos). null si aún no hay 3.
export function usualMorningTime(times: Date[]): string | null {
  const mins = [...times]
    .sort((a, b) => b.getTime() - a.getTime())
    .map((d) => d.getHours() * 60 + d.getMinutes())
    .filter((m) => m >= 4 * 60 && m < 12 * 60)
    .slice(0, 14)
    .sort((a, b) => a - b);
  if (mins.length < 3) return null;
  const mid = Math.floor(mins.length / 2);
  const median = mins.length % 2 ? mins[mid] : (mins[mid - 1] + mins[mid]) / 2;
  const r = Math.round(median / 5) * 5;
  return `${pad(Math.floor(r / 60))}:${pad(r % 60)}`;
}

// Tomas de los próximos días con recordatorio. Las que coinciden a la misma hora van en un solo aviso.
export function doseReminders(input: PhonePlanInput, days = PHONE_REMINDERS.days): PhoneReminder[] {
  const { ctx } = input;
  if (!input.sections.medication) return [];
  const meds = (ctx.medications ?? []).filter((m) => m.reminders && m.schedule.type !== 'as_needed');
  if (!meds.length) return [];
  const byId = new Map(meds.map((m) => [m.id, m]));
  const w = horizon(ctx.now, days);
  const out: PhoneReminder[] = [];
  for (let k = 0; k < days; k++) {
    const due = dosesForDay(meds, dayAt(ctx.now, k, '00:00'), ctx.doses ?? []).filter(
      (d) => !d.log && inWindow(d.at, w) && !isReminderMuted(byId.get(d.medId)!, d.at)
    );
    const groups = new Map<number, typeof due>();
    for (const d of due) groups.set(d.at.getTime(), [...(groups.get(d.at.getTime()) ?? []), d]);
    for (const list of groups.values()) {
      const time = hhmm(list[0].at);
      const names = [...new Set(list.map((d) => d.name))];
      out.push(
        make({
          kind: 'dose',
          at: list[0].at,
          title: list.length === 1 ? t('{name}: your {time} dose', { name: names[0], time }) : t('Your {time} doses', { time }),
          body:
            list.length === 1
              ? t('Mark it in Kuova when you take it.')
              : t('{names}. Mark them in Kuova when you take them.', { names: names.join(', ') }),
          route: '/medications',
          medIds: [...new Set(list.map((d) => d.medId))],
        })
      );
    }
  }
  return out;
}

export function temperatureReminders(input: PhonePlanInput, days = PHONE_REMINDERS.days): PhoneReminder[] {
  const { ctx, prefs } = input;
  const goal = ctx.cycleGoal;
  if (!input.sections.cycle || goal?.goal !== 'conceive' || !goal.logTemperature) return [];
  const manual = ctx.temperatures
    .filter((x) => x.source === 'manual' && new Date(x.fecha).getTime() <= ctx.now.getTime())
    .map((x) => new Date(x.fecha));
  const last = latest(manual);
  const since = last ?? new Date(goal.answeredAt); // sin ninguna toma, desde que lo encendió
  const time = usualMorningTime(manual) ?? PHONE_REMINDERS.temperatureTime;
  const w = horizon(ctx.now, days);
  const out: PhoneReminder[] = [];
  for (let k = 0; k < days; k++) {
    const at = dayAt(ctx.now, k, time);
    if (!inWindow(at, w)) continue;
    if (calendarDays(since, at) >= PHONE_REMINDERS.temperatureStopAfterDays) break;
    if (last && calendarDays(last, at) === 0) continue; // ya la ha apuntado hoy
    if (isMuted(prefs, 'temperature_reminder', at)) continue;
    out.push(
      make({
        kind: 'temperature',
        reminderId: 'temperature_reminder',
        at,
        title: t('Log your morning temperature'),
        body: t('Take it before getting up, at the same time each day. It helps us confirm when you ovulate.'),
        route: '/log-temperature',
      })
    );
  }
  return out;
}

export function weighInReminders(input: PhonePlanInput, days = PHONE_REMINDERS.days): PhoneReminder[] {
  const { ctx, prefs } = input;
  const last = latest(input.weighIns.map((e) => new Date(e.fecha)).filter((d) => d.getTime() <= ctx.now.getTime()));
  if (!last) return []; // nunca se ha pesado en la app: no se le pide
  const w = horizon(ctx.now, days);
  const out: PhoneReminder[] = [];
  for (let week = 1; week <= PHONE_REMINDERS.weighInStopAfterWeeks; week++) {
    const at = dayAt(last, week * WEIGH_EVERY_DAYS, PHONE_REMINDERS.weighInTime);
    if (!inWindow(at, w) || isMuted(prefs, 'weigh_in', at)) continue;
    out.push(
      make({
        kind: 'weigh_in',
        reminderId: 'weigh_in',
        at,
        title: t('Time for your weekly weigh-in'),
        body: t('In the morning, after the toilet and before breakfast: that way one week compares with the next.'),
        route: '/log-weight',
      })
    );
  }
  return out;
}

const checkinRule = () => NUDGE_RULES.find((r) => r.id === 'checkin_missed_3d')!;

// Se evalúa la regla de la bandeja como si fueran las 20:00 de cada uno de los próximos días sin que
// haya hecho nada: si hace el check-in antes, la app lo recalcula y el aviso desaparece.
export function checkinReminders(input: PhonePlanInput, days = PHONE_REMINDERS.days): PhoneReminder[] {
  const { ctx, prefs } = input;
  if (!input.sections.checkin) return [];
  const rule = checkinRule();
  const w = horizon(ctx.now, days);
  const out: PhoneReminder[] = [];
  for (let k = 0; k < days; k++) {
    const at = dayAt(ctx.now, k, PHONE_REMINDERS.checkinTime);
    if (!inWindow(at, w) || isMuted(prefs, rule.id, at)) continue;
    const check = rule.evaluate({ ...ctx, now: at });
    if (!check.due) continue;
    out.push(
      make({
        kind: 'checkin',
        reminderId: rule.id,
        at,
        title: check.title ?? t('How have you been?'),
        body: check.body ?? '',
        route: check.route ?? '/check-in',
      })
    );
  }
  return out;
}

// Máximo de avisos al día (contando lo que ya salió ese día) y tiempo mínimo entre dos iguales
export function applyDailyLimit(candidates: PhoneReminder[], log: NudgeLogEntry[]): PhoneReminder[] {
  const cooldown: Partial<Record<PhoneReminderKind, number>> = { checkin: checkinRule().cooldownDays };
  const perDay = new Map<string, number>();
  const lastSent = new Map<ReminderId, number>();
  for (const l of log) {
    const at = new Date(l.at);
    perDay.set(dayKey(at), (perDay.get(dayKey(at)) ?? 0) + 1);
    lastSent.set(l.id, Math.max(lastSent.get(l.id) ?? 0, at.getTime()));
  }
  const sorted = [...candidates].sort(
    (a, b) => startOfDay(a.at).getTime() - startOfDay(b.at).getTime() || PRIORITY.indexOf(a.kind) - PRIORITY.indexOf(b.kind)
  );
  const kept: PhoneReminder[] = [];
  for (const c of sorted) {
    const wait = cooldown[c.kind] ?? 0;
    const last = c.reminderId ? lastSent.get(c.reminderId) : undefined;
    if (wait && last !== undefined && Math.floor((c.at.getTime() - last) / DAY) < wait) continue;
    const k = dayKey(c.at);
    if ((perDay.get(k) ?? 0) >= MAX_NUDGES_PER_DAY) continue;
    perDay.set(k, (perDay.get(k) ?? 0) + 1);
    if (c.reminderId) lastSent.set(c.reminderId, c.at.getTime());
    kept.push(c);
  }
  return kept;
}

// Todo lo que debe quedar programado ahora, por orden de hora
export function planPhoneReminders(input: PhonePlanInput, days = PHONE_REMINDERS.days): PhoneReminder[] {
  const nudges = applyDailyLimit(
    [...temperatureReminders(input, days), ...weighInReminders(input, days), ...checkinReminders(input, days)],
    input.log
  );
  return [...doseReminders(input, days), ...nudges]
    .sort((a, b) => a.at.getTime() - b.at.getTime())
    .slice(0, PHONE_REMINDERS.maxPending);
}

// Qué cancelar y qué programar para pasar de lo que el sistema tiene a lo planeado. Solo toca los
// avisos de Kuova (los que empiezan por PHONE_ID_PREFIX).
export function diffPending(scheduledIds: string[], planned: PhoneReminder[]): { cancel: string[]; add: PhoneReminder[] } {
  const want = new Set(planned.map((p) => p.id));
  const have = new Set(scheduledIds.filter((id) => id.startsWith(PHONE_ID_PREFIX)));
  return { cancel: [...have].filter((id) => !want.has(id)), add: planned.filter((p) => !have.has(p.id)) };
}

// Lo que viaja dentro de la notificación: para abrir la pantalla y saber si ya está hecho
export interface PhoneReminderData {
  [key: string]: unknown;
  kind: PhoneReminderKind;
  at: string;
  route: string;
  medIds?: string[];
}

export const reminderData = (r: PhoneReminder): PhoneReminderData => ({
  kind: r.kind,
  at: r.at.toISOString(),
  route: r.route,
  ...(r.medIds ? { medIds: r.medIds } : {}),
});

// Avisos que ya están en la barra de notificaciones y ya están hechos (la toma marcada, la
// temperatura o el peso apuntados, el check-in hecho ese día o después): se quitan de la barra.
export function resolvedPresented(
  presented: { id: string; data?: Partial<PhoneReminderData> | null }[],
  state: { ctx: NudgeContext; weighIns: WeighIn[] }
): string[] {
  const { ctx } = state;
  const onOrAfter = (iso: string, day: Date) => new Date(iso).getTime() >= startOfDay(day).getTime();
  return presented
    .filter(({ id, data }) => {
      if (!id.startsWith(PHONE_ID_PREFIX) || !data?.kind || !data.at) return false;
      const at = new Date(data.at);
      if (Number.isNaN(at.getTime())) return false;
      if (data.kind === 'dose') {
        const ids = data.medIds ?? [];
        return (
          ids.length > 0 &&
          ids.every((medId) => (ctx.doses ?? []).some((l) => l.medId === medId && new Date(l.scheduledFor).getTime() === at.getTime()))
        );
      }
      if (data.kind === 'temperature') return ctx.temperatures.some((x) => x.source === 'manual' && onOrAfter(x.fecha, at));
      if (data.kind === 'weigh_in') return state.weighIns.some((e) => onOrAfter(e.fecha, at));
      if (data.kind === 'checkin') return ctx.checkIns.some((c) => onOrAfter(c.fecha, at));
      return false;
    })
    .map((p) => p.id);
}

// Historial de lo que ya saltó en el móvil (para el máximo diario y el tiempo entre avisos, también en
// la bandeja). `planned` es lo que se dejó programado la última vez: lo que ya pasó, saltó. Las tomas
// no cuentan. Se guardan 14 días.
export function mergeFiredLog(
  fired: NudgeLogEntry[],
  planned: { reminderId?: ReminderId; at: string }[],
  now: Date
): NudgeLogEntry[] {
  const out = [...fired];
  const seen = new Set(fired.map((f) => `${f.id}@${f.at}`));
  for (const p of planned) {
    if (!p.reminderId || new Date(p.at).getTime() > now.getTime()) continue;
    const key = `${p.reminderId}@${p.at}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ id: p.reminderId, at: p.at });
  }
  return out.filter((f) => now.getTime() - new Date(f.at).getTime() < 14 * DAY);
}

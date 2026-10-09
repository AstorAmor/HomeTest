import type { ScheduleEvent } from '@/data/schedule';
import { dateLocale, t } from '@/i18n';

// "Your summary" en Today: lo próximo de tu calendario, en este orden y sin nombrar categorías:
// 1. citas (laboratorio y profesionales), 2. logística (entrega y recogida del kit), 3. resultados
// (los esperados o los recién llegados; una vez abiertos ya no se repiten).

export interface SummaryAppointment {
  id: string;
  startsAt: string; // ISO
  label: string; // "Video consultation with Marta Ibáñez"
  canJoin: boolean;
}

export interface SummaryLine {
  id: string;
  kind: 'appointment' | 'logistics' | 'results';
  icon: string; // Ionicons
  text: string;
  when: string; // ISO o YYYY-MM-DD, para ordenar
  target: { pathname: string; params?: Record<string, string> };
  highlight?: boolean; // resultados nuevos sin abrir
}

const HORIZON_DAYS = 30;

const day = (iso: string) => new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
const dayText = (iso: string) => day(iso).toLocaleDateString(dateLocale(), { weekday: 'long', day: 'numeric', month: 'long' });
const timeText = (iso: string) => day(iso).toLocaleTimeString(dateLocale(), { hour: '2-digit', minute: '2-digit' });

export function buildSummary(input: {
  events: ScheduleEvent[];
  appointments: SummaryAppointment[];
  newResults: boolean; // hay un informe nuevo que aún no ha abierto
  now: Date;
}): SummaryLine[] {
  const { events, appointments, newResults, now } = input;
  const today = now.toISOString().slice(0, 10);
  const horizon = new Date(now.getTime() + HORIZON_DAYS * 86400000).toISOString().slice(0, 10);
  const soon = (d: string) => d >= today && d <= horizon;
  const lines: SummaryLine[] = [];

  // 1. Citas: laboratorio y profesionales, por fecha
  const appts: SummaryLine[] = [
    ...events
      .filter((e) => e.type === 'lab' && soon(e.date))
      .map((e) => ({
        id: e.id,
        kind: 'appointment' as const,
        icon: 'flask-outline',
        text: t('{what}, {day} at {time}', { what: t(e.title), day: dayText(e.date), time: e.start ?? '' }),
        when: `${e.date}T${e.start ?? '00:00'}`,
        target: { pathname: '/(tabs)', params: { tab: '2' } },
      })),
    ...appointments
      .filter((a) => soon(a.startsAt.slice(0, 10)) && new Date(a.startsAt).getTime() > now.getTime() - 3600000)
      .map((a) => ({
        id: a.id,
        kind: 'appointment' as const,
        icon: 'videocam-outline',
        text: t('{what}, {day} at {time}', { what: a.label, day: dayText(a.startsAt), time: timeText(a.startsAt) }),
        when: a.startsAt,
        target: (a.canJoin
          ? { pathname: '/video', params: { appt: a.id, title: a.label } }
          : { pathname: '/(tabs)', params: { tab: '2' } }) as SummaryLine['target'],
      })),
  ].sort((a, b) => a.when.localeCompare(b.when));
  lines.push(...appts.slice(0, 2));

  // 2. Logística: la próxima entrega o recogida del kit
  const logistics = events
    .filter((e) => (e.type === 'delivery' || e.type === 'pickup') && soon(e.date))
    .sort((a, b) => a.date.localeCompare(b.date))[0];
  if (logistics) {
    const name = logistics.title.split(':')[0];
    lines.push({
      id: logistics.id,
      kind: 'logistics',
      icon: logistics.type === 'delivery' ? 'cube-outline' : 'bicycle-outline',
      text:
        logistics.type === 'delivery'
          ? t('Your {name} kit arrives {day}', { name, day: dayText(logistics.date) })
          : t('The courier picks up your sample {day}, {from}–{to}', { day: dayText(logistics.date), from: logistics.start ?? '', to: logistics.end ?? '' }),
      when: logistics.date,
      target: { pathname: '/upcoming-analysis', params: { id: logistics.id.replace(/-(delivery|pickup)$/, '') } },
    });
  }

  // 3. Resultados: nuevos sin abrir (destacados) o los próximos esperados
  if (newResults) {
    lines.push({
      id: 'results-new',
      kind: 'results',
      icon: 'sparkles-outline',
      text: t('Your new results are here. Tap to see them and your plan'),
      when: today,
      target: { pathname: '/report-intro' },
      highlight: true,
    });
  } else {
    const next = events.filter((e) => e.type === 'results' && soon(e.date)).sort((a, b) => a.date.localeCompare(b.date))[0];
    if (next)
      lines.push({
        id: next.id,
        kind: 'results',
        icon: 'document-text-outline',
        text: t('Results for your {name} expected around {day}', { name: next.title.split(':')[0], day: dayText(next.date) }),
        when: next.date,
        target: { pathname: '/(tabs)', params: { tab: '3' } },
      });
  }
  return lines;
}

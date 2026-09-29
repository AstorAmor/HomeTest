import { mockUpcomingAnalyses } from './mockData';
import { currentReport } from './reportRepository';

// Agenda del paciente: se deriva de los análisis programados (DUMMY hasta que haya
// pedidos reales) + la próxima analítica de la membresía (6 meses tras la última).

export type ScheduleType = 'delivery' | 'sample' | 'pickup' | 'results' | 'membership' | 'lab';

export const SCHEDULE_COLORS: Record<ScheduleType, string> = {
  delivery: '#5AB8F0',
  sample: '#3ECDB8',
  pickup: '#9B8CFF',
  results: '#F0B84D',
  membership: '#F7B6D2',
  lab: '#FF8A65',
};

export interface ScheduleEvent {
  id: string;
  type: ScheduleType;
  date: string; // YYYY-MM-DD
  start?: string; // HH:MM (sin hora = todo el día)
  end?: string;
  title: string;
  detail: string;
}

const addDays = (iso: string, days: number) => {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

const addWorkingDays = (iso: string, days: number) => {
  const d = new Date(`${iso}T12:00:00`);
  let added = 0;
  while (added < days) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0 && d.getDay() !== 6) added++;
  }
  return d.toISOString().slice(0, 10);
};

export function buildSchedule(): ScheduleEvent[] {
  const events: ScheduleEvent[] = [];
  for (const a of mockUpcomingAnalyses) {
    const [start, end] = a.timeSlot.includes('–') ? a.timeSlot.split('–').map((t) => t.trim()) : [undefined, undefined];
    events.push({
      id: `${a.id}-delivery`,
      type: 'delivery',
      date: a.fecha,
      start,
      end,
      title: `${a.nombre}: kit delivery`,
      detail: `${a.sampleType}. ${a.preparation.join('. ')}.`,
    });
    events.push({
      id: `${a.id}-pickup`,
      type: 'pickup',
      date: addDays(a.fecha, 1),
      start: '09:00',
      end: '13:00',
      title: `${a.nombre}: sample pickup`,
      detail: 'Leave the sealed sample ready for the courier.',
    });
    events.push({
      id: `${a.id}-results`,
      type: 'results',
      date: addWorkingDays(a.fecha, 5),
      title: `${a.nombre}: results expected`,
      detail: 'You will get a notification when your report is ready in the app.',
    });
  }
  events.push({
    id: 'membership-followup',
    type: 'membership',
    date: addDays(currentReport.test_date, 182),
    title: '6-month follow-up blood test',
    detail: 'Included in your membership. We will send your kit a few days before.',
  });
  return events.sort((a, b) => (a.date + (a.start ?? '')).localeCompare(b.date + (b.start ?? '')));
}

// ---------------------------------------------------------------------------
// Añadir al calendario (Google / Outlook / Yahoo) con enlaces directos
// ---------------------------------------------------------------------------

const compact = (date: string, time?: string) =>
  time ? `${date.replace(/-/g, '')}T${time.replace(':', '')}00` : date.replace(/-/g, '');

export function calendarLinks(e: ScheduleEvent) {
  const title = encodeURIComponent(`HomeTest · ${e.title}`);
  const details = encodeURIComponent(e.detail);
  const allDay = !e.start;
  const endDate = allDay ? addDays(e.date, 1) : e.date;

  const google = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&details=${details}&dates=${compact(e.date, e.start)}/${compact(endDate, e.end ?? e.start)}&ctz=Europe/Madrid`;

  const outlookStart = allDay ? e.date : `${e.date}T${e.start}:00`;
  const outlookEnd = allDay ? endDate : `${e.date}T${e.end ?? e.start}:00`;
  const outlook = `https://outlook.live.com/calendar/0/deeplink/compose?path=/calendar/action/compose&rru=addevent&subject=${title}&body=${details}&startdt=${outlookStart}&enddt=${outlookEnd}${allDay ? '&allday=true' : ''}`;

  const yahoo = allDay
    ? `https://calendar.yahoo.com/?v=60&title=${title}&desc=${details}&st=${compact(e.date)}&dur=allday`
    : `https://calendar.yahoo.com/?v=60&title=${title}&desc=${details}&st=${compact(e.date, e.start)}&et=${compact(e.date, e.end ?? e.start)}`;

  return { google, outlook, yahoo };
}

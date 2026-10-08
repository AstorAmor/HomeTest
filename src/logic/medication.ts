import { DoseLog, MedicationItem, MedKind, MedSchedule, ScheduledDose } from '@/types/medication';

// Lógica de medicación y suplementos: entender lo que escribe el usuario ("Ibuprofeno 600 cada 8
// horas 3 días"), proponer la pauta habitual de lo más común y calcular las tomas de cada día.
// Lo que proponemos es orientativo: siempre manda la receta o el prospecto.

const DAY = 24 * 3600 * 1000;

export interface KnownMed {
  names: string[]; // en minúsculas, inglés y español
  label: string;
  kind: MedKind;
  schedule?: MedSchedule;
  shortCourseDays?: number; // duración típica si es un tratamiento puntual
  withFood?: MedicationItem['withFood'];
  tip: string;
}

export const KNOWN_MEDS: KnownMed[] = [
  { names: ['vitamin d', 'vitamina d', 'd3'], label: 'Vitamin D', kind: 'supplement', schedule: { type: 'times', times: ['09:00'] }, withFood: 'with', tip: 'Best with a meal that has some fat.' },
  { names: ['magnesium', 'magnesio'], label: 'Magnesium', kind: 'supplement', schedule: { type: 'times', times: ['21:30'] }, withFood: 'any', tip: 'Many people take it in the evening.' },
  { names: ['omega', 'fish oil', 'aceite de pescado'], label: 'Omega-3', kind: 'supplement', schedule: { type: 'times', times: ['13:30'] }, withFood: 'with', tip: 'With a meal it is absorbed better and repeats less.' },
  { names: ['iron', 'hierro', 'ferroso'], label: 'Iron', kind: 'supplement', schedule: { type: 'weekdays', days: [1, 3, 5], times: ['08:00'] }, withFood: 'empty', tip: 'Every other day absorbs as well as daily and upsets the stomach less. Not with coffee, tea or calcium.' },
  { names: ['b12', 'cobalamin', 'cianocobalamina'], label: 'Vitamin B12', kind: 'supplement', schedule: { type: 'times', times: ['09:00'] }, withFood: 'any', tip: 'Once a day is usual.' },
  { names: ['folic', 'fólico', 'folico', 'folato'], label: 'Folic acid', kind: 'supplement', schedule: { type: 'times', times: ['09:00'] }, withFood: 'any', tip: '400 µg a day is the usual dose before and during early pregnancy.' },
  { names: ['zinc'], label: 'Zinc', kind: 'supplement', schedule: { type: 'times', times: ['13:30'] }, withFood: 'with', tip: 'With food it upsets the stomach less.' },
  { names: ['creatine', 'creatina'], label: 'Creatine', kind: 'supplement', schedule: { type: 'times', times: ['09:00'] }, withFood: 'any', tip: '3–5 g a day, any time. It raises blood creatinine without harming the kidneys: tell your doctor before a blood test.' },
  { names: ['melatonin', 'melatonina'], label: 'Melatonin', kind: 'supplement', schedule: { type: 'times', times: ['22:30'] }, withFood: 'any', tip: '30–60 minutes before bed.' },
  { names: ['probiotic', 'probiótico', 'probiotico'], label: 'Probiotic', kind: 'supplement', schedule: { type: 'times', times: ['09:00'] }, withFood: 'any', tip: 'Once a day.' },
  { names: ['biotin', 'biotina'], label: 'Biotin', kind: 'supplement', schedule: { type: 'times', times: ['09:00'] }, withFood: 'any', tip: 'High doses can change some blood test results: stop it 2–3 days before a test.' },
  { names: ['levothyroxine', 'levotiroxina', 'eutirox', 'thyroxine'], label: 'Levothyroxine', kind: 'medication', schedule: { type: 'times', times: ['07:30'] }, withFood: 'empty', tip: 'On an empty stomach, 30–60 minutes before breakfast.' },
  { names: ['metformin', 'metformina'], label: 'Metformin', kind: 'medication', schedule: { type: 'times', times: ['08:30', '20:30'] }, withFood: 'with', tip: 'With meals.' },
  { names: ['contracept', 'anticonceptiv', 'the pill', 'píldora', 'pildora'], label: 'Contraceptive pill', kind: 'medication', schedule: { type: 'times', times: ['22:00'] }, withFood: 'any', tip: 'Same time every day.' },
  { names: ['amoxicillin', 'amoxicilina'], label: 'Amoxicillin', kind: 'medication', schedule: { type: 'every_hours', hours: 8, firstTime: '07:00' }, shortCourseDays: 7, withFood: 'any', tip: 'Antibiotics: finish the course your doctor prescribed, even if you feel better.' },
  { names: ['azithromycin', 'azitromicina'], label: 'Azithromycin', kind: 'medication', schedule: { type: 'times', times: ['09:00'] }, shortCourseDays: 3, withFood: 'any', tip: 'Often a 3-day course. Follow your prescription.' },
  { names: ['ibuprofen', 'ibuprofeno'], label: 'Ibuprofen', kind: 'medication', schedule: { type: 'every_hours', hours: 8, firstTime: '07:00' }, shortCourseDays: 3, withFood: 'with', tip: 'With food. Without medical advice, no more than 3 days for fever or 5 for pain.' },
  { names: ['paracetamol', 'acetaminophen'], label: 'Paracetamol', kind: 'medication', schedule: { type: 'every_hours', hours: 8, firstTime: '07:00' }, shortCourseDays: 3, withFood: 'any', tip: 'Leave at least 4–6 hours between doses and do not exceed the daily maximum on the leaflet.' },
  { names: ['omeprazole', 'omeprazol'], label: 'Omeprazole', kind: 'medication', schedule: { type: 'times', times: ['08:00'] }, shortCourseDays: 14, withFood: 'empty', tip: 'Before breakfast. Long-term use can lower vitamin B12: worth checking in your blood test.' },
];

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export function findKnownMed(text: string): KnownMed | null {
  const t = norm(text);
  return KNOWN_MEDS.find((m) => m.names.some((n) => t.includes(norm(n)))) ?? null;
}

export const defaultTimes = (perDay: number): string[] =>
  perDay <= 1 ? ['09:00'] : perDay === 2 ? ['08:00', '20:00'] : perDay === 3 ? ['08:00', '14:00', '20:00'] : ['08:00', '12:00', '16:00', '20:00'];

const WORD_NUMBERS: Record<string, number> = {
  one: 1, once: 1, una: 1, un: 1, uno: 1,
  two: 2, twice: 2, dos: 2,
  three: 3, tres: 3,
  four: 4, cuatro: 4,
  five: 5, cinco: 5,
  seven: 7, siete: 7,
  ten: 10, diez: 10,
  fourteen: 14, catorce: 14,
};
const num = (s: string) => (/^\d+$/.test(s) ? Number(s) : WORD_NUMBERS[s] ?? null);

export interface ParsedMed {
  name?: string;
  dose?: string;
  schedule?: MedSchedule;
  courseDays?: number;
}

// Entiende frases sencillas en inglés o español: "Amoxicilina 500 mg cada 8 horas durante 7
// días", "vitamin D 1000 IU once a day", "ibuprofeno 600 dos veces al día 3 días".
export function parseMedicationText(text: string): ParsedMed {
  const t = ` ${norm(text)} `;
  const out: ParsedMed = {};

  const dose = text.match(/(\d+(?:[.,]\d+)?)\s?(mg|g|mcg|µg|ug|ui|iu|ml|gotas|drops|comprimidos?|tablets?|capsules?|capsulas?|cápsulas?)\b/i);
  if (dose) out.dose = `${dose[1].replace(',', '.')} ${dose[2].toLowerCase().replace('ui', 'IU').replace('iu', 'IU')}`;

  const every = t.match(/(?:cada|every)\s+(\d+)\s*(?:h\b|hours?|horas?)/);
  if (every) out.schedule = { type: 'every_hours', hours: Number(every[1]), firstTime: '07:00' };

  const perDay = t.match(/\b(\d+|once|twice|one|two|three|four|una|dos|tres|cuatro)\s*(?:times?|veces?|vez)?\s*(?:a|per|al|por)\s*(?:day|dia)\b/);
  if (!out.schedule && perDay) {
    const n = num(perDay[1]);
    if (n) out.schedule = { type: 'times', times: defaultTimes(n) };
  }
  if (!out.schedule && /\b(?:once daily|daily|diario|diaria|cada dia|every day)\b/.test(t)) {
    out.schedule = { type: 'times', times: defaultTimes(1) };
  }
  if (!out.schedule && /\b(?:as needed|when needed|si dolor|si lo necesito|a demanda|cuando lo necesite)\b/.test(t)) {
    out.schedule = { type: 'as_needed' };
  }
  if (out.schedule?.type === 'times' && out.schedule.times.length === 1) {
    if (/\b(?:noche|night|bedtime|antes de dormir|evening)\b/.test(t)) out.schedule = { type: 'times', times: ['21:30'] };
    else if (/\b(?:manana|morning|desayuno|breakfast)\b/.test(t)) out.schedule = { type: 'times', times: ['08:00'] };
  }

  const days = t.match(/(?:for|durante)?\s*(\d+|three|five|seven|ten|fourteen|tres|cinco|siete|diez|catorce)\s*(?:days?|dias?)\b/);
  if (days) out.courseDays = num(days[1]) ?? undefined;
  else if (/\b(?:a week|one week|una semana)\b/.test(t)) out.courseDays = 7;
  else if (/\b(?:two weeks|dos semanas)\b/.test(t)) out.courseDays = 14;

  // Nombre: lo que va antes del primer número o palabra de pauta
  const cut = text.search(/\d|\b(?:cada|every|once|twice|una vez|dos veces|tres veces|durante|for|por la|at night|daily)\b/i);
  const name = (cut > 0 ? text.slice(0, cut) : text).trim().replace(/[,;.-]+$/, '');
  if (name) out.name = name.charAt(0).toUpperCase() + name.slice(1);
  return out;
}

const dayStart = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};
const at = (day: Date, hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  const x = dayStart(day);
  x.setHours(h, m || 0, 0, 0);
  return x;
};

export function courseEnd(item: MedicationItem): Date | null {
  if (item.course.type !== 'short') return null;
  return new Date(dayStart(new Date(item.course.startDate)).getTime() + item.course.days * DAY);
}

export function isActiveOn(item: MedicationItem, day: Date): boolean {
  const start = item.course.type === 'short' ? dayStart(new Date(item.course.startDate)) : dayStart(new Date(item.createdAt));
  if (dayStart(day) < start) return false;
  if (item.stoppedAt && dayStart(day) > dayStart(new Date(item.stoppedAt))) return false;
  const end = courseEnd(item);
  return !end || dayStart(day) < end;
}

export function courseProgress(item: MedicationItem, now = new Date()): { day: number; total: number } | null {
  if (item.course.type !== 'short') return null;
  const day = Math.floor((dayStart(now).getTime() - dayStart(new Date(item.course.startDate)).getTime()) / DAY) + 1;
  return { day: Math.min(Math.max(day, 1), item.course.days), total: item.course.days };
}

// Tomas programadas de un día, con lo ya marcado (tomada u omitida)
export function dosesForDay(items: MedicationItem[], day: Date, logs: DoseLog[]): ScheduledDose[] {
  const out: ScheduledDose[] = [];
  for (const item of items) {
    if (!isActiveOn(item, day)) continue;
    const s = item.schedule;
    let times: Date[] = [];
    if (s.type === 'times') times = s.times.map((t) => at(day, t));
    else if (s.type === 'weekdays') times = s.days.includes(day.getDay()) ? s.times.map((t) => at(day, t)) : [];
    else if (s.type === 'every_hours') {
      // Cada N horas en un ciclo de 24 h desde la primera toma (cada 8 h desde las 07:00 → 07, 15, 23)
      const [h, m] = s.firstTime.split(':').map(Number);
      const perDay = Math.max(1, Math.floor(24 / s.hours));
      times = Array.from({ length: perDay }, (_, k) => {
        const hour = (h + k * s.hours) % 24;
        return at(day, `${String(hour).padStart(2, '0')}:${String(m || 0).padStart(2, '0')}`);
      });
    }
    for (const time of times) {
      out.push({
        medId: item.id,
        name: item.name,
        dose: item.dose,
        at: time,
        log: logs.find((l) => l.medId === item.id && new Date(l.scheduledFor).getTime() === time.getTime()),
      });
    }
  }
  return out.sort((a, b) => a.at.getTime() - b.at.getTime());
}

export function scheduleText(s: MedSchedule): string {
  if (s.type === 'as_needed') return 'Only when needed';
  if (s.type === 'every_hours') return `Every ${s.hours} hours from ${s.firstTime}`;
  if (s.type === 'weekdays') {
    const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return `${s.days.map((d) => names[d]).join(', ')} at ${s.times.join(', ')}`;
  }
  return s.times.length === 1 ? `Every day at ${s.times[0]}` : `Every day at ${s.times.join(', ')}`;
}

export const MUTED_FOREVER = '9999-12-31T00:00:00.000Z';

export const isReminderMuted = (item: MedicationItem, now = new Date()) =>
  !!item.remindersMutedUntil && new Date(item.remindersMutedUntil) > now;

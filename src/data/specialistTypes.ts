// Tipos compartidos por el portal del especialista y por la parte del paciente
// (citas, solicitudes, chat, notas clínicas, disponibilidad).

export type AppointmentKind = 'first' | 'follow_up' | 'results_review';
export type AppointmentModality = 'video' | 'voice';
export type AppointmentStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled';

export interface Appointment {
  id: string;
  professionalId: string;
  professionalName?: string;
  patientId: string;
  patientName: string;
  startsAt: string; // ISO
  durationMin: number;
  kind: AppointmentKind;
  modality: AppointmentModality;
  status: AppointmentStatus;
  reason?: string | null;
  videoRoomUrl?: string | null;
  createdAt?: string; // cuándo lo pidió el paciente (orden FIFO de las solicitudes)
}

export type RequestKind = 'question' | 'results_review' | 'video_call' | 'async_video';

export interface ConsultRequest {
  id: string;
  patientId: string;
  patientName: string;
  professionalId: string;
  professionalName?: string;
  kind: RequestKind;
  message: string;
  status: 'open' | 'answered' | 'closed';
  response: string | null;
  createdAt: string;
  answeredAt: string | null;
  audioPath?: string | null; // nota de voz (ruta en Storage, o uri local en demo)
}

export interface Conversation {
  id: string;
  patientId: string;
  patientName: string;
  professionalId: string;
  professionalName?: string;
  lastMessageAt: string | null;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  createdAt: string;
  readAt: string | null;
}

export interface ClinicalNote {
  id: string;
  patientId: string;
  appointmentId: string | null;
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  createdAt: string;
  updatedAt: string;
}

export type Weekday = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
export const WEEKDAYS: Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
export const WEEKDAY_LABEL: Record<Weekday, string> = {
  mon: 'Mon',
  tue: 'Tue',
  wed: 'Wed',
  thu: 'Thu',
  fri: 'Fri',
  sat: 'Sat',
  sun: 'Sun',
};

export interface TimeRange {
  start: string; // HH:MM
  end: string;
}

export interface Availability {
  weekly: Record<Weekday, TimeRange[]>;
  slotMinutes: number;
  bufferMinutes: number;
  calendarProvider: 'none' | 'google' | 'outlook';
}

export const DEFAULT_AVAILABILITY: Availability = {
  weekly: {
    mon: [{ start: '09:00', end: '14:00' }],
    tue: [{ start: '09:00', end: '14:00' }, { start: '16:00', end: '19:00' }],
    wed: [{ start: '09:00', end: '14:00' }],
    thu: [{ start: '09:00', end: '14:00' }, { start: '16:00', end: '19:00' }],
    fri: [{ start: '09:00', end: '13:00' }],
    sat: [],
    sun: [],
  },
  slotMinutes: 30,
  bufferMinutes: 5,
  calendarProvider: 'none',
};

export interface PatientSummary {
  id: string;
  name: string;
  scopes: string[];
  openRequests: number;
  unreadMessages: number;
  nextAppointment: string | null;
  appointmentToday: boolean;
  flaggedMarkers: number; // valores alterados en su última analítica compartida
  age?: number | null;
  sex?: string | null;
  goals?: string[];
}

export interface PatientMarker {
  id: string;
  name: string;
  value: number | string;
  unit: string;
  low: number | null;
  high: number | null;
  status: 'low' | 'in' | 'high';
}

export interface PatientLabResult {
  title: string;
  date: string | null;
  lab: string;
  markers: PatientMarker[];
}

export const KIND_LABEL: Record<AppointmentKind, string> = {
  first: 'First visit',
  follow_up: 'Follow-up',
  results_review: 'Results review',
};

export const REQUEST_KIND_LABEL: Record<RequestKind, string> = {
  question: 'Question',
  results_review: 'Review my results',
  video_call: 'Video consultation',
  async_video: 'Video explanation',
};

const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const dayKey = (d: Date): Weekday => WEEKDAYS[(d.getDay() + 6) % 7];

// Huecos libres (ISO) de los próximos `days` días según la disponibilidad, quitando
// los ocupados y respetando el margen entre citas. Nunca antes de dentro de 2 horas.
export function freeSlots(av: Availability, busy: { start: string; end: string }[], days = 10, now = new Date()): string[] {
  const out: string[] = [];
  const earliest = now.getTime() + 2 * 3600 * 1000;
  const busyMs = busy.map((b) => [new Date(b.start).getTime(), new Date(b.end).getTime()]);
  const step = av.slotMinutes + av.bufferMinutes;
  for (let i = 0; i < days; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    for (const r of av.weekly[dayKey(d)] ?? []) {
      for (let m = toMin(r.start); m + av.slotMinutes <= toMin(r.end); m += step) {
        const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), Math.floor(m / 60), m % 60).getTime();
        const end = start + av.slotMinutes * 60000;
        if (start < earliest) continue;
        if (busyMs.some(([bs, be]) => start < be + av.bufferMinutes * 60000 && end + av.bufferMinutes * 60000 > bs)) continue;
        out.push(new Date(start).toISOString());
      }
    }
  }
  return out;
}

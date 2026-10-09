import AsyncStorage from '@react-native-async-storage/async-storage';
import { getCurrentUserId, isRemoteActive, supabase } from '@/lib/supabase';
import { currentReport } from './reportRepository';
import { getMarkerDisplayNameEn } from './reportContentEn';
import { markerIdForExtractedName } from './markerMatching';
import { PlanVersionItem } from './planVersions';
import {
  Appointment,
  AppointmentKind,
  AppointmentModality,
  Availability,
  ClinicalNote,
  ConsultRequest,
  Conversation,
  DEFAULT_AVAILABILITY,
  PatientLabResult,
  PatientMarker,
  PatientSummary,
} from './specialistTypes';

// Datos del portal del especialista. Con cuenta de especialista: Supabase (RLS decide
// qué ve). En modo demo: pacientes, citas, solicitudes y notas de ejemplo guardados en
// el móvil, para enseñar el portal sin cuentas reales.

// Demo si no hay cuenta o si se eligió "Specialist portal" en el selector de desarrollo.
let forcedDemo = false;
export const setPortalDemo = (v: boolean) => {
  forcedDemo = v;
};
export const isPortalDemo = () => forcedDemo || !isRemoteActive();

const fail = (error: { message: string } | null) => {
  if (error) throw new Error(error.message);
};

// ---------------------------------------------------------------------------
// Demo
// ---------------------------------------------------------------------------
const DEMO_KEY = 'proDemo.v1';
const DEMO_PRO = 'demo-pro';

interface DemoState {
  seededOn: string; // fecha del sembrado: cada día se renuevan citas y solicitudes de ejemplo
  appointments: Appointment[];
  requests: ConsultRequest[];
  notes: ClinicalNote[];
  conversations: Conversation[];
  availability: Availability;
  plans: { patientId: string; items: PlanVersionItem[]; note: string; createdAt: string }[];
  privateData: { personalPhone: string; personalEmail: string };
}

const at = (dayOffset: number, h: number, m = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
};

// Hoy, redondeado a la media hora siguiente + `hours` (para que siempre haya citas por venir).
const soon = (hours: number) => {
  const d = new Date(Date.now() + hours * 3600000);
  d.setMinutes(d.getMinutes() < 30 ? 30 : 60, 0, 0);
  return d.toISOString();
};

const DEMO_PATIENTS: (PatientSummary & { labFromReport?: boolean })[] = [
  { id: 'p-laura', name: 'Laura Martín', scopes: ['profile', 'lab_reports', 'wearables', 'cycle'], openRequests: 0, unreadMessages: 1, nextAppointment: null, appointmentToday: false, flaggedMarkers: 0, age: 38, sex: 'Female', goals: ['More energy', 'Sleep better'], labFromReport: true },
  { id: 'p-carlos', name: 'Carlos Ruiz', scopes: ['profile', 'lab_reports', 'glucose', 'blood_pressure'], openRequests: 1, unreadMessages: 0, nextAppointment: null, appointmentToday: false, flaggedMarkers: 3, age: 52, sex: 'Male', goals: ['Keep a condition under control'] },
  { id: 'p-elena', name: 'Elena Gómez', scopes: ['profile', 'lab_reports'], openRequests: 0, unreadMessages: 0, nextAppointment: null, appointmentToday: false, flaggedMarkers: 0, age: 29, sex: 'Female', goals: ['Perform better in sport'] },
  { id: 'p-javier', name: 'Javier Soto', scopes: ['lab_reports'], openRequests: 1, unreadMessages: 0, nextAppointment: null, appointmentToday: false, flaggedMarkers: 2, age: 45, sex: 'Male', goals: ['Lose weight'] },
];

function demoSeed(): DemoState {
  const now = new Date().toISOString();
  return {
    seededOn: new Date().toDateString(),
    appointments: [
      { id: 'a1', professionalId: DEMO_PRO, patientId: 'p-laura', patientName: 'Laura Martín', startsAt: soon(0.25), durationMin: 30, kind: 'results_review', modality: 'video', status: 'confirmed', reason: 'Go through my September results' },
      { id: 'a2', professionalId: DEMO_PRO, patientId: 'p-carlos', patientName: 'Carlos Ruiz', startsAt: soon(2), durationMin: 15, kind: 'follow_up', modality: 'voice', status: 'confirmed', reason: 'Blood pressure follow-up' },
      { id: 'a3', professionalId: DEMO_PRO, patientId: 'p-elena', patientName: 'Elena Gómez', startsAt: at(1, 9, 30), durationMin: 30, kind: 'first', modality: 'video', status: 'pending', reason: 'Training and iron', createdAt: at(-1, 18, 12) },
      { id: 'a4', professionalId: DEMO_PRO, patientId: 'p-javier', patientName: 'Javier Soto', startsAt: at(3, 17, 0), durationMin: 30, kind: 'results_review', modality: 'video', status: 'pending', reason: 'High cholesterol', createdAt: at(-1, 21, 3) },
      { id: 'a5', professionalId: DEMO_PRO, patientId: 'p-laura', patientName: 'Laura Martín', startsAt: at(-14, 11, 0), durationMin: 30, kind: 'first', modality: 'video', status: 'completed' },
    ],
    requests: [
      { id: 'r1', patientId: 'p-carlos', patientName: 'Carlos Ruiz', professionalId: DEMO_PRO, kind: 'question', message: 'My blood pressure was 145/92 this morning. Should I be worried before our call?', status: 'open', response: null, createdAt: at(0, 8, 5), answeredAt: null },
      { id: 'r2', patientId: 'p-javier', patientName: 'Javier Soto', professionalId: DEMO_PRO, kind: 'results_review', message: 'Could you look at my LDL and triglycerides? I uploaded my last test.', status: 'open', response: null, createdAt: at(-1, 19, 40), answeredAt: null },
      { id: 'r3', patientId: 'p-laura', patientName: 'Laura Martín', professionalId: DEMO_PRO, kind: 'question', message: 'Can I take iron and vitamin D together?', status: 'answered', response: 'Yes, but take iron on an empty stomach with some vitamin C, and vitamin D with a meal.', createdAt: at(-5, 9, 0), answeredAt: at(-5, 13, 0) },
      { id: 'r4', patientId: 'p-elena', patientName: 'Elena Gómez', professionalId: DEMO_PRO, kind: 'question', message: 'Since I started training for a half marathon my period comes every 38–40 days. Is that normal? Could it be related to my iron?', status: 'open', response: null, createdAt: at(0, 7, 20), answeredAt: null },
      { id: 'r5', patientId: 'p-laura', patientName: 'Laura Martín', professionalId: DEMO_PRO, kind: 'question', message: "I've been really tired for a month even though I sleep 7 hours. My ferritin was 24 in March. Should I repeat the test?", status: 'open', response: null, createdAt: at(-1, 22, 15), answeredAt: null },
    ],
    notes: [
      { id: 'n1', patientId: 'p-laura', appointmentId: 'a5', subjective: 'Tired in the afternoons, sleeps ~6 h.', objective: 'Ferritin 24 ng/mL, vitamin D 18 ng/mL (March).', assessment: 'Low iron stores and vitamin D deficiency.', plan: 'Iron-rich diet + vitamin C, vitamin D 2000 IU/day, retest in 6 months.', createdAt: at(-14, 11, 40), updatedAt: at(-14, 11, 40) },
    ],
    conversations: [
      { id: 'demo-conv-p-laura', patientId: 'p-laura', patientName: 'Laura Martín', professionalId: DEMO_PRO, lastMessageAt: now },
    ],
    availability: DEFAULT_AVAILABILITY,
    plans: [],
    privateData: { personalPhone: '', personalEmail: '' },
  };
}

let demoCache: DemoState | null = null;
let chatSeeded = false;
async function demo(): Promise<DemoState> {
  if (demoCache) return demoCache;
  try {
    const raw = await AsyncStorage.getItem(DEMO_KEY);
    const stored: DemoState | null = raw ? JSON.parse(raw) : null;
    const fresh = demoSeed();
    // Otro día: citas y solicitudes nuevas relativas a hoy; se conservan notas y planes.
    demoCache = stored && stored.seededOn === fresh.seededOn ? stored : { ...fresh, notes: stored?.notes ?? fresh.notes, plans: stored?.plans ?? [], availability: stored?.availability ?? fresh.availability, privateData: stored?.privateData ?? fresh.privateData };
    // Solicitudes de ejemplo añadidas después de guardar el estado de hoy: aparecen igualmente
    for (const r of fresh.requests) if (!demoCache.requests.some((x) => x.id === r.id)) demoCache.requests.push(r);
  } catch {
    demoCache = demoSeed();
  }
  if (!chatSeeded) {
    chatSeeded = true;
    // Primer mensaje de ejemplo en el chat de Laura
    const key = 'chat.v1:demo-conv-p-laura';
    if (!(await AsyncStorage.getItem(key).catch(() => null))) {
      await AsyncStorage.setItem(
        key,
        JSON.stringify([
          { id: 'm0', conversationId: 'demo-conv-p-laura', senderId: 'demo-other', body: 'Hi! I have my results review with you today. Should I be fasting?', createdAt: at(0, 7, 50), readAt: null },
        ]),
      ).catch(() => undefined);
    }
  }
  return demoCache!;
}
async function saveDemo() {
  if (demoCache) await AsyncStorage.setItem(DEMO_KEY, JSON.stringify(demoCache)).catch(() => undefined);
}

function reportMarkers(): PatientMarker[] {
  const out: PatientMarker[] = [];
  for (const s of currentReport.sections)
    for (const m of s.markers) {
      const low = m.range.low;
      const high = m.range.high;
      const v = typeof m.value === 'number' ? m.value : NaN;
      out.push({
        id: m.marker_id,
        name: getMarkerDisplayNameEn(m.marker_id, m.display_name),
        value: m.value,
        unit: m.unit === 'índice' ? 'index' : m.unit ?? '',
        low,
        high,
        status: low !== null && v < low ? 'low' : high !== null && v > high ? 'high' : 'in',
      });
    }
  return out;
}

const demoLab = (patientId: string): PatientLabResult | null => {
  const p = DEMO_PATIENTS.find((x) => x.id === patientId);
  if (!p) return null;
  const all = reportMarkers();
  // Cada paciente de ejemplo con valores algo distintos: basta con el mismo informe
  // para Laura y un subconjunto para el resto.
  const markers = p.labFromReport ? all : all.filter((_, i) => i % 3 === 0);
  return { title: 'Blood analysis', date: currentReport.test_date, lab: p.labFromReport ? 'Eurofins Megalab' : 'User upload · Synlab', markers };
};

// ---------------------------------------------------------------------------
// Supabase
// ---------------------------------------------------------------------------
const toAppointment = (r: any): Appointment => ({
  id: r.id,
  professionalId: r.professional_id,
  patientId: r.patient_id,
  patientName: r.patient_name ?? 'Patient',
  startsAt: r.starts_at,
  durationMin: r.duration_min,
  kind: r.kind,
  modality: r.modality,
  status: r.status,
  reason: r.reason,
  videoRoomUrl: r.video_room_url,
  createdAt: r.created_at,
});

const toRequest = (r: any): ConsultRequest => ({
  id: r.id,
  patientId: r.patient_id,
  patientName: r.patient_name ?? 'Patient',
  professionalId: r.professional_id,
  kind: r.kind,
  message: r.message,
  status: r.status,
  response: r.response,
  createdAt: r.created_at,
  answeredAt: r.answered_at,
  audioPath: r.audio_path ?? null,
});

const toNote = (r: any): ClinicalNote => ({
  id: r.id,
  patientId: r.patient_id,
  appointmentId: r.appointment_id,
  subjective: r.subjective ?? '',
  objective: r.objective ?? '',
  assessment: r.assessment ?? '',
  plan: r.plan ?? '',
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const toConversation = (r: any): Conversation => ({
  id: r.id,
  patientId: r.patient_id,
  patientName: r.patient_name ?? 'Patient',
  professionalId: r.professional_id,
  lastMessageAt: r.last_message_at,
});

const WEEK_DEFAULT = DEFAULT_AVAILABILITY;

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------
export const portal = {
  myId: () => (isPortalDemo() ? DEMO_PRO : getCurrentUserId() ?? DEMO_PRO),

  async listAppointments(fromISO: string, toISO: string): Promise<Appointment[]> {
    if (isPortalDemo()) {
      return (await demo()).appointments
        .filter((a) => a.startsAt >= fromISO && a.startsAt < toISO)
        .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    }
    const { data, error } = await supabase!
      .from('appointments')
      .select('*')
      .eq('professional_id', getCurrentUserId())
      .gte('starts_at', fromISO)
      .lt('starts_at', toISO)
      .order('starts_at');
    fail(error);
    return (data ?? []).map(toAppointment);
  },

  // Solicitudes de cita pendientes (futuras), la más antigua primero (FIFO).
  async pendingRequests(): Promise<Appointment[]> {
    const nowIso = new Date().toISOString();
    if (isPortalDemo()) {
      return (await demo()).appointments
        .filter((a) => a.status === 'pending' && a.startsAt > nowIso)
        .sort((a, b) => (a.createdAt ?? a.startsAt).localeCompare(b.createdAt ?? b.startsAt));
    }
    const { data, error } = await supabase!
      .from('appointments')
      .select('*')
      .eq('professional_id', getCurrentUserId())
      .eq('status', 'pending')
      .gt('starts_at', nowIso)
      .order('created_at', { ascending: true });
    fail(error);
    return (data ?? []).map(toAppointment);
  },

  async updateAppointment(id: string, patch: Partial<Pick<Appointment, 'status' | 'videoRoomUrl'>>) {
    if (isPortalDemo()) {
      const s = await demo();
      s.appointments = s.appointments.map((a) => (a.id === id ? { ...a, ...patch } : a));
      return saveDemo();
    }
    const row: Record<string, unknown> = {};
    if (patch.status) row.status = patch.status;
    if (patch.videoRoomUrl !== undefined) row.video_room_url = patch.videoRoomUrl;
    const { error } = await supabase!.from('appointments').update(row).eq('id', id);
    fail(error);
  },

  async scheduleFollowUp(patientId: string, patientName: string, startsAt: string, kind: AppointmentKind, modality: AppointmentModality, durationMin = 30): Promise<string> {
    if (isPortalDemo()) {
      const s = await demo();
      const id = `a-${Date.now()}`;
      s.appointments.push({ id, professionalId: DEMO_PRO, patientId, patientName, startsAt, durationMin, kind, modality, status: 'confirmed' });
      await saveDemo();
      return id;
    }
    const { data, error } = await supabase!.from('appointments').insert({
      professional_id: getCurrentUserId(),
      patient_id: patientId,
      patient_name: patientName,
      starts_at: startsAt,
      duration_min: durationMin,
      kind,
      modality,
      status: 'confirmed',
    }).select('id').single();
    fail(error);
    return data!.id as string;
  },

  async listPatients(): Promise<PatientSummary[]> {
    if (isPortalDemo()) {
      const s = await demo();
      const today = new Date().toDateString();
      return DEMO_PATIENTS.map(({ labFromReport, ...p }) => {
        const upcoming = s.appointments
          .filter((a) => a.patientId === p.id && (a.status === 'pending' || a.status === 'confirmed') && new Date(a.startsAt).getTime() > Date.now() - 3600000)
          .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
        const lab = demoLab(p.id);
        return {
          ...p,
          openRequests: s.requests.filter((r) => r.patientId === p.id && r.status === 'open').length,
          nextAppointment: upcoming[0]?.startsAt ?? null,
          appointmentToday: upcoming.some((a) => new Date(a.startsAt).toDateString() === today),
          flaggedMarkers: lab ? lab.markers.filter((m) => m.status !== 'in').length : 0,
        };
      });
    }
    const { data, error } = await supabase!.rpc('pro_patients');
    fail(error);
    return (data ?? []).map((r: any) => ({
      id: r.patient_id,
      name: r.patient_name,
      scopes: r.scopes ?? [],
      openRequests: r.open_requests,
      unreadMessages: r.unread_messages,
      nextAppointment: r.next_appointment,
      appointmentToday: r.appointment_today,
      flaggedMarkers: 0, // se calcula al abrir su analítica compartida
    }));
  },

  async patientLab(patientId: string): Promise<PatientLabResult | null> {
    if (isPortalDemo()) return demoLab(patientId);
    // Última analítica subida y compartida (RLS: solo con permiso "lab_reports" activo)
    const { data, error } = await supabase!
      .from('lab_uploads')
      .select('lab_name, test_date, data, created_at')
      .eq('user_id', patientId)
      .order('created_at', { ascending: false })
      .limit(1);
    fail(error);
    const u = data?.[0];
    if (!u) return null;
    const markers: PatientMarker[] = [];
    for (const sec of u.data?.secciones ?? [])
      for (const p of sec.parametros ?? []) {
        if (typeof p.valor !== 'number') continue;
        const id = markerIdForExtractedName(p.nombre) ?? p.nombre;
        markers.push({
          id,
          name: getMarkerDisplayNameEn(id, p.nombre),
          value: p.valor,
          unit: p.unidad,
          low: p.rango_min,
          high: p.rango_max,
          status: p.rango_min !== null && p.valor < p.rango_min ? 'low' : p.rango_max !== null && p.valor > p.rango_max ? 'high' : 'in',
        });
      }
    return { title: 'Uploaded analysis', date: u.test_date, lab: `User upload${u.lab_name ? ` · ${u.lab_name}` : ''}`, markers };
  },

  async listRequests(patientId?: string): Promise<ConsultRequest[]> {
    if (isPortalDemo()) {
      const all = (await demo()).requests;
      return (patientId ? all.filter((r) => r.patientId === patientId) : all).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }
    let q = supabase!.from('consultation_requests').select('*').eq('professional_id', getCurrentUserId());
    if (patientId) q = q.eq('patient_id', patientId);
    const { data, error } = await q.order('created_at', { ascending: false });
    fail(error);
    return (data ?? []).map(toRequest);
  },

  async answerRequest(id: string, response: string) {
    if (isPortalDemo()) {
      const s = await demo();
      s.requests = s.requests.map((r) => (r.id === id ? { ...r, response, status: 'answered', answeredAt: new Date().toISOString() } : r));
      return saveDemo();
    }
    const { error } = await supabase!.from('consultation_requests').update({ response, status: 'answered' }).eq('id', id);
    fail(error);
  },

  async listNotes(patientId: string): Promise<ClinicalNote[]> {
    if (isPortalDemo()) {
      return (await demo()).notes.filter((n) => n.patientId === patientId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }
    const { data, error } = await supabase!
      .from('clinical_notes')
      .select('*')
      .eq('professional_id', getCurrentUserId())
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false });
    fail(error);
    return (data ?? []).map(toNote);
  },

  // Crea o actualiza (si trae id) una nota SOAP.
  async saveNote(note: Partial<ClinicalNote> & { patientId: string }): Promise<ClinicalNote> {
    const now = new Date().toISOString();
    if (isPortalDemo()) {
      const s = await demo();
      const existing = note.id ? s.notes.find((n) => n.id === note.id) : undefined;
      const saved: ClinicalNote = {
        id: existing?.id ?? `n-${Date.now()}`,
        patientId: note.patientId,
        appointmentId: note.appointmentId ?? existing?.appointmentId ?? null,
        subjective: note.subjective ?? existing?.subjective ?? '',
        objective: note.objective ?? existing?.objective ?? '',
        assessment: note.assessment ?? existing?.assessment ?? '',
        plan: note.plan ?? existing?.plan ?? '',
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };
      s.notes = [saved, ...s.notes.filter((n) => n.id !== saved.id)];
      await saveDemo();
      return saved;
    }
    const row = {
      patient_id: note.patientId,
      appointment_id: note.appointmentId ?? null,
      subjective: note.subjective ?? '',
      objective: note.objective ?? '',
      assessment: note.assessment ?? '',
      plan: note.plan ?? '',
    };
    const q = note.id
      ? supabase!.from('clinical_notes').update(row).eq('id', note.id).select('*').single()
      : supabase!.from('clinical_notes').insert(row).select('*').single();
    const { data, error } = await q;
    fail(error);
    return toNote(data);
  },

  async listConversations(): Promise<Conversation[]> {
    if (isPortalDemo()) return (await demo()).conversations;
    const { data, error } = await supabase!
      .from('conversations')
      .select('*')
      .eq('professional_id', getCurrentUserId())
      .order('last_message_at', { ascending: false, nullsFirst: false });
    fail(error);
    return (data ?? []).map(toConversation);
  },

  // Conversación con un paciente (la abre si no existe; requiere chat habilitado).
  async conversationWith(patientId: string, patientName: string): Promise<string> {
    if (isPortalDemo()) {
      const s = await demo();
      const found = s.conversations.find((c) => c.patientId === patientId);
      if (found) return found.id;
      const c: Conversation = { id: `demo-conv-${patientId}`, patientId, patientName, professionalId: DEMO_PRO, lastMessageAt: null };
      s.conversations.push(c);
      await saveDemo();
      return c.id;
    }
    const me = getCurrentUserId();
    const { data } = await supabase!.from('conversations').select('id').eq('professional_id', me).eq('patient_id', patientId).maybeSingle();
    if (data?.id) return data.id;
    const { data: created, error } = await supabase!
      .from('conversations')
      .insert({ professional_id: me, patient_id: patientId, patient_name: patientName })
      .select('id')
      .single();
    fail(error);
    return created!.id;
  },

  async getAvailability(): Promise<Availability> {
    if (isPortalDemo()) return (await demo()).availability;
    const { data, error } = await supabase!.from('professional_availability').select('*').eq('professional_id', getCurrentUserId()).maybeSingle();
    fail(error);
    if (!data) return WEEK_DEFAULT;
    return { weekly: data.weekly, slotMinutes: data.slot_minutes, bufferMinutes: data.buffer_minutes, calendarProvider: data.calendar_provider };
  },

  async saveAvailability(av: Availability) {
    if (isPortalDemo()) {
      (await demo()).availability = av;
      return saveDemo();
    }
    const { error } = await supabase!.from('professional_availability').upsert({
      professional_id: getCurrentUserId(),
      weekly: av.weekly,
      slot_minutes: av.slotMinutes,
      buffer_minutes: av.bufferMinutes,
      calendar_provider: av.calendarProvider,
      updated_at: new Date().toISOString(),
    });
    fail(error);
  },

  async getPrivate(): Promise<{ personalPhone: string; personalEmail: string }> {
    if (isPortalDemo()) return (await demo()).privateData;
    const { data } = await supabase!.from('professional_private').select('*').eq('professional_id', getCurrentUserId()).maybeSingle();
    return { personalPhone: data?.personal_phone ?? '', personalEmail: data?.personal_email ?? '' };
  },

  async savePrivate(v: { personalPhone: string; personalEmail: string }) {
    if (isPortalDemo()) {
      (await demo()).privateData = v;
      return saveDemo();
    }
    const { error } = await supabase!.from('professional_private').upsert({
      professional_id: getCurrentUserId(),
      personal_phone: v.personalPhone || null,
      personal_email: v.personalEmail || null,
      updated_at: new Date().toISOString(),
    });
    fail(error);
  },

  // Sin recetas: Kuova no prescribe (la columna action_plans.prescriptions queda vacía, '[]').
  async createActionPlan(patientId: string, items: PlanVersionItem[], note: string) {
    if (isPortalDemo()) {
      (await demo()).plans.push({ patientId, items, note, createdAt: new Date().toISOString() });
      return saveDemo();
    }
    const { error } = await supabase!.from('action_plans').insert({
      patient_id: patientId,
      professional_id: getCurrentUserId(),
      source: 'professional',
      items,
      note,
    });
    fail(error);
  },

  // Solo demo: volver a los datos de ejemplo.
  async resetDemo() {
    demoCache = demoSeed();
    await saveDemo();
  },
};

export const demoPatientById = (id: string) => DEMO_PATIENTS.find((p) => p.id === id) ?? null;

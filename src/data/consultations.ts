import AsyncStorage from '@react-native-async-storage/async-storage';
import { getCurrentUserId, isRemoteActive, supabase } from '@/lib/supabase';
import { mockProfessionals } from './servicesMock';
import {
  Appointment,
  AppointmentKind,
  AppointmentModality,
  Availability,
  ConsultRequest,
  DEFAULT_AVAILABILITY,
  RequestKind,
  freeSlots,
} from './specialistTypes';

// Lo que el PACIENTE hace con un especialista: pedir videoconsulta, enviar una
// solicitud o abrir un chat. Especialistas reales (id uuid, verificados en HomeTest) →
// Supabase. Especialistas de ejemplo del catálogo (pro-1…) o modo demo → en el móvil.

export const isRealProfessional = (id: string) => isRemoteActive() && /^[0-9a-f-]{36}$/i.test(id);

export interface ProCapabilities {
  video: boolean;
  requests: boolean;
  chat: boolean;
}

const LOCAL_APPTS = 'consult.appointments.v1';
const LOCAL_REQS = 'consult.requests.v1';

async function readLocal<T>(key: string): Promise<T[]> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

const fail = (error: { message: string } | null) => {
  if (error) throw new Error(error.message);
};

export const consult = {
  // Qué ofrece cada especialista. Los de ejemplo: todo, y chat solo algunos (como haría cada uno).
  async capabilities(proId: string): Promise<ProCapabilities> {
    if (!isRealProfessional(proId)) {
      const mock = mockProfessionals.find((p) => p.id === proId);
      return { video: true, requests: true, chat: mock ? ['doctor', 'dietitian', 'midwife'].includes(mock.role) : true };
    }
    const { data, error } = await supabase!
      .from('professionals')
      .select('video_enabled, requests_enabled, chat_enabled')
      .eq('id', proId)
      .maybeSingle();
    fail(error);
    return { video: !!data?.video_enabled, requests: !!data?.requests_enabled, chat: !!data?.chat_enabled };
  },

  async bookableSlots(proId: string): Promise<string[]> {
    if (!isRealProfessional(proId)) return freeSlots(DEFAULT_AVAILABILITY, []);
    const { data } = await supabase!.from('professional_availability').select('*').eq('professional_id', proId).maybeSingle();
    const av: Availability = data
      ? { weekly: data.weekly, slotMinutes: data.slot_minutes, bufferMinutes: data.buffer_minutes, calendarProvider: data.calendar_provider }
      : DEFAULT_AVAILABILITY;
    const from = new Date();
    const to = new Date(from.getTime() + 11 * 86400000);
    const { data: busy } = await supabase!.rpc('pro_busy_slots', { pro: proId, from_ts: from.toISOString(), to_ts: to.toISOString() });
    return freeSlots(av, (busy ?? []).map((b: any) => ({ start: b.starts_at, end: b.ends_at })));
  },

  async requestAppointment(input: {
    proId: string;
    proName: string;
    patientName: string;
    startsAt: string;
    kind: AppointmentKind;
    modality: AppointmentModality;
    reason?: string;
    durationMin?: number;
  }): Promise<void> {
    const duration = input.durationMin ?? 30;
    if (!isRealProfessional(input.proId)) {
      const appt: Appointment = {
        id: `local-${Date.now()}`,
        professionalId: input.proId,
        professionalName: input.proName,
        patientId: 'me',
        patientName: input.patientName,
        startsAt: input.startsAt,
        durationMin: duration,
        kind: input.kind,
        modality: input.modality,
        status: 'pending',
        reason: input.reason ?? null,
      };
      await AsyncStorage.setItem(LOCAL_APPTS, JSON.stringify([...(await readLocal<Appointment>(LOCAL_APPTS)), appt]));
      return;
    }
    const { error } = await supabase!.from('appointments').insert({
      professional_id: input.proId,
      patient_id: getCurrentUserId(),
      patient_name: input.patientName,
      starts_at: input.startsAt,
      duration_min: duration,
      kind: input.kind,
      modality: input.modality,
      reason: input.reason ?? null,
    });
    if (error?.code === '23P01') throw new Error('That time was just taken. Please choose another one.');
    fail(error);
  },

  async myAppointments(): Promise<Appointment[]> {
    const local = await readLocal<Appointment>(LOCAL_APPTS);
    if (!isRemoteActive()) return local;
    const { data, error } = await supabase!
      .from('appointments')
      .select('*, professionals(display_name)')
      .eq('patient_id', getCurrentUserId())
      .order('starts_at');
    fail(error);
    const remote: Appointment[] = (data ?? []).map((r: any) => ({
      id: r.id,
      professionalId: r.professional_id,
      professionalName: r.professionals?.display_name,
      patientId: r.patient_id,
      patientName: r.patient_name,
      startsAt: r.starts_at,
      durationMin: r.duration_min,
      kind: r.kind,
      modality: r.modality,
      status: r.status,
      reason: r.reason,
      videoRoomUrl: r.video_room_url,
    }));
    return [...remote, ...local];
  },

  async cancelAppointment(id: string) {
    if (id.startsWith('local-')) {
      const all = await readLocal<Appointment>(LOCAL_APPTS);
      await AsyncStorage.setItem(LOCAL_APPTS, JSON.stringify(all.map((a) => (a.id === id ? { ...a, status: 'cancelled' } : a))));
      return;
    }
    const { error } = await supabase!.from('appointments').update({ status: 'cancelled' }).eq('id', id);
    fail(error);
  },

  async sendRequest(input: { proId: string; proName: string; patientName: string; kind: RequestKind; message: string }) {
    if (!isRealProfessional(input.proId)) {
      const req: ConsultRequest = {
        id: `local-${Date.now()}`,
        patientId: 'me',
        patientName: input.patientName,
        professionalId: input.proId,
        professionalName: input.proName,
        kind: input.kind,
        message: input.message,
        status: 'open',
        response: null,
        createdAt: new Date().toISOString(),
        answeredAt: null,
      };
      await AsyncStorage.setItem(LOCAL_REQS, JSON.stringify([req, ...(await readLocal<ConsultRequest>(LOCAL_REQS))]));
      return;
    }
    const { error } = await supabase!.from('consultation_requests').insert({
      professional_id: input.proId,
      patient_name: input.patientName,
      kind: input.kind,
      message: input.message,
    });
    fail(error);
  },

  async myRequests(): Promise<ConsultRequest[]> {
    const local = await readLocal<ConsultRequest>(LOCAL_REQS);
    if (!isRemoteActive()) return local;
    const { data, error } = await supabase!
      .from('consultation_requests')
      .select('*, professionals(display_name)')
      .eq('patient_id', getCurrentUserId())
      .order('created_at', { ascending: false });
    fail(error);
    return [
      ...(data ?? []).map((r: any) => ({
        id: r.id,
        patientId: r.patient_id,
        patientName: r.patient_name,
        professionalId: r.professional_id,
        professionalName: r.professionals?.display_name,
        kind: r.kind,
        message: r.message,
        status: r.status,
        response: r.response,
        createdAt: r.created_at,
        answeredAt: r.answered_at,
      })),
      ...local,
    ];
  },

  // Id de la conversación con este especialista (la abre si hace falta).
  async conversationWith(proId: string, patientName: string): Promise<string> {
    if (!isRealProfessional(proId)) return `local-${proId}`;
    const me = getCurrentUserId();
    const { data } = await supabase!.from('conversations').select('id').eq('patient_id', me).eq('professional_id', proId).maybeSingle();
    if (data?.id) return data.id;
    const { data: created, error } = await supabase!
      .from('conversations')
      .insert({ professional_id: proId, patient_name: patientName })
      .select('id')
      .single();
    fail(error);
    return created!.id;
  },
};

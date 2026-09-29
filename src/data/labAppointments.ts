import AsyncStorage from '@react-native-async-storage/async-storage';
import { LAB_CENTERS, LabCenter } from './labCenters';
import type { ScheduleEvent } from './schedule';

// Citas en laboratorio. PROTOTIPO: se guardan en el móvil y NO se envían a Eurofins;
// cuando haya acuerdo con el laboratorio, "confirm" llamará a su sistema de reservas
// (o a una Edge Function) y la cita pasará a Supabase.

export interface LabAppointment {
  id: string;
  centerId: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  createdAt: string;
}

const KEY = 'labAppointments.v1';

export const labAppointmentRepository = {
  async getAll(): Promise<LabAppointment[]> {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      return raw ? (JSON.parse(raw) as LabAppointment[]) : [];
    } catch {
      return [];
    }
  },
  async save(a: Omit<LabAppointment, 'id' | 'createdAt'>): Promise<LabAppointment> {
    const all = await this.getAll();
    const appt = { ...a, id: `lab-${Date.now()}`, createdAt: new Date().toISOString() };
    await AsyncStorage.setItem(KEY, JSON.stringify([...all, appt]));
    return appt;
  },
  async cancel(id: string): Promise<void> {
    const all = await this.getAll();
    await AsyncStorage.setItem(KEY, JSON.stringify(all.filter((a) => a.id !== id)));
  },
};

// Evento de agenda para una cita (Schedule y "Add to calendar").
export function appointmentEvent(a: LabAppointment, c: LabCenter): ScheduleEvent {
  const [h, m] = a.time.split(':').map(Number);
  const endMin = h * 60 + m + 15;
  const end = `${String(Math.floor(endMin / 60)).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}`;
  return {
    id: a.id,
    type: 'lab',
    date: a.date,
    start: a.time,
    end,
    title: `Blood draw at ${c.network} ${c.name}`,
    detail: `${c.address}. Bring your ID. Fast for 8 hours if your test requires it (water is fine).`,
  };
}

export async function labAppointmentEvents(): Promise<ScheduleEvent[]> {
  const all = await labAppointmentRepository.getAll();
  return all.flatMap((a) => {
    const c = LAB_CENTERS.find((x) => x.id === a.centerId);
    return c ? [appointmentEvent(a, c)] : [];
  });
}

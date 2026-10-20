import { describe, expect, it } from 'vitest';
import { Appointment, recentAppointmentWith } from '@/data/specialistTypes';

const now = new Date('2026-10-20T12:00:00Z');
const appt = (over: Partial<Appointment>): Appointment => ({
  id: 'a',
  professionalId: 'pro-1',
  patientId: 'me',
  patientName: 'Yo',
  startsAt: '2026-10-23T09:00:00Z',
  durationMin: 30,
  kind: 'results_review',
  modality: 'video',
  status: 'pending',
  createdAt: '2026-10-19T10:00:00Z',
  ...over,
});

describe('Consultas: memoria de lo ya pedido esa semana', () => {
  it('encuentra la pedida esta semana al mismo especialista, pendiente o confirmada', () => {
    expect(recentAppointmentWith([appt({})], 'pro-1', now)?.id).toBe('a');
    expect(recentAppointmentWith([appt({ status: 'confirmed' })], 'pro-1', now)?.status).toBe('confirmed');
  });

  it('no cuenta otro especialista, las canceladas, las ya pasadas ni las pedidas hace más de 7 días', () => {
    expect(recentAppointmentWith([appt({ professionalId: 'pro-2' })], 'pro-1', now)).toBeNull();
    expect(recentAppointmentWith([appt({ status: 'cancelled' })], 'pro-1', now)).toBeNull();
    expect(recentAppointmentWith([appt({ startsAt: '2026-10-19T09:00:00Z' })], 'pro-1', now)).toBeNull();
    expect(recentAppointmentWith([appt({ createdAt: '2026-10-10T10:00:00Z' })], 'pro-1', now)).toBeNull();
  });

  it('sin fecha de petición cuenta como reciente, y con varias da la más próxima', () => {
    expect(recentAppointmentWith([appt({ createdAt: undefined })], 'pro-1', now)?.id).toBe('a');
    const two = [appt({ id: 'tarde', startsAt: '2026-10-25T09:00:00Z' }), appt({ id: 'pronto', startsAt: '2026-10-22T09:00:00Z' })];
    expect(recentAppointmentWith(two, 'pro-1', now)?.id).toBe('pronto');
  });
});

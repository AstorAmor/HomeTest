import { describe, expect, it, vi } from 'vitest';

vi.mock('@react-native-async-storage/async-storage', () => ({ default: { getItem: async () => null, setItem: async () => undefined } }));
vi.mock('react-native', () => ({ Platform: { OS: 'android' } }));
vi.mock('@/lib/supabase', () => ({ getCurrentUserId: () => null, isRemoteActive: () => false, supabase: null }));
vi.mock('@/data/servicesMock', () => ({ mockProfessionals: [] }));

import { isTimedReps, secondsLeft, timedSeconds, timeText, upcomingEnds } from '@/logic/workoutTimer';
import { consultationEvent } from '@/data/consultations';
import type { Appointment } from '@/data/specialistTypes';

const now = 1_000_000;

describe('Cuenta atrás del entrenamiento', () => {
  it('cuenta por la hora: al volver de la pantalla bloqueada marca lo que queda', () => {
    expect(secondsLeft(now + 60_000, now)).toBe(60);
    expect(secondsLeft(now + 60_000, now + 400)).toBe(60); // 59,6 s todavía se ve como 1:00
    expect(secondsLeft(now + 60_000, now + 45_000)).toBe(15);
    expect(secondsLeft(now + 60_000, now + 90_000)).toBeLessThanOrEqual(0);
  });

  it('en el descanso solo queda su final', () => {
    const ends = upcomingEnds({ now, phase: 'rest', timerOn: false, endsAt: now + 90_000, totalSec: 0, perSide: false, restAfterSec: 60 });
    expect(ends).toEqual([{ at: now + 90_000, kind: 'rest' }]);
  });

  it('un ejercicio por lado avisa a mitad, al final y al acabar el descanso que le sigue', () => {
    const ends = upcomingEnds({ now, phase: 'work', timerOn: true, endsAt: now + 60_000, totalSec: 60, perSide: true, restAfterSec: 45 });
    expect(ends).toEqual([
      { at: now + 30_000, kind: 'side' },
      { at: now + 60_000, kind: 'work' },
      { at: now + 105_000, kind: 'rest' },
    ]);
  });

  it('lo que ya pasó no se programa, y sin temporizador en marcha no hay nada', () => {
    const later = now + 40_000;
    const ends = upcomingEnds({ now: later, phase: 'work', timerOn: true, endsAt: now + 60_000, totalSec: 60, perSide: true, restAfterSec: 0 });
    expect(ends).toEqual([{ at: now + 60_000, kind: 'work' }]);
    expect(upcomingEnds({ now, phase: 'work', timerOn: false, endsAt: 0, totalSec: 30, perSide: false, restAfterSec: 60 })).toEqual([]);
  });
});

describe('Ejercicios por tiempo', () => {
  it('lee el tiempo como lo escriben el generador, el entrenador y las ruedas', () => {
    expect(timedSeconds('30 s')).toBe(30);
    expect(timedSeconds('20–30 s')).toBe(20);
    expect(timedSeconds('8 min')).toBe(480);
    expect(timedSeconds('1 min 30 s')).toBe(90);
    expect(isTimedReps('1 min 30 s')).toBe(true);
    expect(isTimedReps('10–12')).toBe(false);
  });

  it('lo que se guarda desde las ruedas se vuelve a leer igual', () => {
    for (const sec of [5, 45, 60, 90, 125, 600]) expect(timedSeconds(timeText(sec))).toBe(sec);
    expect(timeText(90)).toBe('1 min 30 s');
  });
});

describe('Consultas en la agenda', () => {
  const appt = (a: Partial<Appointment>): Appointment => ({
    id: 'local-1',
    professionalId: 'pro-1',
    professionalName: 'Gema Martínez',
    patientId: 'me',
    patientName: 'Paciente',
    startsAt: new Date(2026, 9, 22, 17, 30).toISOString(),
    durationMin: 30,
    kind: 'first',
    modality: 'video',
    status: 'pending',
    ...a,
  });

  it('sale en su día y a la hora del móvil, con su duración y su estado', () => {
    const e = consultationEvent(appt({}));
    expect(e).toMatchObject({ id: 'local-1', type: 'consult', date: '2026-10-22', start: '17:30', end: '18:00' });
    expect(e.title).toContain('Gema Martínez');
    expect(e.detail).toContain('Waiting for confirmation');
    expect(e.action).toBeUndefined();
  });

  it('una videoconsulta real confirmada se puede abrir desde la agenda', () => {
    const e = consultationEvent(appt({ id: '3f2b8c1e-1d2a-4b5c-9e8f-0a1b2c3d4e5f', status: 'confirmed' }));
    expect(e.action).toMatchObject({ pathname: '/video', params: { appt: '3f2b8c1e-1d2a-4b5c-9e8f-0a1b2c3d4e5f' } });
  });

  it('cerca de medianoche usa el día local, no el de UTC', () => {
    const e = consultationEvent(appt({ startsAt: new Date(2026, 9, 22, 0, 15).toISOString() }));
    expect(e.date).toBe('2026-10-22');
    expect(e.start).toBe('00:15');
  });
});

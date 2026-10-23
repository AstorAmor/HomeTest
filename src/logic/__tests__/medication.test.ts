import { describe, expect, it } from 'vitest';
import { asNeededLogsOn, courseProgress, daySummary, dosesForDay, findKnownMed, historyDays, isActiveOn, parseMedicationText, shiftSchedule, shiftTime, zoneChange } from '@/logic/medication';
import { MedicationItem } from '@/types/medication';

describe('parseMedicationText', () => {
  it('un número pegado al nombre es parte del nombre (Omega-3, B12), no la dosis', () => {
    expect(parseMedicationText('Omega-3').name).toBe('Omega-3');
    expect(parseMedicationText('Vitamin B12 1000 mcg').name).toBe('Vitamin B12');
    expect(parseMedicationText('Vitamin B12 1000 mcg').dose).toBe('1000 mcg');
  });

  it('español: nombre, dosis, cada 8 horas y días', () => {
    const p = parseMedicationText('Ibuprofeno 600 mg cada 8 horas durante 3 días');
    expect(p.name).toBe('Ibuprofeno');
    expect(p.dose).toBe('600 mg');
    expect(p.schedule).toEqual({ type: 'every_hours', hours: 8, firstTime: '07:00' });
    expect(p.courseDays).toBe(3);
  });
  it('inglés: veces al día', () => {
    const p = parseMedicationText('Vitamin D 1000 IU once a day');
    expect(p.name).toBe('Vitamin D');
    expect(p.dose).toBe('1000 IU');
    expect(p.schedule).toEqual({ type: 'times', times: ['09:00'] });
  });
  it('dos veces al día y una semana', () => {
    const p = parseMedicationText('amoxicilina dos veces al día una semana');
    expect(p.schedule).toEqual({ type: 'times', times: ['08:00', '20:00'] });
    expect(p.courseDays).toBe(7);
  });
  it('por la noche', () => {
    expect(parseMedicationText('magnesio una vez al día por la noche').schedule).toEqual({ type: 'times', times: ['21:30'] });
  });
  it('reconoce lo más común', () => {
    expect(findKnownMed('Hierro 80mg')?.label).toBe('Iron');
    expect(findKnownMed('Eutirox 50')?.label).toBe('Levothyroxine');
  });
});

const base = (over: Partial<MedicationItem>): MedicationItem => ({
  id: 'm1',
  fecha: '2026-10-01T09:00:00.000Z',
  createdAt: '2026-10-01T09:00:00.000Z',
  name: 'Test',
  kind: 'medication',
  schedule: { type: 'times', times: ['08:00'] },
  course: { type: 'ongoing' },
  reminders: true,
  ...over,
});

describe('tomas del día', () => {
  const day = new Date('2026-10-08T12:00:00');
  it('cada 8 horas: 3 tomas en el día', () => {
    const doses = dosesForDay([base({ schedule: { type: 'every_hours', hours: 8, firstTime: '07:00' } })], day, []);
    expect(doses.map((d) => d.at.getHours())).toEqual([7, 15, 23]);
  });
  it('días alternos: solo los días marcados', () => {
    const iron = base({ schedule: { type: 'weekdays', days: [1, 3, 5], times: ['08:00'] } });
    expect(dosesForDay([iron], new Date('2026-10-07T12:00:00'), []).length).toBe(1); // miércoles
    expect(dosesForDay([iron], new Date('2026-10-08T12:00:00'), []).length).toBe(0); // jueves
  });
  it('tratamiento puntual: se acaba solo', () => {
    const course = base({ course: { type: 'short', startDate: '2026-10-06', days: 3 } });
    expect(isActiveOn(course, new Date('2026-10-08T12:00:00'))).toBe(true);
    expect(isActiveOn(course, new Date('2026-10-09T12:00:00'))).toBe(false);
    expect(courseProgress(course, new Date('2026-10-07T12:00:00'))).toEqual({ day: 2, total: 3 });
  });
  it('enlaza lo ya marcado', () => {
    const at = new Date('2026-10-08T08:00:00');
    const doses = dosesForDay([base({})], day, [
      { id: 'l', fecha: at.toISOString(), createdAt: at.toISOString(), medId: 'm1', scheduledFor: at.toISOString(), status: 'taken' },
    ]);
    expect(doses[0].log?.status).toBe('taken');
  });
  const log = (id: string, iso: string, status: 'taken' | 'skipped' = 'taken') => {
    const at = new Date(iso).toISOString();
    return { id, fecha: at, createdAt: at, medId: 'm1', scheduledFor: at, status };
  };
  it('si se cambió la hora, lo marcado a la hora antigua cuenta para ese día', () => {
    const doses = dosesForDay([base({ schedule: { type: 'times', times: ['09:00', '21:00'] } })], day, [log('a', '2026-10-08T08:00:00')]);
    expect(doses.map((d) => d.log?.id)).toEqual(['a', undefined]);
  });
  it('un doble toque en una hora de la pauta no marca la siguiente toma', () => {
    const doses = dosesForDay([base({ schedule: { type: 'times', times: ['08:00', '20:00'] } })], day, [
      log('a', '2026-10-08T08:00:00'),
      log('b', '2026-10-08T08:00:00'),
    ]);
    expect(doses[0].log?.id).toBe('a');
    expect(doses[1].log).toBeUndefined();
  });
  it('lo marcado otro día no cuenta', () => {
    const doses = dosesForDay([base({})], day, [log('a', '2026-10-07T09:00:00')]);
    expect(doses[0].log).toBeUndefined();
  });
});

describe('historial', () => {
  const now = new Date('2026-10-08T10:00:00');
  it('días desde el primer alta hasta hoy, de hoy hacia atrás', () => {
    const days = historyDays([base({ createdAt: '2026-10-06T18:00:00' }), base({ id: 'm2', course: { type: 'short', startDate: '2026-10-07', days: 3 } })], now);
    expect(days.map((d) => d.getDate())).toEqual([8, 7, 6]);
    expect(historyDays([], now)).toEqual([]);
  });
  it('resumen del día: tomadas, omitidas, sin marcar y lo que falta hoy', () => {
    const item = base({ schedule: { type: 'times', times: ['08:00', '09:00', '14:00', '20:00'] } });
    const at = (h: string, status: 'taken' | 'skipped') => {
      const iso = new Date(`2026-10-08T${h}:00`).toISOString();
      return { id: h, fecha: iso, createdAt: iso, medId: 'm1', scheduledFor: iso, status };
    };
    const doses = dosesForDay([item], now, [at('08:00', 'taken'), at('09:00', 'skipped')]);
    expect(daySummary(doses, now)).toEqual({ total: 4, taken: 1, skipped: 1, unmarked: 0, later: 2 });
    expect(daySummary(doses, new Date('2026-10-08T23:00:00'))).toEqual({ total: 4, taken: 1, skipped: 1, unmarked: 2, later: 0 });
  });
  it('«cuando lo necesito»: lo tomado ese día', () => {
    const item = base({ schedule: { type: 'as_needed' } });
    const iso = (s: string) => new Date(s).toISOString();
    const logs = [
      { id: 'a', fecha: iso('2026-10-08T09:00:00'), createdAt: iso('2026-10-08T09:00:00'), medId: 'm1', scheduledFor: iso('2026-10-08T09:00:00'), status: 'taken' as const },
      { id: 'b', fecha: iso('2026-10-07T12:00:00'), createdAt: iso('2026-10-08T09:00:00'), medId: 'm1', scheduledFor: iso('2026-10-07T12:00:00'), status: 'taken' as const },
    ];
    expect(asNeededLogsOn(item, now, logs).map((l) => l.id)).toEqual(['a']);
  });
});

describe('cambio de zona horaria', () => {
  const madrid = { zone: 'Europe/Madrid', offset: 120 };
  it('mismo sitio o solo horario de verano: no pregunta', () => {
    expect(zoneChange(madrid, madrid)).toBeNull();
    expect(zoneChange(madrid, { zone: 'Europe/Madrid', offset: 60 })).toBeNull();
    expect(zoneChange(null, madrid)).toBeNull();
  });
  it('Madrid → Nueva York: −6 h y las 08:00 pasan a las 02:00', () => {
    const diff = zoneChange(madrid, { zone: 'America/New_York', offset: -240 })!;
    expect(diff).toBe(-360);
    expect(shiftSchedule({ type: 'times', times: ['08:00', '22:00'] }, diff)).toEqual({ type: 'times', times: ['02:00', '16:00'] });
    expect(shiftTime('03:30', 120 - -240)).toBe('09:30');
  });
});

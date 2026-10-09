import { describe, expect, it } from 'vitest';
import { courseProgress, dosesForDay, findKnownMed, isActiveOn, parseMedicationText, shiftSchedule, shiftTime, zoneChange } from '@/logic/medication';
import { MedicationItem } from '@/types/medication';

describe('parseMedicationText', () => {
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

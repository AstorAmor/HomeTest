import { createMetricRepository, definedOnly } from './metricRepository';
import { dayKey, noonOf } from './bathroomRepository';
import { DoseLog, MedicationItem, ScheduledDose } from '@/types/medication';

// Medicación y suplementos (tabla medications) y cada toma marcada (tabla medication_doses).
// supabase/migrations/20261008120000_medications.sql

export const medicationRepository = createMetricRepository<MedicationItem>('hometest:medications', {
  table: 'medications',
  dateColumn: 'created_at',
  toRow: (e) =>
    definedOnly({
      id: e.id,
      name: e.name,
      kind: e.kind,
      dose: e.dose,
      schedule: e.schedule,
      course: e.course,
      with_food: e.withFood,
      reminders: e.reminders,
      reminders_muted_until: e.remindersMutedUntil,
      stopped_at: e.stoppedAt,
      note: e.note,
      created_at: e.createdAt,
    }),
  fromRow: (r) => ({
    id: r.id,
    name: r.name,
    kind: r.kind,
    dose: r.dose ?? undefined,
    schedule: r.schedule,
    course: r.course,
    withFood: r.with_food ?? undefined,
    reminders: r.reminders,
    remindersMutedUntil: r.reminders_muted_until ?? undefined,
    stoppedAt: r.stopped_at ?? undefined,
    note: r.note ?? undefined,
    fecha: r.created_at,
    createdAt: r.created_at,
  }),
});

export const doseRepository = createMetricRepository<DoseLog>('hometest:medication_doses', {
  table: 'medication_doses',
  dateColumn: 'logged_at',
  toRow: (e) =>
    definedOnly({
      id: e.id,
      medication_id: e.medId,
      scheduled_for: e.scheduledFor,
      status: e.status,
      logged_at: e.fecha,
      created_at: e.createdAt,
    }),
  fromRow: (r) => ({
    id: r.id,
    medId: r.medication_id,
    scheduledFor: r.scheduled_for,
    status: r.status,
    fecha: r.logged_at,
    createdAt: r.created_at,
  }),
});

// Corregir una toma desde el historial: tomada, no tomada o sin marcar (null). Si ya tenía registro se
// corrige ese (a la hora de la pauta actual) y se quitan los repetidos de la misma hora; si no, se crea.
export async function setDoseStatus(dose: ScheduledDose, status: DoseLog['status'] | null, logs: DoseLog[]): Promise<void> {
  const at = dose.at.toISOString();
  const repeated = logs.filter((l) => l.medId === dose.medId && l.scheduledFor === at && l.id !== dose.log?.id);
  for (const l of repeated) await doseRepository.remove(l.id);
  if (status === null) {
    if (dose.log) await doseRepository.remove(dose.log.id);
    return;
  }
  const now = new Date().toISOString();
  if (dose.log) await doseRepository.update(dose.log.id, { status, scheduledFor: at, fecha: now });
  else await doseRepository.save({ id: `${Date.now()}`, fecha: now, createdAt: now, medId: dose.medId, scheduledFor: at, status });
}

// Apuntar un "He tomado una" de lo que se toma solo cuando hace falta en un día pasado. Va a mediodía
// de ese día (no a ahora) para que no cuente como de hoy.
export async function addAsNeededDose(medId: string, day: Date): Promise<void> {
  const now = new Date();
  const at = dayKey(day) === dayKey(now) ? now.toISOString() : noonOf(dayKey(day));
  await doseRepository.save({ id: `${Date.now()}`, fecha: at, createdAt: now.toISOString(), medId, scheduledFor: at, status: 'taken' });
}

// Borrar del todo un medicamento y las tomas que tenía apuntadas (lo apuntado por error o lo que ya no
// quiere ver). «Lo he dejado» es otra cosa: guarda el historial y solo deja de programarlo.
export async function deleteMedication(id: string): Promise<void> {
  const doses = await doseRepository.getAll();
  for (const d of doses.filter((x) => x.medId === id)) await doseRepository.remove(d.id);
  await medicationRepository.remove(id);
}

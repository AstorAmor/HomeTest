// Seguimiento de medicación y suplementos (opcional: solo si el usuario lo activa).
// Dos tipos: lo que toma de forma habitual y los tratamientos puntuales (p. ej. al ponerse enfermo),
// que duran unos días y se cierran solos.

export type MedKind = 'medication' | 'supplement';

export type MedSchedule =
  | { type: 'times'; times: string[] } // a horas fijas cada día ("08:00", "20:00")
  | { type: 'every_hours'; hours: number; firstTime: string } // cada N horas desde una hora
  | { type: 'weekdays'; days: number[]; times: string[] } // ciertos días (0 = domingo … 6 = sábado)
  | { type: 'as_needed' }; // solo cuando hace falta (sin recordatorios)

export interface MedicationItem {
  id: string;
  fecha: string; // ISO de alta (para el repositorio)
  createdAt: string;
  name: string;
  kind: MedKind;
  dose?: string; // "1 tablet", "600 mg", "1000 IU"
  schedule: MedSchedule;
  // Puntual: desde startDate durante `days` días. Habitual: sin fin.
  course: { type: 'ongoing' } | { type: 'short'; startDate: string; days: number };
  withFood?: 'with' | 'empty' | 'any';
  reminders: boolean; // avisar en cada toma o lo lleva el usuario
  remindersMutedUntil?: string; // silencio del recordatorio de esta medicación ("para siempre" = año 9999)
  stoppedAt?: string;
  note?: string;
}

export interface DoseLog {
  id: string;
  fecha: string; // ISO de cuando lo marcó
  createdAt: string;
  medId: string;
  scheduledFor: string; // ISO de la toma programada a la que corresponde
  status: 'taken' | 'skipped';
}

export interface ScheduledDose {
  medId: string;
  name: string;
  dose?: string;
  at: Date;
  log?: DoseLog;
}

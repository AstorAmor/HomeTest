import { contextAt, expandPersona, simulatePersona } from '@/logic/nudges';
import type { NudgePrefs, Persona } from '@/logic/nudges';
import type { CheckInEntry, DayMoment, Mood } from '@/types/checkIn';
import type { CycleEntry } from '@/types/cycle';
import type { CycleGoalAnswers } from '@/types/cycleGoal';
import type { BowelEntry, UrineEntry } from '@/types/bathroom';
import type { DoseLog, MedicationItem } from '@/types/medication';
import type { BloodPressureEntry } from '@/types/bloodPressure';
import type { GlucoseEntry, MealType } from '@/types/glucose';
import type { SimpleMetricEntry } from '@/types/simpleMetric';
import type { DailyWearableRecord } from '@/wearables/types';
import type { MealEntry, WorkoutEntry, WorkoutType } from '@/data/planRepository';
import type { InboxItem } from '@/data/nudgeStore';
import type { AppSection } from '@/data/appPrefs';
import type { ConditionId } from '@/data/profileRepository';

// Usuarios simulados (simulation/personas) cargados en una cuenta: lógica pura, sin React Native,
// para poder probarla con vitest. src/data/simulation.ts la usa para escribir en el modo demo
// (AsyncStorage) o en una CUENTA DE PRUEBA de Supabase (las tablas de verdad).
//
// Una cuenta real nunca se toca: antes de escribir o borrar nada se vuelve a leer de Supabase
// user_flags.real_account. Además, una cuenta que alguna vez se marcó como real (aunque luego se
// quitara la marca en Ajustes) solo se acepta si ya era cuenta de escenarios (scenario_account),
// para que quitar el interruptor sin querer no deje borrar los datos de una persona de verdad.

export const SCENARIO_ACCOUNT_FLAG = 'scenario_account';

export interface ActiveSimulation {
  personaId: string;
  name: string;
  day0: string;
}

// Todo lo que el usuario simulado ha registrado hasta `now`, en el formato de los repositorios
export interface ScenarioRecords {
  checkIns: CheckInEntry[];
  cycleStarts: CycleEntry[];
  workouts: WorkoutEntry[];
  meals: MealEntry[];
  bowel: BowelEntry[];
  urine: UrineEntry[];
  medications: MedicationItem[];
  doses: DoseLog[];
  bloodPressure: BloodPressureEntry[];
  glucose: GlucoseEntry[];
  basalTemperature: SimpleMetricEntry[];
  wearable: DailyWearableRecord[];
  profile: { sex?: 'female' | 'male'; dateOfBirth?: string; conditions: ConditionId[]; firstName: string };
  cycleGoal: CycleGoalAnswers | null;
  nudgePrefs: NudgePrefs;
  inbox: InboxItem[]; // avisos ya recibidos antes de hoy (los de hoy los calcula la app al abrir Today)
  sections: AppSection[]; // secciones opcionales que usa
  simulation: ActiveSimulation;
}

const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const birthDateForAge = (age: number | undefined, now: Date) =>
  age == null ? undefined : `${now.getFullYear() - age}-01-15`;

export function scenarioRecords(p: Persona, start: Date, now: Date): ScenarioRecords {
  const x = expandPersona(p, start);
  const past = <T extends { fecha: string }>(list: T[]) => list.filter((e) => new Date(e.fecha) <= now);
  const today = dayKey(now);
  const simulated = { sourceName: 'Simulated', provider: 'huawei_dummy' as const, rawTypeId: 'sim' };

  const { ctx, prefs } = contextAt(x, now);
  const { days } = simulatePersona({ ...p, simulate: { fromDay: p.simulate.fromDay, toDay: -1 } }, start);
  const inbox: InboxItem[] = days
    .flatMap((d) =>
      d.decisions
        .filter((dec) => dec.status === 'send')
        .map((dec) => ({
          id: dec.id,
          at: new Date(`${d.date}T20:00:00`).toISOString(),
          title: dec.title ?? dec.label,
          body: dec.body ?? '',
          route: dec.route,
          read: true,
        }))
    )
    .reverse();

  const sections: AppSection[] = [];
  if (x.bowel.length) sections.push('gut');
  if (x.urine.length) sections.push('bladder');
  if (x.medications.length) sections.push('medication');

  return {
    checkIns: past(x.checkIns).map((c) => ({ ...c, moment: c.moment as DayMoment, mood: c.mood as Mood | undefined })),
    cycleStarts: past(x.cycleStarts).map((c) => ({ ...c, endFecha: null })),
    workouts: past(x.workouts).map((w) => ({ ...w, type: w.type as WorkoutType, intensity: 'moderate' as const })),
    meals: past(x.meals).map((m) => ({ ...m, description: 'Simulated meal', mealType: 'lunch' as const, addedSugar: null })),
    bowel: past(x.bowel),
    urine: past(x.urine),
    medications: x.medications.filter((m) => new Date(m.createdAt) <= now),
    doses: past(x.doses),
    bloodPressure: past(x.bloodPressure).map((r) => ({ ...r, source: 'manual' as const })),
    glucose: past(x.glucose).map((g) => ({
      id: g.id,
      valor: g.mgdl,
      unidad: 'mg/dL' as const,
      fecha: g.fecha,
      mealType: g.mealType as MealType,
      createdAt: g.createdAt,
    })),
    basalTemperature: past(x.temperatures.filter((t) => t.source === 'manual')).map((t) => ({
      id: t.id,
      valor: t.celsius,
      unidad: '°C',
      fecha: t.fecha,
      createdAt: t.createdAt,
    })),
    // Wearable: solo lo que el usuario simulado trae (sueño y temperatura nocturna)
    wearable: [
      ...x.sleepNights
        .filter((s) => s.date <= today)
        .map((s) => ({ ...simulated, date: s.date, metric: 'sleep_duration' as const, value: s.minutes, rawTypeName: 'Sleep' })),
      ...past(x.temperatures.filter((t) => t.source === 'wearable')).map((t) => ({
        ...simulated,
        date: dayKey(new Date(t.fecha)),
        metric: 'body_temperature' as const,
        value: t.celsius,
        rawTypeName: 'Body temperature',
      })),
    ],
    profile: {
      sex: p.profile.sex === 'other' ? undefined : p.profile.sex,
      dateOfBirth: birthDateForAge(p.profile.age, now),
      conditions: (p.profile.conditions ?? []) as ConditionId[],
      firstName: p.profile.firstName ?? p.name,
    },
    cycleGoal: ctx.cycleGoal ?? null,
    nudgePrefs: prefs,
    inbox,
    sections,
    simulation: { personaId: p.id, name: p.name, day0: start.toISOString() },
  };
}

// --- Guardia: solo cuentas de prueba ---------------------------------------------------------

export const REAL_ACCOUNT_REFUSAL =
  'This is a real account: test scenarios never load into it and its data is never cleared.';
export const ONCE_REAL_REFUSAL =
  'This account was marked as real before, so scenarios are blocked to protect its data. Use a separate test account.';
export const UNVERIFIED_REFUSAL = 'Could not confirm that this is a test account. Check your connection and try again.';
export const SIGNED_OUT_REFUSAL = 'Sign in to a test account first.';

export interface AccountScenarioFlags {
  realAccount?: unknown; // user_flags.real_account (sin fila = undefined)
  scenarioAccount?: unknown; // user_flags.scenario_account
}

// Por qué no se puede usar esta cuenta para escenarios (null = sí se puede)
export function scenarioRefusal(state: { signedIn: boolean; realNow: boolean; flags: AccountScenarioFlags | null }): string | null {
  if (!state.signedIn) return SIGNED_OUT_REFUSAL;
  if (state.realNow) return REAL_ACCOUNT_REFUSAL;
  if (!state.flags) return UNVERIFIED_REFUSAL;
  if (state.flags.realAccount === true) return REAL_ACCOUNT_REFUSAL;
  if (state.flags.realAccount !== undefined && state.flags.scenarioAccount !== true) return ONCE_REAL_REFUSAL;
  return null;
}

// Lo que hace falta para escribir en la cuenta (src/data/simulation.ts lo conecta con Supabase)
export interface ScenarioAccountIO {
  signedIn: () => boolean;
  realNow: () => boolean; // lo que ya sabe la app (dataMode.isRealAccount)
  readFlags: () => Promise<AccountScenarioFlags>; // lectura fresca de Supabase; lanza si no puede
  markScenarioAccount: () => Promise<void>;
  clear: () => Promise<void>; // borra solo las filas de este usuario
  write: (records: ScenarioRecords) => Promise<void>;
}

export async function assertScenarioAccount(io: ScenarioAccountIO): Promise<void> {
  const signedIn = io.signedIn();
  const realNow = io.realNow();
  let flags: AccountScenarioFlags | null = null;
  if (signedIn && !realNow) {
    try {
      flags = await io.readFlags();
    } catch {
      flags = null;
    }
  }
  const refusal = scenarioRefusal({ signedIn, realNow, flags });
  if (refusal) throw new Error(refusal);
}

// Borra lo registrado en la cuenta de prueba y escribe el escenario hasta hoy
export async function loadScenarioIntoAccount(io: ScenarioAccountIO, p: Persona, start: Date, now = new Date()): Promise<ScenarioRecords> {
  await assertScenarioAccount(io);
  await io.markScenarioAccount();
  const records = scenarioRecords(p, start, now);
  await io.clear();
  await io.write(records);
  return records;
}

export async function clearScenarioAccount(io: ScenarioAccountIO): Promise<void> {
  await assertScenarioAccount(io);
  await io.markScenarioAccount();
  await io.clear();
}

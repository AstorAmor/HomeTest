import AsyncStorage from '@react-native-async-storage/async-storage';
import { DevSettings, Platform } from 'react-native';
import * as Updates from 'expo-updates';
import { isRemoteActive } from '@/lib/supabase';
import { PERSONAS } from '../../simulation/personas';
import { contextAt, expandPersona, Persona, simulatePersona } from '@/logic/nudges';
import { profileRepository } from './profileRepository';
import { cycleGoalStore } from './cycleGoal';
import { userFlags } from './userFlags';
import { InboxItem, nudgeStore } from './nudgeStore';
import { wearableRepository } from '@/wearables/wearableRepository';
import { DailyWearableRecord } from '@/wearables/types';
import { mockPatient } from './mockData';
import { appPrefs, AppSection } from './appPrefs';

// Usuarios simulados dentro de la app (Developer mode → Simulated users). Cargan los JSON de
// simulation/personas en el modo demo: borran los datos locales de ejemplo y escriben los del
// usuario hasta hoy (día 0), con su historial de avisos ya recibido. Nunca en una cuenta real.

export { PERSONAS };
export type { Persona };

const SIM_KEY = 'simulation';

export interface ActiveSimulation {
  personaId: string;
  name: string;
  day0: string;
}

export const localMidnight = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

export async function activeSimulation(): Promise<ActiveSimulation | null> {
  const v = await userFlags.get(SIM_KEY);
  return v && typeof v === 'object' && 'personaId' in v ? (v as unknown as ActiveSimulation) : null;
}

const birthDateForAge = (age?: number) => {
  if (age == null) return undefined;
  const d = new Date();
  d.setFullYear(d.getFullYear() - age, 0, 15);
  return d.toISOString().slice(0, 10);
};

// Recarga para que AuthContext lea el usuario nuevo; en la web, entrando por el inicio (Today)
function reloadApp() {
  if (Platform.OS === 'web') window.location.assign('/');
  else if (__DEV__) DevSettings.reload();
  else Updates.reloadAsync().catch(() => undefined);
}

export async function loadPersona(p: Persona): Promise<void> {
  if (isRemoteActive()) {
    throw new Error('Simulated users only load in the demo, never into a real account.');
  }
  const start = localMidnight();
  const now = new Date();
  const x = expandPersona(p, start);
  const past = <T extends { fecha: string }>(list: T[]) => list.filter((e) => new Date(e.fecha) <= now);

  // Mismas claves que usan los repositorios en modo demo (AsyncStorage)
  await AsyncStorage.multiSet([
    ['hometest:check_ins', JSON.stringify(past(x.checkIns))],
    ['hometest:cycle_entries', JSON.stringify(past(x.cycleStarts).map((c) => ({ ...c, endFecha: null })))],
    ['hometest:workouts', JSON.stringify(past(x.workouts).map((w) => ({ ...w, intensity: 'moderate' })))],
    [
      'hometest:meals',
      JSON.stringify(past(x.meals).map((m) => ({ ...m, description: 'Simulated meal', mealType: 'lunch', addedSugar: null }))),
    ],
    ['hometest:bowel_logs', JSON.stringify(past(x.bowel))],
    ['hometest:urine_logs', JSON.stringify(past(x.urine))],
    ['hometest:medications', JSON.stringify(x.medications.filter((m) => new Date(m.createdAt) <= now))],
    ['hometest:medication_doses', JSON.stringify(past(x.doses))],
    [
      'hometest:blood_pressure_entries',
      JSON.stringify(past(x.bloodPressure).map((r) => ({ ...r, source: 'manual' }))),
    ],
    [
      'hometest:glucose_entries',
      JSON.stringify(past(x.glucose).map((g) => ({ id: g.id, valor: g.mgdl, unidad: 'mg/dL', fecha: g.fecha, mealType: g.mealType, createdAt: g.createdAt }))),
    ],
    [
      'hometest:basal_temperature',
      JSON.stringify(
        past(x.temperatures.filter((t) => t.source === 'manual')).map((t) => ({
          id: t.id,
          valor: t.celsius,
          unidad: '°C',
          fecha: t.fecha,
          createdAt: t.createdAt,
        }))
      ),
    ],
  ]);

  // Wearable: solo lo que el usuario simulado trae (sueño y temperatura nocturna)
  await wearableRepository.clearRecords();
  const today = now.toISOString().slice(0, 10);
  const records: DailyWearableRecord[] = [
    ...x.sleepNights
      .filter((s) => s.date <= today)
      .map((s) => ({ date: s.date, metric: 'sleep_duration' as const, value: s.minutes, sourceName: 'Simulated', provider: 'huawei_dummy' as const, rawTypeId: 'sim', rawTypeName: 'Sleep' })),
    ...past(x.temperatures.filter((t) => t.source === 'wearable')).map((t) => ({
      date: t.fecha.slice(0, 10),
      metric: 'body_temperature' as const,
      value: t.celsius,
      sourceName: 'Simulated',
      provider: 'huawei_dummy' as const,
      rawTypeId: 'sim',
      rawTypeName: 'Body temperature',
    })),
  ];
  if (records.length) await wearableRepository.upsertRecords(records);

  const current = await profileRepository.get();
  await profileRepository.save({
    ...current,
    sex: p.profile.sex === 'other' ? undefined : p.profile.sex,
    dateOfBirth: birthDateForAge(p.profile.age),
    conditions: (p.profile.conditions ?? []) as typeof current.conditions,
    completedAt: current.completedAt ?? now.toISOString(),
  });

  // Objetivo del ciclo y silencios vigentes hoy; historial de avisos de los días anteriores
  const { ctx, prefs } = contextAt(x, now);
  if (ctx.cycleGoal) await cycleGoalStore.set(ctx.cycleGoal);
  else await userFlags.set('cycle_goal', false);
  await userFlags.set('nudge_prefs', prefs as unknown as Record<string, unknown>);
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
  await nudgeStore.saveInbox(inbox);
  // Las secciones opcionales que usa este usuario, encendidas (las demás como estuvieran)
  const optIn: AppSection[] = [];
  if (x.bowel.length) optIn.push('gut');
  if (x.urine.length) optIn.push('bladder');
  if (x.medications.length) optIn.push('medication');
  for (const section of optIn) await appPrefs.setSectionVisible(section, true);
  await userFlags.set(SIM_KEY, { personaId: p.id, name: p.name, day0: start.toISOString() } as unknown as Record<string, unknown>);

  // Nombre del usuario demo y pantalla de usuario habitual (AuthContext los lee al arrancar)
  await AsyncStorage.multiSet([
    ['auth.demoUser.v1', JSON.stringify({ id: mockPatient.id, email: `${p.id}@kuova.test`, nombre: p.profile.firstName ?? p.name })],
    ['auth.demoMode.v1', 'returning'],
  ]);
  reloadApp();
}

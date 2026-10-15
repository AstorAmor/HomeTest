import AsyncStorage from '@react-native-async-storage/async-storage';
import { DevSettings, Platform } from 'react-native';
import * as Updates from 'expo-updates';
import { getCurrentUserId, isRemoteActive, supabase } from '@/lib/supabase';
import { PERSONAS } from '../../simulation/personas';
import type { Persona } from '@/logic/nudges';
import {
  ActiveSimulation,
  clearScenarioAccount,
  loadScenarioIntoAccount,
  scenarioRecords,
  ScenarioAccountIO,
  ScenarioRecords,
  SCENARIO_ACCOUNT_FLAG,
} from '@/logic/scenarioAccount';
import { profileRepository } from './profileRepository';
import { cycleGoalStore } from './cycleGoal';
import { userFlags } from './userFlags';
import { nudgeStore } from './nudgeStore';
import { wearableRepository } from '@/wearables/wearableRepository';
import { mockPatient } from './mockData';
import { appPrefs } from './appPrefs';
import { isRealAccount, REAL_ACCOUNT_FLAG } from './dataMode';
import { checkInRepository } from './checkInRepository';
import { cycleRepository } from './cycleRepository';
import { mealRepository, workoutRepository } from './planRepository';
import { bowelRepository, urineRepository } from './bathroomRepository';
import { doseRepository, medicationRepository } from './medicationRepository';
import { bloodPressureRepository } from './bloodPressureRepository';
import { glucoseRepository } from './glucoseRepository';
import { basalTemperatureRepository, thermometerRepository } from './temperatureRepository';
import { cholesterolRepository } from './cholesterolRepository';
import { cortisolRepository } from './cortisolRepository';
import { vo2maxRepository } from './vo2maxRepository';

// Usuarios simulados dentro de la app (Developer mode → Simulated users, y Ajustes → Test
// scenarios en una cuenta de prueba). Cargan los JSON de simulation/personas hasta hoy (día 0),
// con su historial de avisos ya recibido:
// - Modo demo (sin Supabase): en AsyncStorage, sustituyendo los datos de ejemplo del móvil.
// - Cuenta de prueba de Supabase: en sus tablas de verdad, a través de los repositorios, para
//   ver el caso en el móvil (APK) igual que lo vería esa persona. Antes se vacía lo que hubiera.
// - Cuenta real: nunca (src/logic/scenarioAccount.ts vuelve a mirar la marca en Supabase).

export { PERSONAS };
export type { Persona, ActiveSimulation };

const SIM_KEY = 'simulation';

export const localMidnight = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

export async function activeSimulation(): Promise<ActiveSimulation | null> {
  const v = await userFlags.get(SIM_KEY);
  return v && typeof v === 'object' && 'personaId' in v ? (v as unknown as ActiveSimulation) : null;
}

// Dónde se cargaría un usuario simulado ahora mismo
export type ScenarioTarget = 'demo' | 'test_account' | 'real_account';
export const scenarioTarget = (): ScenarioTarget =>
  !isRemoteActive() ? 'demo' : isRealAccount() ? 'real_account' : 'test_account';

// Recarga para que AuthContext y las pantallas lean lo nuevo; en la web, entrando por el inicio (Today)
function reloadApp() {
  if (Platform.OS === 'web') window.location.assign('/');
  else if (__DEV__) DevSettings.reload();
  else Updates.reloadAsync().catch(() => undefined);
}

// Perfil, objetivo del ciclo, silencios, historial de avisos y secciones: igual en demo y en cuenta
async function writeSettings(r: ScenarioRecords) {
  const current = await profileRepository.get();
  await profileRepository.save({
    ...current,
    sex: r.profile.sex,
    dateOfBirth: r.profile.dateOfBirth,
    conditions: r.profile.conditions,
    completedAt: current.completedAt ?? new Date().toISOString(),
  });
  if (r.cycleGoal) await cycleGoalStore.set(r.cycleGoal);
  else await userFlags.set('cycle_goal', false);
  await userFlags.set('nudge_prefs', r.nudgePrefs as unknown as Record<string, unknown>);
  await nudgeStore.saveInbox(r.inbox);
  // Las secciones opcionales que usa este usuario, encendidas (las demás como estuvieran)
  await appPrefs.load();
  for (const section of r.sections) await appPrefs.setSectionVisible(section, true);
  await userFlags.set(SIM_KEY, r.simulation as unknown as Record<string, unknown>);
}

// --- Modo demo (AsyncStorage) ------------------------------------------------------------------

async function loadPersonaInDemo(p: Persona): Promise<void> {
  const r = scenarioRecords(p, localMidnight(), new Date());

  // Mismas claves que usan los repositorios en modo demo (AsyncStorage)
  await AsyncStorage.multiSet([
    ['hometest:check_ins', JSON.stringify(r.checkIns)],
    ['hometest:cycle_entries', JSON.stringify(r.cycleStarts)],
    ['hometest:workouts', JSON.stringify(r.workouts)],
    ['hometest:meals', JSON.stringify(r.meals)],
    ['hometest:bowel_logs', JSON.stringify(r.bowel)],
    ['hometest:urine_logs', JSON.stringify(r.urine)],
    ['hometest:medications', JSON.stringify(r.medications)],
    ['hometest:medication_doses', JSON.stringify(r.doses)],
    ['hometest:blood_pressure_entries', JSON.stringify(r.bloodPressure)],
    ['hometest:glucose_entries', JSON.stringify(r.glucose)],
    ['hometest:basal_temperature', JSON.stringify(r.basalTemperature)],
  ]);
  await wearableRepository.clearRecords();
  if (r.wearable.length) await wearableRepository.upsertRecords(r.wearable);
  await writeSettings(r);

  // Nombre del usuario demo y pantalla de usuario habitual (AuthContext los lee al arrancar)
  await AsyncStorage.multiSet([
    ['auth.demoUser.v1', JSON.stringify({ id: mockPatient.id, email: `${p.id}@kuova.test`, nombre: r.profile.firstName })],
    ['auth.demoMode.v1', 'returning'],
  ]);
}

// --- Cuenta de prueba (Supabase) ---------------------------------------------------------------

// Lo que registra el usuario día a día: es lo que se vacía en una cuenta de prueba. Se quedan
// las analíticas, archivos, pedidos, permisos a profesionales, chats, el perfil y los ajustes.
const LOG_REPOSITORIES = [
  checkInRepository,
  workoutRepository,
  mealRepository,
  cycleRepository,
  bowelRepository,
  urineRepository,
  medicationRepository,
  doseRepository,
  bloodPressureRepository,
  glucoseRepository,
  basalTemperatureRepository,
  thermometerRepository,
  cholesterolRepository,
  cortisolRepository,
  vo2maxRepository,
];
// Lo mismo, para decirlo antes de borrar
export const CLEARED_LOGS =
  'check-ins, measurements, medication, digestion, cycle, workouts, meals, wearable days and notifications';

const accountIO: ScenarioAccountIO = {
  signedIn: () => isRemoteActive() && !!getCurrentUserId(),
  realNow: isRealAccount,
  // Directo a Supabase (sin la copia local de userFlags): si no se puede leer, no se toca nada
  async readFlags() {
    const { data, error } = await supabase!
      .from('user_flags')
      .select('key, value')
      .eq('user_id', getCurrentUserId()!)
      .in('key', [REAL_ACCOUNT_FLAG, SCENARIO_ACCOUNT_FLAG]);
    if (error || !data) throw new Error(error?.message ?? 'No data');
    const value = (key: string) => data.find((row) => row.key === key)?.value;
    return { realAccount: value(REAL_ACCOUNT_FLAG), scenarioAccount: value(SCENARIO_ACCOUNT_FLAG) };
  },
  markScenarioAccount: () => userFlags.set(SCENARIO_ACCOUNT_FLAG, true),
  async clear() {
    // Las fotos de las comidas (bucket meal-photos, carpeta del usuario) antes que sus filas
    const photos = (await mealRepository.getAll()).map((m) => m.photoPath).filter((x): x is string => !!x);
    if (photos.length) await supabase!.storage.from('meal-photos').remove(photos).catch(() => undefined);
    await Promise.all(LOG_REPOSITORIES.map((repo) => repo.clearAll()));
    await wearableRepository.clearRecords();
    await userFlags.set('nudge_inbox', { items: [] });
    await userFlags.set('nudge_prefs', { muted: {} });
    await userFlags.set('cycle_goal', false);
    await userFlags.set(SIM_KEY, false);
  },
  async write(r) {
    await Promise.all([
      checkInRepository.saveMany(r.checkIns),
      cycleRepository.saveMany(r.cycleStarts),
      workoutRepository.saveMany(r.workouts),
      mealRepository.saveMany(r.meals),
      bowelRepository.saveMany(r.bowel),
      urineRepository.saveMany(r.urine),
      medicationRepository.saveMany(r.medications),
      doseRepository.saveMany(r.doses),
      bloodPressureRepository.saveMany(r.bloodPressure),
      glucoseRepository.saveMany(r.glucose),
      basalTemperatureRepository.saveMany(r.basalTemperature),
    ]);
    if (r.wearable.length) await wearableRepository.upsertRecords(r.wearable);
    await writeSettings(r);
  },
};

// Carga el usuario simulado donde toque (demo o cuenta de prueba) y recarga la app en Today.
// En una cuenta real lanza un error con el motivo y no toca nada.
export async function loadPersona(p: Persona): Promise<void> {
  if (isRemoteActive()) await loadScenarioIntoAccount(accountIO, p, localMidnight());
  else await loadPersonaInDemo(p);
  reloadApp();
}

// Vacía lo registrado en la cuenta de prueba (solo las filas de este usuario). Nunca en una real.
export async function clearTestAccount(): Promise<void> {
  if (!isRemoteActive()) throw new Error('Sign in to a test account first.');
  await clearScenarioAccount(accountIO);
  reloadApp();
}

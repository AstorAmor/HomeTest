import AsyncStorage from '@react-native-async-storage/async-storage';
import { getCurrentUserId, isRemoteActive, supabase } from '@/lib/supabase';
import { showSamples } from '@/data/dataMode';
import { DEFAULT_PREFS, newProgram } from '@/logic/workoutGenerator';
import type { WorkoutCompletion, WorkoutProgram } from './types';

// Programas de entrenamiento del usuario: los que se hace con el generador y los que le manda su
// profesional desde el portal.
//
// Dónde viven: con cuenta, tabla `workout_programs` (migración 20261019120000_workout_programs.sql,
// aplicada el 2026-10-19); sin cuenta (demo), en este dispositivo. Lo que se guardó en el móvil antes de
// tener la tabla se sube la primera vez. En cuentas de prueba y en la demo sale además un programa de
// ejemplo "de tu entrenador" (siempre en el móvil).
export const REMOTE_HAS_WORKOUT_PROGRAMS = true;

const KEY = 'workouts.programs.v1';
const SAMPLE_OFF_KEY = 'workouts.sampleDismissed.v1';
export const SAMPLE_PROGRAM_ID = 'wp-sample-trainer';

const remote = () => REMOTE_HAS_WORKOUT_PROGRAMS && isRemoteActive();

async function readLocal(): Promise<WorkoutProgram[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as WorkoutProgram[]) : [];
  } catch {
    return [];
  }
}
const writeLocal = (list: WorkoutProgram[]) => AsyncStorage.setItem(KEY, JSON.stringify(list)).catch(() => undefined);

type Row = {
  id: string;
  patient_id: string;
  professional_id: string | null;
  professional_name: string | null;
  title: string;
  prefs: WorkoutProgram['prefs'];
  sessions: WorkoutProgram['sessions'];
  note: string;
  active: boolean;
  completions: WorkoutCompletion[];
  created_at: string;
};

export const fromRow = (r: Row): WorkoutProgram => ({
  id: r.id,
  title: r.title,
  createdAt: r.created_at,
  source: r.professional_id ? 'professional' : 'self',
  professionalId: r.professional_id,
  professionalName: r.professional_name,
  patientId: r.patient_id,
  prefs: { ...DEFAULT_PREFS, ...(r.prefs ?? {}) },
  sessions: r.sessions ?? [],
  note: r.note || undefined,
  active: r.active,
  completions: r.completions ?? [],
});

export const toRow = (p: WorkoutProgram) => ({
  id: p.id,
  title: p.title.slice(0, 120) || 'Workout',
  prefs: p.prefs,
  sessions: p.sessions,
  note: p.note ?? '',
  active: p.active,
  completions: p.completions,
});

// Programa de ejemplo "de tu entrenador" (solo cuentas de prueba y demo), para ver cómo llega uno
function sampleProgram(): WorkoutProgram {
  const prog = newProgram(
    { ...DEFAULT_PREFS, goal: 'health', level: 'beginner', daysPerWeek: 2, minutes: 30, place: 'home_kit', equipment: ['dumbbells', 'bands'], seed: 11 },
    {
      id: SAMPLE_PROGRAM_ID,
      title: 'Strength to get started',
      source: 'professional',
      professionalName: 'Álex Romero',
      note: 'Two short sessions a week to build the habit. Go slowly the first week and tell me how it went.',
      active: false,
    },
  );
  return { ...prog, createdAt: '2026-10-15T09:00:00.000Z' };
}
export const isSampleProgram = (p: Pick<WorkoutProgram, 'id'>) => p.id === SAMPLE_PROGRAM_ID;

async function listRemote(): Promise<WorkoutProgram[]> {
  const { data, error } = await supabase!.from('workout_programs').select('*').eq('patient_id', getCurrentUserId()).order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data as Row[]).map(fromRow);
}

// Sube una vez lo que se guardó en el móvil antes de tener la tabla (menos el ejemplo)
async function uploadLocalOnce(local: WorkoutProgram[]): Promise<WorkoutProgram[]> {
  const mine = local.filter((p) => !isSampleProgram(p) && p.source === 'self');
  if (!mine.length) return local;
  const { error } = await supabase!.from('workout_programs').upsert(
    mine.map((p) => ({ ...toRow(p), patient_id: getCurrentUserId() })),
    { onConflict: 'patient_id,id' },
  );
  if (error) return local;
  const rest = local.filter((p) => !mine.includes(p));
  await writeLocal(rest);
  return rest;
}

export const programRepository = {
  async list(): Promise<WorkoutProgram[]> {
    let local = await readLocal();
    if (remote()) local = await uploadLocalOnce(local);
    // Con la tabla, lo propio y lo del entrenador viene de Supabase; el ejemplo vive siempre en el móvil
    let list = remote() ? [...(await listRemote().catch(() => local.filter((p) => !isSampleProgram(p)))), ...local.filter(isSampleProgram)] : local;
    if (showSamples() && !list.some(isSampleProgram) && (await AsyncStorage.getItem(SAMPLE_OFF_KEY).catch(() => null)) !== '1') {
      list = [...list, sampleProgram()];
    }
    // El activo primero; luego los más nuevos
    return list.sort((a, b) => Number(b.active) - Number(a.active) || b.createdAt.localeCompare(a.createdAt));
  },

  async get(id: string): Promise<WorkoutProgram | null> {
    return (await this.list()).find((p) => p.id === id) ?? null;
  },

  // Guardar (nuevo o cambiado). Solo puede quedar uno activo.
  async save(program: WorkoutProgram): Promise<void> {
    if (remote() && !isSampleProgram(program)) {
      const { error } = await supabase!.from('workout_programs').upsert({ ...toRow(program), patient_id: getCurrentUserId() }, { onConflict: 'patient_id,id' });
      if (error) throw new Error(error.message);
      if (program.active) {
        await supabase!.from('workout_programs').update({ active: false }).eq('patient_id', getCurrentUserId()).neq('id', program.id).eq('active', true);
      }
      return;
    }
    const list = await readLocal();
    const next = list.filter((p) => p.id !== program.id).map((p) => (program.active ? { ...p, active: false } : p));
    await writeLocal([program, ...next]);
  },

  async setActive(id: string): Promise<void> {
    const p = await this.get(id);
    if (p) await this.save({ ...p, active: true });
  },

  async remove(id: string): Promise<void> {
    if (id === SAMPLE_PROGRAM_ID) await AsyncStorage.setItem(SAMPLE_OFF_KEY, '1').catch(() => undefined);
    if (remote() && id !== SAMPLE_PROGRAM_ID) {
      const { error } = await supabase!.from('workout_programs').delete().eq('patient_id', getCurrentUserId()).eq('id', id);
      if (error) throw new Error(error.message);
      return;
    }
    await writeLocal((await readLocal()).filter((p) => p.id !== id));
  },

  async logCompletion(id: string, completion: WorkoutCompletion): Promise<void> {
    const p = await this.get(id);
    if (!p) return;
    await this.save({ ...p, completions: [...p.completions, completion] });
  },
};

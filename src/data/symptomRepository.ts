// El registro de síntomas (lógica en src/logic/symptoms.ts; fundador, 2026-11-17). Sin tabla nueva ni migración: en
// las cuentas, en la tabla genérica metric_readings con kind 'symptom', una fila por síntoma marcado:
//   id 'sym:<apunte>:<síntoma>' · value = intensidad (1 leve, 2 moderada, 3 fuerte) · measured_at = cuándo empezó ·
//   unit = un JSON corto con lo demás: dónde (zonas y texto), el nombre de «Otro» y la nota del apunte.
// (`unit` es la única columna de texto de esa tabla y no tiene restricciones.) Sin sesión, lo mismo en el móvil
// (AsyncStorage). Todo va a la cuenta: nada se queda solo en el móvil. No salen en la vista del profesional
// (src/data/sharing.ts), como las etiquetas del check-in.
// En la demo y en las cuentas de prueba, sin nada propio, un ejemplo que nunca se guarda (sampleSymptoms).
import { createMetricRepository, definedOnly } from './metricRepository';
import { showSamples } from './dataMode';
import { checkInRepository } from './checkInRepository';
import { cycleRepository } from './cycleRepository';
import { cycleGoalStore } from './cycleGoal';
import { profileRepository } from './profileRepository';
import { wearableRepository } from '@/wearables/wearableRepository';
import { toDailySeries } from '@/wearables/seriesLogic';
import { cycleByDay } from '@/logic/dayChart';
import { checkInDayKey } from '@/logic/checkInDay';
import type { CycleEntry } from '@/types/cycle';
import {
  PATTERN,
  SYMPTOM_KIND,
  cleanSymptomEntries,
  packSymptomExtras,
  sampleSymptoms,
  symptomDayKey,
  symptomFromRow,
  type SymptomContext,
  type SymptomEntry,
} from '@/logic/symptoms';

export const symptomRepository = createMetricRepository<SymptomEntry>('hometest:symptom_entries', {
  table: 'metric_readings',
  dateColumn: 'measured_at',
  match: { kind: SYMPTOM_KIND },
  toRow: (e) =>
    definedOnly({
      id: e.id,
      value: e.intensity,
      // Lo demás, solo con el apunte entero (un cambio parcial no lo pisa)
      unit: e.symptom ? packSymptomExtras(e) : undefined,
      measured_at: e.fecha,
      created_at: e.createdAt,
    }),
  // Una fila que no se entiende (de otra versión de la app) sale con su id tal cual y loadSymptoms la descarta
  fromRow: (r) => symptomFromRow(r) ?? { id: String(r.id), symptom: 'other', intensity: 1, fecha: r.measured_at, createdAt: r.created_at },
});

// Todo lo apuntado, del más reciente al más antiguo
export async function loadSymptoms(): Promise<SymptomEntry[]> {
  return cleanSymptomEntries(await symptomRepository.getAll());
}

// Los síntomas de un apunte (buildSymptomEntries), de una vez
export async function saveSymptoms(entries: SymptomEntry[]): Promise<void> {
  if (entries.length) await symptomRepository.saveMany(entries);
}

export const removeSymptom = (id: string): Promise<void> => symptomRepository.remove(id);

// Los últimos días que miran los patrones, del más antiguo a hoy
const windowKeys = (now: Date) =>
  Array.from({ length: PATTERN.windowDays }, (_, i) => {
    const d = new Date(now);
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() - (PATTERN.windowDays - 1 - i));
    return symptomDayKey(d);
  });

// La fase estimada del ciclo de cada día (la misma cuenta que «Tus últimos días»); antes de la primera regla
// apuntada no se sabe y ese día no sale
const phasesOf = (keys: string[], entries: CycleEntry[], length: number | null, sample: boolean): SymptomContext['phases'] => {
  const out: SymptomContext['phases'] = {};
  cycleByDay(keys, entries, length, sample).forEach((d, i) => {
    if (d) out[keys[i]] = d.phase;
  });
  return out;
};

const isFemale = async () => (await profileRepository.get().catch(() => null))?.sex === 'female';

// Lo que se sabe de cada día para cruzarlo con los síntomas: las horas de sueño del reloj o la pulsera, lo que
// dijo en el check-in de la mañana («¿Cómo has dormido?») y, en mujeres con alguna regla apuntada, la fase del ciclo
export async function loadSymptomContext(now = new Date()): Promise<SymptomContext> {
  const keys = windowKeys(now);
  const from = keys[0];
  const [records, checkIns, female] = await Promise.all([
    wearableRepository.getRecords().catch(() => []),
    checkInRepository.getAll().catch(() => []),
    isFemale(),
  ]);

  const sleepMinutes: SymptomContext['sleepMinutes'] = {};
  for (const p of toDailySeries(records).sleep_duration ?? []) if (p.date >= from) sleepMinutes[p.date] = p.value;

  const sleepRating: SymptomContext['sleepRating'] = {};
  for (const c of [...checkIns].sort((a, b) => a.fecha.localeCompare(b.fecha))) {
    const day = checkInDayKey(c);
    if (c.sleep != null && day >= from) sleepRating[day] = c.sleep;
  }

  let phases: SymptomContext['phases'] = {};
  if (female) {
    const [entries, goal] = await Promise.all([cycleRepository.getAll().catch(() => [] as CycleEntry[]), cycleGoalStore.get().catch(() => null)]);
    if (entries.length) phases = phasesOf(keys, entries, goal?.cycleLength ?? null, false);
  }
  return { sleepMinutes, sleepRating, phases };
}

export interface SymptomData {
  entries: SymptomEntry[];
  context: SymptomContext;
  sample: boolean; // de ejemplo (demo y cuentas de prueba sin nada propio): no se puede quitar nada
}

// Lo que enseña «Tus síntomas»: lo apuntado con su contexto. Sin nada propio, en la demo y en las cuentas de
// prueba, el ejemplo con su propio sueño de ejemplo (y el ciclo de ejemplo de la app, en mujeres): lo de ejemplo
// nunca se cruza con datos de verdad.
export async function loadSymptomData(now = new Date()): Promise<SymptomData> {
  const entries = await loadSymptoms();
  if (entries.length || !showSamples()) return { entries, context: await loadSymptomContext(now), sample: false };
  const sample = sampleSymptoms(now);
  const phases = (await isFemale()) ? phasesOf(windowKeys(now), [], null, true) : {};
  return { entries: sample.entries, context: { sleepMinutes: sample.sleepMinutes, sleepRating: {}, phases }, sample: true };
}

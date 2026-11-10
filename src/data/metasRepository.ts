// Objetivos y metas de Hoy (lógica en src/logic/metas.ts). Sin tablas nuevas:
// - Lo elegido (objetivos, metas, cómo se ajusta cada una, las tuyas, el compromiso y la enhorabuena
//   cerrada) va en user_flags 'metas.v1', como los objetivos del día.
// - Lo que apuntas a mano, en metric_readings con kind 'meta': una fila por meta y día, con id
//   'meta:<meta>:<día>' y la hora a mediodía. Va en la unidad base (el tabaco, en cigarrillos). Las filas
//   están en la categoría «metrics» al compartir, pero la vista del profesional no las enseña
//   (src/data/sharing.ts).
// - Lo que llega solo (reloj, Entrenamientos, check-in) no se copia: se lee cada vez.
import { createMetricRepository } from './metricRepository';
import { simpleMetricRemote } from './simpleMetricRemote';
import type { SimpleMetricEntry } from '@/types/simpleMetric';
import { userFlags } from './userFlags';
import { showSamples } from './dataMode';
import { noonOf } from './bathroomRepository';
import { profileRepository, type UserProfile } from './profileRepository';
import { labUploadRepository } from './labUploads';
import { markerIdForExtractedName } from './markerMatching';
import { currentReport } from './reportRepository';
import {
  demoState,
  emptyState,
  initialGoals,
  labGoals,
  normalizeState,
  type DayMap,
  type LabReading,
  type Meta,
  type MetasState,
  type Who,
} from '@/logic/metas';

export const METAS_FLAG = 'metas.v1';
export const METAS_SOURCE = `flag:${METAS_FLAG}`;
export const METAS_VALUES_SOURCE = 'hometest:metas_values';

export const metaValueRepository = createMetricRepository<SimpleMetricEntry>(METAS_VALUES_SOURCE, simpleMetricRemote('meta'));

const entryId = (id: string, day: string) => `meta:${id}:${day}`;
const parseEntryId = (eid: string) => {
  const m = /^meta:(.+):(\d{4}-\d{2}-\d{2})$/.exec(eid);
  return m ? { id: m[1], day: m[2] } : null;
};

const baseUnit = (m: Meta) =>
  m.kind === 'yesno' ? 'yesno' : m.def?.tobacco ? 'cigarettes' : m.def?.alcohol ? 'drinks' : m.rawUnit ? m.one || 'units' : m.many;

// Lo apuntado a mano, por meta y día
export async function loadManualValues(): Promise<DayMap> {
  const out: DayMap = {};
  for (const e of await metaValueRepository.getAll().catch(() => [] as SimpleMetricEntry[])) {
    const k = parseEntryId(e.id);
    if (!k || !Number.isFinite(e.valor)) continue;
    (out[k.id] ??= {})[k.day] = e.valor;
  }
  return out;
}

// Apunta (o borra, con null) lo de una meta en un día
export async function setMetaValue(m: Meta, day: string, value: number | null): Promise<void> {
  const id = entryId(m.id, day);
  if (value == null) return metaValueRepository.remove(id);
  await metaValueRepository.saveMany([{ id, valor: value, unidad: baseUnit(m), fecha: noonOf(day), createdAt: new Date().toISOString() }]);
}

export const whoOf = (p: Pick<UserProfile, 'smoking' | 'alcohol'> | null | undefined): Who => ({
  smoker: p?.smoking === 'occasional' || p?.smoking === 'current',
  drinker: !!p?.alcohol && p.alcohol !== 'never',
});

const LAB_MARKERS = ['ldl', 'hdl', 'triglycerides', 'glucose', 'hba1c'];

// Los valores de la analítica que miran los objetivos recomendados. En la demo, la analítica de ejemplo;
// en una cuenta real, la más reciente que haya subido con cada uno.
export async function loadLabReadings(): Promise<LabReading[]> {
  if (showSamples()) {
    return currentReport.sections
      .flatMap((s) => s.markers)
      .filter((m) => LAB_MARKERS.includes(m.marker_id) && typeof m.value === 'number')
      .map((m) => ({ marker: m.marker_id, value: m.value as number, unit: m.unit, low: m.range.low, high: m.range.high }));
  }
  const uploads = await labUploadRepository.getAll().catch(() => []);
  const day = (u: (typeof uploads)[number]) => u.testDate ?? u.createdAt.slice(0, 10);
  const out = new Map<string, LabReading>();
  for (const u of [...uploads].sort((a, b) => day(b).localeCompare(day(a))))
    for (const sec of u.data.secciones)
      for (const p of sec.parametros) {
        const marker = typeof p.valor === 'number' ? markerIdForExtractedName(p.nombre) : null;
        if (marker && LAB_MARKERS.includes(marker) && !out.has(marker))
          out.set(marker, { marker, value: p.valor, unit: p.unidad || null, low: p.rango_min, high: p.rango_max });
      }
  return [...out.values()];
}

// Lo elegido. La primera vez (sin nada guardado): en la demo, el ejemplo; si no, los objetivos que
// recomienda tu analítica y los del cuestionario de inicio, sin metas todavía.
export async function loadMetasState(today: string, profile: UserProfile | null, lab: LabReading[]): Promise<{ state: MetasState; saved: boolean }> {
  const raw = await userFlags.get(METAS_FLAG).catch(() => undefined);
  if (raw && typeof raw === 'object') return { state: normalizeState(raw), saved: true };
  if (showSamples()) return { state: demoState(today), saved: false };
  const goals = initialGoals(labGoals(lab).map((g) => g.key), profile?.goals ?? [], whoOf(profile));
  return { state: { ...emptyState(), goals }, saved: false };
}

export const saveMetasState = (s: MetasState) => userFlags.set(METAS_FLAG, s as unknown as Record<string, unknown>);

export const loadProfile = () => profileRepository.get().catch(() => null);

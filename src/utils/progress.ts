import { currentReport } from '@/data/reportRepository';
import { getMarkerDisplayNameEn } from '@/data/reportContentEn';
import { markerIdForExtractedName, sameUnit } from '@/data/markerMatching';
import { LabUpload } from '@/data/labUploads';
import { markerIn } from '@/data/planHistory';

// Compara una analítica subida con el último valor conocido de cada marcador.
// Reglas (conservadoras a propósito):
// - Solo se comparan marcadores reconocidos con seguridad (catálogo canónico) y con
//   la MISMA unidad. Lo que no se ha vuelto a medir no se toca.
// - El rango es el del laboratorio de la analítica nueva; si no lo trae, el del informe.

export type RangeStatus = 'low' | 'in' | 'high';
export type ChangeVerdict = 'back_in_range' | 'improving' | 'stable_out' | 'worsening' | 'newly_out' | 'still_in_range';

export interface MarkerChange {
  markerId: string;
  name: string;
  unit: string;
  before: number;
  beforeDate: string;
  beforeSource: string;
  after: number;
  low: number | null;
  high: number | null;
  beforeStatus: RangeStatus;
  afterStatus: RangeStatus;
  verdict: ChangeVerdict;
}

export interface ProgressResult {
  changes: MarkerChange[];
  firstTime: { name: string; value: number; unit: string; status: RangeStatus }[]; // reconocidos pero sin valor previo
  notCompared: { name: string; reason: string }[];
}

const status = (v: number, low: number | null, high: number | null): RangeStatus =>
  low !== null && v < low ? 'low' : high !== null && v > high ? 'high' : 'in';

// Distancia relativa al límite más cercano (0 si está dentro del rango).
const distance = (v: number, low: number | null, high: number | null) => {
  if (low !== null && v < low) return (low - v) / (low || 1);
  if (high !== null && v > high) return (v - high) / (high || 1);
  return 0;
};

interface Known {
  value: number;
  unit: string;
  date: string;
  source: string;
  low: number | null;
  high: number | null;
}

// Último valor conocido de cada marcador ANTES de la subida: informe actual y subidas anteriores.
function knownValues(previousUploads: LabUpload[]): Record<string, Known> {
  const known: Record<string, Known> = {};
  for (const s of currentReport.sections) {
    for (const m of s.markers) {
      if (typeof m.value === 'number') {
        known[m.marker_id] = {
          value: m.value,
          unit: m.unit ?? '',
          date: currentReport.test_date,
          source: 'your HomeTest report',
          low: m.range.low,
          high: m.range.high,
        };
      }
    }
  }
  const older = [...previousUploads].sort((a, b) => (a.testDate ?? a.createdAt).localeCompare(b.testDate ?? b.createdAt));
  for (const u of older) {
    const date = u.testDate ?? u.createdAt.slice(0, 10);
    for (const sec of u.data.secciones) {
      for (const p of sec.parametros) {
        const id = markerIdForExtractedName(p.nombre);
        if (!id || typeof p.valor !== 'number') continue;
        if (!known[id] || known[id].date <= date) {
          known[id] = { value: p.valor, unit: p.unidad, date, source: u.labName ?? 'an uploaded test', low: p.rango_min, high: p.rango_max };
        }
      }
    }
  }
  return known;
}

export function compareUpload(upload: LabUpload, previousUploads: LabUpload[]): ProgressResult {
  const known = knownValues(previousUploads);
  const result: ProgressResult = { changes: [], firstTime: [], notCompared: [] };
  const seen = new Set<string>();

  for (const sec of upload.data.secciones) {
    for (const p of sec.parametros) {
      if (typeof p.valor !== 'number' || Number.isNaN(p.valor)) continue;
      const id = markerIdForExtractedName(p.nombre);
      if (!id) {
        result.notCompared.push({ name: p.nombre, reason: 'Not recognised yet' });
        continue;
      }
      if (seen.has(id)) continue;
      seen.add(id);
      const prev = known[id];
      const reportMarker = markerIn(currentReport, id);
      const name = getMarkerDisplayNameEn(id, reportMarker?.display_name ?? p.nombre);
      const low = p.rango_min ?? prev?.low ?? reportMarker?.range.low ?? null;
      const high = p.rango_max ?? prev?.high ?? reportMarker?.range.high ?? null;
      if (!prev) {
        result.firstTime.push({ name, value: p.valor, unit: p.unidad, status: status(p.valor, low, high) });
        continue;
      }
      if (!sameUnit(prev.unit, p.unidad)) {
        result.notCompared.push({ name, reason: `Different unit (${prev.unit} before, ${p.unidad} now)` });
        continue;
      }
      const beforeStatus = status(prev.value, low, high);
      const afterStatus = status(p.valor, low, high);
      let verdict: ChangeVerdict;
      if (beforeStatus === 'in' && afterStatus === 'in') verdict = 'still_in_range';
      else if (beforeStatus !== 'in' && afterStatus === 'in') verdict = 'back_in_range';
      else if (beforeStatus === 'in') verdict = 'newly_out';
      else {
        const d0 = distance(prev.value, low, high);
        const d1 = distance(p.valor, low, high);
        // Cambios de menos del 5% del valor se consideran ruido de laboratorio.
        const small = Math.abs(p.valor - prev.value) < Math.abs(prev.value) * 0.05;
        verdict = small ? 'stable_out' : d1 < d0 ? 'improving' : 'worsening';
      }
      result.changes.push({
        markerId: id,
        name,
        unit: p.unidad,
        before: prev.value,
        beforeDate: prev.date,
        beforeSource: prev.source,
        after: p.valor,
        low,
        high,
        beforeStatus,
        afterStatus,
        verdict,
      });
    }
  }
  const order: ChangeVerdict[] = ['newly_out', 'worsening', 'stable_out', 'improving', 'back_in_range', 'still_in_range'];
  result.changes.sort((a, b) => order.indexOf(a.verdict) - order.indexOf(b.verdict));
  return result;
}

export const VERDICT_LABEL: Record<ChangeVerdict, string> = {
  back_in_range: 'Back in range',
  improving: 'Improving',
  stable_out: 'No real change',
  worsening: 'Getting worse',
  newly_out: 'Now out of range',
  still_in_range: 'Still in range',
};

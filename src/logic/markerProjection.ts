import type { LabUpload } from '@/data/labUploads';
import { markerIdForExtractedName } from '@/data/markerMatching';
import { getRangeStatus } from '@/utils/rangeStatus';

// "Cómo podrían cambiar tus marcadores" en el plan completo, para una cuenta con analíticas subidas:
// para cada marcador fuera de rango que el plan trabaja, cuánto podría moverse en 6 meses si se
// mantienen los cambios de rutina del plan (la forma de la curva la pone logic/projection.ts).
//
// ⚠ SUPUESTO, pendiente de revisión clínica (como los plazos de projection.ts): efectos típicos de
// cambios de estilo de vida mantenidos, redondeados a partir de la literatura general —
// - LDL y colesterol total con dieta (menos grasa saturada, más fibra, frutos secos): LDL −10–15 %,
//   total algo menos (guía ESC/EAS 2019 de dislipemias, tabla de intervenciones de estilo de vida;
//   Mensink 2016, OMS).
// - HDL con ejercicio aeróbico regular: +2–4 mg/dL (Kodama 2007, metaanálisis).
// - Triglicéridos con ejercicio, menos azúcar y alcohol: −20–30 % (ESC/EAS 2019).
// - Glucosa en ayunas y HbA1c con actividad y dieta: −5 % y −0,2–0,5 puntos (Umpierre 2011).
// - Vitamina D con sol y pescado azul (sin suplemento): +5–15 ng/mL.
// - PCR, ALT/GGT y ácido úrico: −10–40 % al quitar la causa (alcohol, peso, sedentarismo).
// Nunca se proyecta más allá de volver al rango, y la banda se abre con el tiempo: es una estimación.

interface Effect {
  kind: 'pct' | 'abs';
  typical: number;
  low: number;
  high: number;
  fixes: 'high' | 'low'; // qué desvío corrige (LDL alto; HDL o vitamina D bajos)
  unit?: string; // solo para efectos absolutos: la unidad en la que están
}

const EFFECTS: Record<string, Effect> = {
  ldl: { kind: 'pct', typical: -0.12, low: -0.06, high: -0.18, fixes: 'high' },
  total_cholesterol: { kind: 'pct', typical: -0.08, low: -0.04, high: -0.12, fixes: 'high' },
  non_hdl_cholesterol: { kind: 'pct', typical: -0.1, low: -0.05, high: -0.15, fixes: 'high' },
  triglycerides: { kind: 'pct', typical: -0.25, low: -0.12, high: -0.35, fixes: 'high' },
  hdl: { kind: 'abs', typical: 3, low: 1, high: 6, fixes: 'low', unit: 'mg/dl' },
  glucose: { kind: 'pct', typical: -0.05, low: -0.02, high: -0.09, fixes: 'high' },
  hba1c: { kind: 'abs', typical: -0.3, low: -0.1, high: -0.5, fixes: 'high', unit: '%' },
  vitamin_d: { kind: 'abs', typical: 10, low: 5, high: 15, fixes: 'low', unit: 'ng/ml' },
  hs_crp: { kind: 'pct', typical: -0.25, low: -0.1, high: -0.4, fixes: 'high' },
  alt: { kind: 'pct', typical: -0.2, low: -0.1, high: -0.35, fixes: 'high' },
  ggt: { kind: 'pct', typical: -0.25, low: -0.1, high: -0.4, fixes: 'high' },
  uric_acid: { kind: 'pct', typical: -0.08, low: -0.03, high: -0.12, fixes: 'high' },
};

export interface MarkerProjection {
  markerId: string;
  name: string; // tal como viene en la analítica
  unit: string;
  current: number;
  expected: number; // a 6 meses
  bandLow: number;
  bandHigh: number;
  rangeLow: number | null;
  rangeHigh: number | null;
  testDate: string;
}

const round = (v: number, ref: number) => {
  const d = Math.abs(ref) < 10 ? 10 : 1;
  return Math.round(v * d) / d;
};

// Analítica más reciente (por fecha de la analítica o, si no la trae, de subida)
export const latestUpload = (uploads: LabUpload[]) =>
  [...uploads].sort((a, b) => (b.testDate ?? b.createdAt).localeCompare(a.testDate ?? a.createdAt))[0] ?? null;

export function projectMarkers(upload: LabUpload | null): MarkerProjection[] {
  if (!upload) return [];
  const out: MarkerProjection[] = [];
  const seen = new Set<string>();
  for (const sec of upload.data.secciones) {
    for (const p of sec.parametros) {
      if (typeof p.valor !== 'number') continue;
      const id = markerIdForExtractedName(p.nombre);
      const effect = id ? EFFECTS[id] : undefined;
      if (!id || !effect || seen.has(id)) continue;
      const status = getRangeStatus(p.valor, p.rango_min, p.rango_max);
      if ((effect.fixes === 'high' && status !== 'por_encima') || (effect.fixes === 'low' && status !== 'por_debajo')) continue;
      if (effect.unit && effect.unit !== (p.unidad ?? '').toLowerCase().replace(/\s+/g, '')) continue;
      seen.add(id);
      const apply = (x: number) => (effect.kind === 'pct' ? p.valor * (1 + x) : p.valor + x);
      // Nunca más allá del límite del rango que se quiere recuperar
      const limit = effect.fixes === 'high' ? p.rango_max : p.rango_min;
      const cap = (v: number) => (limit === null ? v : effect.fixes === 'high' ? Math.max(v, limit) : Math.min(v, limit));
      const a = cap(apply(effect.low));
      const b = cap(apply(effect.high));
      out.push({
        markerId: id,
        name: p.nombre,
        unit: p.unidad,
        current: p.valor,
        expected: round(cap(apply(effect.typical)), p.valor),
        bandLow: round(Math.min(a, b), p.valor),
        bandHigh: round(Math.max(a, b), p.valor),
        rangeLow: p.rango_min,
        rangeHigh: p.rango_max,
        testDate: upload.testDate ?? upload.createdAt.slice(0, 10),
      });
    }
  }
  return out;
}

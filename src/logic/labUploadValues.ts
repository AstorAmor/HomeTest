import type { LabUpload } from '@/data/labUploads';
import { markerIdForExtractedName, sameUnit } from '@/data/markerMatching';

// Valores de las analíticas subidas para las fichas que también se apuntan a mano (glucosa, colesterol
// total, cortisol): así lo escaneado sale en Mis datos, en Hoy y en el historial de cada ficha, sin
// copiarlo a las tablas de mediciones (si se borra o corrige la analítica, cambia aquí solo).
// Solo con la unidad de la ficha o una conversión exacta (mmol/L → mg/dL, nmol/L → µg/dL).

export type LabMarker = 'glucose' | 'total_cholesterol' | 'cortisol_am';

const TO_UNIT: Record<LabMarker, { unit: string; convert: Record<string, number> }> = {
  glucose: { unit: 'mg/dL', convert: { 'mmol/l': 18.016 } },
  total_cholesterol: { unit: 'mg/dL', convert: { 'mmol/l': 38.67 } },
  cortisol_am: { unit: 'µg/dL', convert: { 'nmol/l': 1 / 27.59 } },
};

export interface LabValue {
  id: string; // lab:<id de la analítica>:<marcador>
  uploadId: string;
  fecha: string; // ISO, al mediodía del día de la analítica
  valor: number;
  unidad: string;
}

const round = (v: number) => Math.round(v * 10) / 10;

export function labValuesFrom(uploads: LabUpload[], marker: LabMarker): LabValue[] {
  const target = TO_UNIT[marker];
  const out: LabValue[] = [];
  for (const u of uploads) {
    const day = u.testDate ?? u.createdAt.slice(0, 10);
    for (const sec of u.data.secciones) {
      const p = sec.parametros.find((x) => typeof x.valor === 'number' && markerIdForExtractedName(x.nombre) === marker);
      if (!p) continue;
      const unit = (p.unidad ?? '').toLowerCase().replace(/\s+/g, '');
      const factor = sameUnit(p.unidad, target.unit) ? 1 : target.convert[unit];
      if (!factor) continue;
      out.push({ id: `lab:${u.id}:${marker}`, uploadId: u.id, fecha: `${day}T12:00:00`, valor: round(p.valor * factor), unidad: target.unit });
      break; // un valor por analítica
    }
  }
  return out;
}

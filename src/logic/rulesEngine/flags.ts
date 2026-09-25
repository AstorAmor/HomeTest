// Cálculo del flag (en rango / por encima / por debajo) de un resultado de
// biomarcador. Envuelve el getRangeStatus ya existente (src/utils/rangeStatus.ts)
// en vez de duplicarlo -- ese es el único sitio que decide "dentro de rango"
// en toda la app.
//
// Nota de diseño importante: hoy el rango de referencia de un resultado NO
// sale de knowledge/biomarcadores/*.json (KnowledgeCard no tiene min/max --
// ver src/types/knowledge.ts). Sale de lo que el propio informe de
// laboratorio trae impreso (ExtractedParametro.rango_min/rango_max), que
// varía de un laboratorio a otro. Eso es correcto y deliberado para "en
// rango según este laboratorio", pero es una limitación real para el ajuste
// por fase de ciclo (cycleAdjustment.ts): no hay un rango "propio" de
// HomeTest del que partir para ajustar. Si en algún momento se decide que
// HomeTest publique sus propios rangos de referencia (en vez de heredar los
// de cada lab), ese campo tendría que añadirse a CanonicalBiomarker.

import { getRangeStatus, RangeStatus } from '@/utils/rangeStatus';
import { BiomarkerResult, ReferenceRange } from '@/types/recommendation';
import { CyclePhase } from '@/types/cycle';

export interface RawBiomarkerReading {
  canonicalId: string;
  value: number;
  unit: string;
  measuredAt: string;
  // Rango tal como lo reporta el laboratorio para este resultado concreto.
  rangeMin: number | null;
  rangeMax: number | null;
}

export interface PreviousReading {
  value: number;
  measuredAt: string;
}

export function computeFlag(value: number, min: number | null, max: number | null): RangeStatus {
  return getRangeStatus(value, min, max);
}

// Construye un BiomarkerResult completo a partir de una lectura cruda y
// (opcionalmente) el resultado anterior del mismo biomarcador, para poder
// mostrar tendencia. `adjustedRange`, si se pasa, sustituye al rango del
// laboratorio (lo produce cycleAdjustment.ts cuando aplica) -- por defecto
// se usa el rango del laboratorio tal cual.
export function buildBiomarkerResult(
  reading: RawBiomarkerReading,
  previous: PreviousReading | null,
  adjustedRange?: { min: number | null; max: number | null; cyclePhase: CyclePhase }
): BiomarkerResult {
  const min = adjustedRange ? adjustedRange.min : reading.rangeMin;
  const max = adjustedRange ? adjustedRange.max : reading.rangeMax;

  const referenceRange: ReferenceRange = {
    min,
    max,
    unit: reading.unit,
    adjustedForCyclePhase: adjustedRange ? adjustedRange.cyclePhase : null,
  };

  return {
    canonicalId: reading.canonicalId,
    value: reading.value,
    unit: reading.unit,
    measuredAt: reading.measuredAt,
    referenceRange,
    flag: computeFlag(reading.value, min, max),
    previousValue: previous?.value ?? null,
    previousMeasuredAt: previous?.measuredAt ?? null,
  };
}

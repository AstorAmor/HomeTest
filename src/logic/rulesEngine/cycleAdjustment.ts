// Ajuste de rango de referencia por fase de ciclo menstrual -- PENDIENTE de
// la investigación externa (ver prompts/README.md, sección 4 del prompt de
// research). Deliberadamente NO calcula rangos ajustados todavía: hacerlo
// bien requeriría cutoffs numéricos por fase y por biomarcador respaldados
// en literatura, que es exactamente lo que la investigación tiene que traer.
// Inventar esos números aquí sería justo el tipo de contenido médico sin
// fuente que knowledge/README.md prohíbe explícitamente.
//
// Limitación real adicional (ver flags.ts): hoy el rango de un resultado
// sale del propio informe de laboratorio, no de un rango "propio" de
// HomeTest -- no hay una base numérica de la que partir para ajustar hasta
// que exista esa base.
//
// Lo que SÍ hace esta primera versión: identificar qué biomarcadores son
// conocidos por variar de forma clínicamente relevante según la fase del
// ciclo (para poder avisar en el informe "este resultado puede depender de
// en qué fase del ciclo estabas", en vez de mostrar un rango silenciosamente
// engañoso), sin tocar el valor de min/max.

import { CyclePhase } from '@/types/cycle';
import { ReferenceRange } from '@/types/recommendation';

// Hormonas con variación por fase del ciclo bien establecida en fisiología
// reproductiva estándar (no hace falta investigación externa para esta
// lista concreta, es libro de texto: FSH/LH pico ovulatorio, estradiol
// pico preovulatorio, SHBG con variación mucho más leve). Progesterona
// tendría que estar aquí pero no existe canonical_id en el catálogo todavía
// (no está en el import de Function Health) -- añadir si se canonicaliza.
//
// Lista deliberadamente conservadora: candidatos con variación MENOS obvia
// (hierro/ferritina por pérdida menstrual, sensibilidad a la insulina) se
// dejan fuera hasta confirmarlos con la investigación externa, para no
// generar avisos de "puede variar por ciclo" sin respaldo.
export const KNOWN_CYCLE_SENSITIVE_BIOMARKERS = ['FSH', 'LH', 'ESTRADIOL', 'PROLACTIN'] as const;

export function isCycleSensitive(canonicalId: string): boolean {
  return (KNOWN_CYCLE_SENSITIVE_BIOMARKERS as readonly string[]).includes(canonicalId);
}

export interface CycleAwareRangeResult {
  range: ReferenceRange;
  // true solo cuando el rango realmente cambió de valor. Hoy siempre false
  // -- ver cabecera del archivo.
  wasAdjusted: boolean;
  // Presente cuando el biomarcador es cycle-sensitive y hay fase conocida,
  // aunque no se haya podido ajustar el número todavía. La UI debería
  // mostrar esto como aviso incluso sin rango ajustado.
  advisory: string | null;
}

export function applyCyclePhaseAdjustment(
  canonicalId: string,
  baseRange: { min: number | null; max: number | null; unit: string },
  cyclePhase: CyclePhase | null
): CycleAwareRangeResult {
  const passthrough: ReferenceRange = { ...baseRange, adjustedForCyclePhase: null };

  if (!cyclePhase || cyclePhase === 'none' || !isCycleSensitive(canonicalId)) {
    return { range: passthrough, wasAdjusted: false, advisory: null };
  }

  return {
    range: passthrough,
    wasAdjusted: false,
    advisory:
      `Este resultado (${canonicalId}) puede variar de forma relevante según la fase del ciclo (fase registrada: ${cyclePhase}). ` +
      'El rango de referencia mostrado es general, no ajustado por fase -- pendiente de cutoffs por fase (ver src/logic/rulesEngine/cycleAdjustment.ts).',
  };
}

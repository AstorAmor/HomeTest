// Cálculo de edad biológica -- PENDIENTE de la investigación externa (ver
// prompts/README.md). La firma de la función ya está cerrada para que el
// resto del motor (RecommendationInput.biologicalAge, la sección de
// "resumen ejecutivo" del informe) se pueda construir ya, sin esperar a la
// fórmula. NO usar en producción hasta rellenar el cuerpo: lanza un error
// explícito a propósito para que sea imposible que esto se cuele en un
// informe real sin que alguien lo note primero.
//
// Lo que ya sabemos (de la investigación previa, sin decidir todavía):
//   - Candidatas: PhenoAge (Levine 2018), Klemera-Doubal (KDM), Homeostatic
//     Dysregulation. Hay un paquete de referencia en R ("BioAge",
//     https://github.com/dayoonkwon/BioAge) que implementa las tres.
//   - PhenoAge usa 9 biomarcadores + edad cronológica: albúmina, creatinina,
//     glucosa, log(PCR), % linfocitos, VCM, RDW, fosfatasa alcalina y
//     leucocitos totales -- todos ya existen como canonical_id en el
//     catálogo (hepatico/renal/metabolico/hematologia.json), lo que la hace
//     la candidata más fácil de implementar con el panel actual.
//   - Falta decidir: fórmula exacta con coeficientes, qué hacer si faltan
//     inputs (¿no calcular, o calcular con menor `confidence`?), y cómo
//     comunicar el resultado sin parecer un diagnóstico.

import { BiologicalAgeResult } from '@/types/recommendation';
import { BiomarkerLookup } from './ratios';

export class BiologicalAgeNotImplementedError extends Error {
  constructor() {
    super(
      'Cálculo de edad biológica pendiente de decisión de fórmula (ver src/logic/rulesEngine/biologicalAge.ts). ' +
        'No usar computeBiologicalAge() en producción todavía.'
    );
    this.name = 'BiologicalAgeNotImplementedError';
  }
}

export interface BiologicalAgeInputs {
  chronologicalAge: number;
  lookup: BiomarkerLookup;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function computeBiologicalAge(inputs: BiologicalAgeInputs): BiologicalAgeResult {
  throw new BiologicalAgeNotImplementedError();
}

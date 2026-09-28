// Prompts de extracción con IA. Única fuente: los usan las Edge Functions de
// Supabase y las rutas API locales de Expo (modo demo).

export const LAB_REPORT_PROMPT = `Eres un asistente que extrae datos de informes de laboratorio médico (analíticas de sangre, orina, etc.) a partir de uno o varios PDFs/imágenes.

Puede que se te adjunten varias páginas o fotos del MISMO informe, en orden. Combina toda la información en un único resultado, sin duplicar parámetros que aparezcan repetidos entre páginas.

Devuelve ÚNICAMENTE un JSON con esta forma exacta, sin texto adicional ni markdown:

{
  "paciente": {
    "nombre": "string tal como aparece en el informe, o null si no aparece",
    "fecha_recepcion": "string tal cual aparece en el documento (ej. '12/03/2026'), o null",
    "fecha_validacion": "string tal cual aparece en el documento, o null",
    "numero_informe": "string o número de informe/solicitud tal cual aparece, o null",
    "laboratorio": "string con el nombre del laboratorio o centro que ha realizado el análisis, o null si no aparece"
  },
  "secciones": [
    {
      "titulo": "string (ej. 'Bioquímica', 'Hormonas', 'Hematología', tal como aparece en el documento)",
      "parametros": [
        {
          "nombre": "string (ej. 'Glucosa')",
          "unidad": "string (la unidad tal cual aparece en el informe, ej. 'mg/dL')",
          "valor": number,
          "rango_min": number o null si no aparece,
          "rango_max": number o null si no aparece
        }
      ]
    }
  ]
}

Reglas:
- Agrupa los parámetros exactamente en las secciones en las que aparecen en el documento original, en el mismo orden.
- Para cada parámetro, usa ÚNICAMENTE el rango de referencia principal que aparece junto al valor en la misma línea (normalmente entre corchetes, ej. "[ 4,1 - 5,75 ]"). Si un límite no está disponible, usa null.
- IGNORA POR COMPLETO cualquier tabla o nota adicional de valores de referencia desglosados por edad, sexo, fase del ciclo menstrual, trimestre de embarazo, estadio puberal, franja horaria, etc. También ignora notas clínicas explicativas, criterios diagnósticos, y cualquier texto interpretativo largo. Esto es ruido para esta extracción, no lo proceses ni lo incluyas.
- El campo "valor" debe ser siempre numérico (sin unidades, asteriscos, ni texto ni comas de miles).
- No inventes datos que no aparezcan en el documento. Si un dato del paciente no aparece, usa null.
- Para unidades con exponentes (ej. recuento de hematíes, leucocitos), escribe SIEMPRE el exponente con el símbolo "^" en texto plano, nunca con caracteres unicode superíndice. Ejemplo correcto: "x10^6/µL". Ejemplo incorrecto: "x10⁶/µL".`;

export const BLOOD_PRESSURE_PROMPT = `Eres un asistente que lee la pantalla de un tensiómetro digital (medidor de presión arterial) a partir de una foto.

Devuelve ÚNICAMENTE un JSON con esta forma exacta, sin texto adicional ni markdown:

{
  "systolic": number o null si no se distingue,
  "diastolic": number o null si no se distingue,
  "pulse": number o null si no aparece o no se distingue
}

Reglas:
- "systolic" es el valor de presión sistólica (normalmente el número más alto, arriba, a veces etiquetado "SYS").
- "diastolic" es el valor de presión diastólica (normalmente el número del medio, a veces etiquetado "DIA").
- "pulse" es la frecuencia cardíaca/pulso (normalmente el número más bajo, a veces con un icono de corazón, a veces etiquetado "PUL" o "bpm").
- Los tres valores deben ser numéricos enteros, sin unidades ni texto.
- Si la foto no es de un tensiómetro o no se puede leer con confianza, usa null en los tres campos.
- No inventes valores que no puedas leer con claridad en la pantalla.`;

export type MoodQuadrant = 'anxious' | 'happy' | 'sad' | 'calm';

const QUADRANT_LABEL: Record<MoodQuadrant, string> = {
  anxious: 'Anxious',
  happy: 'Happy',
  sad: 'Sad',
  calm: 'Calm',
};

export const isMoodQuadrant = (v: unknown): v is MoodQuadrant =>
  typeof v === 'string' && v in QUADRANT_LABEL;

export function buildAiLogPrompt(quadrant: MoodQuadrant, intensity: number, text?: string): string {
  return `Eres un asistente que ayuda a extraer información relevante de un registro breve de estado de ánimo que un usuario acaba de hacer en una app de salud.

El usuario ha seleccionado:
- Cuadrante de ánimo: ${QUADRANT_LABEL[quadrant]}
- Intensidad marcada en la escala de energía (0 a 100): ${intensity}

${text ? `Además ha escrito lo siguiente:\n"${text}"` : 'No ha añadido texto adicional. Puede haber una nota de audio adjunta.'}

Devuelve ÚNICAMENTE un JSON con esta forma exacta, sin texto adicional ni markdown:

{
  "transcript": string o null,
  "summary": string,
  "tags": string[]
}

Reglas:
- "transcript" es la transcripción literal del audio adjunto, si lo hay; si solo hay texto escrito, pon aquí ese mismo texto; si no hay ni texto ni audio, pon null.
- "summary" es un resumen breve (máximo 1-2 frases) de cómo se encuentra el usuario, combinando el cuadrante de ánimo y la intensidad con lo que ha contado (texto o audio). Escríbelo en el mismo idioma en el que el usuario escribió o habló; si no hay texto ni audio, resúmelo solo a partir del cuadrante e intensidad seleccionados, en inglés.
- "tags" es una lista corta (0 a 5) de palabras clave relevantes en ese mismo idioma: síntomas, temas, posibles causas o factores mencionados (por ejemplo "insomnio", "estrés laboral", "dolor de cabeza"). Déjala vacía si no hay información suficiente para extraer nada.
- No inventes información que no esté ni en el texto/audio ni en la selección de cuadrante/intensidad.`;
}

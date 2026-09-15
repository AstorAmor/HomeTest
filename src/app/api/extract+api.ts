import { callGeminiJson, GeminiFilePart } from '@/utils/geminiClient';

const EXTRACTION_PROMPT = `Eres un asistente que extrae datos de informes de laboratorio médico (analíticas de sangre, orina, etc.) a partir de uno o varios PDFs/imágenes.

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

export async function POST(request: Request) {
  const body = await request.json();
  const files: GeminiFilePart[] = body.files ?? (body.base64 ? [body] : []);

  if (!files.length) {
    return Response.json({ error: 'No file was received' }, { status: 400 });
  }

  const result = await callGeminiJson(EXTRACTION_PROMPT, files);

  if ('error' in result) {
    return Response.json({ error: result.error }, { status: result.status });
  }

  return Response.json(result.data);
}

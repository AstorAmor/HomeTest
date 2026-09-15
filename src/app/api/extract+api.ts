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

interface FilePayload {
  base64: string;
  mimeType: string;
}

const MAX_RETRIES = 3;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Llama a Gemini con reintentos y espera creciente si la API devuelve
// 429 (límite de peticiones por minuto superado) o 503 (sobrecarga temporal).
async function callGeminiWithRetry(
  apiKey: string,
  fileParts: { inline_data: { mime_type: string; data: string } }[]
): Promise<{ response: Response } | { error: string; status: number }> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 170000);

    let response: Response;
    try {
      response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: EXTRACTION_PROMPT }, ...fileParts] }],
            generationConfig: { responseMimeType: 'application/json' },
          }),
          signal: controller.signal,
        }
      );
    } catch (fetchErr) {
      const isAbort = fetchErr instanceof Error && fetchErr.name === 'AbortError';
      return {
        error: isAbort
          ? 'Gemini tardó demasiado en responder (>170s). Prueba con menos páginas o imágenes más pequeñas.'
          : `Error al llamar a Gemini: ${fetchErr instanceof Error ? fetchErr.message : 'desconocido'}`,
        status: 504,
      };
    } finally {
      clearTimeout(timeoutId);
    }

    const isRateLimited = response.status === 429 || response.status === 503;
    if (isRateLimited && attempt < MAX_RETRIES) {
      const retryAfterHeader = response.headers.get('retry-after');
      const waitMs = retryAfterHeader
        ? Number(retryAfterHeader) * 1000
        : 4000 * Math.pow(2, attempt); // 4s, 8s, 16s
      await sleep(waitMs);
      continue;
    }

    return { response };
  }

  return { error: 'No se pudo completar la petición tras varios reintentos', status: 429 };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const files: FilePayload[] = body.files ?? (body.base64 ? [body] : []);

    if (!files.length) {
      return Response.json({ error: 'No se ha recibido ningún archivo' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return Response.json(
        { error: 'GEMINI_API_KEY no configurada en el servidor (.env.local)' },
        { status: 500 }
      );
    }

    const fileParts = files.map((f) => ({
      inline_data: { mime_type: f.mimeType, data: f.base64 },
    }));

    const result = await callGeminiWithRetry(apiKey, fileParts);

    if ('error' in result) {
      return Response.json({ error: result.error }, { status: result.status });
    }

    const geminiResponse = result.response;

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      const isRateLimited = geminiResponse.status === 429;
      return Response.json(
        {
          error: isRateLimited
            ? 'Gemini sigue con el límite de peticiones superado tras varios reintentos. Espera un minuto y prueba con menos páginas a la vez.'
            : `Error de Gemini (${geminiResponse.status}): ${errorText}`,
        },
        { status: 502 }
      );
    }

    const geminiData = await geminiResponse.json();
    const textResult = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!textResult) {
      return Response.json(
        { error: 'Gemini no devolvió contenido de texto', raw: geminiData },
        { status: 502 }
      );
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(textResult);
    } catch {
      return Response.json(
        { error: 'La respuesta de Gemini no es JSON válido', raw: textResult },
        { status: 502 }
      );
    }

    return Response.json(parsed);
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'Error desconocido en el servidor' },
      { status: 500 }
    );
  }
}

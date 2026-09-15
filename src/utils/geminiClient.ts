export interface GeminiFilePart {
  base64: string;
  mimeType: string;
}

const MAX_RETRIES = 3;
const TIMEOUT_MS = 170000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type GeminiResult<T> = { data: T } | { error: string; status: number };

// Llama a Gemini pidiendo una respuesta JSON, con reintentos y espera
// creciente si la API devuelve 429 (límite de peticiones) o 503 (sobrecarga).
export async function callGeminiJson<T>(
  prompt: string,
  files: GeminiFilePart[]
): Promise<GeminiResult<T>> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { error: 'GEMINI_API_KEY not configured on the server (.env.local)', status: 500 };
  }

  const fileParts = files.map((f) => ({
    inline_data: { mime_type: f.mimeType, data: f.base64 },
  }));

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }, ...fileParts] }],
            generationConfig: { responseMimeType: 'application/json' },
          }),
          signal: controller.signal,
        }
      );
    } catch (fetchErr) {
      const isAbort = fetchErr instanceof Error && fetchErr.name === 'AbortError';
      return {
        error: isAbort
          ? `Gemini took too long to respond (>${TIMEOUT_MS / 1000}s).`
          : `Error calling Gemini: ${fetchErr instanceof Error ? fetchErr.message : 'unknown'}`,
        status: 504,
      };
    } finally {
      clearTimeout(timeoutId);
    }

    const isRateLimited = response.status === 429 || response.status === 503;
    if (isRateLimited && attempt < MAX_RETRIES) {
      const retryAfterHeader = response.headers.get('retry-after');
      const waitMs = retryAfterHeader ? Number(retryAfterHeader) * 1000 : 4000 * Math.pow(2, attempt);
      await sleep(waitMs);
      continue;
    }

    if (!response.ok) {
      const errorText = await response.text();
      return {
        error: isRateLimited
          ? 'Gemini is still rate-limited after several retries. Wait a minute and try again.'
          : `Gemini error (${response.status}): ${errorText}`,
        status: 502,
      };
    }

    const geminiData = await response.json();
    const textResult = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!textResult) {
      return { error: 'Gemini did not return any text content', status: 502 };
    }

    try {
      return { data: JSON.parse(textResult) as T };
    } catch {
      return { error: "Gemini's response is not valid JSON", status: 502 };
    }
  }

  return { error: 'Could not complete the request after several retries', status: 429 };
}

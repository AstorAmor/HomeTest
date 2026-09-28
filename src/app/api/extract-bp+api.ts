// Ruta local (modo demo, sin Supabase). En producción se usa la Edge Function `extract-bp`.
import { callGeminiJson, GeminiFilePart } from '../../../supabase/functions/_shared/gemini';
import { BLOOD_PRESSURE_PROMPT } from '../../../supabase/functions/_shared/prompts';

export async function POST(request: Request) {
  const body = await request.json();
  const files: GeminiFilePart[] = body.files ?? (body.base64 ? [body] : []);

  if (!files.length) {
    return Response.json({ error: 'No file was received' }, { status: 400 });
  }

  const result = await callGeminiJson(process.env.GEMINI_API_KEY, BLOOD_PRESSURE_PROMPT, files, 170000);

  if ('error' in result) {
    return Response.json({ error: result.error }, { status: result.status });
  }

  return Response.json(result.data);
}

// Lee la pantalla de un tensiómetro (foto) con Gemini.
import { callGeminiJson, GeminiFilePart } from '../_shared/gemini.ts';
import { BLOOD_PRESSURE_PROMPT } from '../_shared/prompts.ts';
import { json, serve } from '../_shared/http.ts';

serve(async (body) => {
  const files: GeminiFilePart[] = body.files ?? (body.base64 ? [body] : []);
  if (!files.length) return json({ error: 'No file was received' }, 400);

  const result = await callGeminiJson(Deno.env.get('GEMINI_API_KEY'), BLOOD_PRESSURE_PROMPT, files);
  if ('error' in result) return json({ error: result.error }, result.status);
  return json(result.data);
});

// Resume un registro de ánimo (texto y/o audio) con Gemini.
import { callGeminiJson, GeminiFilePart } from '../_shared/gemini.ts';
import { buildAiLogPrompt, isMoodQuadrant } from '../_shared/prompts.ts';
import { json, serve } from '../_shared/http.ts';

serve(async (body) => {
  const { quadrant, intensity, text, audio } = body as {
    quadrant?: unknown;
    intensity?: unknown;
    text?: string;
    audio?: GeminiFilePart;
  };
  if (!isMoodQuadrant(quadrant) || typeof intensity !== 'number') {
    return json({ error: 'quadrant and intensity are required' }, 400);
  }

  const result = await callGeminiJson(
    Deno.env.get('GEMINI_API_KEY'),
    buildAiLogPrompt(quadrant, intensity, text),
    audio ? [audio] : []
  );
  if ('error' in result) return json({ error: result.error }, result.status);
  return json(result.data);
});

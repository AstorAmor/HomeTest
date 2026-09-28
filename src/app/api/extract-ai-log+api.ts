// Ruta local (modo demo, sin Supabase). En producción se usa la Edge Function `extract-ai-log`.
import { callGeminiJson, GeminiFilePart } from '../../../supabase/functions/_shared/gemini';
import { buildAiLogPrompt, isMoodQuadrant } from '../../../supabase/functions/_shared/prompts';
import { AiLogExtraction } from '@/types/aiLog';

export async function POST(request: Request) {
  const body = await request.json();
  const { quadrant, intensity, text, audio } = body as {
    quadrant?: unknown;
    intensity?: unknown;
    text?: string;
    audio?: GeminiFilePart;
  };

  if (!isMoodQuadrant(quadrant) || typeof intensity !== 'number') {
    return Response.json({ error: 'quadrant and intensity are required' }, { status: 400 });
  }

  const result = await callGeminiJson<AiLogExtraction>(
    process.env.GEMINI_API_KEY,
    buildAiLogPrompt(quadrant, intensity, text),
    audio ? [audio] : [],
    170000
  );

  if ('error' in result) {
    return Response.json({ error: result.error }, { status: result.status });
  }

  return Response.json(result.data);
}

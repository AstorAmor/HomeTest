import { callGeminiJson, GeminiFilePart } from '@/utils/geminiClient';
import { MoodQuadrant, MOOD_QUADRANT_INFO, AiLogExtraction } from '@/types/aiLog';

function buildPrompt(quadrant: MoodQuadrant, intensity: number, text?: string): string {
  return `Eres un asistente que ayuda a extraer información relevante de un registro breve de estado de ánimo que un usuario acaba de hacer en una app de salud.

El usuario ha seleccionado:
- Cuadrante de ánimo: ${MOOD_QUADRANT_INFO[quadrant].label}
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

export async function POST(request: Request) {
  const body = await request.json();
  const quadrant: MoodQuadrant | undefined = body.quadrant;
  const intensity: number | undefined = body.intensity;
  const text: string | undefined = body.text;
  const audio: GeminiFilePart | undefined = body.audio;

  if (!quadrant || typeof intensity !== 'number') {
    return Response.json({ error: 'quadrant and intensity are required' }, { status: 400 });
  }

  const prompt = buildPrompt(quadrant, intensity, text);
  const files: GeminiFilePart[] = audio ? [audio] : [];

  const result = await callGeminiJson<AiLogExtraction>(prompt, files);

  if ('error' in result) {
    return Response.json({ error: result.error }, { status: result.status });
  }

  return Response.json(result.data);
}

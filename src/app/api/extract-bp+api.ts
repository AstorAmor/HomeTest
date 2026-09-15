import { callGeminiJson, GeminiFilePart } from '@/utils/geminiClient';

const BP_PROMPT = `Eres un asistente que lee la pantalla de un tensiómetro digital (medidor de presión arterial) a partir de una foto.

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

export async function POST(request: Request) {
  const body = await request.json();
  const files: GeminiFilePart[] = body.files ?? (body.base64 ? [body] : []);

  if (!files.length) {
    return Response.json({ error: 'No file was received' }, { status: 400 });
  }

  const result = await callGeminiJson(BP_PROMPT, files);

  if ('error' in result) {
    return Response.json({ error: result.error }, { status: result.status });
  }

  return Response.json(result.data);
}

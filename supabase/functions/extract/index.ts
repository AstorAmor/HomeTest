// Extrae datos estructurados de un informe de laboratorio (PDF/fotos) con Gemini.
// Escanear informes es de la suscripción o de un acceso por invitación (has_feature 'scan_reports').
import { callGeminiJson, GeminiFilePart } from '../_shared/gemini.ts';
import { LAB_REPORT_PROMPT } from '../_shared/prompts.ts';
import { json, serve, userHasFeature } from '../_shared/http.ts';

serve(async (body, _userId, req) => {
  if (!(await userHasFeature(req, 'scan_reports'))) {
    return json({ error: 'Scanning your reports comes with a subscription', code: 'needs_subscription' }, 403);
  }
  const files: GeminiFilePart[] = body.files ?? (body.base64 ? [body] : []);
  if (!files.length) return json({ error: 'No file was received' }, 400);

  const result = await callGeminiJson(Deno.env.get('GEMINI_API_KEY'), LAB_REPORT_PROMPT, files);
  if ('error' in result) return json({ error: result.error }, result.status);
  return json(result.data);
});

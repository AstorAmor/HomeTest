// Ruta local (modo demo, sin Supabase). En producción se usa la Edge Function
// `predict-cycle`. Ya no depende de Windmill: el cálculo está en TypeScript.
import { predictCycle } from '../../../supabase/functions/_shared/cycle';

export async function POST(request: Request) {
  const body = await request.json();
  const cycleStarts: string[] = Array.isArray(body.cycle_starts) ? body.cycle_starts : [];
  return Response.json(predictCycle(cycleStarts));
}

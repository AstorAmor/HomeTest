// Predicción del próximo periodo (sustituye al script de Windmill).
import { predictCycle } from '../_shared/cycle.ts';
import { json, serve } from '../_shared/http.ts';

serve(async (body) => {
  const cycleStarts: string[] = Array.isArray(body.cycle_starts) ? body.cycle_starts : [];
  return json(predictCycle(cycleStarts));
});

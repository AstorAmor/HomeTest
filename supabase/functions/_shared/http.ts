// Utilidades HTTP para las Edge Functions (Deno): CORS, respuestas JSON y
// comprobación de que quien llama es un usuario con sesión.
import { createClient } from 'npm:@supabase/supabase-js@2';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

function publishableKey(): string {
  const legacy = Deno.env.get('SUPABASE_ANON_KEY');
  if (legacy) return legacy;
  try {
    const keys = JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS') ?? '{}');
    return (Object.values(keys)[0] as string) ?? '';
  } catch {
    return '';
  }
}

// Solo usuarios con sesión pueden usar las funciones (evita que cualquiera con
// la URL gaste la cuota de Gemini). Devuelve el id del usuario o una respuesta de error.
export async function requireUser(req: Request): Promise<{ userId: string } | Response> {
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'Not signed in' }, 401);

  const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', publishableKey());
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return json({ error: 'Invalid or expired session' }, 401);
  return { userId: data.user.id };
}

// Envoltorio común: CORS, método, sesión y errores inesperados.
export function serve(handler: (body: any, userId: string) => Promise<Response>) {
  Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
    if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

    const auth = await requireUser(req);
    if (auth instanceof Response) return auth;

    try {
      const body = await req.json();
      return await handler(body, auth.userId);
    } catch (err) {
      return json({ error: err instanceof Error ? err.message : 'Unexpected error' }, 500);
    }
  });
}

import Constants from 'expo-constants';
import { fetchWithTimeout } from '@/utils/imageUpload';
import { isRemoteActive, supabase, supabasePublishableKey, supabaseUrl } from '@/lib/supabase';

export function getApiBaseUrl(): string {
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    return `http://${hostUri}`;
  }
  // Fallback para web, donde el origin ya es correcto
  return '';
}

export type AiFunction = 'extract' | 'extract-bp' | 'extract-ai-log' | 'predict-cycle';

// Fallo de red (sin cobertura, DNS que no responde, el móvil pasando de wifi a datos). En Android
// llega como "fetch failed: java.net.UnknownHostException: Unable to resolve host …"; en la web,
// como TypeError "Failed to fetch". No incluye el tiempo agotado (AbortError).
export function isNetworkError(err: unknown): boolean {
  if (!(err instanceof Error) || err.name === 'AbortError') return false;
  return (
    err.name === 'TypeError' ||
    /fetch failed|network request failed|failed to fetch|unknownhost|unable to resolve host|connection|socket/i.test(err.message)
  );
}

const RETRY_DELAYS_MS = [1500, 4000];

// Llama a una función de IA/cómputo. Con sesión de Supabase va a la Edge Function
// (funciona sin el ordenador y exige usuario logueado); en modo demo, a la ruta
// API local de Expo. Mismo cuerpo y misma respuesta en los dos casos.
// Si la red falla antes de llegar al servidor, lo reintenta dos veces (1,5 s y 4 s después).
export async function postAi(name: AiFunction, body: unknown, timeoutMs: number): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await postAiOnce(name, body, timeoutMs);
    } catch (err) {
      if (!isNetworkError(err) || attempt >= RETRY_DELAYS_MS.length) throw err;
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS_MS[attempt]));
    }
  }
}

async function postAiOnce(name: AiFunction, body: unknown, timeoutMs: number): Promise<Response> {
  const payload = JSON.stringify(body);

  if (isRemoteActive() && supabase) {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token ?? '';
    return fetchWithTimeout(
      `${supabaseUrl}/functions/v1/${name}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: supabasePublishableKey,
          Authorization: `Bearer ${token}`,
        },
        body: payload,
      },
      timeoutMs
    );
  }

  return fetchWithTimeout(
    `${getApiBaseUrl()}/api/${name}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload },
    timeoutMs
  );
}

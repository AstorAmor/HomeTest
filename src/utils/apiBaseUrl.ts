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

// Llama a una función de IA/cómputo. Con sesión de Supabase va a la Edge Function
// (funciona sin el ordenador y exige usuario logueado); en modo demo, a la ruta
// API local de Expo. Mismo cuerpo y misma respuesta en los dos casos.
export async function postAi(name: AiFunction, body: unknown, timeoutMs: number): Promise<Response> {
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

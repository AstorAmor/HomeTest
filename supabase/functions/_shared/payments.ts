// Piezas comunes de pagos con Revolut Merchant API: crear/consultar pedidos, verificar
// la firma de los webhooks, cliente de Supabase con permisos de servidor (para escribir
// en orders) y validación de la URL de vuelta a la app.
// Secretos (npx supabase secrets set …):
//   REVOLUT_SECRET_KEY      clave secreta de la API (sandbox o producción)
//   REVOLUT_WEBHOOK_SECRET  wsk_… devuelto al registrar el webhook
//   REVOLUT_ENV             'sandbox' (por defecto) o 'production'
// Sin REVOLUT_SECRET_KEY la app muestra un pago SIMULADO.
import { createClient } from 'npm:@supabase/supabase-js@2';

// Versión de la API que usamos; revisar en developer.revolut.com al activar los pagos.
const API_VERSION = '2024-09-01';

export const revolutConfigured = () => !!Deno.env.get('REVOLUT_SECRET_KEY');

const baseUrl = () =>
  Deno.env.get('REVOLUT_ENV') === 'production' ? 'https://merchant.revolut.com/api' : 'https://sandbox-merchant.revolut.com/api';

async function revolut(path: string, init: RequestInit = {}) {
  const res = await fetch(`${baseUrl()}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${Deno.env.get('REVOLUT_SECRET_KEY')}`,
      'Revolut-Api-Version': API_VERSION,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(init.headers ?? {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Revolut ${res.status}: ${body?.message ?? 'request failed'}`);
  return body;
}

export interface RevolutOrder {
  id: string;
  state: 'pending' | 'processing' | 'authorised' | 'completed' | 'cancelled' | 'failed';
  amount: number;
  currency: string;
  checkout_url?: string;
}

export const createRevolutOrder = (body: Record<string, unknown>): Promise<RevolutOrder> =>
  revolut('/orders', { method: 'POST', body: JSON.stringify(body) });

export const getRevolutOrder = (id: string): Promise<RevolutOrder> => revolut(`/orders/${encodeURIComponent(id)}`);

// Firma: HMAC-SHA256 (hex) de `v1.{Revolut-Request-Timestamp}.{cuerpo sin tocar}` con el
// secreto del webhook. La cabecera puede traer varias firmas separadas por comas (rotación).
export async function verifyRevolutSignature(raw: string, signatureHeader: string, timestamp: string, secret: string) {
  const ts = Number(timestamp);
  if (!ts || Math.abs(Date.now() - ts) > 5 * 60 * 1000) return false; // evita reenvíos antiguos
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`v1.${timestamp}.${raw}`));
  const expected = 'v1=' + [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, '0')).join('');
  return signatureHeader.split(',').some((s) => timingSafeEqual(s.trim(), expected));
}

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function serviceKey(): string {
  const legacy = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (legacy) return legacy;
  try {
    const keys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}');
    return (Object.values(keys)[0] as string) ?? '';
  } catch {
    return '';
  }
}

// Solo para funciones de servidor: se salta RLS. Nunca devolver datos de otros usuarios.
export const adminClient = () =>
  createClient(Deno.env.get('SUPABASE_URL') ?? '', serviceKey(), { auth: { persistSession: false } });

// Tras pagar, Revolut vuelve a checkout-return, que redirige a la app. Solo se permiten
// esquemas de la app (instalada o Expo Go) y localhost en desarrollo: nada de webs externas.
export const isAppReturnUrl = (url: string) =>
  /^(apptestsmedicos|exp|exps):\/\/[^\s]+$/.test(url) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/[^\s]*$/.test(url);

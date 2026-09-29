import * as Linking from 'expo-linking';
import { getCurrentUserId, isRemoteActive, supabase } from '@/lib/supabase';

// Pedidos y planes pagados. Los escribe solo el servidor (create-checkout + webhook
// de Stripe); la app los lee para saber, p. ej., si la membresía está activa.

export type CheckoutStart =
  | { kind: 'stripe'; url: string; returnUrl: string }
  | { kind: 'simulated' }; // sin Stripe configurado, en modo demo o sin conexión

// Pide al servidor una sesión de pago. Solo se envía el id del producto: el importe
// lo pone el servidor.
export async function startCheckout(productId: string): Promise<CheckoutStart> {
  if (!isRemoteActive() || !supabase) return { kind: 'simulated' };
  const returnUrl = Linking.createURL('checkout');
  const { data, error } = await supabase.functions.invoke('create-checkout', { body: { productId, returnUrl } });
  if (error) throw new Error(error.message);
  if (!data?.configured || !data.url) return { kind: 'simulated' };
  return { kind: 'stripe', url: data.url, returnUrl };
}

// Productos con un pago confirmado (los planes anuales, solo mientras dure el periodo).
export async function listMyPaidProducts(): Promise<string[]> {
  if (!isRemoteActive() || !supabase) return [];
  const { data, error } = await supabase
    .from('orders')
    .select('product_id, current_period_end')
    .eq('user_id', getCurrentUserId())
    .eq('status', 'paid');
  if (error || !data) return [];
  const now = Date.now();
  return data
    .filter((o) => !o.current_period_end || new Date(o.current_period_end).getTime() > now)
    .map((o) => o.product_id);
}

// Estado de un pedido tras volver de Stripe (el webhook puede tardar unos segundos).
export async function getOrderStatus(sessionId: string): Promise<string | null> {
  if (!isRemoteActive() || !supabase) return null;
  const { data } = await supabase
    .from('orders')
    .select('status')
    .eq('user_id', getCurrentUserId())
    .eq('stripe_session_id', sessionId)
    .maybeSingle();
  return data?.status ?? null;
}

import * as Linking from 'expo-linking';
import { getCurrentUserId, isRemoteActive, supabase } from '@/lib/supabase';

// Pedidos y planes pagados. Los escribe solo el servidor (create-checkout + webhook
// de Revolut); la app los lee para saber, p. ej., si la membresía está activa.

export type CheckoutStart =
  | { kind: 'hosted'; url: string; returnUrl: string }
  | { kind: 'simulated' }; // sin Revolut configurado, en modo demo o sin conexión

// Pide al servidor una sesión de pago. Solo se envía el id del producto: el importe
// lo pone el servidor.
export async function startCheckout(productId: string): Promise<CheckoutStart> {
  if (!isRemoteActive() || !supabase) return { kind: 'simulated' };
  const returnUrl = Linking.createURL('checkout');
  const { data, error } = await supabase.functions.invoke('create-checkout', { body: { productId, returnUrl } });
  if (error) throw new Error(error.message);
  if (!data?.configured || !data.url) return { kind: 'simulated' };
  return { kind: 'hosted', url: data.url, returnUrl };
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

// Estado de un pedido tras volver del pago (el webhook puede tardar unos segundos).
export async function getOrderStatus(orderId: string): Promise<string | null> {
  if (!isRemoteActive() || !supabase) return null;
  const { data } = await supabase
    .from('orders')
    .select('status')
    .eq('user_id', getCurrentUserId())
    .eq('id', orderId)
    .maybeSingle();
  return data?.status ?? null;
}

export interface MySubscription {
  productId: 'membership' | 'premium';
  since: string | null; // YYYY-MM-DD
  renewsOn: string | null; // YYYY-MM-DD (fin del periodo pagado)
  sample: boolean; // true = datos de ejemplo (modo demo)
}

// Plan anual activo. En modo demo devuelve la membresía de ejemplo del prototipo
// (primera analítica en marzo); con cuenta real, solo lo que el webhook marcó pagado.
export async function getMySubscription(): Promise<MySubscription | null> {
  if (!isRemoteActive() || !supabase) {
    return { productId: 'membership', since: '2026-03-27', renewsOn: '2027-03-27', sample: true };
  }
  const { data } = await supabase
    .from('orders')
    .select('product_id, paid_at, current_period_end')
    .eq('user_id', getCurrentUserId())
    .eq('status', 'paid')
    .in('product_id', ['membership', 'premium'])
    .order('paid_at', { ascending: false });
  const now = Date.now();
  const active = (data ?? []).find((o) => o.current_period_end && new Date(o.current_period_end).getTime() > now);
  if (!active) return null;
  return {
    productId: active.product_id as MySubscription['productId'],
    since: active.paid_at?.slice(0, 10) ?? null,
    renewsOn: active.current_period_end?.slice(0, 10) ?? null,
    sample: false,
  };
}

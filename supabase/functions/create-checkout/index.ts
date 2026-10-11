// Crea un pedido en Revolut (página de pago alojada) para un producto del catálogo y
// lo deja en 'pending' en orders. El importe sale de _shared/products.ts, nunca de la app.
// Sin REVOLUT_SECRET_KEY devuelve { configured: false } y la app simula el pago.
import { json, serve } from '../_shared/http.ts';
import { PRODUCTS } from '../_shared/products.ts';
import { adminClient, createRevolutOrder, isAppReturnUrl, revolutConfigured } from '../_shared/payments.ts';

serve(async (body, userId) => {
  if (!revolutConfigured()) return json({ configured: false });

  // Un producto (productId) o varios tests en un solo pago (productIds, desde el cuestionario).
  // El pedido conjunto se guarda como una fila con product_id 'a+b' y la suma de importes.
  const ids: string[] = Array.isArray(body?.productIds) ? body.productIds.map(String) : [String(body?.productId ?? '')];
  if (!ids.length || ids.length > 10 || new Set(ids).size !== ids.length) return json({ error: 'Invalid products' }, 400);
  const items = ids.map((id) => PRODUCTS[id]);
  if (items.some((p) => !p)) return json({ error: 'Unknown product' }, 400);
  if (items.length > 1 && items.some((p) => p.interval)) return json({ error: 'Plans are paid on their own' }, 400);
  const productId = ids.join('+');
  const product = items.length === 1 ? items[0] : { name: items.map((p) => p.name).join(' + '), amountCents: items.reduce((s, p) => s + p.amountCents, 0) };

  const returnUrl = String(body?.returnUrl ?? '');
  if (!isAppReturnUrl(returnUrl)) return json({ error: 'Invalid return URL' }, 400);

  const db = adminClient();
  const recurring = items.length === 1 && !!items[0].interval;
  const { data: order, error } = await db
    .from('orders')
    .insert({ user_id: userId, product_id: productId, amount_cents: product.amountCents, recurring, provider: 'revolut' })
    .select('id')
    .single();
  if (error || !order) return json({ error: error?.message ?? 'Could not create order' }, 500);

  // Planes anuales: de momento pago único por año (el webhook fija current_period_end a +1 año).
  // Cuando haga falta renovación automática, pasar a la Subscriptions API de Revolut.
  const back = `${Deno.env.get('SUPABASE_URL')}/functions/v1/checkout-return?to=${encodeURIComponent(returnUrl)}`;
  try {
    const rev = await createRevolutOrder({
      amount: product.amountCents,
      currency: 'EUR',
      description: recurring ? `${product.name} (1 year)` : product.name,
      redirect_url: `${back}&status=success&order_id=${order.id}`,
      merchant_order_data: { reference: order.id },
      metadata: { user_id: userId, product_id: productId },
      expire_pending_after: 'PT1H',
    });
    await db.from('orders').update({ provider_order_id: rev.id }).eq('id', order.id);
    return json({ configured: true, url: rev.checkout_url, orderId: order.id });
  } catch (e) {
    await db.from('orders').update({ status: 'cancelled' }).eq('id', order.id);
    return json({ error: e instanceof Error ? e.message : 'Payment provider error' }, 502);
  }
});

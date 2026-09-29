// Crea una sesión de Stripe Checkout para un producto del catálogo y deja el pedido
// en 'pending'. El importe sale de _shared/products.ts, nunca de la app.
// Sin STRIPE_SECRET_KEY devuelve { configured: false } y la app simula el pago.
import { json, serve } from '../_shared/http.ts';
import { PRODUCTS } from '../_shared/products.ts';
import { adminClient, isAppReturnUrl, stripe, stripeConfigured } from '../_shared/payments.ts';

serve(async (body, userId) => {
  if (!stripeConfigured()) return json({ configured: false });

  const productId = String(body?.productId ?? '');
  const product = PRODUCTS[productId];
  if (!product) return json({ error: 'Unknown product' }, 400);

  const returnUrl = String(body?.returnUrl ?? '');
  if (!isAppReturnUrl(returnUrl)) return json({ error: 'Invalid return URL' }, 400);

  const back = `${Deno.env.get('SUPABASE_URL')}/functions/v1/checkout-return?to=${encodeURIComponent(returnUrl)}`;
  const recurring = !!product.interval;
  const metadata = { user_id: userId, product_id: productId };

  const session = await stripe().checkout.sessions.create({
    mode: recurring ? 'subscription' : 'payment',
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: 'eur',
          unit_amount: product.amountCents,
          product_data: { name: product.name },
          ...(recurring ? { recurring: { interval: product.interval! } } : {}),
        },
      },
    ],
    client_reference_id: userId,
    metadata,
    ...(recurring ? { subscription_data: { metadata } } : {}),
    // {CHECKOUT_SESSION_ID} lo sustituye Stripe: no debe ir codificado.
    success_url: `${back}&status=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${back}&status=cancelled`,
  });

  const { error } = await adminClient().from('orders').insert({
    user_id: userId,
    product_id: productId,
    amount_cents: product.amountCents,
    recurring,
    stripe_session_id: session.id,
  });
  if (error) return json({ error: error.message }, 500);

  return json({ configured: true, url: session.url, sessionId: session.id });
});

// Webhook de Stripe: única vía por la que un pedido pasa a 'paid'. Verifica la firma
// con STRIPE_WEBHOOK_SECRET antes de tocar la base de datos.
import { adminClient, cryptoProvider, stripe } from '../_shared/payments.ts';

const ok = () => new Response('ok', { status: 200 });

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const secret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
  const signature = req.headers.get('Stripe-Signature');
  if (!secret || !signature) return new Response('Not configured', { status: 400 });

  let event;
  try {
    event = await stripe().webhooks.constructEventAsync(await req.text(), signature, secret, undefined, cryptoProvider);
  } catch {
    return new Response('Invalid signature', { status: 400 });
  }

  const db = adminClient();
  switch (event.type) {
    case 'checkout.session.completed':
    case 'checkout.session.async_payment_succeeded': {
      const s = event.data.object;
      if (s.payment_status !== 'paid') break;
      const { data: order } = await db.from('orders').select('amount_cents').eq('stripe_session_id', s.id).single();
      // Doble comprobación: lo cobrado debe coincidir con el pedido creado por el servidor.
      if (!order || s.amount_total !== order.amount_cents) {
        console.error('Order not found or amount mismatch', s.id);
        break;
      }
      await db
        .from('orders')
        .update({
          status: 'paid',
          paid_at: new Date().toISOString(),
          stripe_subscription_id: typeof s.subscription === 'string' ? s.subscription : null,
        })
        .eq('stripe_session_id', s.id);
      break;
    }
    case 'checkout.session.expired':
      await db.from('orders').update({ status: 'expired' }).eq('stripe_session_id', event.data.object.id).eq('status', 'pending');
      break;
    case 'invoice.paid': {
      // Alta y renovaciones de planes anuales: amplía el periodo pagado.
      const invoice = event.data.object;
      const sub = (invoice as { subscription?: string }).subscription;
      const end = invoice.lines?.data?.[0]?.period?.end;
      if (sub && end) {
        await db
          .from('orders')
          .update({ current_period_end: new Date(end * 1000).toISOString() })
          .eq('stripe_subscription_id', sub);
      }
      break;
    }
    case 'customer.subscription.deleted':
      await db.from('orders').update({ status: 'cancelled' }).eq('stripe_subscription_id', event.data.object.id);
      break;
  }
  return ok();
});

// Webhook de Revolut: única vía por la que un pedido pasa a 'paid'. Verifica la firma
// con REVOLUT_WEBHOOK_SECRET y, además, vuelve a consultar el pedido en Revolut antes
// de marcarlo (no se fía solo del contenido del aviso).
import { adminClient, getRevolutOrder, verifyRevolutSignature } from '../_shared/payments.ts';

const text = (body: string, status = 200) => new Response(body, { status });

Deno.serve(async (req) => {
  if (req.method !== 'POST') return text('Method not allowed', 405);
  const secret = Deno.env.get('REVOLUT_WEBHOOK_SECRET');
  const signature = req.headers.get('Revolut-Signature');
  const timestamp = req.headers.get('Revolut-Request-Timestamp');
  if (!secret || !signature || !timestamp) return text('Not configured', 400);

  const raw = await req.text();
  if (!(await verifyRevolutSignature(raw, signature, timestamp, secret))) return text('Invalid signature', 400);

  const event = JSON.parse(raw) as { event: string; order_id?: string };
  if (!event.order_id) return text('ok');

  const db = adminClient();
  const { data: order } = await db
    .from('orders')
    .select('id, amount_cents, recurring, status')
    .eq('provider_order_id', event.order_id)
    .maybeSingle();
  if (!order) return text('ok'); // pedido que no es nuestro o ya borrado

  if (event.event === 'ORDER_COMPLETED') {
    const rev = await getRevolutOrder(event.order_id);
    // Doble comprobación: estado real en Revolut e importe igual al que fijó el servidor.
    if (rev.state !== 'completed' || rev.amount !== order.amount_cents || rev.currency !== 'EUR') {
      console.error('Order state/amount mismatch', event.order_id, rev.state, rev.amount);
      return text('ok');
    }
    if (order.status === 'paid') return text('ok'); // aviso repetido
    const now = new Date();
    const end = new Date(now);
    end.setFullYear(end.getFullYear() + 1);
    await db
      .from('orders')
      .update({ status: 'paid', paid_at: now.toISOString(), current_period_end: order.recurring ? end.toISOString() : null })
      .eq('id', order.id);
  } else if (event.event === 'ORDER_CANCELLED' || event.event === 'ORDER_PAYMENT_FAILED') {
    await db.from('orders').update({ status: 'cancelled' }).eq('id', order.id).eq('status', 'pending');
  }
  return text('ok');
});

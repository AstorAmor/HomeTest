// Página de vuelta del pago (Revolut): redirige a la app (el proveedor exige una URL web).
// No registra nada: el pago solo cuenta cuando llega el webhook firmado.
import { isAppReturnUrl } from '../_shared/payments.ts';

Deno.serve((req) => {
  const url = new URL(req.url);
  const to = url.searchParams.get('to') ?? '';
  if (!isAppReturnUrl(to)) return new Response('Invalid return URL', { status: 400 });

  const status = url.searchParams.get('status') === 'success' ? 'success' : 'cancelled';
  const target = new URL(to);
  target.searchParams.set('status', status);
  const orderId = url.searchParams.get('order_id');
  if (orderId && /^[0-9a-f-]{36}$/i.test(orderId)) target.searchParams.set('order_id', orderId);

  return new Response(null, { status: 302, headers: { Location: target.toString() } });
});

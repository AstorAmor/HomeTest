// Página de vuelta de Stripe Checkout: redirige a la app (Stripe exige una URL web).
// No registra nada: el pago solo cuenta cuando llega el webhook firmado.
import { isAppReturnUrl } from '../_shared/payments.ts';

Deno.serve((req) => {
  const url = new URL(req.url);
  const to = url.searchParams.get('to') ?? '';
  if (!isAppReturnUrl(to)) return new Response('Invalid return URL', { status: 400 });

  const status = url.searchParams.get('status') === 'success' ? 'success' : 'cancelled';
  const target = new URL(to);
  target.searchParams.set('status', status);
  const sessionId = url.searchParams.get('session_id');
  if (sessionId) target.searchParams.set('session_id', sessionId);

  return new Response(null, { status: 302, headers: { Location: target.toString() } });
});

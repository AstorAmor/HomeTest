// Piezas comunes de pagos: cliente de Stripe, cliente de Supabase con permisos de
// servidor (para escribir en orders) y validación de la URL de vuelta a la app.
import Stripe from 'npm:stripe@17';
import { createClient } from 'npm:@supabase/supabase-js@2';

export const stripeConfigured = () => !!Deno.env.get('STRIPE_SECRET_KEY');

export const stripe = () =>
  new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', { httpClient: Stripe.createFetchHttpClient() });

export const cryptoProvider = Stripe.createSubtleCryptoProvider();

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

// Tras pagar, Stripe vuelve a checkout-return, que redirige a la app. Solo se permiten
// esquemas de la app (instalada o Expo Go) y localhost en desarrollo: nada de webs externas.
export const isAppReturnUrl = (url: string) =>
  /^(apptestsmedicos|exp|exps):\/\/[^\s]+$/.test(url) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/[^\s]*$/.test(url);

-- Pedidos y suscripciones pagados con Stripe.
-- La app solo LEE sus pedidos. Los crea la Edge Function create-checkout (estado
-- 'pending') y los marca como pagados el webhook de Stripe tras verificar la firma:
-- así una membresía solo cuenta como activa cuando Stripe confirma el cobro.
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  product_id text not null,
  amount_cents integer not null check (amount_cents > 0),
  currency text not null default 'eur',
  recurring boolean not null default false,
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'cancelled', 'refunded', 'expired')),
  stripe_session_id text unique,
  stripe_subscription_id text,
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  -- Fin del periodo pagado (planes anuales). Lo actualiza el webhook en cada renovación.
  current_period_end timestamptz
);

create index orders_user_idx on public.orders (user_id, created_at desc);

alter table public.orders enable row level security;

create policy "orders: read own"
  on public.orders for select to authenticated
  using (user_id = auth.uid());

-- Sin políticas de insert/update/delete: solo el servidor (service role) escribe.
revoke insert, update, delete on public.orders from anon, authenticated;

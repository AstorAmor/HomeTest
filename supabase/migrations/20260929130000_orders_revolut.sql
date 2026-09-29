-- Pagos con Revolut en lugar de Stripe: columnas genéricas de proveedor.
alter table public.orders rename column stripe_session_id to provider_order_id;
alter table public.orders drop column stripe_subscription_id;
alter table public.orders add column provider text not null default 'revolut';
alter index if exists orders_stripe_session_id_key rename to orders_provider_order_id_key;

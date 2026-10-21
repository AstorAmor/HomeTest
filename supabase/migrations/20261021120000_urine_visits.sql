-- Orina: cada vez con su hora, color y escozor (como bowel_logs.movements), para editar las veces
-- sueltas además del total del día. Lista de {at, color?, burning?}; nunca más que `count`.
alter table public.urine_logs add column if not exists visits jsonb;

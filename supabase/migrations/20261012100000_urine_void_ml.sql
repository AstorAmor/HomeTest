-- Medición rápida de volumen de orina: además de la cantidad aproximada (void_volume: un cuarto,
-- la mitad… de una botella de 500 ml), el volumen exacto en ml si la persona lo mide con un vaso
-- graduado. Sin aplicar todavía: pendiente del OK del fundador.
alter table public.urine_logs
  add column if not exists void_ml integer check (void_ml between 0 and 2000);

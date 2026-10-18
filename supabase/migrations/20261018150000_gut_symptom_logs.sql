-- Registro de Digestión (2026-10-18): lo que el usuario nota en la tripa, cuando lo nota, y lo que
-- comió antes (se pregunta justo después de apuntar las molestias; no usa las comidas de "Tus
-- nutrientes"). La app lo cruza con las heces (bowel_logs) por las horas (src/logic/gutPatterns.ts).
-- Mismo patrón que bowel_logs: clave (user_id, id) para poder subir lo guardado en el móvil sin
-- duplicar.
--
-- PREPARADA, SIN APLICAR: aplicar solo con el OK explícito del fundador. Después, poner
-- REMOTE_HAS_GUT_LOGS = true en src/data/digestionRepository.ts (y subir lo guardado en el móvil).

create table public.gut_symptom_logs (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null default gen_random_uuid()::text,
  -- symptoms = noto algo; day_ok = "Hoy, bien" (confirma que el resto del día no hubo molestias)
  kind text not null default 'symptoms' check (kind in ('symptoms', 'day_ok')),
  -- Intensidad 1 leve, 2 moderado, 3 fuerte (GSRS adaptada); null = no lo notó
  fullness smallint check (fullness between 1 and 3), -- pesadez o lleno demasiado pronto
  bloating smallint check (bloating between 1 and 3),
  reflux smallint check (reflux between 1 and 3), -- ardor o reflujo
  gas smallint check (gas between 1 and 3),
  pain smallint check (pain between 1 and 3),
  nausea smallint check (nausea between 1 and 3),
  woke_at_night boolean,
  note text,
  -- Lo que comió antes de notarlo (la última comida o picoteo); todo opcional
  food_fasted boolean, -- no había comido nada en las horas antes
  food_description text,
  -- Grupos confirmados por el usuario: gluten, lactose, dairy_low_lactose, legumes, onion_garlic,
  -- fructose, polyols, fatty, spicy, alcohol, coffee
  food_groups text[],
  food_minutes_before smallint check (food_minutes_before between 0 and 1440),
  food_amount text check (food_amount in ('little', 'normal', 'lot')),
  logged_at timestamptz not null, -- cuándo empezó (o el mediodía del día, en day_ok)
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);

create index on public.gut_symptom_logs (user_id, logged_at desc);

alter table public.gut_symptom_logs enable row level security;

create policy "gut_symptom_logs: owner all" on public.gut_symptom_logs for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Cada vez apuntada con "Ahora" en Heces, con su hora, para cruzarla con las comidas:
-- [{ "at": "2026-10-18T11:05:00Z", "consistency": 6, "urgent": true }]
alter table public.bowel_logs add column movements jsonb;

-- Registro digestivo y urinario que hace el propio usuario (un apunte por día). Mismo patrón que
-- metric_readings: clave (user_id, id) para poder subir lo guardado en el móvil sin duplicar.

create table public.bowel_logs (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null default gen_random_uuid()::text,
  count smallint not null check (count between 0 and 20),
  color text check (color in ('brown', 'light_brown', 'yellow', 'green', 'black', 'red', 'pale')),
  consistency smallint check (consistency between 1 and 7), -- escala de Bristol
  note text,
  explained_by text, -- lo que explica un color llamativo (comida, suplemento...)
  logged_at timestamptz not null,
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table public.urine_logs (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null default gen_random_uuid()::text,
  count smallint check (count between 0 and 40),
  night_count smallint check (night_count between 0 and 10),
  color text check (color in ('clear', 'pale', 'yellow', 'dark', 'amber', 'brown', 'red', 'cloudy')),
  burning boolean,
  void_volume text check (void_volume in ('quarter', 'half', 'three_quarters', 'full')),
  volume_usual text check (volume_usual in ('yes', 'no', 'unsure')),
  daily_total_ml integer check (daily_total_ml between 0 and 10000),
  note text,
  explained_by text,
  logged_at timestamptz not null,
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);

create index on public.bowel_logs (user_id, logged_at desc);
create index on public.urine_logs (user_id, logged_at desc);

alter table public.bowel_logs enable row level security;
alter table public.urine_logs enable row level security;

create policy "bowel_logs: owner all" on public.bowel_logs for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "urine_logs: owner all" on public.urine_logs for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

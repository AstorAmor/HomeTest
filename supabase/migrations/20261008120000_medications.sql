-- Seguimiento de medicación y suplementos (opcional en la app). La pauta y la duración se guardan
-- como JSON (schedule, course) porque tienen varias formas: horas fijas, cada N horas, ciertos
-- días o "solo si lo necesito"; habitual o tratamiento de N días.

create table public.medications (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null default gen_random_uuid()::text,
  name text not null,
  kind text not null check (kind in ('medication', 'supplement')),
  dose text,
  schedule jsonb not null,
  course jsonb not null,
  with_food text check (with_food in ('with', 'empty', 'any')),
  reminders boolean not null default true,
  reminders_muted_until timestamptz, -- recordatorio silenciado hasta esa fecha (año 9999 = para siempre)
  stopped_at timestamptz,
  note text,
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table public.medication_doses (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null default gen_random_uuid()::text,
  medication_id text not null,
  scheduled_for timestamptz not null,
  status text not null check (status in ('taken', 'skipped')),
  logged_at timestamptz not null,
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);

create index on public.medications (user_id, created_at desc);
create index on public.medication_doses (user_id, logged_at desc);

alter table public.medications enable row level security;
alter table public.medication_doses enable row level security;

create policy "medications: owner all" on public.medications for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "medication_doses: owner all" on public.medication_doses for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

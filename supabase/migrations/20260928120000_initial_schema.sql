-- HomeTest: esquema inicial (datos de salud por usuario).
--
-- Principios:
-- - Cada fila pertenece a un usuario (user_id = auth.uid()) y RLS impide ver datos de otros.
-- - Los ids los puede generar el cliente (texto), por eso la clave primaria es (user_id, id).
-- - Categoría especial RGPD: el consentimiento para uso agregado (tipo Flo) se guarda
--   desde el primer día en profiles, aunque todavía no se use.
-- - Compartir con profesionales: ver la migración siguiente (data_shares).

-- ---------------------------------------------------------------------------
-- Perfil (1 fila por usuario, se crea sola al registrarse)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  date_of_birth date,
  sex text check (sex in ('female', 'male', 'other', 'undisclosed')),
  height_cm numeric,
  weight_kg numeric,
  activity text,
  sleep_habit text,
  smoking text,
  alcohol text,
  goals text[] not null default '{}',
  badges text[] not null default '{}',
  onboarding_completed_at timestamptz,
  consent_aggregate_use boolean not null default false,
  consent_aggregate_use_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, new.raw_user_meta_data ->> 'display_name');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Mediciones
-- ---------------------------------------------------------------------------
create table public.glucose_readings (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null default gen_random_uuid()::text,
  value numeric not null,
  unit text not null check (unit in ('mg/dL', 'mmol/L')),
  meal_type text not null default 'unspecified',
  measured_at timestamptz not null,
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table public.blood_pressure_readings (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null default gen_random_uuid()::text,
  systolic integer not null,
  diastolic integer not null,
  pulse integer,
  source text not null default 'manual' check (source in ('photo', 'manual')),
  measured_at timestamptz not null,
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);

-- Métricas simples de un valor (colesterol total, cortisol...)
create table public.metric_readings (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null default gen_random_uuid()::text,
  kind text not null,
  value numeric not null,
  unit text not null,
  measured_at timestamptz not null,
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table public.cycle_starts (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null default gen_random_uuid()::text,
  started_at timestamptz not null,
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);

-- ---------------------------------------------------------------------------
-- Diario, plan y hábitos
-- ---------------------------------------------------------------------------
create table public.check_ins (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null default gen_random_uuid()::text,
  moment text not null check (moment in ('just_woke_up', 'mid_day', 'winding_down')),
  sleep smallint check (sleep between 1 and 5),
  energy smallint check (energy between 1 and 5),
  stress smallint check (stress between 1 and 5),
  day_rating smallint check (day_rating between 1 and 5),
  mood text,
  note text,
  checked_in_at timestamptz not null,
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table public.ai_logs (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null default gen_random_uuid()::text,
  quadrant text not null,
  intensity smallint not null,
  note text not null default '',
  has_audio boolean not null default false,
  transcript text,
  summary text,
  tags text[] not null default '{}',
  logged_at timestamptz not null,
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table public.workouts (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null default gen_random_uuid()::text,
  type text not null,
  minutes integer not null,
  intensity text not null,
  performed_at timestamptz not null,
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table public.meals (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null default gen_random_uuid()::text,
  photo_path text, -- ruta en el bucket meal-photos: <user_id>/<id>.jpg
  description text not null default '',
  meal_type text not null,
  added_sugar boolean,
  eaten_at timestamptz not null,
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);

-- ---------------------------------------------------------------------------
-- Wearables (formato propio de HomeTest, un valor por día y métrica)
-- ---------------------------------------------------------------------------
create table public.wearable_daily (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date date not null,
  metric text not null,
  value numeric not null,
  source_name text not null,
  provider text not null,
  raw_type_id text not null,
  raw_type_name text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, date, metric, source_name, provider, raw_type_id)
);

-- ---------------------------------------------------------------------------
-- Informes de laboratorio (resultado estructurado + fichero original)
-- ---------------------------------------------------------------------------
create table public.lab_reports (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null default gen_random_uuid()::text,
  test_date date,
  lab_name text,
  source text not null default 'upload' check (source in ('upload', 'hometest')),
  file_paths text[] not null default '{}', -- rutas en el bucket lab-files
  data jsonb not null,
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);

-- ---------------------------------------------------------------------------
-- Índices para las consultas habituales (histórico por fecha)
-- ---------------------------------------------------------------------------
create index on public.glucose_readings (user_id, measured_at desc);
create index on public.blood_pressure_readings (user_id, measured_at desc);
create index on public.metric_readings (user_id, kind, measured_at desc);
create index on public.cycle_starts (user_id, started_at desc);
create index on public.check_ins (user_id, checked_in_at desc);
create index on public.ai_logs (user_id, logged_at desc);
create index on public.workouts (user_id, performed_at desc);
create index on public.meals (user_id, eaten_at desc);
create index on public.wearable_daily (user_id, date desc);
create index on public.lab_reports (user_id, test_date desc);

-- ---------------------------------------------------------------------------
-- RLS: cada usuario solo ve y modifica sus filas
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
create policy "own profile: select" on public.profiles for select to authenticated
  using ((select auth.uid()) = id);
create policy "own profile: update" on public.profiles for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

do $$
declare
  t text;
begin
  foreach t in array array[
    'glucose_readings', 'blood_pressure_readings', 'metric_readings', 'cycle_starts',
    'check_ins', 'ai_logs', 'workouts', 'meals', 'wearable_daily', 'lab_reports'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "own rows: select" on public.%I for select to authenticated using ((select auth.uid()) = user_id)', t);
    execute format(
      'create policy "own rows: insert" on public.%I for insert to authenticated with check ((select auth.uid()) = user_id)', t);
    execute format(
      'create policy "own rows: update" on public.%I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', t);
    execute format(
      'create policy "own rows: delete" on public.%I for delete to authenticated using ((select auth.uid()) = user_id)', t);
  end loop;
end
$$;

-- ---------------------------------------------------------------------------
-- Storage: buckets privados; cada usuario solo accede a su carpeta <user_id>/
-- ---------------------------------------------------------------------------
-- Límites de tamaño y tipo: la app ya comprime (~100-200 KB por foto de comida),
-- pero el límite en el servidor evita que un fallo llene el plan gratuito (1 GB).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('meal-photos', 'meal-photos', false, 1048576, array['image/jpeg']),            -- 1 MB
  ('lab-files', 'lab-files', false, 10485760, array['image/jpeg', 'application/pdf']) -- 10 MB
on conflict (id) do nothing;

create policy "own files: select" on storage.objects for select to authenticated
  using (bucket_id in ('meal-photos', 'lab-files') and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "own files: insert" on storage.objects for insert to authenticated
  with check (bucket_id in ('meal-photos', 'lab-files') and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "own files: update" on storage.objects for update to authenticated
  using (bucket_id in ('meal-photos', 'lab-files') and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "own files: delete" on storage.objects for delete to authenticated
  using (bucket_id in ('meal-photos', 'lab-files') and (storage.foldername(name))[1] = (select auth.uid())::text);

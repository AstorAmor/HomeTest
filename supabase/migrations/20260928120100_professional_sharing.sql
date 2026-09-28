-- HomeTest: compartir datos con profesionales.
--
-- El paciente decide QUÉ comparte (categorías = scopes) y CON QUIÉN (profesional),
-- con caducidad opcional y revocación en cualquier momento. La base de datos lo
-- hace cumplir con RLS: un profesional solo puede LEER las filas de las
-- categorías de un permiso activo; nunca escribir.
--
-- Cada permiso es también el registro del consentimiento (RGPD, datos de salud):
-- no se borra, se revoca (revoked_at), y sus categorías no se editan: para
-- cambiarlas se revoca y se crea uno nuevo, así queda el historial completo.

-- ---------------------------------------------------------------------------
-- Profesionales (usuarios con cuenta propia, verificados por HomeTest)
-- ---------------------------------------------------------------------------
create table public.professionals (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  role text not null check (role in ('doctor', 'dietitian', 'trainer', 'physio', 'geneticist')),
  specialty text,
  license_number text, -- nº de colegiado
  bio text,
  verified_at timestamptz, -- solo lo marca HomeTest (service role), nunca el propio profesional
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger professionals_touch_updated_at
  before update on public.professionals
  for each row execute function public.touch_updated_at();

alter table public.professionals enable row level security;

-- Directorio: cualquier usuario ve los profesionales verificados; cada profesional, su ficha.
create policy "directory: select" on public.professionals for select to authenticated
  using (verified_at is not null or (select auth.uid()) = id);
create policy "own professional profile: insert" on public.professionals for insert to authenticated
  with check ((select auth.uid()) = id);
create policy "own professional profile: update" on public.professionals for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

-- verified_at no se puede escribir desde la app (privilegios por columna).
revoke insert, update on public.professionals from authenticated, anon;
grant insert (id, display_name, role, specialty, license_number, bio) on public.professionals to authenticated;
grant update (display_name, role, specialty, license_number, bio) on public.professionals to authenticated;

-- ---------------------------------------------------------------------------
-- Permisos de compartir (paciente -> profesional, por categorías)
-- ---------------------------------------------------------------------------
create table public.data_shares (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  professional_id uuid not null references public.professionals (id) on delete cascade,
  scopes text[] not null check (
    cardinality(scopes) > 0
    and scopes <@ array[
      'profile', 'lab_reports', 'glucose', 'blood_pressure', 'metrics',
      'cycle', 'wellbeing', 'activity', 'nutrition', 'wearables'
    ]::text[]
  ),
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  check (patient_id <> professional_id)
);

create index on public.data_shares (professional_id) where revoked_at is null;
create index on public.data_shares (patient_id);

alter table public.data_shares enable row level security;

create policy "patient: select own shares" on public.data_shares for select to authenticated
  using ((select auth.uid()) = patient_id);
create policy "professional: select shares to me" on public.data_shares for select to authenticated
  using ((select auth.uid()) = professional_id);
create policy "patient: create share" on public.data_shares for insert to authenticated
  with check ((select auth.uid()) = patient_id and revoked_at is null);
create policy "patient: revoke share" on public.data_shares for update to authenticated
  using ((select auth.uid()) = patient_id) with check ((select auth.uid()) = patient_id);

-- Solo se puede revocar (no cambiar categorías ni profesional) y nunca borrar.
revoke update, delete on public.data_shares from authenticated, anon;
grant update (revoked_at) on public.data_shares to authenticated;

-- ---------------------------------------------------------------------------
-- ¿El usuario actual (profesional verificado) tiene permiso activo sobre `owner` para `scope`?
-- security definer para poder consultar data_shares/professionals desde las políticas.
-- ---------------------------------------------------------------------------
create function public.has_share(owner uuid, scope text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.data_shares s
    join public.professionals p on p.id = s.professional_id
    where s.patient_id = owner
      and s.professional_id = (select auth.uid())
      and scope = any (s.scopes)
      and s.revoked_at is null
      and (s.expires_at is null or s.expires_at > now())
      and p.verified_at is not null
  );
$$;

-- Variante para Storage, donde el dueño es el nombre de la carpeta (texto).
create function public.has_share_folder(folder text, scope text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.data_shares s
    join public.professionals p on p.id = s.professional_id
    where s.patient_id::text = folder
      and s.professional_id = (select auth.uid())
      and scope = any (s.scopes)
      and s.revoked_at is null
      and (s.expires_at is null or s.expires_at > now())
      and p.verified_at is not null
  );
$$;

revoke execute on function public.has_share(uuid, text) from anon, public;
revoke execute on function public.has_share_folder(text, text) from anon, public;
grant execute on function public.has_share(uuid, text) to authenticated;
grant execute on function public.has_share_folder(text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Lectura para profesionales con permiso (solo SELECT)
-- ---------------------------------------------------------------------------
create policy "shared: select" on public.profiles for select to authenticated
  using (public.has_share(id, 'profile'));

create policy "shared: select" on public.lab_reports for select to authenticated
  using (public.has_share(user_id, 'lab_reports'));
create policy "shared: select" on public.glucose_readings for select to authenticated
  using (public.has_share(user_id, 'glucose'));
create policy "shared: select" on public.blood_pressure_readings for select to authenticated
  using (public.has_share(user_id, 'blood_pressure'));
create policy "shared: select" on public.metric_readings for select to authenticated
  using (public.has_share(user_id, 'metrics'));
create policy "shared: select" on public.cycle_starts for select to authenticated
  using (public.has_share(user_id, 'cycle'));
create policy "shared: select" on public.check_ins for select to authenticated
  using (public.has_share(user_id, 'wellbeing'));
create policy "shared: select" on public.ai_logs for select to authenticated
  using (public.has_share(user_id, 'wellbeing'));
create policy "shared: select" on public.workouts for select to authenticated
  using (public.has_share(user_id, 'activity'));
create policy "shared: select" on public.meals for select to authenticated
  using (public.has_share(user_id, 'nutrition'));
create policy "shared: select" on public.wearable_daily for select to authenticated
  using (public.has_share(user_id, 'wearables'));

create policy "shared files: select" on storage.objects for select to authenticated
  using (
    (bucket_id = 'lab-files' and public.has_share_folder((storage.foldername(name))[1], 'lab_reports'))
    or (bucket_id = 'meal-photos' and public.has_share_folder((storage.foldername(name))[1], 'nutrition'))
  );

-- ---------------------------------------------------------------------------
-- Lista de pacientes para el profesional: nombre + categorías de cada permiso activo.
-- El nombre se comparte siempre que exista un permiso (se explica al paciente en la app).
-- ---------------------------------------------------------------------------
create function public.my_shared_patients()
returns table (
  share_id uuid,
  patient_id uuid,
  patient_name text,
  scopes text[],
  expires_at timestamptz,
  shared_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, s.patient_id, pr.display_name, s.scopes, s.expires_at, s.created_at
  from public.data_shares s
  join public.professionals p on p.id = s.professional_id
  left join public.profiles pr on pr.id = s.patient_id
  where s.professional_id = (select auth.uid())
    and s.revoked_at is null
    and (s.expires_at is null or s.expires_at > now())
    and p.verified_at is not null
  order by s.created_at desc;
$$;

revoke execute on function public.my_shared_patients() from anon, public;
grant execute on function public.my_shared_patients() to authenticated;

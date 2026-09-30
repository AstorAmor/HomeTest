-- Analíticas subidas por el usuario (escaneo/PDF extraído con IA) y versiones de su
-- plan de acción. Cada vez que el usuario (o, más adelante, su profesional) actualiza
-- el plan se guarda una versión nueva: nunca se sobrescribe, así queda el historial.

create table public.lab_uploads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  lab_name text,
  test_date date,
  data jsonb not null, -- ExtractedLabReport tal cual lo devolvió la extracción (ya revisado por el usuario)
  created_at timestamptz not null default now()
);

create index lab_uploads_user_idx on public.lab_uploads (user_id, created_at desc);
alter table public.lab_uploads enable row level security;

create policy "lab_uploads: owner all" on public.lab_uploads for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
-- Profesionales con permiso activo de "lab_reports" pueden leerlas.
create policy "lab_uploads: shared read" on public.lab_uploads for select to authenticated
  using (public.has_share(user_id, 'lab_reports'));

create table public.action_plans (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  professional_id uuid references public.professionals (id) on delete set null, -- null = generado por HomeTest/el usuario
  source text not null check (source in ('report', 'upload', 'professional')),
  based_on text, -- id del informe o de la subida en que se basa
  items jsonb not null, -- acciones con estado (reached / on_track / needs_attention / not_retested / new)
  prescriptions jsonb not null default '[]'::jsonb,
  note text,
  created_at timestamptz not null default now()
);

create index action_plans_patient_idx on public.action_plans (patient_id, created_at desc);
alter table public.action_plans enable row level security;

create policy "action_plans: patient read" on public.action_plans for select to authenticated
  using ((select auth.uid()) = patient_id);
-- El paciente solo crea versiones propias (sin profesional); las del profesional llegan con el portal.
create policy "action_plans: patient insert" on public.action_plans for insert to authenticated
  with check ((select auth.uid()) = patient_id and professional_id is null and source in ('report', 'upload'));
revoke update, delete on public.action_plans from authenticated, anon;

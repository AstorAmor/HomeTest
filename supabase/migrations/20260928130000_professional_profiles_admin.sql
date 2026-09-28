-- HomeTest: ficha completa del profesional, tarifa supervisada por HomeTest y administradores.
--
-- - El profesional rellena su ficha y PROPONE una tarifa horaria (hourly_rate_requested_eur).
-- - HomeTest (admins) verifica al profesional y APRUEBA o rechaza la tarifa; los
--   pacientes solo ven la aprobada (hourly_rate_eur).
-- - Privilegios por columna: los pacientes ven la ficha pública, nunca la tarifa
--   propuesta ni las notas de revisión. El profesional lee su ficha completa con
--   my_professional_profile(); los admins, con admin_list_professionals().

-- ---------------------------------------------------------------------------
-- Ficha profesional
-- ---------------------------------------------------------------------------
alter table public.professionals
  add column license_college text, -- colegio profesional (p. ej. ICOMEM)
  add column city text,
  add column languages text[] not null default '{}',
  add column modalities text[] not null default '{}'
    check (modalities <@ array['online', 'in_person', 'home_visit']::text[]),
  add column years_experience smallint check (years_experience between 0 and 70),
  add column photo_path text, -- bucket público professional-photos: <user_id>/avatar.jpg
  add column hourly_rate_requested_eur numeric(8, 2) check (hourly_rate_requested_eur > 0),
  add column hourly_rate_eur numeric(8, 2) check (hourly_rate_eur > 0), -- aprobada por HomeTest
  add column rate_status text not null default 'none'
    check (rate_status in ('none', 'pending', 'approved', 'rejected')),
  add column rate_reviewed_at timestamptz,
  add column review_note text; -- nota de HomeTest al profesional (verificación / tarifa)

-- Si el profesional cambia la tarifa propuesta, vuelve a revisión.
create function public.professionals_rate_to_review()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.hourly_rate_requested_eur is distinct from old.hourly_rate_requested_eur then
    new.rate_status := case when new.hourly_rate_requested_eur is null then 'none' else 'pending' end;
  end if;
  return new;
end;
$$;

create trigger professionals_rate_to_review
  before update on public.professionals
  for each row execute function public.professionals_rate_to_review();

create function public.professionals_rate_on_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.hourly_rate_requested_eur is not null then
    new.rate_status := 'pending';
  end if;
  return new;
end;
$$;

create trigger professionals_rate_on_insert
  before insert on public.professionals
  for each row execute function public.professionals_rate_on_insert();

-- Columnas que el profesional puede escribir (nunca verificación, tarifa aprobada ni revisión).
revoke insert, update on public.professionals from authenticated, anon;
grant insert (
  id, display_name, role, specialty, license_number, license_college, bio, city,
  languages, modalities, years_experience, photo_path, hourly_rate_requested_eur
) on public.professionals to authenticated;
grant update (
  display_name, role, specialty, license_number, license_college, bio, city,
  languages, modalities, years_experience, photo_path, hourly_rate_requested_eur
) on public.professionals to authenticated;

-- Columnas visibles en el directorio (sin tarifa propuesta ni notas de revisión).
revoke select on public.professionals from authenticated, anon;
grant select (
  id, display_name, role, specialty, license_number, license_college, bio, city,
  languages, modalities, years_experience, photo_path, hourly_rate_eur, verified_at,
  created_at, updated_at
) on public.professionals to authenticated;

-- ---------------------------------------------------------------------------
-- Administradores de HomeTest
-- ---------------------------------------------------------------------------
create table public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
-- Sin políticas: nadie la lee ni la escribe desde la app. Se gestiona con SQL.
alter table public.admins enable row level security;

create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admins where user_id = (select auth.uid()));
$$;

revoke execute on function public.is_admin() from anon, public;
grant execute on function public.is_admin() to authenticated;

-- Ficha completa del propio profesional (incluida su tarifa propuesta y la revisión).
create function public.my_professional_profile()
returns setof public.professionals
language sql
stable
security definer
set search_path = ''
as $$
  select * from public.professionals where id = (select auth.uid());
$$;

revoke execute on function public.my_professional_profile() from anon, public;
grant execute on function public.my_professional_profile() to authenticated;

-- Admin: todos los profesionales con todos los campos.
create function public.admin_list_professionals()
returns setof public.professionals
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Only HomeTest admins can list professionals for review' using errcode = '42501';
  end if;
  return query select * from public.professionals order by verified_at nulls first, created_at desc;
end;
$$;

revoke execute on function public.admin_list_professionals() from anon, public;
grant execute on function public.admin_list_professionals() to authenticated;

-- Admin: verificar / retirar verificación y aprobar / rechazar la tarifa propuesta.
-- p_verified y p_rate_decision a null = no tocar ese aspecto.
create function public.admin_review_professional(
  p_professional_id uuid,
  p_verified boolean default null,
  p_rate_decision text default null, -- 'approve' | 'reject'
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Only HomeTest admins can review professionals' using errcode = '42501';
  end if;
  if p_rate_decision is not null and p_rate_decision not in ('approve', 'reject') then
    raise exception 'p_rate_decision must be approve or reject' using errcode = '22023';
  end if;

  update public.professionals p set
    verified_at = case
      when p_verified is true then coalesce(p.verified_at, now())
      when p_verified is false then null
      else p.verified_at end,
    hourly_rate_eur = case
      when p_rate_decision = 'approve' then p.hourly_rate_requested_eur
      else p.hourly_rate_eur end,
    rate_status = case
      when p_rate_decision = 'approve' then 'approved'
      when p_rate_decision = 'reject' then 'rejected'
      else p.rate_status end,
    rate_reviewed_at = case when p_rate_decision is not null then now() else p.rate_reviewed_at end,
    review_note = coalesce(p_note, p.review_note)
  where p.id = p_professional_id;

  if not found then
    raise exception 'Professional not found' using errcode = 'P0002';
  end if;
end;
$$;

revoke execute on function public.admin_review_professional(uuid, boolean, text, text) from anon, public;
grant execute on function public.admin_review_professional(uuid, boolean, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Fotos de perfil de profesionales: bucket público (foto de presentación), ≤1 MB, JPEG
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('professional-photos', 'professional-photos', true, 1048576, array['image/jpeg'])
on conflict (id) do nothing;

create policy "pro photo: insert own" on storage.objects for insert to authenticated
  with check (bucket_id = 'professional-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "pro photo: update own" on storage.objects for update to authenticated
  using (bucket_id = 'professional-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "pro photo: delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'professional-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

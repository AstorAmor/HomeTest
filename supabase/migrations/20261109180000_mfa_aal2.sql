-- Doble factor (app de autenticación, TOTP) obligatorio para admins, profesionales y soporte (2026-11-09).
--
-- La obligación la pone la base de datos, no la pantalla:
-- 1) mfa_ok(): la sesión vale si es aal2 (se ha escrito el código de la app de autenticación) o si la cuenta
--    no necesita doble factor y no lo tiene activado. Lo necesitan los admins, los profesionales (también
--    sin verificar) y las cuentas de soporte; un paciente que lo active por su cuenta (opcional) también
--    queda protegido: con solo la contraseña no ve nada.
-- 2) Una política RESTRICTIVA en cada tabla de public con RLS y en storage.objects: sin mfa_ok() no se lee
--    ni se escribe ninguna fila, aunque otra política lo permita. Un test (mfa_aal2.test.sql) comprueba que
--    ninguna tabla se queda sin ella: una tabla nueva tiene que crearla también.
-- 3) Las funciones security definer se saltan RLS, así que exigen aal2 por dentro: is_admin() (todas las
--    funciones y políticas de admin), is_support_agent() (support_read, support_open_file…), has_share(),
--    has_share_folder(), is_my_patient(), my_shared_patients() y pro_patients().
-- 4) mfa_required() se puede preguntar con aal1: la app la usa para pedir el alta o el código al entrar.
-- 5) mfa_resets: registro de solo añadir de cada vez que un admin quita el doble factor de alguien (móvil
--    perdido). Lo escribe la Edge Function admin-mfa-reset, que comprueba que quien llama es admin con aal2.
--
-- Orden en producción: primero la app que sabe pedir el código (OTA), después esta migración. Al revés,
-- un admin o un profesional con la app vieja dejaría de ver datos sin saber por qué.

-- ---------------------------------------------------------------------------
-- 1) Funciones
-- ---------------------------------------------------------------------------
create function public.jwt_aal2()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce((select auth.jwt() ->> 'aal'), '') = 'aal2';
$$;

create function public.mfa_required()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admins where user_id = (select auth.uid()))
      or exists (select 1 from public.professionals where id = (select auth.uid()))
      or exists (select 1 from public.support_agents where user_id = (select auth.uid()));
$$;

create function public.has_verified_mfa()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from auth.mfa_factors f
    where f.user_id = (select auth.uid()) and f.status = 'verified'
  );
$$;

create function public.mfa_ok()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.jwt_aal2() or not (public.mfa_required() or public.has_verified_mfa());
$$;

revoke execute on function public.jwt_aal2() from anon, public;
revoke execute on function public.mfa_required() from anon, public;
revoke execute on function public.has_verified_mfa() from anon, public;
revoke execute on function public.mfa_ok() from anon, public;
grant execute on function public.jwt_aal2() to authenticated;
grant execute on function public.mfa_required() to authenticated;
grant execute on function public.has_verified_mfa() to authenticated;
grant execute on function public.mfa_ok() to authenticated;

-- Admin y soporte: solo con el segundo factor. Todas las funciones y políticas de admin y de soporte pasan
-- por aquí, así que no hace falta tocarlas una a una.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.jwt_aal2() and exists (select 1 from public.admins where user_id = (select auth.uid()));
$$;

create or replace function public.is_support_agent()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.jwt_aal2() and exists (select 1 from public.support_agents where user_id = (select auth.uid()));
$$;

-- Profesionales: los datos de pacientes, solo con el segundo factor (mismo cuerpo que en
-- 20260928120100_professional_sharing.sql y 20260930110000_specialist_portal.sql, más jwt_aal2()).
create or replace function public.has_share(owner uuid, scope text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.jwt_aal2() and exists (
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

create or replace function public.has_share_folder(folder text, scope text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.jwt_aal2() and exists (
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

create or replace function public.is_my_patient(patient uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.jwt_aal2() and exists (
    select 1 from public.professionals p
    where p.id = (select auth.uid()) and p.verified_at is not null
  ) and (
    exists (select 1 from public.data_shares s where s.patient_id = patient and s.professional_id = (select auth.uid())
            and s.revoked_at is null and (s.expires_at is null or s.expires_at > now()))
    or exists (select 1 from public.appointments a where a.patient_id = patient and a.professional_id = (select auth.uid()))
    or exists (select 1 from public.consultation_requests r where r.patient_id = patient and r.professional_id = (select auth.uid()))
    or exists (select 1 from public.conversations c where c.patient_id = patient and c.professional_id = (select auth.uid()))
  );
$$;

create or replace function public.my_shared_patients()
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
    and public.jwt_aal2()
  order by s.created_at desc;
$$;

create or replace function public.pro_patients()
returns table (
  patient_id uuid,
  patient_name text,
  scopes text[],
  open_requests integer,
  unread_messages integer,
  next_appointment timestamptz,
  appointment_today boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  with me as (select (select auth.uid()) as id),
  ids as (
    select s.patient_id from public.data_shares s, me where s.professional_id = me.id and s.revoked_at is null
      and (s.expires_at is null or s.expires_at > now())
    union select a.patient_id from public.appointments a, me where a.professional_id = me.id
    union select r.patient_id from public.consultation_requests r, me where r.professional_id = me.id
    union select c.patient_id from public.conversations c, me where c.professional_id = me.id
  )
  select
    i.patient_id,
    coalesce(
      pr.display_name,
      (select a.patient_name from public.appointments a where a.patient_id = i.patient_id and a.patient_name is not null limit 1),
      (select r.patient_name from public.consultation_requests r where r.patient_id = i.patient_id and r.patient_name is not null limit 1),
      (select c.patient_name from public.conversations c where c.patient_id = i.patient_id and c.patient_name is not null limit 1),
      'Patient'
    ),
    (select s.scopes from public.data_shares s, me where s.patient_id = i.patient_id and s.professional_id = me.id
       and s.revoked_at is null and (s.expires_at is null or s.expires_at > now()) order by s.created_at desc limit 1),
    (select count(*)::int from public.consultation_requests r, me where r.patient_id = i.patient_id and r.professional_id = me.id and r.status = 'open'),
    (select count(*)::int from public.messages m join public.conversations c on c.id = m.conversation_id, me
       where c.patient_id = i.patient_id and c.professional_id = me.id and m.sender_id <> me.id and m.read_at is null),
    (select min(a.starts_at) from public.appointments a, me where a.patient_id = i.patient_id and a.professional_id = me.id
       and a.status in ('pending', 'confirmed') and a.starts_at > now() - interval '1 hour'),
    exists (select 1 from public.appointments a, me where a.patient_id = i.patient_id and a.professional_id = me.id
       and a.status in ('pending', 'confirmed') and (a.starts_at at time zone 'Europe/Madrid')::date = (now() at time zone 'Europe/Madrid')::date)
  from ids i
  left join public.profiles pr on pr.id = i.patient_id
  where exists (select 1 from public.professionals p, me where p.id = me.id and p.verified_at is not null)
    and public.jwt_aal2();
$$;

-- ---------------------------------------------------------------------------
-- 2) Registro de doble factor quitado por un admin (móvil perdido)
-- ---------------------------------------------------------------------------
create table public.mfa_resets (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null,       -- sin FK: el registro se conserva aunque se borre la cuenta
  target_id uuid not null,
  target_email text,
  reason text not null check (char_length(reason) between 10 and 1000),
  factors_removed integer not null default 0,
  created_at timestamptz not null default now()
);
alter table public.mfa_resets enable row level security;
create policy "mfa resets: admins read" on public.mfa_resets for select to authenticated
  using ((select public.is_admin()));
-- Nadie escribe desde la app: solo la Edge Function admin-mfa-reset (con la clave de servicio).

create function public.mfa_resets_append_only()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'mfa_resets es un registro: no se edita ni se borra' using errcode = '42501';
end;
$$;
create trigger mfa_resets_append_only before update or delete on public.mfa_resets
  for each row execute function public.mfa_resets_append_only();

-- ---------------------------------------------------------------------------
-- 3) Política restrictiva en cada tabla con RLS (y en Storage)
-- ---------------------------------------------------------------------------
do $$
declare
  r record;
begin
  for r in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p') and c.relrowsecurity
  loop
    execute format(
      'create policy "mfa: segundo factor si la cuenta lo exige" on public.%I as restrictive for all to authenticated '
      'using ((select public.mfa_ok())) with check ((select public.mfa_ok()))',
      r.relname
    );
  end loop;
end;
$$;

create policy "mfa: segundo factor si la cuenta lo exige" on storage.objects as restrictive for all to authenticated
  using ((select public.mfa_ok())) with check ((select public.mfa_ok()));

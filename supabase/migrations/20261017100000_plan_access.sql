-- Suscripciones gestionables por el administrador, acceso por invitación y foto de perfil (2026-10-17).
--
-- 1) app_config: ajustes que un admin cambia desde la propia app. Clave 'plan_features' = qué
--    incluye cada nivel (gratis, Basic, Premium) en filas {id, label, values}. Todos lo leen; solo
--    los admins lo escriben.
-- 2) access_codes / access_grants: acceso a lo de pago sin pagar (amigos, pruebas). El admin crea
--    un código; quien lo canjea recibe acceso Basic o Premium, con fecha de fin opcional. El admin
--    también puede dar acceso a un email concreto y retirarlo.
-- 3) my_access() y has_feature(): nivel efectivo de quien llama (admin > suscripción pagada >
--    acceso por invitación > gratis) y si incluye una función (p. ej. 'scan_reports'). La Edge
--    Function extract lo usa para no leer informes de quien no tiene acceso.
-- 4) Bucket privado 'avatars' para la foto de perfil (<user_id>/...).

-- ---------------------------------------------------------------------------
-- 1) Ajustes de la app
-- ---------------------------------------------------------------------------
create table public.app_config (
  key text primary key check (char_length(key) between 1 and 100),
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);

alter table public.app_config enable row level security;

-- Sin secretos: es lo que se enseña en "Comparar suscripciones"
create policy "app_config: read" on public.app_config for select to anon, authenticated using (true);
create policy "app_config: admins insert" on public.app_config for insert to authenticated
  with check ((select public.is_admin()));
create policy "app_config: admins update" on public.app_config for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "app_config: admins delete" on public.app_config for delete to authenticated
  using ((select public.is_admin()));

-- ---------------------------------------------------------------------------
-- 2) Códigos de acceso y accesos concedidos
-- ---------------------------------------------------------------------------
create table public.access_codes (
  code text primary key check (code ~ '^[A-Z0-9-]{4,40}$'),
  tier text not null check (tier in ('membership', 'premium')),
  days integer check (days is null or days between 1 and 3650), -- duración del acceso al canjearlo (null = sin fin)
  max_uses integer check (max_uses is null or max_uses > 0),     -- null = sin límite
  uses integer not null default 0,
  expires_at timestamptz,                                         -- hasta cuándo se puede canjear
  active boolean not null default true,
  note text,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users (id) on delete set null
);

alter table public.access_codes enable row level security;

create policy "access_codes: admins" on public.access_codes for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create table public.access_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  tier text not null check (tier in ('membership', 'premium')),
  source text not null, -- 'code:<CÓDIGO>' o 'admin_grant' (dado por un admin a un email)
  note text,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null
);

create index access_grants_user_idx on public.access_grants (user_id);

alter table public.access_grants enable row level security;

create policy "access_grants: read own or admin" on public.access_grants for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy "access_grants: admins delete" on public.access_grants for delete to authenticated
  using ((select public.is_admin()));

-- Las altas van solo por redeem_access_code() y admin_grant_access()
revoke insert, update on public.access_grants from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3) Nivel efectivo y funciones incluidas
-- ---------------------------------------------------------------------------
create function public.my_access()
returns table (tier text, source text, expires_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  uid uuid := (select auth.uid());
begin
  if uid is null then
    return query select 'free'::text, 'none'::text, null::timestamptz;
    return;
  end if;
  if exists (select 1 from public.admins a where a.user_id = uid) then
    return query select 'premium'::text, 'admin'::text, null::timestamptz;
    return;
  end if;
  return query
    select x.tier, x.source, x.expires_at
      from (
        select o.product_id as tier, 'subscription'::text as source, o.current_period_end as expires_at,
               case o.product_id when 'premium' then 2 else 1 end as rank
          from public.orders o
         where o.user_id = uid
           and o.status = 'paid'
           and o.product_id in ('membership', 'premium')
           and o.current_period_end > now()
        union all
        select g.tier, g.source, g.expires_at, case g.tier when 'premium' then 2 else 1 end
          from public.access_grants g
         where g.user_id = uid
           and (g.expires_at is null or g.expires_at > now())
      ) x
     order by x.rank desc, (x.source = 'subscription') desc, x.expires_at desc nulls first
     limit 1;
  if not found then
    return query select 'free'::text, 'none'::text, null::timestamptz;
  end if;
end;
$$;

-- Valor de la función para el nivel: true/false, o un texto ({en, es}) que cuenta como incluido.
-- Sin fila para esa función en 'plan_features': solo la incluyen los niveles de pago.
create function public.has_feature(p_feature text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  t text;
  v jsonb;
begin
  select a.tier into t from public.my_access() a;
  select r -> 'values' -> t into v
    from public.app_config c, jsonb_array_elements(c.value -> 'rows') r
   where c.key = 'plan_features'
     and r ->> 'id' = p_feature
   limit 1;
  if v is null then
    return t <> 'free';
  end if;
  return v = 'true'::jsonb or jsonb_typeof(v) = 'object';
end;
$$;

-- Canjear un código (quien tiene sesión). Canjearlo dos veces devuelve el mismo acceso.
create function public.redeem_access_code(p_code text)
returns table (tier text, expires_at timestamptz)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  uid uuid := (select auth.uid());
  normalized text := upper(regexp_replace(coalesce(p_code, ''), '\s', '', 'g'));
  c public.access_codes;
  g public.access_grants;
  until timestamptz;
begin
  if uid is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  select * into c from public.access_codes ac where ac.code = normalized for update;
  if not found or not c.active or (c.expires_at is not null and c.expires_at < now()) then
    raise exception 'invalid_code' using errcode = 'P0001';
  end if;
  select * into g from public.access_grants ag where ag.user_id = uid and ag.source = 'code:' || c.code limit 1;
  if found then
    return query select g.tier, g.expires_at;
    return;
  end if;
  if c.max_uses is not null and c.uses >= c.max_uses then
    raise exception 'code_used_up' using errcode = 'P0001';
  end if;
  until := case when c.days is null then null else now() + make_interval(days => c.days) end;
  insert into public.access_grants (user_id, tier, source, note, expires_at, created_by)
  values (uid, c.tier, 'code:' || c.code, c.note, until, c.created_by);
  update public.access_codes ac set uses = ac.uses + 1 where ac.code = c.code;
  return query select c.tier, until;
end;
$$;

-- Admin: dar acceso a una cuenta por su email
create function public.admin_grant_access(p_email text, p_tier text, p_days integer, p_note text)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid;
  gid uuid;
begin
  if not public.is_admin() then
    raise exception 'Only Kuova admins can grant access' using errcode = '42501';
  end if;
  if p_tier not in ('membership', 'premium') then
    raise exception 'Unknown tier %', p_tier;
  end if;
  select u.id into uid from auth.users u where lower(u.email) = lower(trim(p_email)) limit 1;
  if uid is null then
    raise exception 'no_account' using errcode = 'P0001';
  end if;
  insert into public.access_grants (user_id, tier, source, note, expires_at, created_by)
  values (
    uid, p_tier, 'admin_grant', nullif(trim(coalesce(p_note, '')), ''),
    case when p_days is null then null else now() + make_interval(days => p_days) end,
    (select auth.uid())
  )
  returning id into gid;
  return gid;
end;
$$;

-- Admin: accesos concedidos, con el email de cada cuenta
create function public.admin_list_access_grants()
returns table (id uuid, email text, tier text, source text, note text, expires_at timestamptz, created_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if not public.is_admin() then
    raise exception 'Only Kuova admins can list access' using errcode = '42501';
  end if;
  return query
    select g.id, u.email::text, g.tier, g.source, g.note, g.expires_at, g.created_at
      from public.access_grants g
      join auth.users u on u.id = g.user_id
     order by g.created_at desc;
end;
$$;

revoke execute on function public.my_access() from anon, public;
revoke execute on function public.has_feature(text) from anon, public;
revoke execute on function public.redeem_access_code(text) from anon, public;
revoke execute on function public.admin_grant_access(text, text, integer, text) from anon, public;
revoke execute on function public.admin_list_access_grants() from anon, public;
grant execute on function public.my_access() to authenticated;
grant execute on function public.has_feature(text) to authenticated;
grant execute on function public.redeem_access_code(text) to authenticated;
grant execute on function public.admin_grant_access(text, text, integer, text) to authenticated;
grant execute on function public.admin_list_access_grants() to authenticated;

-- ---------------------------------------------------------------------------
-- 4) Foto de perfil del paciente
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', false, 524288, array['image/jpeg']) -- 512 KB (la app la reduce a ~400 px)
on conflict (id) do nothing;

create policy "avatars: select own" on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "avatars: insert own" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "avatars: update own" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "avatars: delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

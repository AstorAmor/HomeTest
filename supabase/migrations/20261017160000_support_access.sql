-- Acceso de soporte con permiso del usuario y registro de cada acceso (2026-10-17).
--
-- El panel de Supabase se salta RLS y no registra lecturas, así que para resolver incidencias
-- no se abren tablas de salud en el panel. En su lugar:
-- 1) El usuario concede a "Soporte KUOVA" un permiso temporal (máx. 30 días) por categorías desde
--    la app. Es una fila más de data_shares (grantee = 'support', sin professional_id): el mismo
--    historial de consentimientos, las mismas categorías, se revoca igual y nunca se borra.
--    has_share() y el resto de funciones de profesionales filtran por professional_id, así que
--    este permiso no abre ninguna política RLS.
-- 2) Las cuentas de soporte (support_agents, se gestionan con SQL) no tienen políticas de lectura
--    sobre tablas de salud. Solo leen con support_read() y abren archivos con support_open_file():
--    las dos exigen un motivo, comprueban el permiso y escriben en support_access_log en la misma
--    operación; si el registro falla, no se devuelve nada.
-- 3) support_access_log es de solo añadir: nadie lo edita ni lo borra, tampoco desde el panel
--    (un trigger lo impide). Cómo exportarlo: docs/soporte-registro-accesos.md.

-- ---------------------------------------------------------------------------
-- 1) Cuentas de soporte
-- ---------------------------------------------------------------------------
create table public.support_agents (
  user_id uuid primary key references auth.users (id) on delete cascade,
  label text,
  created_at timestamptz not null default now()
);
-- Sin políticas: nadie la lee ni la escribe desde la app. Se gestiona con SQL.
alter table public.support_agents enable row level security;

create function public.is_support_agent()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.support_agents where user_id = (select auth.uid()));
$$;

-- ---------------------------------------------------------------------------
-- 2) Permiso de soporte en data_shares
-- ---------------------------------------------------------------------------
alter table public.data_shares
  add column grantee text not null default 'professional' check (grantee in ('professional', 'support')),
  add column note text check (note is null or char_length(note) <= 1000); -- el problema, contado por el usuario

alter table public.data_shares alter column professional_id drop not null;

-- Un permiso de profesional siempre tiene profesional; el de soporte no tiene y siempre caduca.
alter table public.data_shares add constraint data_shares_support_shape_check check (
  (grantee = 'professional' and professional_id is not null)
  or (
    grantee = 'support'
    and professional_id is null
    and expires_at is not null
    and expires_at <= created_at + interval '31 days'
  )
);

create index data_shares_support_idx on public.data_shares (created_at desc)
  where grantee = 'support' and revoked_at is null;

-- ---------------------------------------------------------------------------
-- 3) Registro de accesos (solo añadir)
-- ---------------------------------------------------------------------------
create table public.support_access_log (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  agent_id uuid,              -- cuenta de soporte (null en anotaciones manuales desde el panel)
  agent_email text not null,
  patient_id uuid,            -- sin clave foránea: el registro se conserva aunque se elimine la cuenta
  share_id uuid,              -- permiso que lo autorizó (null en anotaciones manuales)
  action text not null check (action in ('read', 'open_file', 'manual')),
  scope text,                 -- categoría leída
  object text,                -- archivo abierto: <bucket>/<ruta>
  reason text not null check (char_length(btrim(reason)) between 10 and 500),
  rows_returned integer,
  check (action = 'manual' or (agent_id is not null and patient_id is not null and share_id is not null))
);

create index support_access_log_patient_idx on public.support_access_log (patient_id, created_at desc);
create index support_access_log_file_idx on public.support_access_log (agent_id, object, created_at desc)
  where action = 'open_file';

alter table public.support_access_log enable row level security;

-- Cada cuenta de soporte ve sus propios accesos; los admins, todos. Los usuarios no lo ven.
create policy "support log: own entries or admin" on public.support_access_log for select to authenticated
  using (agent_id = (select auth.uid()) or (select public.is_admin()));

-- Las altas van solo por support_read() y support_open_file() (o un INSERT manual desde el panel).
revoke insert, update, delete, truncate on public.support_access_log from anon, authenticated;

create function public.support_access_log_append_only()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'support_access_log is append-only' using errcode = '42501';
end;
$$;

create trigger support_access_log_no_update_delete
  before update or delete on public.support_access_log
  for each row execute function public.support_access_log_append_only();
create trigger support_access_log_no_truncate
  before truncate on public.support_access_log
  for each statement execute function public.support_access_log_append_only();

-- ---------------------------------------------------------------------------
-- 4) Lectura por soporte
-- ---------------------------------------------------------------------------

-- Permisos de soporte activos: quién, qué categorías, hasta cuándo y el problema que contó.
create function public.support_list_grants()
returns table (
  share_id uuid,
  patient_id uuid,
  patient_name text,
  patient_email text,
  scopes text[],
  note text,
  expires_at timestamptz,
  granted_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if not public.is_support_agent() then
    raise exception 'Only KUOVA support accounts can list support permissions' using errcode = '42501';
  end if;
  return query
    select s.id, s.patient_id, pr.display_name, u.email::text, s.scopes, s.note, s.expires_at, s.created_at
      from public.data_shares s
      left join public.profiles pr on pr.id = s.patient_id
      left join auth.users u on u.id = s.patient_id
     where s.grantee = 'support'
       and s.revoked_at is null
       and s.expires_at > now()
     order by s.created_at desc;
end;
$$;

-- Datos de una categoría (las 60 filas más recientes de cada tabla) y la lista de archivos.
-- Comprueba el permiso, exige motivo y deja el acceso registrado antes de devolver nada.
create function public.support_read(p_share_id uuid, p_scope text, p_reason text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  s public.data_shares;
  src record;
  rows_json jsonb;
  bucket text;
  result jsonb := '{}'::jsonb;
  total integer := 0;
begin
  if not public.is_support_agent() then
    raise exception 'Only KUOVA support accounts can read support data' using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(p_reason, ''))) < 10 then
    raise exception 'reason_required' using errcode = 'P0001';
  end if;
  select * into s from public.data_shares d
   where d.id = p_share_id
     and d.grantee = 'support'
     and d.revoked_at is null
     and d.expires_at > now()
     and p_scope = any (d.scopes);
  if not found then
    raise exception 'no_active_permission' using errcode = '42501';
  end if;

  -- Las mismas tablas por categoría que ven los profesionales (SCOPE_TABLES en src/data/sharing.ts)
  for src in
    select * from (values
      ('profile', 'profiles', 'id', 'updated_at'),
      ('lab_reports', 'lab_reports', 'user_id', 'test_date'),
      ('lab_reports', 'lab_uploads', 'user_id', 'created_at'),
      ('plan', 'action_plans', 'patient_id', 'created_at'),
      ('glucose', 'glucose_readings', 'user_id', 'measured_at'),
      ('blood_pressure', 'blood_pressure_readings', 'user_id', 'measured_at'),
      ('metrics', 'metric_readings', 'user_id', 'measured_at'),
      ('cycle', 'cycle_starts', 'user_id', 'started_at'),
      ('wellbeing', 'check_ins', 'user_id', 'checked_in_at'),
      ('wellbeing', 'ai_logs', 'user_id', 'logged_at'),
      ('activity', 'workouts', 'user_id', 'performed_at'),
      ('nutrition', 'meals', 'user_id', 'eaten_at'),
      ('wearables', 'wearable_daily', 'user_id', 'date')
    ) as m (scope, tbl, owner_col, date_col)
    where m.scope = p_scope
  loop
    execute format(
      'select coalesce(jsonb_agg(to_jsonb(x)), ''[]''::jsonb)
         from (select * from public.%I where %I = $1 order by %I desc nulls last limit 60) x',
      src.tbl, src.owner_col, src.date_col
    ) into rows_json using s.patient_id;
    result := result || jsonb_build_object(src.tbl, rows_json);
    total := total + jsonb_array_length(rows_json);
  end loop;

  -- Archivos: solo nombre, tamaño y fecha. Abrir uno pasa por support_open_file().
  bucket := case p_scope when 'lab_reports' then 'lab-files' when 'nutrition' then 'meal-photos' end;
  if bucket is not null then
    select coalesce(jsonb_agg(jsonb_build_object(
             'bucket', o.bucket_id, 'path', o.name, 'size', o.metadata ->> 'size', 'created_at', o.created_at)), '[]'::jsonb)
      into rows_json
      from (select * from storage.objects ob
             where ob.bucket_id = bucket and ob.name like s.patient_id::text || '/%'
             order by ob.created_at desc limit 100) o;
    result := result || jsonb_build_object('files', rows_json);
  end if;

  insert into public.support_access_log (agent_id, agent_email, patient_id, share_id, action, scope, reason, rows_returned)
  values (
    uid,
    coalesce((select u.email::text from auth.users u where u.id = uid), uid::text),
    s.patient_id, s.id, 'read', p_scope, btrim(p_reason), total
  );

  return result;
end;
$$;

-- Abrir un archivo: comprueba el permiso, registra el acceso y lo desbloquea 5 minutos para
-- que la app pida una URL firmada (la política de Storage de abajo exige esta anotación).
create function public.support_open_file(p_share_id uuid, p_bucket text, p_path text, p_reason text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  s public.data_shares;
  file_scope text := case p_bucket when 'lab-files' then 'lab_reports' when 'meal-photos' then 'nutrition' end;
begin
  if not public.is_support_agent() then
    raise exception 'Only KUOVA support accounts can open support files' using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(p_reason, ''))) < 10 then
    raise exception 'reason_required' using errcode = 'P0001';
  end if;
  if file_scope is null then
    raise exception 'unknown_bucket' using errcode = 'P0001';
  end if;
  select * into s from public.data_shares d
   where d.id = p_share_id
     and d.grantee = 'support'
     and d.revoked_at is null
     and d.expires_at > now()
     and file_scope = any (d.scopes);
  if not found then
    raise exception 'no_active_permission' using errcode = '42501';
  end if;
  if p_path not like s.patient_id::text || '/%'
     or not exists (select 1 from storage.objects o where o.bucket_id = p_bucket and o.name = p_path) then
    raise exception 'file_not_found' using errcode = 'P0001';
  end if;

  insert into public.support_access_log (agent_id, agent_email, patient_id, share_id, action, scope, object, reason)
  values (
    uid,
    coalesce((select u.email::text from auth.users u where u.id = uid), uid::text),
    s.patient_id, s.id, 'open_file', file_scope, p_bucket || '/' || p_path, btrim(p_reason)
  );
end;
$$;

-- ¿Puede la cuenta de soporte actual leer este archivo? Solo si lo registró hace menos de
-- 5 minutos con support_open_file() y el permiso sigue activo.
create function public.support_file_unlocked(p_bucket text, p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_support_agent() and exists (
    select 1
      from public.support_access_log l
      join public.data_shares s on s.id = l.share_id
     where l.agent_id = (select auth.uid())
       and l.action = 'open_file'
       and l.object = p_bucket || '/' || p_name
       and l.created_at > now() - interval '5 minutes'
       and s.grantee = 'support'
       and s.revoked_at is null
       and s.expires_at > now()
       and l.scope = any (s.scopes)
  );
$$;

create policy "support files: select after logging" on storage.objects for select to authenticated
  using (bucket_id in ('lab-files', 'meal-photos') and public.support_file_unlocked(bucket_id, name));

revoke execute on function public.is_support_agent() from anon, public;
revoke execute on function public.support_list_grants() from anon, public;
revoke execute on function public.support_read(uuid, text, text) from anon, public;
revoke execute on function public.support_open_file(uuid, text, text, text) from anon, public;
revoke execute on function public.support_file_unlocked(text, text) from anon, public;
revoke execute on function public.support_access_log_append_only() from anon, public, authenticated;
grant execute on function public.is_support_agent() to authenticated;
grant execute on function public.support_list_grants() to authenticated;
grant execute on function public.support_read(uuid, text, text) to authenticated;
grant execute on function public.support_open_file(uuid, text, text, text) to authenticated;
grant execute on function public.support_file_unlocked(text, text) to authenticated;

-- Portal del especialista + comunicación paciente ↔ especialista.
--
-- Principios:
-- - Relación paciente-especialista: nace cuando el PACIENTE da el paso (comparte datos,
--   pide cita, envía una solicitud o abre un chat). El especialista solo ve a "sus"
--   pacientes (is_my_patient) y los datos clínicos solo con permiso activo (has_share).
-- - Las notas clínicas son privadas del especialista que las escribe.
-- - Nada se borra desde la app: se cancela / cierra (trazabilidad).

create extension if not exists btree_gist with schema extensions;

-- ---------------------------------------------------------------------------
-- 1. Ficha del especialista: datos nuevos
-- ---------------------------------------------------------------------------
alter table public.professionals
  add column first_name text,
  add column last_name text,
  add column work_phone text,
  add column work_email text,
  add column chat_enabled boolean not null default false,     -- cada especialista decide si abre chat
  add column video_enabled boolean not null default true,
  add column requests_enabled boolean not null default true;

grant insert (first_name, last_name, work_phone, work_email, chat_enabled, video_enabled, requests_enabled)
  on public.professionals to authenticated;
grant update (first_name, last_name, work_phone, work_email, chat_enabled, video_enabled, requests_enabled)
  on public.professionals to authenticated;
grant select (first_name, last_name, work_phone, work_email, chat_enabled, video_enabled, requests_enabled)
  on public.professionals to authenticated;

-- Datos personales del especialista: solo él (y HomeTest) los ven. Nunca pacientes.
create table public.professional_private (
  professional_id uuid primary key references public.professionals (id) on delete cascade,
  personal_phone text,
  personal_email text,
  updated_at timestamptz not null default now()
);
alter table public.professional_private enable row level security;
create policy "pro private: own" on public.professional_private for all to authenticated
  using ((select auth.uid()) = professional_id) with check ((select auth.uid()) = professional_id);
create policy "pro private: admin read" on public.professional_private for select to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- 2. Disponibilidad (agenda base)
-- weekly: {"mon":[{"start":"09:00","end":"14:00"}], "tue":[...], ... "sun":[]}
-- ---------------------------------------------------------------------------
create table public.professional_availability (
  professional_id uuid primary key references public.professionals (id) on delete cascade,
  weekly jsonb not null default '{"mon":[],"tue":[],"wed":[],"thu":[],"fri":[],"sat":[],"sun":[]}'::jsonb,
  slot_minutes smallint not null default 30 check (slot_minutes in (10, 15, 20, 30, 45, 60)),
  buffer_minutes smallint not null default 5 check (buffer_minutes between 0 and 60),
  timezone text not null default 'Europe/Madrid',
  calendar_provider text not null default 'none' check (calendar_provider in ('none', 'google', 'outlook')),
  updated_at timestamptz not null default now()
);
alter table public.professional_availability enable row level security;
create policy "availability: own" on public.professional_availability for all to authenticated
  using ((select auth.uid()) = professional_id) with check ((select auth.uid()) = professional_id);
-- Los pacientes la leen para reservar (solo de especialistas verificados).
create policy "availability: read verified" on public.professional_availability for select to authenticated
  using (exists (select 1 from public.professionals p where p.id = professional_id and p.verified_at is not null));

-- ---------------------------------------------------------------------------
-- 3. Citas
-- ---------------------------------------------------------------------------
create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professionals (id) on delete cascade,
  patient_id uuid not null references auth.users (id) on delete cascade,
  patient_name text, -- lo aporta el paciente al pedir la cita
  starts_at timestamptz not null,
  duration_min smallint not null default 30 check (duration_min between 5 and 180),
  ends_at timestamptz not null, -- lo calcula el trigger (necesario para impedir solapes)
  kind text not null default 'first' check (kind in ('first', 'follow_up', 'results_review')),
  modality text not null default 'video' check (modality in ('video', 'voice')),
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'completed', 'cancelled')),
  reason text,
  video_room_url text,
  sync_event_id text, -- id del evento en Google/Outlook si está sincronizado
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (patient_id <> professional_id),
  -- Un especialista no puede tener dos citas activas solapadas.
  constraint appointments_no_overlap exclude using gist (
    professional_id with =,
    tstzrange(starts_at, ends_at) with &&
  ) where (status in ('pending', 'confirmed'))
);
create index appointments_pro_idx on public.appointments (professional_id, starts_at);
create index appointments_patient_idx on public.appointments (patient_id, starts_at);
alter table public.appointments enable row level security;

create function public.appointments_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.ends_at := new.starts_at + make_interval(mins => new.duration_min);
  new.updated_at := now();
  if tg_op = 'UPDATE' then
    if new.patient_id <> old.patient_id or new.professional_id <> old.professional_id then
      raise exception 'Cannot change who the appointment is between';
    end if;
    -- El paciente solo puede cancelar; el resto lo gestiona el especialista.
    if (select auth.uid()) = old.patient_id then
      if new.status <> 'cancelled' or new.starts_at <> old.starts_at or new.duration_min <> old.duration_min
         or new.kind <> old.kind or new.modality <> old.modality
         or new.video_room_url is distinct from old.video_room_url then
        raise exception 'Patients can only cancel an appointment';
      end if;
    end if;
  end if;
  return new;
end;
$$;
create trigger appointments_before_write
  before insert or update on public.appointments
  for each row execute function public.appointments_before_write();

create policy "appointments: participants read" on public.appointments for select to authenticated
  using ((select auth.uid()) in (patient_id, professional_id));
create policy "appointments: patient requests" on public.appointments for insert to authenticated
  with check (
    (select auth.uid()) = patient_id
    and status = 'pending'
    and exists (select 1 from public.professionals p where p.id = professional_id and p.verified_at is not null and p.video_enabled)
  );
create policy "appointments: participants update" on public.appointments for update to authenticated
  using ((select auth.uid()) in (patient_id, professional_id))
  with check ((select auth.uid()) in (patient_id, professional_id));
revoke delete on public.appointments from authenticated, anon;

-- ---------------------------------------------------------------------------
-- 4. Solicitudes (pregunta, revisión de resultados, vídeo asíncrono…)
-- ---------------------------------------------------------------------------
create table public.consultation_requests (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  patient_name text,
  professional_id uuid not null references public.professionals (id) on delete cascade,
  kind text not null check (kind in ('question', 'results_review', 'video_call', 'async_video')),
  message text not null check (char_length(message) between 1 and 4000),
  status text not null default 'open' check (status in ('open', 'answered', 'closed')),
  response text,
  created_at timestamptz not null default now(),
  answered_at timestamptz
);
create index requests_pro_idx on public.consultation_requests (professional_id, status, created_at desc);
alter table public.consultation_requests enable row level security;

create function public.requests_before_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.patient_id <> old.patient_id or new.professional_id <> old.professional_id
     or new.message <> old.message or new.kind <> old.kind then
    raise exception 'Only the status and the answer can change';
  end if;
  if (select auth.uid()) = old.patient_id and (new.status <> 'closed' or new.response is distinct from old.response) then
    raise exception 'Patients can only close a request';
  end if;
  if new.response is distinct from old.response then
    new.answered_at := now();
  end if;
  return new;
end;
$$;
create trigger requests_before_update
  before update on public.consultation_requests
  for each row execute function public.requests_before_update();

create policy "requests: participants read" on public.consultation_requests for select to authenticated
  using ((select auth.uid()) in (patient_id, professional_id));
create policy "requests: patient create" on public.consultation_requests for insert to authenticated
  with check (
    (select auth.uid()) = patient_id
    and status = 'open' and response is null
    and exists (select 1 from public.professionals p where p.id = professional_id and p.verified_at is not null and p.requests_enabled)
  );
create policy "requests: participants update" on public.consultation_requests for update to authenticated
  using ((select auth.uid()) in (patient_id, professional_id))
  with check ((select auth.uid()) in (patient_id, professional_id));
revoke delete on public.consultation_requests from authenticated, anon;

-- ---------------------------------------------------------------------------
-- 5. Chat (sencillo, sobre Supabase Realtime). Solo si el especialista lo habilita.
-- ---------------------------------------------------------------------------
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  patient_name text,
  professional_id uuid not null references public.professionals (id) on delete cascade,
  created_at timestamptz not null default now(),
  last_message_at timestamptz,
  unique (patient_id, professional_id)
);
alter table public.conversations enable row level security;
create policy "conversations: participants read" on public.conversations for select to authenticated
  using ((select auth.uid()) in (patient_id, professional_id));
create policy "conversations: patient opens" on public.conversations for insert to authenticated
  with check (
    (select auth.uid()) = patient_id
    and exists (select 1 from public.professionals p where p.id = professional_id and p.verified_at is not null and p.chat_enabled)
  );
revoke update, delete on public.conversations from authenticated, anon;

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index messages_conv_idx on public.messages (conversation_id, created_at);
alter table public.messages enable row level security;

create function public.is_conversation_member(conv uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.conversations c
    where c.id = conv and (select auth.uid()) in (c.patient_id, c.professional_id)
  );
$$;

create function public.chat_is_open(conv uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.conversations c join public.professionals p on p.id = c.professional_id
    where c.id = conv and p.chat_enabled and p.verified_at is not null
  );
$$;

create policy "messages: members read" on public.messages for select to authenticated
  using (public.is_conversation_member(conversation_id));
create policy "messages: members send" on public.messages for insert to authenticated
  with check (sender_id = (select auth.uid()) and public.is_conversation_member(conversation_id) and public.chat_is_open(conversation_id));
-- Marcar como leído: solo el destinatario, y solo read_at.
create policy "messages: recipient marks read" on public.messages for update to authenticated
  using (public.is_conversation_member(conversation_id) and sender_id <> (select auth.uid()))
  with check (public.is_conversation_member(conversation_id) and sender_id <> (select auth.uid()));
revoke update, delete on public.messages from authenticated, anon;
grant update (read_at) on public.messages to authenticated;

create function public.messages_touch_conversation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.conversations set last_message_at = new.created_at where id = new.conversation_id;
  return new;
end;
$$;
create trigger messages_touch_conversation
  after insert on public.messages
  for each row execute function public.messages_touch_conversation();

alter publication supabase_realtime add table public.messages;

-- ---------------------------------------------------------------------------
-- 6. ¿Es este paciente "mío"? (el paciente ha iniciado alguna relación conmigo)
-- ---------------------------------------------------------------------------
create function public.is_my_patient(patient uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
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
revoke execute on function public.is_my_patient(uuid) from anon, public;
grant execute on function public.is_my_patient(uuid) to authenticated;

-- Lista de pacientes del especialista con avisos para el CRM.
create function public.pro_patients()
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
  where exists (select 1 from public.professionals p, me where p.id = me.id and p.verified_at is not null);
$$;
revoke execute on function public.pro_patients() from anon, public;
grant execute on function public.pro_patients() to authenticated;

-- ---------------------------------------------------------------------------
-- 7. Notas clínicas (SOAP): privadas del especialista autor
-- ---------------------------------------------------------------------------
create table public.clinical_notes (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null default auth.uid() references public.professionals (id) on delete cascade,
  patient_id uuid not null references auth.users (id) on delete cascade,
  appointment_id uuid references public.appointments (id) on delete set null,
  subjective text,
  objective text,
  assessment text,
  plan text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index clinical_notes_idx on public.clinical_notes (professional_id, patient_id, created_at desc);
create trigger clinical_notes_touch_updated_at
  before update on public.clinical_notes
  for each row execute function public.touch_updated_at();
alter table public.clinical_notes enable row level security;
create policy "notes: author read" on public.clinical_notes for select to authenticated
  using ((select auth.uid()) = professional_id);
create policy "notes: author write" on public.clinical_notes for insert to authenticated
  with check ((select auth.uid()) = professional_id and public.is_my_patient(patient_id));
create policy "notes: author update" on public.clinical_notes for update to authenticated
  using ((select auth.uid()) = professional_id) with check ((select auth.uid()) = professional_id);
revoke delete on public.clinical_notes from authenticated, anon;

-- ---------------------------------------------------------------------------
-- 8. Planes de acción del especialista (se añaden a la tabla ya existente)
-- ---------------------------------------------------------------------------
create policy "action_plans: professional read" on public.action_plans for select to authenticated
  using ((select auth.uid()) = professional_id or public.has_share(patient_id, 'lab_reports'));
create policy "action_plans: professional insert" on public.action_plans for insert to authenticated
  with check (
    (select auth.uid()) = professional_id and source = 'professional' and public.is_my_patient(patient_id)
  );

-- El especialista puede programar seguimientos con sus pacientes (tras definir is_my_patient).
create policy "appointments: professional schedules" on public.appointments for insert to authenticated
  with check ((select auth.uid()) = professional_id and public.is_my_patient(patient_id));

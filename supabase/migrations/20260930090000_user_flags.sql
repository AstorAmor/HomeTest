-- Estado de uso de la app por usuario ("ya visto", "ya descartado", preferencias…).
-- Clave/valor: p. ej. 'report_seen:rpt_followup_2026_09_25' = true. Vive en la nube
-- para que se respete en todos los dispositivos del usuario; la app guarda además una
-- copia local para responder al instante y funcionar sin conexión.
create table public.user_flags (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  key text not null check (char_length(key) between 1 and 200),
  value jsonb not null default 'true'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);

alter table public.user_flags enable row level security;

create policy "user_flags: own" on public.user_flags for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

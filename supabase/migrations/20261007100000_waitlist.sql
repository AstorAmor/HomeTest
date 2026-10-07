-- Lista de espera de la web pública (kuovahealth.com). Solo email, idioma y fecha.
-- Desde fuera solo se puede apuntar un email con join_waitlist(); la tabla no se puede leer
-- ni modificar con las claves públicas (RLS activada y sin políticas). Se consulta y exporta
-- desde el panel de Supabase (Table Editor → waitlist).
create table public.waitlist (
  id bigint generated always as identity primary key,
  email text not null unique
    check (char_length(email) <= 254 and email = lower(btrim(email)) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  lang text not null default 'es' check (lang in ('es', 'en')),
  source text not null default 'web' check (char_length(source) between 1 and 50),
  created_at timestamptz not null default now(),
  -- Baja: se marca aquí (y se borra el email si lo pide) en vez de seguir escribiéndole
  unsubscribed_at timestamptz
);

alter table public.waitlist enable row level security;
revoke all on public.waitlist from anon, authenticated;

-- Apuntarse. Si el email ya estaba, no hace nada y no lo revela (misma respuesta).
create function public.join_waitlist(p_email text, p_lang text default 'es', p_source text default 'web')
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.waitlist (email, lang, source)
  values (lower(btrim(p_email)), coalesce(nullif(p_lang, ''), 'es'), coalesce(nullif(p_source, ''), 'web'))
  on conflict (email) do nothing;
$$;

revoke all on function public.join_waitlist(text, text, text) from public;
grant execute on function public.join_waitlist(text, text, text) to anon, authenticated;

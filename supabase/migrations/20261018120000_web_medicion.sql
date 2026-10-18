-- Medición de la web pública (kuovahealth.com), sin cookies:
--   web_visitas  una fila por página cargada: canal (email, Instagram, búsqueda…), fuente, medio,
--                campaña, dispositivo, país y una huella anónima del día para contar visitantes
--                únicos (cambia cada día y no permite seguir a nadie de un día a otro).
--   web_eventos  lo que pasa en esa página: secciones vistas, clics, intentos de apuntarse, tiempo.
--   waitlist     cada alta guarda también por dónde llegó.
-- La web clasifica el canal (HomeTest-web/lib/canales.ts) y llama a estas funciones con la clave
-- publicable; las tablas no se pueden leer desde fuera (RLS sin políticas). Para consultarlo:
-- panel de Supabase → Table Editor → las vistas web_* y waitlist_por_canal.

create table public.web_visitas (
  -- Lo genera la página al cargar; no se guarda en el dispositivo
  id uuid primary key,
  created_at timestamptz not null default now(),
  visitante text not null,
  ruta text not null check (char_length(ruta) <= 200),
  idioma text check (idioma in ('es', 'en')),
  canal text not null check (char_length(canal) <= 40),
  fuente text check (char_length(fuente) <= 100),
  medio text check (char_length(medio) <= 100),
  campana text check (char_length(campana) <= 150),
  contenido text check (char_length(contenido) <= 150),
  termino text check (char_length(termino) <= 150),
  referrer text check (char_length(referrer) <= 150),
  -- Tipo de identificador de clic de anuncios que traía el enlace (gclid, fbclid, ttclid…)
  click_id text check (char_length(click_id) <= 20),
  dispositivo text check (char_length(dispositivo) <= 20),
  sistema text check (char_length(sistema) <= 30),
  navegador text check (char_length(navegador) <= 30),
  pais text check (char_length(pais) <= 2),
  region text check (char_length(region) <= 10),
  ciudad text check (char_length(ciudad) <= 100),
  ancho integer check (ancho between 0 and 10000)
);
create index web_visitas_fecha on public.web_visitas (created_at);

create table public.web_eventos (
  id bigint generated always as identity primary key,
  visita uuid not null references public.web_visitas (id) on delete cascade,
  created_at timestamptz not null default now(),
  tipo text not null check (tipo in ('seccion', 'clic', 'registro_intento', 'registro_ok', 'registro_error', 'salida', 'video')),
  detalle text check (char_length(detalle) <= 200),
  valor numeric
);
create index web_eventos_visita on public.web_eventos (visita);
create index web_eventos_fecha on public.web_eventos (created_at);

-- Sal del día para la huella de visitante: se crea al primer acceso del día y se borra la del día
-- anterior, así las huellas de días pasados no se pueden recalcular.
create table public.web_sal (
  dia date primary key,
  sal bytea not null
);

alter table public.web_visitas enable row level security;
alter table public.web_eventos enable row level security;
alter table public.web_sal enable row level security;
revoke all on public.web_visitas, public.web_eventos, public.web_sal from anon, authenticated;

-- Alta en la lista de espera: por dónde llegó
alter table public.waitlist
  add column canal text check (char_length(canal) <= 40),
  add column fuente text check (char_length(fuente) <= 100),
  add column medio text check (char_length(medio) <= 100),
  add column campana text check (char_length(campana) <= 150),
  add column contenido text check (char_length(contenido) <= 150),
  add column termino text check (char_length(termino) <= 150),
  add column referrer text check (char_length(referrer) <= 150),
  add column click_id text check (char_length(click_id) <= 20),
  add column ruta text check (char_length(ruta) <= 200),
  add column dispositivo text check (char_length(dispositivo) <= 20),
  add column pais text check (char_length(pais) <= 2),
  add column region text check (char_length(region) <= 10),
  add column ciudad text check (char_length(ciudad) <= 100);

-- Texto recortado y sin espacios; vacío = null (solo para las funciones de abajo)
create function public._web_txt(t text, n integer)
returns text
language sql
immutable
set search_path = ''
as $$ select nullif(left(btrim(t), n), '') $$;
revoke all on function public._web_txt(text, integer) from public, anon, authenticated;

create function public.web_registrar_visita(
  p_id uuid,
  p_huella text,
  p_ruta text,
  p_idioma text default null,
  p_canal text default null,
  p_fuente text default null,
  p_medio text default null,
  p_campana text default null,
  p_contenido text default null,
  p_termino text default null,
  p_referrer text default null,
  p_click_id text default null,
  p_dispositivo text default null,
  p_sistema text default null,
  p_navegador text default null,
  p_pais text default null,
  p_region text default null,
  p_ciudad text default null,
  p_ancho integer default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sal bytea;
  v_nueva integer;
begin
  if p_id is null then
    return;
  end if;
  insert into public.web_sal (dia, sal) values (current_date, extensions.gen_random_bytes(32))
  on conflict (dia) do nothing;
  get diagnostics v_nueva = row_count;
  -- Primera visita del día: se borra la sal de ayer y las visitas de hace más de 24 meses (plazo
  -- de la política de privacidad; sus eventos se borran con ellas)
  if v_nueva > 0 then
    delete from public.web_sal where dia < current_date;
    delete from public.web_visitas where created_at < now() - interval '24 months';
  end if;
  select sal into v_sal from public.web_sal where dia = current_date;

  insert into public.web_visitas (
    id, visitante, ruta, idioma, canal, fuente, medio, campana, contenido, termino, referrer,
    click_id, dispositivo, sistema, navegador, pais, region, ciudad, ancho
  )
  values (
    p_id,
    left(encode(extensions.digest(v_sal || convert_to(coalesce(p_huella, ''), 'UTF8'), 'sha256'), 'hex'), 16),
    coalesce(public._web_txt(p_ruta, 200), '/'),
    case when p_idioma in ('es', 'en') then p_idioma end,
    coalesce(public._web_txt(p_canal, 40), 'Directo'),
    lower(public._web_txt(p_fuente, 100)),
    lower(public._web_txt(p_medio, 100)),
    public._web_txt(p_campana, 150),
    public._web_txt(p_contenido, 150),
    public._web_txt(p_termino, 150),
    lower(public._web_txt(p_referrer, 150)),
    lower(public._web_txt(p_click_id, 20)),
    lower(public._web_txt(p_dispositivo, 20)),
    public._web_txt(p_sistema, 30),
    public._web_txt(p_navegador, 30),
    upper(public._web_txt(p_pais, 2)),
    upper(public._web_txt(p_region, 10)),
    public._web_txt(p_ciudad, 100),
    case when p_ancho between 0 and 10000 then p_ancho end
  )
  on conflict (id) do nothing;
end;
$$;

create function public.web_registrar_evento(p_visita uuid, p_tipo text, p_detalle text default null, p_valor numeric default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_tipo not in ('seccion', 'clic', 'registro_intento', 'registro_ok', 'registro_error', 'salida', 'video') then
    return;
  end if;
  -- Solo para visitas de las últimas 24 horas y con un tope por visita (por si alguien abusa)
  if not exists (select 1 from public.web_visitas where id = p_visita and created_at > now() - interval '1 day') then
    return;
  end if;
  if (select count(*) from public.web_eventos where visita = p_visita) >= 300 then
    return;
  end if;
  insert into public.web_eventos (visita, tipo, detalle, valor)
  values (p_visita, p_tipo, public._web_txt(p_detalle, 200), case when p_valor between -1000000000 and 1000000000 then p_valor end);
end;
$$;

revoke all on function public.web_registrar_visita(uuid, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, integer) from public;
revoke all on function public.web_registrar_evento(uuid, text, text, numeric) from public;
grant execute on function public.web_registrar_visita(uuid, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, integer) to anon, authenticated;
grant execute on function public.web_registrar_evento(uuid, text, text, numeric) to anon, authenticated;

-- join_waitlist con los datos de llegada, todos opcionales: la web publicada ahora (que solo manda
-- email, idioma y origen) sigue funcionando. Se borra la versión antigua para que no haya dos.
drop function public.join_waitlist(text, text, text);

create function public.join_waitlist(
  p_email text,
  p_lang text default 'es',
  p_source text default 'web',
  p_canal text default null,
  p_fuente text default null,
  p_medio text default null,
  p_campana text default null,
  p_contenido text default null,
  p_termino text default null,
  p_referrer text default null,
  p_click_id text default null,
  p_ruta text default null,
  p_dispositivo text default null,
  p_pais text default null,
  p_region text default null,
  p_ciudad text default null
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.waitlist (
    email, lang, source, canal, fuente, medio, campana, contenido, termino, referrer, click_id,
    ruta, dispositivo, pais, region, ciudad
  )
  values (
    lower(btrim(p_email)),
    coalesce(nullif(p_lang, ''), 'es'),
    coalesce(nullif(p_source, ''), 'web'),
    public._web_txt(p_canal, 40),
    lower(public._web_txt(p_fuente, 100)),
    lower(public._web_txt(p_medio, 100)),
    public._web_txt(p_campana, 150),
    public._web_txt(p_contenido, 150),
    public._web_txt(p_termino, 150),
    lower(public._web_txt(p_referrer, 150)),
    lower(public._web_txt(p_click_id, 20)),
    public._web_txt(p_ruta, 200),
    lower(public._web_txt(p_dispositivo, 20)),
    upper(public._web_txt(p_pais, 2)),
    upper(public._web_txt(p_region, 10)),
    public._web_txt(p_ciudad, 100)
  )
  on conflict (email) do nothing;
$$;

revoke all on function public.join_waitlist(text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text) from public;
grant execute on function public.join_waitlist(text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text) to anon, authenticated;

-- ── Vistas para consultar (y para el futuro panel). Fechas en hora de Madrid. ──────────────
-- "visitantes" = visitantes únicos de cada día sumados (sin cookies no se reconoce a quien
-- vuelve otro día). "conversion" = altas / visitantes, en %.

create view public.web_diario with (security_invoker = true) as
with v as (
  select (created_at at time zone 'Europe/Madrid')::date as dia,
    count(*) as visitas,
    count(distinct visitante) as visitantes
  from public.web_visitas
  group by 1
),
a as (
  select (created_at at time zone 'Europe/Madrid')::date as dia, count(*) as altas
  from public.waitlist
  group by 1
)
select coalesce(v.dia, a.dia) as dia,
  coalesce(v.visitas, 0) as visitas,
  coalesce(v.visitantes, 0) as visitantes,
  coalesce(a.altas, 0) as altas,
  round(100.0 * coalesce(a.altas, 0) / nullif(v.visitantes, 0), 1) as conversion
from v full join a on a.dia = v.dia
order by 1 desc;

create view public.web_por_canal with (security_invoker = true) as
with v as (
  select canal, count(*) as visitas,
    count(distinct (visitante, (created_at at time zone 'Europe/Madrid')::date)) as visitantes,
    count(distinct visitante) filter (where created_at >= now() - interval '7 days') as visitantes_7d
  from public.web_visitas
  group by 1
),
a as (
  select coalesce(canal, 'Sin dato (antes del 18/10)') as canal, count(*) as altas,
    count(*) filter (where created_at >= now() - interval '7 days') as altas_7d
  from public.waitlist
  group by 1
)
select coalesce(v.canal, a.canal) as canal,
  coalesce(v.visitantes, 0) as visitantes,
  coalesce(v.visitas, 0) as visitas,
  coalesce(a.altas, 0) as altas,
  round(100.0 * coalesce(a.altas, 0) / nullif(v.visitantes, 0), 1) as conversion,
  coalesce(v.visitantes_7d, 0) as visitantes_7d,
  coalesce(a.altas_7d, 0) as altas_7d
from v full join a on a.canal = v.canal
order by visitantes desc, altas desc;

create view public.web_por_campana with (security_invoker = true) as
with v as (
  select canal, coalesce(fuente, '—') as fuente, coalesce(medio, '—') as medio,
    coalesce(campana, '—') as campana, coalesce(contenido, '—') as contenido,
    count(*) as visitas,
    count(distinct (visitante, (created_at at time zone 'Europe/Madrid')::date)) as visitantes
  from public.web_visitas
  group by 1, 2, 3, 4, 5
),
a as (
  select coalesce(canal, 'Sin dato (antes del 18/10)') as canal, coalesce(fuente, '—') as fuente,
    coalesce(medio, '—') as medio, coalesce(campana, '—') as campana,
    coalesce(contenido, '—') as contenido, count(*) as altas
  from public.waitlist
  group by 1, 2, 3, 4, 5
)
select coalesce(v.canal, a.canal) as canal,
  coalesce(v.fuente, a.fuente) as fuente,
  coalesce(v.medio, a.medio) as medio,
  coalesce(v.campana, a.campana) as campana,
  coalesce(v.contenido, a.contenido) as contenido,
  coalesce(v.visitantes, 0) as visitantes,
  coalesce(v.visitas, 0) as visitas,
  coalesce(a.altas, 0) as altas,
  round(100.0 * coalesce(a.altas, 0) / nullif(v.visitantes, 0), 1) as conversion
from v
full join a on a.canal = v.canal and a.fuente = v.fuente and a.medio = v.medio
  and a.campana = v.campana and a.contenido = v.contenido
order by visitantes desc, altas desc;

-- Embudo por canal: de la visita a apuntarse, y el tiempo medio en la página
create view public.web_embudo with (security_invoker = true) as
select v.canal,
  count(*) as visitas,
  count(*) filter (where exists (select 1 from public.web_eventos e where e.visita = v.id and e.tipo = 'seccion' and e.detalle = 'como-funciona')) as vieron_como_funciona,
  count(*) filter (where exists (select 1 from public.web_eventos e where e.visita = v.id and e.tipo = 'seccion' and e.detalle = 'lista-de-espera')) as llegaron_a_la_lista,
  count(*) filter (where exists (select 1 from public.web_eventos e where e.visita = v.id and e.tipo = 'registro_intento')) as intentaron_apuntarse,
  count(*) filter (where exists (select 1 from public.web_eventos e where e.visita = v.id and e.tipo = 'registro_ok')) as se_apuntaron,
  round(avg((select max(e.valor) from public.web_eventos e where e.visita = v.id and e.tipo = 'salida'))) as segundos_medios
from public.web_visitas v
group by v.canal
order by visitas desc;

-- Hasta dónde llega la gente: % de visitas a la portada que ven cada sección
create view public.web_secciones with (security_invoker = true) as
with portada as (
  select id from public.web_visitas where ruta in ('/', '/en')
)
select e.detalle as seccion,
  count(distinct e.visita) as visitas,
  round(100.0 * count(distinct e.visita) / nullif((select count(*) from portada), 0), 1) as porcentaje
from public.web_eventos e
join portada p on p.id = e.visita
where e.tipo = 'seccion'
group by e.detalle
order by visitas desc;

-- Qué se pulsa (botones, enlaces, preguntas frecuentes)
create view public.web_clics with (security_invoker = true) as
select detalle as elemento, count(*) as clics, count(distinct visita) as visitas
from public.web_eventos
where tipo = 'clic'
group by detalle
order by clics desc;

-- Dispositivos y países
create view public.web_audiencia with (security_invoker = true) as
select coalesce(pais, '—') as pais, coalesce(dispositivo, '—') as dispositivo,
  count(distinct (visitante, (created_at at time zone 'Europe/Madrid')::date)) as visitantes,
  count(*) as visitas
from public.web_visitas
group by 1, 2
order by visitantes desc;

revoke all on public.web_diario, public.web_por_canal, public.web_por_campana, public.web_embudo,
  public.web_secciones, public.web_clics, public.web_audiencia from anon, authenticated;

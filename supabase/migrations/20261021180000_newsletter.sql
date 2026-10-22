-- Newsletter de Kuova (Kuova Letter): quién se ha suscrito y con qué consentimiento, cada número
-- enviado y lo que pasa con él (entregas, clics, bajas…), y el embudo de cada número cruzado con la
-- medición de la web (…_web_medicion.sql). Brevo envía los emails; aquí queda lo que es nuestro.
--
--   newsletter_suscriptores  una fila por email: estado, versión del texto de consentimiento que
--                            aceptó, de dónde vino, si aceptó la medición individual y cuándo confirmó
--                            o se dio de baja.
--   newsletter_envios        un número enviado (n001, n002…). Se crea solo con el primer aviso de
--                            Brevo de una campaña cuyo nombre empiece por el número («n001 · …»).
--   newsletter_eventos       lo que avisa Brevo. Lleva la persona solo si aceptó la medición
--                            individual (o si es un cambio de estado: alta, baja, rebote, spam);
--                            si no, cuenta en el total del número sin saber de quién es.
--   newsletter_ajustes       el id de la lista de Brevo de la newsletter (clave «brevo_lista»).
--
-- Cómo entra cada cosa (HomeTest-web):
--   alta    formulario → /api/newsletter → newsletter_alta() (clave publicable) → Brevo manda el email
--           de doble confirmación → al confirmar, Brevo avisa y la persona pasa a «suscrito».
--   avisos  Brevo → /api/newsletter/brevo?k=<secreto> → newsletter_evento_brevo(), que comprueba el
--           secreto contra el guardado en Supabase Vault con el nombre «brevo_webhook_secret».
--   panel   kuovahealth.com/panel → newsletter_panel(), solo para administradores.
--
-- Para dejarlo en marcha (una vez, sin copiar el secreto en ningún archivo): el secreto del webhook
-- en Vault («brevo_webhook_secret») y el webhook en Brevo los crea juntos
-- 05 Marca\Newsletter\Herramientas\activar_webhook.py; la lista ya está puesta:
--          insert into public.newsletter_ajustes values ('brevo_lista', '4');
-- Aplicada el 2026-10-22 (db query --linked en una transacción + migration repair), ya con la lista 4.
-- Si alguien pide que borremos sus datos, se borra su fila de newsletter_suscriptores: sus eventos
-- se quedan sin persona (cuentan en los totales) y Brevo lo debe borrar también.

create table public.newsletter_suscriptores (
  id bigint generated always as identity primary key,
  email text not null unique
    check (char_length(email) <= 254 and email = lower(btrim(email)) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  idioma text not null default 'es' check (idioma in ('es', 'en')),
  estado text not null default 'pendiente' check (estado in ('pendiente', 'suscrito', 'baja', 'rebote', 'spam')),
  -- Consentimiento: versión del texto aceptado (content/newsletter.json en la web) y desde dónde
  consentimiento_version text not null check (char_length(consentimiento_version) <= 40),
  origen text not null check (origen in ('formulario', 'lista-de-espera', 'email-lanzamiento', 'manual')),
  -- Casilla aparte y opcional: medir por persona en qué enlaces pincha
  medicion_individual boolean not null default false,
  pedido_at timestamptz not null default now(),
  confirmado_at timestamptz,
  baja_at timestamptz,
  baja_via text check (baja_via in ('enlace', 'respuesta', 'brevo', 'manual')),
  -- Por dónde llegó (igual que la lista de espera)
  canal text check (char_length(canal) <= 40),
  fuente text check (char_length(fuente) <= 100),
  medio text check (char_length(medio) <= 100),
  campana text check (char_length(campana) <= 150),
  contenido text check (char_length(contenido) <= 150),
  ruta text check (char_length(ruta) <= 200),
  dispositivo text check (char_length(dispositivo) <= 20),
  pais text check (char_length(pais) <= 2),
  updated_at timestamptz not null default now()
);

create table public.newsletter_envios (
  id text primary key check (id ~ '^n[0-9]{3}$'),
  asunto text not null check (char_length(asunto) <= 200),
  brevo_campana_id bigint,
  enviado_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.newsletter_eventos (
  id bigint generated always as identity primary key,
  envio text references public.newsletter_envios (id) on delete set null,
  suscriptor bigint references public.newsletter_suscriptores (id) on delete set null,
  tipo text not null check (tipo in ('alta_confirmada', 'entregado', 'apertura', 'clic', 'baja', 'rebote_duro', 'rebote_blando', 'spam')),
  url text check (char_length(url) <= 500),
  ocurrido_at timestamptz not null,
  -- Huella del aviso (la calcula la web) para no contarlo dos veces si Brevo lo repite
  clave text not null unique check (char_length(clave) <= 64)
);
create index newsletter_eventos_envio on public.newsletter_eventos (envio, tipo);

create table public.newsletter_ajustes (
  clave text primary key,
  valor text not null
);

alter table public.newsletter_suscriptores enable row level security;
alter table public.newsletter_envios enable row level security;
alter table public.newsletter_eventos enable row level security;
alter table public.newsletter_ajustes enable row level security;
revoke all on public.newsletter_suscriptores, public.newsletter_envios, public.newsletter_eventos, public.newsletter_ajustes
  from anon, authenticated;

-- Alta (o vuelta a suscribirse): guarda el consentimiento pedido y deja a la persona «pendiente»
-- hasta que confirme en el email de Brevo. Si ya estaba suscrita, no cambia nada y no lo revela.
create function public.newsletter_alta(
  p_email text,
  p_idioma text,
  p_version text,
  p_origen text,
  p_medicion boolean default false,
  p_canal text default null,
  p_fuente text default null,
  p_medio text default null,
  p_campana text default null,
  p_contenido text default null,
  p_ruta text default null,
  p_dispositivo text default null,
  p_pais text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_origen is null or p_origen not in ('formulario', 'lista-de-espera', 'email-lanzamiento') then
    raise exception 'Origen no válido' using errcode = '22023';
  end if;
  insert into public.newsletter_suscriptores as s (
    email, idioma, consentimiento_version, origen, medicion_individual,
    canal, fuente, medio, campana, contenido, ruta, dispositivo, pais
  )
  values (
    lower(btrim(p_email)),
    case when p_idioma = 'en' then 'en' else 'es' end,
    public._web_txt(p_version, 40),
    p_origen,
    coalesce(p_medicion, false),
    public._web_txt(p_canal, 40),
    public._web_txt(p_fuente, 100),
    public._web_txt(p_medio, 100),
    public._web_txt(p_campana, 150),
    public._web_txt(p_contenido, 150),
    public._web_txt(p_ruta, 200),
    public._web_txt(p_dispositivo, 20),
    upper(public._web_txt(p_pais, 2))
  )
  on conflict (email) do update set
    idioma = excluded.idioma,
    consentimiento_version = excluded.consentimiento_version,
    origen = excluded.origen,
    medicion_individual = excluded.medicion_individual,
    estado = 'pendiente',
    pedido_at = now(),
    confirmado_at = null,
    baja_at = null,
    baja_via = null,
    updated_at = now()
  where s.estado <> 'suscrito';
end;
$$;

revoke all on function public.newsletter_alta(text, text, text, text, boolean, text, text, text, text, text, text, text, text) from public;
grant execute on function public.newsletter_alta(text, text, text, text, boolean, text, text, text, text, text, text, text, text) to anon, authenticated;

-- Un aviso de Brevo, ya ordenado por la web. Solo vale con el secreto guardado en Vault.
create function public.newsletter_evento_brevo(
  p_secreto text,
  p_evento text,
  p_email text,
  p_fecha timestamptz,
  p_clave text,
  p_campana bigint default null,
  p_campana_nombre text default null,
  p_enviado timestamptz default null,
  p_listas bigint[] default null,
  p_url text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_secreto text;
  v_lista bigint;
  v_sus public.newsletter_suscriptores;
  v_envio text;
  v_tipo text;
  v_email text := lower(btrim(p_email));
  v_fecha timestamptz := coalesce(p_fecha, now());
begin
  select ds.decrypted_secret into v_secreto from vault.decrypted_secrets ds where ds.name = 'brevo_webhook_secret' limit 1;
  if v_secreto is null or p_secreto is distinct from v_secreto then
    raise exception 'No autorizado' using errcode = '42501';
  end if;

  -- El número: por el nombre de la campaña en Brevo («n001 · Hablemos de caca…»)
  if p_campana is not null then
    v_envio := substring(coalesce(p_campana_nombre, '') from '^(n[0-9]{3})');
    if v_envio is not null then
      insert into public.newsletter_envios as ne (id, asunto, brevo_campana_id, enviado_at)
      values (v_envio, left(btrim(p_campana_nombre), 200), p_campana, p_enviado)
      on conflict (id) do update set
        brevo_campana_id = coalesce(ne.brevo_campana_id, excluded.brevo_campana_id),
        enviado_at = least(ne.enviado_at, excluded.enviado_at);
    else
      select e.id into v_envio from public.newsletter_envios e where e.brevo_campana_id = p_campana limit 1;
    end if;
  end if;

  select * into v_sus from public.newsletter_suscriptores s where s.email = v_email;

  if p_evento = 'list_addition' then
    -- Solo cuenta si es la lista de la newsletter: es la confirmación de la doble confirmación
    select a.valor::bigint into v_lista from public.newsletter_ajustes a where a.clave = 'brevo_lista';
    if v_lista is null or not (v_lista = any (coalesce(p_listas, '{}'::bigint[]))) then
      return;
    end if;
    if v_sus.id is null then
      -- Alguien añadido directamente en Brevo (a mano o importado): queda registrado como «manual»
      insert into public.newsletter_suscriptores (email, estado, consentimiento_version, origen, confirmado_at)
      values (v_email, 'suscrito', 'brevo', 'manual', v_fecha)
      returning * into v_sus;
    else
      update public.newsletter_suscriptores
      set estado = 'suscrito', confirmado_at = v_fecha, baja_at = null, baja_via = null, updated_at = now()
      where id = v_sus.id;
    end if;
    v_tipo := 'alta_confirmada';
  elsif p_evento = 'unsubscribe' then
    update public.newsletter_suscriptores
    set estado = 'baja', baja_at = v_fecha, baja_via = coalesce(baja_via, 'brevo'), updated_at = now()
    where id = v_sus.id and estado <> 'baja';
    v_tipo := 'baja';
  elsif p_evento = 'spam' then
    update public.newsletter_suscriptores
    set estado = 'spam', baja_at = coalesce(baja_at, v_fecha), baja_via = coalesce(baja_via, 'brevo'), updated_at = now()
    where id = v_sus.id;
    v_tipo := 'spam';
  elsif p_evento = 'hard_bounce' then
    update public.newsletter_suscriptores set estado = 'rebote', updated_at = now() where id = v_sus.id;
    v_tipo := 'rebote_duro';
  elsif p_evento = 'soft_bounce' then
    v_tipo := 'rebote_blando';
  elsif p_evento = 'delivered' then
    v_tipo := 'entregado';
  elsif p_evento = 'opened' then
    v_tipo := 'apertura';
  elsif p_evento = 'click' then
    v_tipo := 'clic';
  else
    return; -- otros avisos de Brevo no se guardan
  end if;

  insert into public.newsletter_eventos (envio, suscriptor, tipo, url, ocurrido_at, clave)
  values (
    v_envio,
    case when v_sus.medicion_individual or v_tipo in ('alta_confirmada', 'baja', 'spam', 'rebote_duro') then v_sus.id end,
    v_tipo,
    case when v_tipo = 'clic' then left(p_url, 500) end,
    v_fecha,
    left(p_clave, 64)
  )
  on conflict (clave) do nothing;
end;
$$;

revoke all on function public.newsletter_evento_brevo(text, text, text, timestamptz, text, bigint, text, timestamptz, bigint[], text) from public;
grant execute on function public.newsletter_evento_brevo(text, text, text, timestamptz, text, bigint, text, timestamptz, bigint[], text) to anon, authenticated;

-- Panel (kuovahealth.com/panel): suscriptores, el embudo de cada número y las últimas altas. Las visitas
-- y altas de la web cuentan por el enlace etiquetado del número (utm_source=newsletter, utm_campaign=n001).
create function public.newsletter_panel()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  r jsonb;
begin
  if not public.is_admin() then
    raise exception 'Solo para administradores' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'resumen', (
      select jsonb_build_object(
        'suscritos', count(*) filter (where s.estado = 'suscrito'),
        'pendientes', count(*) filter (where s.estado = 'pendiente'),
        'bajas', count(*) filter (where s.estado in ('baja', 'spam')),
        'rebotes', count(*) filter (where s.estado = 'rebote'),
        'medicion_individual', count(*) filter (where s.estado = 'suscrito' and s.medicion_individual),
        'altas_30d', count(*) filter (where s.estado = 'suscrito' and s.confirmado_at >= now() - interval '30 days')
      )
      from public.newsletter_suscriptores s
    ),
    'envios', (
      select coalesce(jsonb_agg(x.fila order by x.enviado_at desc nulls last, x.id desc), '[]'::jsonb)
      from (
        select e.id, e.enviado_at, jsonb_build_object(
          'id', e.id,
          'asunto', e.asunto,
          'enviado_at', e.enviado_at,
          'entregados', count(ev.id) filter (where ev.tipo = 'entregado'),
          'rebotes', count(ev.id) filter (where ev.tipo in ('rebote_duro', 'rebote_blando')),
          'aperturas', count(ev.id) filter (where ev.tipo = 'apertura'),
          'clics', count(ev.id) filter (where ev.tipo = 'clic'),
          'personas_clic', count(distinct ev.suscriptor) filter (where ev.tipo = 'clic'),
          'bajas', count(ev.id) filter (where ev.tipo in ('baja', 'spam')),
          'visitantes_web', (
            select count(distinct (v.visitante, (v.created_at at time zone 'Europe/Madrid')::date))
            from public.web_visitas v
            where lower(v.fuente) = 'newsletter' and lower(v.campana) = e.id
          ),
          'visitas_web', (
            select count(*) from public.web_visitas v where lower(v.fuente) = 'newsletter' and lower(v.campana) = e.id
          ),
          'altas_lista', (
            select count(*) from public.waitlist w where lower(w.fuente) = 'newsletter' and lower(w.campana) = e.id
          )
        ) as fila
        from public.newsletter_envios e
        left join public.newsletter_eventos ev on ev.envio = e.id
        group by e.id
      ) x
    ),
    'origenes', (
      select coalesce(jsonb_agg(jsonb_build_object('origen', o.origen, 'suscritos', o.n) order by o.n desc), '[]'::jsonb)
      from (
        select s.origen, count(*) as n from public.newsletter_suscriptores s where s.estado = 'suscrito' group by s.origen
      ) o
    ),
    'recientes', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'email', s.email, 'estado', s.estado, 'origen', s.origen, 'medicion', s.medicion_individual,
        'pedido', s.pedido_at, 'confirmado', s.confirmado_at, 'baja', s.baja_at, 'canal', s.canal, 'fuente', s.fuente
      ) order by s.pedido_at desc), '[]'::jsonb)
      from (select * from public.newsletter_suscriptores order by pedido_at desc limit 30) s
    )
  ) into r;
  return r;
end;
$$;

-- Supabase da a anon permiso directo sobre cada función nueva: quitarlo a public no basta
revoke all on function public.newsletter_panel() from public, anon;
grant execute on function public.newsletter_panel() to authenticated;

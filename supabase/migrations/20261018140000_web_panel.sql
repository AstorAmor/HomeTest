-- Datos del panel de la web (kuovahealth.com/panel, HomeTest-web/app/panel): todo lo de la medición
-- (…_web_medicion.sql) resumido para un periodo, en un solo JSON. Solo para administradores
-- (public.admins); se llama con la sesión de la persona, nunca con claves públicas.
-- Las fechas son días en hora de Madrid; se dejan fuera las pruebas (fuente "prueba-local").
-- Para comparar, "_ant" es el periodo anterior de la misma duración.
create function public.web_panel(p_desde date, p_hasta date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_dias integer := p_hasta - p_desde + 1;
  v_ini timestamptz := p_desde::timestamp at time zone 'Europe/Madrid';
  v_fin timestamptz := (p_hasta + 1)::timestamp at time zone 'Europe/Madrid';
  v_ini_ant timestamptz := (p_desde - (p_hasta - p_desde + 1))::timestamp at time zone 'Europe/Madrid';
  r jsonb;
begin
  if not public.is_admin() then
    raise exception 'Solo para administradores' using errcode = '42501';
  end if;
  if p_desde is null or p_hasta is null or p_hasta < p_desde or v_dias > 800 then
    raise exception 'Fechas no válidas' using errcode = '22023';
  end if;

  with
  todas as (
    select v.*, (v.created_at at time zone 'Europe/Madrid')::date as dia
    from public.web_visitas v
    where v.created_at >= v_ini_ant and v.created_at < v_fin and coalesce(v.fuente, '') <> 'prueba-local'
  ),
  v as (select * from todas where created_at >= v_ini),
  altas_todas as (
    select w.*, (w.created_at at time zone 'Europe/Madrid')::date as dia
    from public.waitlist w
    where w.created_at >= v_ini_ant and w.created_at < v_fin and coalesce(w.fuente, '') <> 'prueba-local'
  ),
  a as (select * from altas_todas where created_at >= v_ini),
  e as (
    select ev.* from public.web_eventos ev join v on v.id = ev.visita
  ),
  salidas as (
    select visita, max(valor) as segundos,
      max(nullif(substring(detalle from '([0-9]+)'), '')::numeric) as scroll
    from e where tipo = 'salida' group by visita
  ),
  portada as (select * from v where ruta in ('/', '/en')),
  canal_v as (
    select canal, count(distinct (visitante, dia)) as visitantes, count(*) as visitas
    from v group by canal
  ),
  canal_a as (
    select coalesce(canal, 'Sin dato') as canal, count(*) as altas from a group by 1
  ),
  canal_s as (
    select v.canal, round(avg(s.segundos)) as segundos
    from salidas s join v on v.id = s.visita group by v.canal
  ),
  camp_v as (
    select canal, coalesce(fuente, '—') as fuente, coalesce(medio, '—') as medio,
      coalesce(campana, '—') as campana, coalesce(contenido, '—') as contenido,
      count(distinct (visitante, dia)) as visitantes, count(*) as visitas
    from v group by 1, 2, 3, 4, 5
  ),
  camp_a as (
    select coalesce(canal, 'Sin dato') as canal, coalesce(fuente, '—') as fuente, coalesce(medio, '—') as medio,
      coalesce(campana, '—') as campana, coalesce(contenido, '—') as contenido, count(*) as altas
    from a group by 1, 2, 3, 4, 5
  ),
  embudo_visita as (
    select p.id, p.canal,
      exists (select 1 from e where e.visita = p.id and e.tipo = 'seccion' and e.detalle = 'como-funciona') as como,
      exists (select 1 from e where e.visita = p.id and e.tipo = 'seccion' and e.detalle = 'lista-de-espera') as lista,
      exists (select 1 from e where e.visita = p.id and e.tipo = 'registro_intento') as intento,
      exists (select 1 from e where e.visita = p.id and e.tipo = 'registro_ok') as ok
    from portada p
  )
  select jsonb_build_object(
    'desde', p_desde,
    'hasta', p_hasta,
    'resumen', jsonb_build_object(
      'visitantes', (select count(distinct (visitante, dia)) from v),
      'visitas', (select count(*) from v),
      'altas', (select count(*) from a),
      'visitantes_ant', (select count(distinct (visitante, dia)) from todas where created_at < v_ini),
      'visitas_ant', (select count(*) from todas where created_at < v_ini),
      'altas_ant', (select count(*) from altas_todas where created_at < v_ini),
      'segundos', (select round(avg(segundos)) from salidas),
      'scroll', (select round(avg(scroll)) from salidas),
      'altas_total', (select count(*) from public.waitlist where coalesce(fuente, '') <> 'prueba-local' and unsubscribed_at is null)
    ),
    'diario', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'dia', d.dia,
        'visitantes', coalesce((select count(distinct visitante) from v where v.dia = d.dia), 0),
        'visitas', coalesce((select count(*) from v where v.dia = d.dia), 0),
        'altas', coalesce((select count(*) from a where a.dia = d.dia), 0)
      ) order by d.dia), '[]'::jsonb)
      from (select generate_series(p_desde, p_hasta, interval '1 day')::date as dia) d
    ),
    'canales', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'canal', x.canal, 'visitantes', x.visitantes, 'visitas', x.visitas, 'altas', x.altas, 'segundos', x.segundos
      ) order by x.visitantes desc, x.altas desc), '[]'::jsonb)
      from (
        select coalesce(cv.canal, ca.canal) as canal, coalesce(cv.visitantes, 0) as visitantes,
          coalesce(cv.visitas, 0) as visitas, coalesce(ca.altas, 0) as altas, cs.segundos
        from canal_v cv
        full join canal_a ca on ca.canal = cv.canal
        left join canal_s cs on cs.canal = coalesce(cv.canal, ca.canal)
      ) x
    ),
    'campanas', (
      select coalesce(jsonb_agg(to_jsonb(x) order by x.visitantes desc, x.altas desc), '[]'::jsonb)
      from (
        select coalesce(cv.canal, ca.canal) as canal, coalesce(cv.fuente, ca.fuente) as fuente,
          coalesce(cv.medio, ca.medio) as medio, coalesce(cv.campana, ca.campana) as campana,
          coalesce(cv.contenido, ca.contenido) as contenido,
          coalesce(cv.visitantes, 0) as visitantes, coalesce(cv.visitas, 0) as visitas, coalesce(ca.altas, 0) as altas
        from camp_v cv
        full join camp_a ca on ca.canal = cv.canal and ca.fuente = cv.fuente and ca.medio = cv.medio
          and ca.campana = cv.campana and ca.contenido = cv.contenido
        order by 6 desc, 8 desc
        limit 60
      ) x
    ),
    'embudo', jsonb_build_object(
      'visitas', (select count(*) from embudo_visita),
      'como_funciona', (select count(*) from embudo_visita where como),
      'lista', (select count(*) from embudo_visita where lista),
      'intento', (select count(*) from embudo_visita where intento),
      'apuntados', (select count(*) from embudo_visita where ok)
    ),
    'embudo_canal', (
      select coalesce(jsonb_agg(to_jsonb(x) order by x.visitas desc), '[]'::jsonb)
      from (
        select canal, count(*) as visitas, count(*) filter (where como) as como_funciona,
          count(*) filter (where lista) as lista, count(*) filter (where intento) as intento,
          count(*) filter (where ok) as apuntados
        from embudo_visita group by canal
      ) x
    ),
    'secciones', (
      select coalesce(jsonb_agg(jsonb_build_object('seccion', x.seccion, 'visitas', x.n) order by x.n desc), '[]'::jsonb)
      from (
        select e.detalle as seccion, count(distinct e.visita) as n
        from e join portada p on p.id = e.visita
        where e.tipo = 'seccion' group by e.detalle
      ) x
    ),
    'clics', (
      select coalesce(jsonb_agg(jsonb_build_object('elemento', x.detalle, 'clics', x.n, 'visitas', x.visitas) order by x.n desc), '[]'::jsonb)
      from (
        select detalle, count(*) as n, count(distinct visita) as visitas
        from e where tipo = 'clic' group by detalle order by 2 desc limit 25
      ) x
    ),
    'paises', (
      select coalesce(jsonb_agg(jsonb_build_object('nombre', x.k, 'visitantes', x.n) order by x.n desc), '[]'::jsonb)
      from (select coalesce(pais, '—') as k, count(distinct (visitante, dia)) as n from v group by 1 order by 2 desc limit 12) x
    ),
    'ciudades', (
      select coalesce(jsonb_agg(jsonb_build_object('nombre', x.k, 'visitantes', x.n) order by x.n desc), '[]'::jsonb)
      from (select coalesce(ciudad, '—') as k, count(distinct (visitante, dia)) as n from v group by 1 order by 2 desc limit 12) x
    ),
    'dispositivos', (
      select coalesce(jsonb_agg(jsonb_build_object('nombre', x.k, 'visitantes', x.n) order by x.n desc), '[]'::jsonb)
      from (select coalesce(dispositivo, '—') as k, count(distinct (visitante, dia)) as n from v group by 1) x
    ),
    'navegadores', (
      select coalesce(jsonb_agg(jsonb_build_object('nombre', x.k, 'visitantes', x.n) order by x.n desc), '[]'::jsonb)
      from (select coalesce(navegador, '—') as k, count(distinct (visitante, dia)) as n from v group by 1 order by 2 desc limit 10) x
    ),
    'altas_recientes', (
      select coalesce(jsonb_agg(to_jsonb(x) order by x.fecha desc), '[]'::jsonb)
      from (
        select created_at as fecha, email, lang, canal, fuente, medio, campana, contenido, dispositivo, ciudad, pais,
          unsubscribed_at is not null as baja
        from a order by created_at desc limit 50
      ) x
    )
  ) into r;

  return r;
end;
$$;

revoke all on function public.web_panel(date, date) from public, anon;
grant execute on function public.web_panel(date, date) to authenticated;

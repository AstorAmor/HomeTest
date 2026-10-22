-- Panel de la newsletter (kuovahealth.com/panel): además de lo de …_newsletter.sql, el estado de la
-- puesta en marcha y más datos. Solo cambia newsletter_panel(), que ahora también devuelve:
--   ajustes        la lista de Brevo guardada aquí (newsletter_ajustes.brevo_lista), para ver en el
--                  panel que coincide con la de Vercel (BREVO_LISTA_NEWSLETTER)
--   ultimo_aviso   cuándo llegó el último aviso de Brevo (si el webhook funciona)
--   confirmacion   cuántas altas pedidas desde la web acabaron confirmando el email
--   altas_dia      altas pedidas y confirmadas por día, los últimos 30 días (hora de Madrid)
-- El resto (resumen, envios, origenes, recientes) no cambia.

create or replace function public.newsletter_panel()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  r jsonb;
  hoy date := (now() at time zone 'Europe/Madrid')::date;
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
    ),
    'ajustes', jsonb_build_object(
      'brevo_lista', (select a.valor from public.newsletter_ajustes a where a.clave = 'brevo_lista')
    ),
    'ultimo_aviso', (select max(ev.ocurrido_at) from public.newsletter_eventos ev),
    'confirmacion', (
      -- Sin las añadidas a mano en Brevo, que no pasan por la doble confirmación de la web
      select jsonb_build_object(
        'pedidas', count(*),
        'confirmadas', count(*) filter (where s.confirmado_at is not null)
      )
      from public.newsletter_suscriptores s
      where s.origen <> 'manual'
    ),
    'altas_dia', (
      select coalesce(jsonb_agg(jsonb_build_object('dia', d.dia, 'pedidas', d.pedidas, 'confirmadas', d.confirmadas) order by d.dia), '[]'::jsonb)
      from (
        select g.dia,
          (select count(*) from public.newsletter_suscriptores s
            where s.origen <> 'manual' and (s.pedido_at at time zone 'Europe/Madrid')::date = g.dia) as pedidas,
          (select count(*) from public.newsletter_suscriptores s
            where (s.confirmado_at at time zone 'Europe/Madrid')::date = g.dia) as confirmadas
        from (select (hoy - n) as dia from generate_series(0, 29) n) g
      ) d
    )
  ) into r;
  return r;
end;
$$;

-- Supabase da a anon permiso directo sobre cada función nueva: quitarlo a public no basta
revoke all on function public.newsletter_panel() from public, anon;
grant execute on function public.newsletter_panel() to authenticated;

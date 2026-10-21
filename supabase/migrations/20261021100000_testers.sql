-- Quién puede usar las herramientas de prueba de la app (selector «developer», datos de ejemplo,
-- casos de prueba y el interruptor «Cuenta real») (2026-10-21, a petición del fundador: desde ya, toda
-- cuenta nueva es real y entra directa a los cuestionarios).
--
-- Probadores: los admins y las cuentas con el email de un admin con «+algo» delante de la @ (los
-- alias que usa el fundador para crear cuentas de prueba). Sin ningún email escrito aquí: se compara
-- con los emails de la tabla admins. La app lo pregunta con is_tester(); mientras esta migración no
-- esté aplicada, la app trata como probadores solo a los admins (src/data/dataMode.ts).
--
-- APLICADA el 2026-10-21 con el OK del fundador (db query --linked en una transacción + migration repair).
-- Comprobada: un «+alias» del email de un admin da true; otro email cualquiera, false.

create function public.is_tester()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  with me as (select lower(coalesce((select auth.jwt() ->> 'email'), '')) as email)
  select public.is_admin() or exists (
    select 1
    from public.admins a
    join auth.users u on u.id = a.user_id
    cross join me
    where position('+' in split_part(me.email, '@', 1)) > 0
      and split_part(split_part(me.email, '@', 1), '+', 1) || '@' || split_part(me.email, '@', 2) = lower(u.email)
  );
$$;

revoke execute on function public.is_tester() from anon, public;
grant execute on function public.is_tester() to authenticated;

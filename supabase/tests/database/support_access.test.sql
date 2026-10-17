-- Tests del acceso de soporte: permiso del usuario, lectura solo con motivo y registro que no se
-- puede tocar. Todo se deshace al final.
--   npx supabase test db --linked
begin;
create extension if not exists pgtap with schema extensions;
select plan(24);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a3', 'patient.a3@test.local'),
  ('00000000-0000-0000-0000-0000000000b3', 'patient.b3@test.local'),
  ('00000000-0000-0000-0000-0000000000c3', 'pro.c3@test.local'),
  ('00000000-0000-0000-0000-0000000000e3', 'support.e3@test.local');
insert into public.professionals (id, display_name, role, verified_at) values
  ('00000000-0000-0000-0000-0000000000c3', 'Dra. C3', 'doctor', now());
insert into public.support_agents (user_id, label) values
  ('00000000-0000-0000-0000-0000000000e3', 'Soporte (test)');
insert into public.glucose_readings (user_id, value, unit, measured_at) values
  ('00000000-0000-0000-0000-0000000000a3', 92, 'mg/dL', now() - interval '1 day'),
  ('00000000-0000-0000-0000-0000000000a3', 97, 'mg/dL', now()),
  ('00000000-0000-0000-0000-0000000000b3', 110, 'mg/dL', now());
insert into storage.objects (bucket_id, name) values
  ('meal-photos', '00000000-0000-0000-0000-0000000000a3/meal-1.jpg'),
  ('meal-photos', '00000000-0000-0000-0000-0000000000b3/meal-1.jpg');

set local role authenticated;

-- 1) El paciente A da acceso a soporte: glucosa y nutrición, 7 días
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}';
select lives_ok(
  $$ insert into public.data_shares (id, grantee, scopes, expires_at, note)
     values ('5a000000-0000-0000-0000-000000000001', 'support', array['glucose', 'nutrition'],
             now() + interval '7 days', 'La glucosa sale duplicada') $$,
  'un usuario da acceso temporal a soporte');
select throws_ok(
  $$ insert into public.data_shares (grantee, scopes) values ('support', array['glucose']) $$,
  '23514', null, 'el acceso de soporte siempre caduca');
select throws_ok(
  $$ insert into public.data_shares (grantee, scopes, expires_at)
     values ('support', array['glucose'], now() + interval '40 days') $$,
  '23514', null, 'y como mucho a los 30 días');
select throws_ok(
  $$ insert into public.data_shares (grantee, professional_id, scopes, expires_at)
     values ('support', '00000000-0000-0000-0000-0000000000c3', array['glucose'], now() + interval '7 days') $$,
  '23514', null, 'un permiso de soporte no puede llevar profesional');

-- 2) Un profesional no gana nada con el permiso de soporte
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000c3","role":"authenticated"}';
select is((select count(*) from public.glucose_readings), 0::bigint, 'el profesional no ve la glucosa de A');
select is((select count(*) from public.my_shared_patients()), 0::bigint, 'ni a A en su lista de pacientes');
select throws_ok(
  $$ select public.support_read('5a000000-0000-0000-0000-000000000001', 'glucose', 'Probando sin ser soporte') $$,
  '42501', null, 'ni puede usar la lectura de soporte');

-- 3) Soporte: sin lectura directa; solo con motivo y por la función
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000e3","role":"authenticated"}';
select is((select count(*) from public.glucose_readings), 0::bigint, 'soporte no lee las tablas de salud directamente');
select is((select count(*) from public.data_shares), 0::bigint, 'ni la tabla de permisos');
select is(
  (select patient_email from public.support_list_grants()),
  'patient.a3@test.local', 've quién le ha dado permiso');
select throws_ok(
  $$ select public.support_read('5a000000-0000-0000-0000-000000000001', 'glucose', 'corto') $$,
  'P0001', 'reason_required', 'sin motivo no lee nada');
select throws_ok(
  $$ select public.support_read('5a000000-0000-0000-0000-000000000001', 'cycle', 'Incidencia 1: revisar el ciclo') $$,
  '42501', 'no_active_permission', 'ni categorías que el usuario no ha dado');
select is(
  jsonb_array_length(public.support_read('5a000000-0000-0000-0000-000000000001', 'glucose', 'Incidencia 1: glucosa duplicada') -> 'glucose_readings'),
  2, 'con motivo lee la glucosa de A (y solo la de A)');
select is(
  (select count(*) from public.support_access_log
    where patient_id = '00000000-0000-0000-0000-0000000000a3' and action = 'read' and scope = 'glucose'
      and reason = 'Incidencia 1: glucosa duplicada' and rows_returned = 2),
  1::bigint, 'y la lectura queda registrada con su motivo');

-- 4) Archivos: solo después de registrar la apertura
select is((select count(*) from storage.objects where bucket_id = 'meal-photos'), 0::bigint,
  'soporte no ve las fotos sin registrar la apertura');
select throws_ok(
  $$ select public.support_open_file('5a000000-0000-0000-0000-000000000001', 'meal-photos',
       '00000000-0000-0000-0000-0000000000b3/meal-1.jpg', 'Incidencia 1: foto de la comida') $$,
  'P0001', 'file_not_found', 'ni puede abrir archivos de otro usuario con ese permiso');
select lives_ok(
  $$ select public.support_open_file('5a000000-0000-0000-0000-000000000001', 'meal-photos',
       '00000000-0000-0000-0000-0000000000a3/meal-1.jpg', 'Incidencia 1: foto de la comida') $$,
  'registra la apertura de una foto de A');
select results_eq(
  $$ select name from storage.objects where bucket_id = 'meal-photos' $$,
  $$ values ('00000000-0000-0000-0000-0000000000a3/meal-1.jpg'::text) $$,
  'y entonces puede leer esa foto, y ninguna otra');

-- 5) El registro no se toca desde la app
select throws_ok(
  $$ insert into public.support_access_log (agent_email, patient_id, action, reason)
     values ('x@test.local', '00000000-0000-0000-0000-0000000000a3', 'manual', 'Anotación falsa desde la app') $$,
  '42501', null, 'soporte no puede escribir en el registro a mano');
select throws_ok(
  $$ update public.support_access_log set reason = 'Motivo cambiado después' $$,
  '42501', null, 'ni cambiarlo');

-- 6) El usuario retira el acceso: soporte deja de leer al momento
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}';
select is((select count(*) from public.support_access_log), 0::bigint, 'el usuario no ve el registro interno');
update public.data_shares set revoked_at = now() where id = '5a000000-0000-0000-0000-000000000001';
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000e3","role":"authenticated"}';
select throws_ok(
  $$ select public.support_read('5a000000-0000-0000-0000-000000000001', 'glucose', 'Incidencia 1: volver a mirar') $$,
  '42501', 'no_active_permission', 'tras retirarlo, soporte ya no lee');

-- 7) Ni siquiera desde el panel (rol con todos los permisos) se puede cambiar o borrar
reset role;
select throws_ok(
  $$ update public.support_access_log set reason = 'Cambiado desde el panel' $$,
  '42501', 'support_access_log is append-only', 'el registro no se cambia desde el panel');
select throws_ok(
  $$ delete from public.support_access_log $$,
  '42501', 'support_access_log is append-only', 'ni se borra');

select * from finish();
rollback;

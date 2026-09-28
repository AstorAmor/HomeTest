-- Tests de seguridad (RLS) de HomeTest: aislamiento entre pacientes y permisos
-- de compartir con profesionales. Todo ocurre dentro de una transacción que se
-- deshace al final: no deja usuarios ni datos en el proyecto.
--   npx supabase test db --linked
begin;
create extension if not exists pgtap with schema extensions;
select plan(20);

-- Usuarios simulados: A y B pacientes, P profesional verificado, Q sin verificar
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', 'patient.a@test.local', '{"display_name":"Paciente A"}'),
  ('00000000-0000-0000-0000-0000000000b1', 'patient.b@test.local', '{"display_name":"Paciente B"}'),
  ('00000000-0000-0000-0000-0000000000c1', 'pro.p@test.local', '{"display_name":"Dra. P"}'),
  ('00000000-0000-0000-0000-0000000000d1', 'pro.q@test.local', '{"display_name":"Dr. Q"}');

insert into public.professionals (id, display_name, role, verified_at) values
  ('00000000-0000-0000-0000-0000000000c1', 'Dra. P', 'doctor', now()),
  ('00000000-0000-0000-0000-0000000000d1', 'Dr. Q', 'dietitian', null);

select is(
  (select count(*) from public.profiles where id in (
    '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1')),
  2::bigint, 'el trigger crea el perfil al registrarse');

-- ---------------------------------------------------------------- Paciente A
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';

insert into public.glucose_readings (id, value, unit, measured_at) values ('g-a', 95, 'mg/dL', now());
insert into public.blood_pressure_readings (id, systolic, diastolic, measured_at) values ('bp-a', 120, 80, now());

select throws_ok(
  $$ insert into public.glucose_readings (user_id, id, value, unit, measured_at)
     values ('00000000-0000-0000-0000-0000000000b1', 'fake', 1, 'mg/dL', now()) $$,
  '42501', null, 'A no puede crear filas a nombre de B');

-- ---------------------------------------------------------------- Paciente B
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}';
insert into public.glucose_readings (id, value, unit, measured_at) values ('g-b', 110, 'mg/dL', now());

select is((select count(*) from public.glucose_readings), 1::bigint, 'B solo ve su propia glucosa');
select is(
  (select count(*) from public.profiles where id = '00000000-0000-0000-0000-0000000000a1'),
  0::bigint, 'B no ve el perfil de A');

-- ---------------------------------------------------------------- Profesional P, sin permiso
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}';
select is((select count(*) from public.glucose_readings), 0::bigint, 'P sin permiso no ve datos de nadie');

select throws_ok(
  $$ update public.professionals set verified_at = now() where id = '00000000-0000-0000-0000-0000000000c1' $$,
  '42501', null, 'un profesional no puede marcarse como verificado');

-- ---------------------------------------------------------------- A comparte glucosa con P y con Q
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
insert into public.data_shares (id, professional_id, scopes) values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-0000000000c1', array['glucose']),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-0000000000d1', array['glucose']);
-- permiso ya caducado para tensión
insert into public.data_shares (professional_id, scopes, expires_at) values
  ('00000000-0000-0000-0000-0000000000c1', array['blood_pressure'], now() - interval '1 day');

select throws_ok(
  $$ insert into public.data_shares (professional_id, scopes)
     values ('00000000-0000-0000-0000-0000000000c1', array['passwords']) $$,
  '23514', null, 'no se puede compartir una categoría que no existe');

-- ---------------------------------------------------------------- P con permiso de glucosa
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}';
select is(
  (select count(*) from public.glucose_readings where user_id = '00000000-0000-0000-0000-0000000000a1'),
  1::bigint, 'P ve la glucosa que A le comparte');
select is(
  (select count(*) from public.glucose_readings where user_id = '00000000-0000-0000-0000-0000000000b1'),
  0::bigint, 'P no ve la glucosa de B (no le ha compartido nada)');
select is((select count(*) from public.blood_pressure_readings), 0::bigint,
  'P no ve la tensión de A (categoría no compartida o permiso caducado)');
select is((select count(*) from public.profiles where id = '00000000-0000-0000-0000-0000000000a1'),
  0::bigint, 'P no ve el perfil de A (categoría profile no compartida)');
-- Intento de modificación (RLS lo ignora sin error); se comprueba más abajo como A
update public.glucose_readings set value = 999 where user_id = '00000000-0000-0000-0000-0000000000a1';
select is((select count(*) from public.my_shared_patients()), 1::bigint,
  'P ve a A en su lista de pacientes (1 permiso activo)');

-- ---------------------------------------------------------------- Q sin verificar
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated"}';
select is((select count(*) from public.glucose_readings), 0::bigint,
  'un profesional sin verificar no ve nada aunque tenga permiso');

-- ---------------------------------------------------------------- A gestiona sus permisos
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
select is((select value from public.glucose_readings where id = 'g-a'), 95::numeric,
  'P no pudo modificar la glucosa de A (solo lectura)');
select throws_ok(
  $$ update public.data_shares set scopes = array['glucose', 'profile']
     where id = '11111111-1111-1111-1111-111111111111' $$,
  '42501', null, 'las categorías de un permiso no se editan (se revoca y se crea otro)');
select throws_ok(
  $$ delete from public.data_shares where id = '11111111-1111-1111-1111-111111111111' $$,
  '42501', null, 'los permisos no se borran (quedan como registro del consentimiento)');
update public.data_shares set revoked_at = now() where id = '11111111-1111-1111-1111-111111111111';

-- ---------------------------------------------------------------- P tras la revocación
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}';
select is((select count(*) from public.glucose_readings), 0::bigint, 'tras revocar, P ya no ve la glucosa de A');
select is((select count(*) from public.data_shares where revoked_at is not null), 1::bigint,
  'el permiso revocado sigue existiendo como historial');

-- ---------------------------------------------------------------- B no ve permisos ajenos
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}';
select is((select count(*) from public.data_shares), 0::bigint, 'B no ve los permisos de A');

-- ---------------------------------------------------------------- Anónimo
reset role;
set local role anon;
select is((select count(*) from public.glucose_readings), 0::bigint, 'sin sesión no se ve nada');

select * from finish();
rollback;

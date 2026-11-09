-- Tests del doble factor obligatorio (migración 20261109180000_mfa_aal2.sql). Todo dentro de una
-- transacción que se deshace al final: no deja usuarios ni datos.
--   npx supabase test db --linked        (solo contra la base de PRUEBAS; ver docs/entorno-de-pruebas.md)
-- «aal1» = solo contraseña; «aal2» = contraseña + código de la app de autenticación.
begin;
create extension if not exists pgtap with schema extensions;
select plan(30);

-- A paciente; P profesional verificada; D admin; S soporte; C paciente que activó el doble factor
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a9', 'mfa.patient.a@test.local', '{"display_name":"Paciente A"}'),
  ('00000000-0000-0000-0000-0000000000c9', 'mfa.pro.p@test.local', '{"display_name":"Dra. P"}'),
  ('00000000-0000-0000-0000-0000000000d9', 'mfa.admin.d@test.local', '{"display_name":"Admin D"}'),
  ('00000000-0000-0000-0000-0000000000e9', 'mfa.support.s@test.local', '{"display_name":"Soporte S"}'),
  ('00000000-0000-0000-0000-0000000000f9', 'mfa.patient.c@test.local', '{"display_name":"Paciente C"}');
insert into public.professionals (id, display_name, role, verified_at) values
  ('00000000-0000-0000-0000-0000000000c9', 'Dra. P', 'doctor', now());
insert into public.admins (user_id) values ('00000000-0000-0000-0000-0000000000d9');
insert into public.support_agents (user_id, label) values ('00000000-0000-0000-0000-0000000000e9', 'Soporte de prueba');
insert into auth.mfa_factors (id, user_id, friendly_name, factor_type, status, created_at, updated_at) values
  ('99999999-9999-9999-9999-9999999999f9', '00000000-0000-0000-0000-0000000000f9', 'App de prueba', 'totp', 'verified', now(), now());

-- ---------------------------------------------------------------- Paciente A (sin doble factor), aal1
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000a9","role":"authenticated","aal":"aal1"}';
insert into public.glucose_readings (id, value, unit, measured_at) values ('g-mfa-a', 95, 'mg/dL', now());
insert into public.data_shares (professional_id, scopes) values ('00000000-0000-0000-0000-0000000000c9', array['glucose']);
select is((select public.mfa_required()), false, 'a un paciente no se le exige doble factor');
select is((select public.mfa_ok()), true, 'el paciente sin doble factor pasa con solo la contraseña');
select is((select count(*) from public.glucose_readings), 1::bigint, 'el paciente entra como siempre y ve lo suyo');

-- ---------------------------------------------------------------- Profesional P, aal1
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000c9","role":"authenticated","aal":"aal1"}';
select is((select public.mfa_required()), true, 'a un profesional se le exige doble factor');
select is((select public.has_share('00000000-0000-0000-0000-0000000000a9', 'glucose')), false, 'has_share() es falso sin aal2');
select is((select count(*) from public.glucose_readings), 0::bigint, 'P sin aal2 no ve la glucosa que A le comparte');
select is((select count(*) from public.my_shared_patients()), 0::bigint, 'P sin aal2 no ve su lista de pacientes (my_shared_patients)');
select is((select count(*) from public.pro_patients()), 0::bigint, 'P sin aal2 no ve su lista de pacientes (pro_patients)');
select is((select count(*) from public.data_shares), 0::bigint, 'P sin aal2 no ve ni los permisos que le han dado');
select is((select count(*) from public.my_professional_profile()), 1::bigint, 'P sin aal2 sí sabe que es profesional (para pedirle el alta)');

-- ---------------------------------------------------------------- Profesional P, aal2
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000c9","role":"authenticated","aal":"aal2"}';
select is((select public.has_share('00000000-0000-0000-0000-0000000000a9', 'glucose')), true, 'has_share() es verdadero con aal2');
select is((select count(*) from public.glucose_readings), 1::bigint, 'P con aal2 ve la glucosa que A le comparte');
select is((select count(*) from public.my_shared_patients()), 1::bigint, 'P con aal2 ve a A en su lista');

-- ---------------------------------------------------------------- Admin D
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000d9","role":"authenticated","aal":"aal1"}';
select is((select public.mfa_required()), true, 'a un admin se le exige doble factor');
select is((select public.is_admin()), false, 'is_admin() es falso sin aal2');
select throws_ok($$ select * from public.admin_list_professionals() $$, '42501', null,
  'sin aal2 el admin no puede listar profesionales');
select is((select public.is_tester()), false, 'sin aal2 el admin tampoco es probador');

set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000d9","role":"authenticated","aal":"aal2"}';
select is((select public.is_admin()), true, 'is_admin() es verdadero con aal2');
select ok((select count(*) from public.admin_list_professionals()) >= 1, 'con aal2 el admin lista profesionales');

-- ---------------------------------------------------------------- Soporte S
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000e9","role":"authenticated","aal":"aal1"}';
select is((select public.mfa_required()), true, 'a soporte se le exige doble factor');
select is((select public.is_support_agent()), false, 'is_support_agent() es falso sin aal2');
select throws_ok($$ select * from public.support_list_grants() $$, null, null,
  'sin aal2 soporte no puede ver los permisos que le han dado');
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000e9","role":"authenticated","aal":"aal2"}';
select is((select public.is_support_agent()), true, 'is_support_agent() es verdadero con aal2');

-- ---------------------------------------------------------------- Paciente C, que activó el doble factor
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000f9","role":"authenticated","aal":"aal1"}';
select is((select public.mfa_ok()), false, 'el paciente con doble factor activado no pasa con solo la contraseña');
select throws_ok(
  $$ insert into public.glucose_readings (id, value, unit, measured_at) values ('g-mfa-c', 100, 'mg/dL', now()) $$,
  '42501', null, 'sin el código no puede escribir en su cuenta');
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000f9","role":"authenticated","aal":"aal2"}';
insert into public.glucose_readings (id, value, unit, measured_at) values ('g-mfa-c', 100, 'mg/dL', now());
select is((select count(*) from public.glucose_readings), 1::bigint, 'con el código escribe y ve lo suyo');

-- ---------------------------------------------------------------- Estructura
reset role;
select is(
  (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p') and c.relrowsecurity
      and not exists (select 1 from pg_policy pol where pol.polrelid = c.oid
                      and pol.polname = 'mfa: segundo factor si la cuenta lo exige' and not pol.polpermissive)),
  0::bigint,
  'todas las tablas con RLS tienen la política restrictiva del doble factor (una tabla nueva también la necesita)');
select ok(
  exists (select 1 from pg_policy pol where pol.polrelid = 'storage.objects'::regclass
          and pol.polname = 'mfa: segundo factor si la cuenta lo exige' and not pol.polpermissive),
  'los archivos (Storage) también la tienen');

insert into public.mfa_resets (admin_id, target_id, reason) values
  ('00000000-0000-0000-0000-0000000000d9', '00000000-0000-0000-0000-0000000000c9', 'Móvil perdido, identidad comprobada');
select throws_ok($$ update public.mfa_resets set reason = 'otro motivo cualquiera' $$, '42501', null,
  'el registro de doble factor quitado no se puede editar');
select throws_ok($$ delete from public.mfa_resets $$, '42501', null,
  'ni borrar');

select * from finish();
rollback;

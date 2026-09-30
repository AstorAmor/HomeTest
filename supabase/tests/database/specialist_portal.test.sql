-- Tests de seguridad del portal del especialista: citas, solicitudes, chat, notas
-- clínicas, datos privados y planes. Todo se deshace al final.
--   npx supabase test db --linked
begin;
create extension if not exists pgtap with schema extensions;
select plan(20);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', 'patient.a@test.local', '{"display_name":"Paciente A"}'),
  ('00000000-0000-0000-0000-0000000000b1', 'patient.b@test.local', '{"display_name":"Paciente B"}'),
  ('00000000-0000-0000-0000-0000000000c1', 'pro.p@test.local', '{"display_name":"Dra. P"}'),
  ('00000000-0000-0000-0000-0000000000d1', 'pro.q@test.local', '{"display_name":"Dr. Q"}');
insert into public.professionals (id, display_name, role, verified_at, chat_enabled) values
  ('00000000-0000-0000-0000-0000000000c1', 'Dra. P', 'doctor', now(), true),
  ('00000000-0000-0000-0000-0000000000d1', 'Dr. Q', 'dietitian', null, true);
insert into public.professional_private (professional_id, personal_phone) values
  ('00000000-0000-0000-0000-0000000000c1', '+34 600 000 000');

-- ---------------------------------------------------------------- Paciente A
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';

select lives_ok(
  $$ insert into public.appointments (id, professional_id, patient_id, patient_name, starts_at, duration_min)
     values ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000c1',
             '00000000-0000-0000-0000-0000000000a1', 'Paciente A', now() + interval '1 day', 30) $$,
  'A pide cita a una especialista verificada');
select throws_ok(
  $$ insert into public.appointments (professional_id, patient_id, starts_at)
     values ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000a1', now() + interval '2 days') $$,
  '42501', null, 'no se puede pedir cita a un especialista sin verificar');
select throws_ok(
  $$ insert into public.appointments (professional_id, patient_id, starts_at, duration_min)
     values ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000a1', now() + interval '1 day 10 minutes', 30) $$,
  '23P01', null, 'no se pueden solapar citas de la misma especialista');
select throws_ok(
  $$ update public.appointments set status = 'confirmed' where id = 'aaaaaaaa-0000-0000-0000-000000000001' $$,
  'P0001', null, 'el paciente no puede confirmar su propia cita (solo cancelar)');
select is((select count(*) from public.professional_private), 0::bigint, 'el paciente no ve los datos personales del especialista');

insert into public.conversations (id, professional_id, patient_name) values
  ('cccccccc-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000c1', 'Paciente A');
select lives_ok(
  $$ insert into public.messages (conversation_id, body) values ('cccccccc-0000-0000-0000-000000000001', 'Hola, doctora') $$,
  'A escribe en su chat con P');
select throws_ok(
  $$ insert into public.conversations (professional_id) values ('00000000-0000-0000-0000-0000000000d1') $$,
  '42501', null, 'no se abre chat con un especialista sin verificar');

insert into public.consultation_requests (id, professional_id, kind, message, patient_name) values
  ('dddddddd-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000c1', 'question', '¿Es normal mi ferritina?', 'Paciente A');
select throws_ok(
  $$ update public.consultation_requests set response = 'yo misma' where id = 'dddddddd-0000-0000-0000-000000000001' $$,
  'P0001', null, 'el paciente no puede contestarse a sí mismo');

-- ---------------------------------------------------------------- Paciente B (ajeno)
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}';
select is((select count(*) from public.appointments), 0::bigint, 'B no ve las citas de A');
select is((select count(*) from public.messages), 0::bigint, 'B no ve los mensajes de A');
select throws_ok(
  $$ insert into public.messages (conversation_id, body) values ('cccccccc-0000-0000-0000-000000000001', 'intruso') $$,
  '42501', null, 'B no puede escribir en el chat de A');
select is((select count(*) from public.consultation_requests), 0::bigint, 'B no ve las solicitudes de A');

-- ---------------------------------------------------------------- Especialista P
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}';
select lives_ok(
  $$ update public.appointments set status = 'confirmed', video_room_url = 'https://video.example/room'
     where id = 'aaaaaaaa-0000-0000-0000-000000000001' $$,
  'P confirma la cita');
select is((select count(*) from public.messages), 1::bigint, 'P ve el mensaje de A');
select lives_ok(
  $$ update public.consultation_requests set response = 'Sí, está mejorando', status = 'answered'
     where id = 'dddddddd-0000-0000-0000-000000000001' $$,
  'P contesta la solicitud');
select lives_ok(
  $$ insert into public.clinical_notes (patient_id, subjective) values ('00000000-0000-0000-0000-0000000000a1', 'Cansancio') $$,
  'P escribe una nota clínica de su paciente');
select throws_ok(
  $$ insert into public.clinical_notes (patient_id, subjective) values ('00000000-0000-0000-0000-0000000000b1', 'x') $$,
  '42501', null, 'P no puede escribir notas de alguien que no es su paciente');
select is((select count(*) from public.pro_patients()), 1::bigint, 'pro_patients devuelve solo a A');
select lives_ok(
  $$ insert into public.action_plans (patient_id, professional_id, source, items)
     values ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000c1', 'professional', '[]'::jsonb) $$,
  'P crea un plan de acción para A');

-- ---------------------------------------------------------------- A de nuevo
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
select is((select count(*) from public.clinical_notes), 0::bigint, 'las notas clínicas son privadas del especialista');

select * from finish();
rollback;

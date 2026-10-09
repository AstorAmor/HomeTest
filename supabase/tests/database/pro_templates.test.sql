-- Tests de seguridad de la biblioteca de plantillas del especialista. Todo se deshace al final.
--   npx supabase test db --linked
begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a2', 'patient.t@test.local'),
  ('00000000-0000-0000-0000-0000000000c2', 'pro.t@test.local'),
  ('00000000-0000-0000-0000-0000000000d2', 'pro.u@test.local');
insert into public.professionals (id, display_name, role, verified_at) values
  ('00000000-0000-0000-0000-0000000000c2', 'Dra. T', 'doctor', now()),
  ('00000000-0000-0000-0000-0000000000d2', 'Dr. U', 'doctor', now());

set local role authenticated;

-- Dra. T crea una plantilla
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000c2","role":"authenticated"}';
select lives_ok(
  $$ insert into public.pro_templates (id, title, topic, body)
     values ('eeeeeeee-0000-0000-0000-000000000001', 'Ferritina baja', 'energy', 'Hola [name], tu ferritina es [value]...') $$,
  'una profesional crea su plantilla');
select is((select count(*) from public.pro_templates), 1::bigint, 'y la ve');
select throws_ok(
  $$ insert into public.pro_templates (professional_id, title, body)
     values ('00000000-0000-0000-0000-0000000000d2', 'Suplantar', 'x') $$,
  '42501', null, 'no puede crear plantillas a nombre de otro');

-- Dr. U no ve ni toca las de T
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000d2","role":"authenticated"}';
select is((select count(*) from public.pro_templates), 0::bigint, 'otro profesional no ve las plantillas de T');
update public.pro_templates set body = 'cambiado' where id = 'eeeeeeee-0000-0000-0000-000000000001';
delete from public.pro_templates where id = 'eeeeeeee-0000-0000-0000-000000000001';

-- Un paciente no puede crear plantillas ni ver ninguna
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}';
select throws_ok(
  $$ insert into public.pro_templates (title, body) values ('Paciente', 'x') $$,
  '42501', null, 'un paciente no puede crear plantillas');
select is((select count(*) from public.pro_templates), 0::bigint, 'un paciente no ve plantillas');

-- La plantilla de T sigue intacta
reset role;
select is((select body from public.pro_templates where id = 'eeeeeeee-0000-0000-0000-000000000001'),
  'Hola [name], tu ferritina es [value]...', 'nadie más la ha cambiado ni borrado');

select * from finish();
rollback;

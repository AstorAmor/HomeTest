-- Nuevo rol de profesional: psicólogo/a (psicólogo general sanitario), en todos los menús de especialistas.
alter table public.professionals drop constraint professionals_role_check;
alter table public.professionals add constraint professionals_role_check
  check (role in ('doctor', 'psychologist', 'midwife', 'dietitian', 'trainer', 'physio', 'geneticist'));

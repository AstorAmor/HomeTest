-- Nuevo rol de profesional: matrona (carrusel "Talk to a specialist").
alter table public.professionals drop constraint professionals_role_check;
alter table public.professionals add constraint professionals_role_check
  check (role in ('doctor', 'midwife', 'dietitian', 'trainer', 'physio', 'geneticist'));

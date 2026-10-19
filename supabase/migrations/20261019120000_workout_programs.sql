-- Entrenamientos (2026-10-19): programas de ejercicio del usuario. Los crea él mismo con el generador de
-- la app (professional_id nulo) o se los manda su profesional (entrenador personal, fisio…) desde el
-- portal. Las sesiones y los ejercicios van en jsonb con los ids del catálogo de la app
-- (src/data/workouts). `completions` = sesiones hechas (fecha y minutos), lo que el profesional ve para
-- saber si su paciente sigue el programa.
-- Clave (patient_id, id) como en los registros: se puede subir lo guardado en el móvil sin duplicar.
--
-- APLICADA el 2026-10-19 con el OK del fundador (db query --linked en una transacción + migration repair),
-- antes de juntar la rama con master. REMOTE_HAS_WORKOUT_PROGRAMS = true en src/data/workouts/programRepository.ts.

create table public.workout_programs (
  patient_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null default gen_random_uuid()::text,
  professional_id uuid references public.professionals (id) on delete set null, -- null = lo hizo el usuario
  professional_name text,
  title text not null check (char_length(title) between 1 and 120),
  prefs jsonb not null default '{}'::jsonb,
  sessions jsonb not null check (jsonb_typeof(sessions) = 'array'),
  note text not null default '' check (char_length(note) <= 4000),
  active boolean not null default true,
  completions jsonb not null default '[]'::jsonb check (jsonb_typeof(completions) = 'array'),
  catalog text not null default 'free-exercise-db@f00c92c', -- versión del catálogo de ejercicios
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (patient_id, id)
);

create index workout_programs_pro_idx on public.workout_programs (professional_id, created_at desc)
  where professional_id is not null;
create trigger workout_programs_touch_updated_at
  before update on public.workout_programs
  for each row execute function public.touch_updated_at();

-- Nadie cambia de quién es un programa ni quién lo mandó (el paciente puede marcar sesiones hechas,
-- activarlo o archivarlo, pero no hacer pasar uno suyo por uno de su entrenador)
create function public.workout_programs_keep_owner()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.patient_id := old.patient_id;
  new.professional_id := old.professional_id;
  new.professional_name := old.professional_name;
  new.created_at := old.created_at;
  return new;
end;
$$;
create trigger workout_programs_keep_owner
  before update on public.workout_programs
  for each row execute function public.workout_programs_keep_owner();

alter table public.workout_programs enable row level security;

-- El usuario: los suyos
create policy "workout_programs: patient read" on public.workout_programs for select to authenticated
  using ((select auth.uid()) = patient_id);
create policy "workout_programs: patient insert" on public.workout_programs for insert to authenticated
  with check ((select auth.uid()) = patient_id and professional_id is null);
create policy "workout_programs: patient update" on public.workout_programs for update to authenticated
  using ((select auth.uid()) = patient_id) with check ((select auth.uid()) = patient_id);
create policy "workout_programs: patient delete" on public.workout_programs for delete to authenticated
  using ((select auth.uid()) = patient_id);

-- El profesional: solo los que ha mandado él, y solo mientras sea su paciente (is_my_patient)
create policy "workout_programs: professional read" on public.workout_programs for select to authenticated
  using ((select auth.uid()) = professional_id and public.is_my_patient(patient_id));
create policy "workout_programs: professional insert" on public.workout_programs for insert to authenticated
  with check ((select auth.uid()) = professional_id and public.is_my_patient(patient_id));
create policy "workout_programs: professional update" on public.workout_programs for update to authenticated
  using ((select auth.uid()) = professional_id and public.is_my_patient(patient_id))
  with check ((select auth.uid()) = professional_id);
create policy "workout_programs: professional delete" on public.workout_programs for delete to authenticated
  using ((select auth.uid()) = professional_id);

revoke all on public.workout_programs from anon;

-- Menús semanales (2026-10-19): los crea el usuario con el cuestionario de la app (professional_id nulo)
-- o se los manda su dietista-nutricionista desde el portal. Los días, las comidas y las raciones van en
-- jsonb con los ids del recetario de la app (src/data/diet). `prefs` guarda las respuestas del
-- cuestionario (tipo de dieta, alergias, lo que sienta mal, presupuesto, tiempo, suplementos…) y
-- `reasons`, lo que se tuvo en cuenta de sus analíticas. Son datos de salud: solo los ven el paciente y
-- el profesional que lo mandó mientras sea su paciente.
-- Clave (patient_id, id): se puede subir lo guardado en el móvil sin duplicar.
--
-- PREPARADA, SIN APLICAR: aplicar solo con el OK explícito del fundador. Después, poner
-- REMOTE_HAS_DIET_PLANS = true en src/data/diet/dietRepository.ts.

create table public.diet_plans (
  patient_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null default gen_random_uuid()::text,
  professional_id uuid references public.professionals (id) on delete set null, -- null = lo hizo el usuario
  professional_name text,
  title text not null check (char_length(title) between 1 and 120),
  prefs jsonb not null default '{}'::jsonb,
  targets jsonb not null default '{}'::jsonb,
  reasons jsonb not null default '[]'::jsonb,
  days jsonb not null check (jsonb_typeof(days) = 'array'),
  note text not null default '' check (char_length(note) <= 4000),
  active boolean not null default true,
  catalog text not null default 'kuova-recipes-2026-10-19', -- versión del recetario
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (patient_id, id)
);

create index diet_plans_pro_idx on public.diet_plans (professional_id, created_at desc) where professional_id is not null;
create trigger diet_plans_touch_updated_at
  before update on public.diet_plans
  for each row execute function public.touch_updated_at();

-- Nadie cambia de quién es un menú ni quién lo mandó
create function public.diet_plans_keep_owner()
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
create trigger diet_plans_keep_owner
  before update on public.diet_plans
  for each row execute function public.diet_plans_keep_owner();

alter table public.diet_plans enable row level security;

create policy "diet_plans: patient read" on public.diet_plans for select to authenticated
  using ((select auth.uid()) = patient_id);
create policy "diet_plans: patient insert" on public.diet_plans for insert to authenticated
  with check ((select auth.uid()) = patient_id and professional_id is null);
create policy "diet_plans: patient update" on public.diet_plans for update to authenticated
  using ((select auth.uid()) = patient_id) with check ((select auth.uid()) = patient_id);
create policy "diet_plans: patient delete" on public.diet_plans for delete to authenticated
  using ((select auth.uid()) = patient_id);

-- El profesional: solo los que ha mandado él y solo a sus pacientes (is_my_patient)
create policy "diet_plans: professional read" on public.diet_plans for select to authenticated
  using ((select auth.uid()) = professional_id and public.is_my_patient(patient_id));
create policy "diet_plans: professional insert" on public.diet_plans for insert to authenticated
  with check ((select auth.uid()) = professional_id and public.is_my_patient(patient_id));
create policy "diet_plans: professional update" on public.diet_plans for update to authenticated
  using ((select auth.uid()) = professional_id and public.is_my_patient(patient_id))
  with check ((select auth.uid()) = professional_id);
create policy "diet_plans: professional delete" on public.diet_plans for delete to authenticated
  using ((select auth.uid()) = professional_id);

revoke all on public.diet_plans from anon;

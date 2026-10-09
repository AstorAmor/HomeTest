-- Biblioteca de plantillas del especialista: textos que reutiliza al contestar dudas
-- (regla, analíticas, hormonas, energía, colesterol, glucosa). Son textos del propio
-- profesional, no datos de pacientes: solo los ve y edita su autor. Sin IA.

create table public.pro_templates (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 160),
  topic text not null default 'other'
    check (topic in ('cycle', 'blood_test', 'hormones', 'energy', 'cholesterol', 'glucose', 'other')),
  keywords text[] not null default '{}',
  body text not null check (char_length(body) between 1 and 20000),
  uses integer not null default 0,
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index pro_templates_owner_idx on public.pro_templates (professional_id, updated_at desc);
create trigger pro_templates_touch_updated_at
  before update on public.pro_templates
  for each row execute function public.touch_updated_at();

alter table public.pro_templates enable row level security;

-- Solo su autor, y solo si es profesional (o admin, para probar el portal)
create policy "pro_templates: author read" on public.pro_templates for select to authenticated
  using ((select auth.uid()) = professional_id);
create policy "pro_templates: author insert" on public.pro_templates for insert to authenticated
  with check (
    (select auth.uid()) = professional_id
    and (exists (select 1 from public.professionals p where p.id = (select auth.uid())) or public.is_admin())
  );
create policy "pro_templates: author update" on public.pro_templates for update to authenticated
  using ((select auth.uid()) = professional_id) with check ((select auth.uid()) = professional_id);
create policy "pro_templates: author delete" on public.pro_templates for delete to authenticated
  using ((select auth.uid()) = professional_id);

revoke all on public.pro_templates from anon;

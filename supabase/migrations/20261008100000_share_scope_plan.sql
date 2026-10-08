-- Nueva categoría para compartir: "plan" (el plan de acción personalizado y sus versiones).
-- Hasta ahora el plan solo se veía compartiendo "lab_reports"; se mantiene ese acceso para no
-- cortar permisos ya dados, y "plan" permite compartir el plan sin las analíticas.

alter table public.data_shares drop constraint if exists data_shares_scopes_check;
alter table public.data_shares add constraint data_shares_scopes_check check (
  cardinality(scopes) > 0
  and scopes <@ array[
    'profile', 'lab_reports', 'plan', 'glucose', 'blood_pressure', 'metrics',
    'cycle', 'wellbeing', 'activity', 'nutrition', 'wearables'
  ]::text[]
);

drop policy if exists "action_plans: professional read" on public.action_plans;
create policy "action_plans: professional read" on public.action_plans for select to authenticated
  using (
    (select auth.uid()) = professional_id
    or public.has_share(patient_id, 'plan')
    or public.has_share(patient_id, 'lab_reports')
  );

-- El paciente puede borrar sus planes desde "Tus planes" (2026-10-17), también los que le hizo un
-- profesional: son sus datos. Sigue sin poder editarlos (update sigue revocado).
grant delete on public.action_plans to authenticated;

create policy "action_plans: patient delete" on public.action_plans for delete to authenticated
  using (patient_id = (select auth.uid()));

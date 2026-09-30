-- El especialista también puede abrir un chat con sus pacientes (si tiene el chat habilitado).
create policy "conversations: professional opens" on public.conversations for insert to authenticated
  with check (
    (select auth.uid()) = professional_id
    and public.is_my_patient(patient_id)
    and exists (select 1 from public.professionals p where p.id = professional_id and p.chat_enabled)
  );

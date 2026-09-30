-- Huecos ocupados de un especialista (para que el paciente elija uno libre) sin revelar
-- nada de las citas de otros pacientes: solo inicio y fin.
create function public.pro_busy_slots(pro uuid, from_ts timestamptz, to_ts timestamptz)
returns table (starts_at timestamptz, ends_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select a.starts_at, a.ends_at
  from public.appointments a
  join public.professionals p on p.id = a.professional_id
  where a.professional_id = pro
    and p.verified_at is not null
    and a.status in ('pending', 'confirmed')
    and a.starts_at < to_ts and a.ends_at > from_ts
    and to_ts - from_ts <= interval '62 days';
$$;
revoke execute on function public.pro_busy_slots(uuid, timestamptz, timestamptz) from anon, public;
grant execute on function public.pro_busy_slots(uuid, timestamptz, timestamptz) to authenticated;

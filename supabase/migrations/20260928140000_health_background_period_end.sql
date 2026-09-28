-- Antecedentes de salud en el perfil (medicación y enfermedades previas) y fin del
-- periodo (duración), además del inicio. Datos de salud: mismas reglas RLS que el
-- resto de la fila (el paciente, o el profesional con permiso 'profile' / 'cycle').

alter table public.profiles
  add column takes_medication boolean,
  add column medications text,
  add column conditions text[] not null default '{}',
  add column conditions_other text;

alter table public.cycle_starts
  add column ended_at timestamptz,
  add constraint cycle_end_after_start check (ended_at is null or ended_at >= started_at);

-- Cuestionario (2026-10-30): días de fuerza y de cardio a la semana y pasos al día que cree que da.
-- Sin datos del reloj ni entrenos registrados, «Tu plan personalizado» parte de estas respuestas.
-- 3 = «3 o más». La app solo manda estas columnas cuando están contestadas.
alter table public.profiles
  add column if not exists strength_days smallint check (strength_days between 0 and 7),
  add column if not exists cardio_days smallint check (cardio_days between 0 and 7),
  add column if not exists steps_band text check (steps_band in ('lt5k', '5to7k', '7to10k', 'gt10k', 'unknown'));

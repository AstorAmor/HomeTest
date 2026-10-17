-- Nuevo color de heces "marrón oscuro", entre el marrón y el muy oscuro/negro (2026-10-17): la
-- mayoría de la gente lo tiene así y no encajaba ni en "marrón" ni en "muy oscuro".
alter table public.bowel_logs drop constraint if exists bowel_logs_color_check;
alter table public.bowel_logs add constraint bowel_logs_color_check
  check (color in ('brown', 'light_brown', 'dark_brown', 'yellow', 'green', 'black', 'red', 'pale'));

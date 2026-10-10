-- Temas propios en la biblioteca de plantillas: al elegir "Otro", el especialista puede ponerle
-- nombre al tema (p. ej. "Embarazo"); se guarda aquí y le vuelve a salir como tema. Borrar un tema
-- propio = dejar custom_topic en null (sus plantillas pasan a "Otro"). Mismas políticas de la tabla.

alter table public.pro_templates
  add column custom_topic text
    check (custom_topic is null or (char_length(custom_topic) between 1 and 40 and topic = 'other'));

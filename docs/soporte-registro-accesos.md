# Acceso de soporte y registro de accesos

Cómo resolver una incidencia que toca datos de salud de un usuario sin abrir el panel de Supabase,
y cómo demostrar después (art. 5.2 RGPD, responsabilidad proactiva) quién miró qué, cuándo y por qué.
Migración: `supabase/migrations/20261017160000_support_access.sql`. Tests:
`supabase/tests/database/support_access.test.sql`.

## Cómo funciona

1. **El usuario da permiso desde la app**: *Más › Compartir y privacidad › Soporte KUOVA › Dar acceso
   a soporte*. Elige las categorías (análisis, glucosa, comidas…), la duración (24 horas, 7 o 30 días;
   nunca sin fecha de fin) y, si quiere, cuenta el problema. Puede retirarlo cuando quiera. El permiso
   queda en el mismo historial que los permisos a profesionales (`data_shares`, `grantee = 'support'`):
   no se borra, se retira, y sirve como prueba del consentimiento.
2. **Soporte lee desde la app, con una cuenta de soporte** (no con el panel de Supabase): *Más ›
   Acceso de soporte*. Aparecen solo los usuarios con un permiso activo. Para ver algo hay que escribir
   un motivo (mínimo 10 caracteres, p. ej. "Email 12/10: el PDF no se leyó bien") y elegir una de las
   categorías que el usuario dio.
3. **Cada lectura y cada archivo abierto se registra** en `support_access_log`: fecha y hora, cuenta de
   soporte, usuario, permiso que lo autorizó, categoría o archivo, motivo y número de registros vistos.
   La base de datos escribe el registro en la misma operación que devuelve los datos: si no se puede
   registrar, no se ve nada.
4. **El registro no se puede cambiar ni borrar**: ni desde la app ni desde el panel (un trigger lo
   impide). Solo se pueden añadir líneas.
5. **El usuario no ve el registro** (decisión del 17-10-2026: solo interno). Si lo pide ejerciendo su
   derecho de acceso, se le entrega con la consulta de abajo filtrada por su email.

La cuenta de soporte no tiene ninguna otra forma de leer datos de salud: no tiene políticas de lectura
sobre esas tablas y el permiso de soporte no da acceso a ningún profesional.

## Puesta en marcha (una vez)

1. Aplicar la migración en Supabase (cuando des el OK).
2. Crear la cuenta de soporte en la app como una cuenta normal, p. ej. `soporte@kuovahealth.com`, con
   contraseña propia y, cuando esté disponible, doble factor.
3. En Supabase › SQL Editor, darle el rol de soporte:

   ```sql
   insert into public.support_agents (user_id, label)
   select id, 'Soporte KUOVA' from auth.users where email = 'soporte@kuovahealth.com';
   ```

   Para quitárselo: `delete from public.support_agents where user_id = (select id from auth.users where email = 'soporte@kuovahealth.com');`
4. Cerrar sesión y volver a entrar con esa cuenta: aparece *Acceso de soporte* en *Más*.

## Exportar el registro (p. ej. si lo pide la AEPD)

Supabase › SQL Editor › pegar la consulta, ajustar las fechas y pulsar **Run**. Encima de los
resultados, **Export › Download CSV**. Cada fila es un acceso, junto con el permiso que lo autorizó.

```sql
select
  l.id                                                    as n,
  to_char(l.created_at at time zone 'Europe/Madrid', 'YYYY-MM-DD HH24:MI:SS') as fecha_hora,
  l.agent_email                                           as quien,
  l.patient_id                                            as usuario,
  l.action                                                as accion,      -- read, open_file o manual
  l.scope                                                 as categoria,
  l.object                                                as archivo,
  l.reason                                                as motivo,
  l.rows_returned                                         as registros_vistos,
  to_char(s.created_at at time zone 'Europe/Madrid', 'YYYY-MM-DD HH24:MI') as permiso_dado,
  array_to_string(s.scopes, ', ')                         as permiso_categorias,
  to_char(s.expires_at at time zone 'Europe/Madrid', 'YYYY-MM-DD HH24:MI') as permiso_caduca,
  to_char(s.revoked_at at time zone 'Europe/Madrid', 'YYYY-MM-DD HH24:MI') as permiso_retirado
from public.support_access_log l
left join public.data_shares s on s.id = l.share_id
where l.created_at >= '2026-10-01' and l.created_at < '2027-01-01'
order by l.id;
```

- **Un usuario concreto**: añadir `and l.patient_id = (select id from auth.users where email = 'usuario@ejemplo.com')`
  al `where`. Sin ese filtro el CSV identifica a los usuarios solo por su id interno (sin nombre ni email).
- **Los consentimientos** (todos los permisos a soporte, se hayan usado o no):
  `select id, patient_id, scopes, note, created_at, expires_at, revoked_at from public.data_shares where grantee = 'support' order by created_at;`

## Si hay que mirar algo sin permiso del usuario

Solo en casos excepcionales que recoge la política de privacidad (un fallo del servicio que afecta al
usuario, la seguridad del servicio o una obligación legal). **Antes** de mirar, anotarlo en el mismo
registro desde el SQL Editor:

```sql
insert into public.support_access_log (agent_email, patient_id, action, scope, reason)
values (
  'soporte@kuovahealth.com',
  (select id from auth.users where email = 'usuario@ejemplo.com'),  -- o null si afecta a todos
  'manual',
  'lab_reports',                                                    -- qué vas a mirar
  'Fallo en la extracción del 17/10: revisar sus análisis subidos'  -- por qué (10-500 caracteres)
);
```

Fuera de estos casos, no abras tablas de salud en el *Table Editor* del panel: el panel se salta las
reglas de acceso y no deja registro de lo que se ve.

## Conservación

El registro no tiene clave foránea hacia la cuenta del usuario: si el usuario borra su cuenta, sus
datos se borran pero las líneas del registro se conservan (solo con su id interno), igual que el
historial de consentimientos, durante los plazos legales de prescripción. Confirmar el plazo con el
abogado/DPD.

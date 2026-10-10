# De prueba a lanzamiento: privacidad y datos de salud

Borrador del 11-10-2026 para revisar con el abogado o el delegado de protección de datos. Resume qué
protege ya la app (pacientes y portal del especialista) y qué falta antes del primer paciente real.
Lo jurídico está marcado como "confirmar": es una guía técnica, no asesoramiento legal.

## 1. Lo que ya está bien (no hay que rehacerlo)

- **Datos en la UE**: Supabase, proyecto `HomeTest00` en Frankfurt (`eu-central-1`).
- **Las reglas las aplica la base de datos, no la pantalla** (RLS en todas las tablas):
  - cada paciente solo ve lo suyo;
  - un profesional solo ve lo que el paciente le comparte, **categoría a categoría**, **mientras el
    permiso esté activo** (caduca o se retira) y **solo si Kuova lo ha verificado** (`has_share()`);
  - el permiso se puede retirar pero no borrar: queda rastro de quién compartió qué y cuándo;
  - notas clínicas y plantillas: solo las ve su autor.
- **Archivos** (analíticas, fotos de comidas, notas de voz) en almacenamiento privado con las mismas
  reglas. La foto del profesional es pública a propósito.
- **Funciones de IA y de vídeo**: solo con sesión iniciada; las claves están en el servidor.
- **Tests automáticos de esas reglas**: 28 (compartir), 20 (portal del especialista) y 7 (plantillas).
- **La demo no toca la base de datos**: el portal de demostración y "Simular X pacientes" funcionan
  con datos de ejemplo guardados en el dispositivo.

## 2. Antes del primer paciente real (bloqueante)

| # | Qué | Por qué | Quién |
|---|-----|---------|-------|
| 1 | **Supabase de pago (Pro) y contrato de encargado (DPA)** | El plan gratuito no hace copias de seguridad y se pausa tras 7 días sin uso. Pro cuesta desde ~25 $/mes (comprobar precio actual); copias con recuperación a un momento concreto (PITR), aparte. | Fundador |
| 2 | **Separar prueba y producción** | Un proyecto de Supabase "staging" solo con datos inventados para probar; producción limpia (borrar las cuentas y datos de prueba antes de abrir). | Claude |
| 3 | **Confirmar el email al registrarse** (ahora está desactivado) y **doble factor obligatorio para profesionales y admin** | Sin confirmar el email cualquiera puede crear cuentas con correos ajenos. Supabase trae doble factor (TOTP). | Claude |
| 4 | **Registro de accesos** | Que quede apuntado cada vez que un profesional abre datos de un paciente (quién, qué, cuándo) y que el paciente lo vea en "Compartir". Es lo que se espera en datos de salud y sostiene la evaluación de impacto. | Claude |
| 5 | **Contratos de encargado y región UE con cada proveedor** | Supabase (UE, falta firmar el DPA). Daily, vídeo: la cuenta actual no tiene el plan con contrato (`hipaa: false`); contratarlo y fijar región UE. Google Gemini: **solo la versión de pago** (con la gratuita Google puede usar lo que se envía). Vercel (webs; no guarda datos de salud), Expo (actualizaciones de la app; sin datos), Revolut (pagos), Microsoft 365 (correo). Para lo que salga de la UE: cláusulas tipo o Data Privacy Framework. | Fundador + abogado |
| 6 | **Evaluación de impacto (EIPD, art. 35 RGPD)** | Obligatoria al tratar datos de salud a gran escala. Podemos preparar la parte técnica. | Abogado / DPD |
| 7 | **Delegado de protección de datos (DPD)** | Muy probablemente obligatorio (art. 37 RGPD: datos de salud a gran escala como actividad principal). Puede ser externo. Confirmar. | Fundador |
| 8 | **Registro de actividades de tratamiento (art. 30) y política de privacidad final** | La política publicada es un borrador. Base legal: consentimiento explícito para datos de salud (art. 9.2.a) y para compartir con cada profesional. Confirmar. | Abogado |
| 9 | **Derechos del paciente dentro de la app** | Hoy no hay "Descargar mis datos" ni "Borrar mi cuenta". | Claude |
| 10 | **Contrato con cada profesional** | Confidencialidad, uso de los datos solo para atender al paciente, verificación de la colegiación. Decidir si el profesional es responsable o encargado del tratamiento. | Fundador + abogado |
| 11 | **Plan ante una brecha** | Aviso a la AEPD en 72 h: quién lo detecta, quién decide y quién avisa. | Fundador |

## 3. Pronto después (no bloqueante)

- Probar una vez a restaurar una copia de seguridad.
- Cerrar la sesión del portal del especialista tras un rato sin uso.
- Política de conservación: cuánto tiempo se guarda cada cosa (la lista de espera ya tiene 24 meses).
- Revisión de producto sanitario (MDR): las recomendaciones, la edad biológica o el asesoramiento genético
  pueden considerarse software sanitario según cómo se presenten. Tema aparte con un asesor regulatorio.
- Una revisión de seguridad externa ligera antes de crecer.

## 4. Cómo probar "como si fuera real" sin riesgo

1. En el proyecto de staging: 3 cuentas inventadas (paciente A, paciente B y una médica verificada).
2. A comparte con la médica solo "Resultados de laboratorio" y "Tensión arterial".
3. Comprobar con la médica: ve esas dos categorías de A, nada del resto de A y nada de B.
4. Dejar caducar el permiso y luego retirarlo: la médica deja de ver los datos al momento.
5. Los tests automáticos (`supabase/tests/database`) ya comprueban esto en la base de datos. Ejecutarlos
   antes de cada cambio en las tablas: `npx supabase test db --linked` (con Docker Desktop abierto).

Para ver cómo queda el portal con muchos pacientes no hace falta nada de esto: en el portal de
demostración, **Pacientes → Pacientes de ejemplo: 4 · 12 · 40**.

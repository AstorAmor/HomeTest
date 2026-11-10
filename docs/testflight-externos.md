# TestFlight para gente de fuera (enlace público)

Para que cualquiera pruebe Kuova en un iPhone sin ser usuario de App Store Connect: un grupo **externo** de TestFlight con
**enlace público**. La primera compilación de cada versión pasa la revisión beta de Apple (suele tardar alrededor de un día).
Hasta 10.000 probadores. Se instala con la app TestFlight. La compilación es la de pruebas, 1.1.0 (4) (perfil `pruebas-ios`,
canal `pruebas`), así que recibe los OTA de `pruebas` igual que el APK de Android.

Preparado el 2026-11-06 (fundador: «modo gratis y luego yo les envío código», «Sí, prepáralo»).

## Lo que pide Apple (TestFlight → Información de prueba)

**Descripción de la beta (ES):**
Kuova te ayuda a seguir tu salud en un solo sitio: el check-in diario de ánimo y energía, tus metas de ejercicio, alimentación
y hábitos, el ciclo, el sueño y los pasos de tu reloj, y tus analíticas frente al rango de tu laboratorio. Es una versión de
prueba: puede haber fallos y cambios.

**Beta App Description (EN):**
Kuova helps you keep track of your health in one place: a daily check-in for mood and energy, exercise, food and habit
targets, your cycle, sleep and steps from your watch, and your lab results against your lab's range. This is a test version:
expect bugs and changes.

**Qué probar (ES):**
Crea tu cuenta, haz el check-in de hoy y elige tus objetivos y metas. Si algo no se entiende o falla, cuéntanoslo con «Enviar
comentarios» en TestFlight (o con una captura de pantalla).

**What to Test (EN):**
Create your account, do today's check-in and choose your goals and targets. If something is unclear or breaks, tell us with
"Send Beta Feedback" in TestFlight (or take a screenshot).

- Correo para comentarios: support@kuovahealth.com (o el que elija el fundador)
- URL de marketing: https://kuovahealth.com
- URL de la política de privacidad: https://kuovahealth.com/privacy

## Información para la revisión beta (solo la ve Apple)

- Contacto: nombre, apellidos, teléfono y correo de quien responda a Apple. Los pone el fundador.
- **Inicio de sesión obligatorio: sí.** Una cuenta de Kuova solo para Apple (correo y contraseña), creada por el fundador en la
  app. Conviene darle acceso completo (Más → Suscripciones (admin) → dar acceso a ese correo, Premium, sin fin) para que la
  revisión vea todo.
- Notas para la revisión (EN):
  The app requires a Kuova account; please use the demo account above, which has full access. Payments are not active in this
  test build: the checkout only shows a simulation and nothing is charged. Some features (Workouts, report scanning, weekly
  menu) unlock with an invitation code that we send to testers; the demo account already has them. Kuova shows your lab
  results against your lab's reference range and does not diagnose.

## Ojo

- La cuenta de desarrollador es de particular. La norma 5.1.1(ix) pide que las apps de salud las publique una empresa: no está
  claro si Apple lo aplica ya en la revisión beta (ver `iphone-y-apple-salud.md`).
- La pantalla de pago simulado puede llamar la atención (las suscripciones digitales se cobran con compras dentro de la app,
  norma 3.1.1). Por eso va en las notas.
- Las cuentas que creen los probadores son reales (Supabase de producción).

// Español de las pantallas de cuenta: contraseña, «Revisa tu correo» y doble factor (2026-11-09).
// Aparte de es.ts para no chocar con otras ramas que también lo tocan. Si una clave también está en
// es.ts, manda la de es.ts (ver index.ts).
export const authEs: Record<string, string> = {
  // Contraseña
  'At least 8 characters': 'Al menos 8 caracteres',
  'One letter (a-z)': 'Una letra (a-z)',
  'One number': 'Un número',
  'The password needs at least 8 characters, with letters (a-z) and numbers.':
    'La contraseña necesita al menos 8 caracteres, con letras (a-z) y números.',

  // Confirmar el email
  'Check your email': 'Revisa tu correo',
  'We have sent an email to {email}. Type the 6-digit code from the email here, or tap «Confirm my email» in it and then sign in.':
    'Te hemos enviado un correo a {email}. Escribe aquí el código de 6 cifras que trae, o pulsa «Confirmar mi email» en el correo y después inicia sesión.',
  'Code from the email': 'Código del correo',
  Confirm: 'Confirmar',
  'Send the email again': 'Reenviar el correo',
  'You can ask for another email in {s} s.': 'Podrás pedir otro correo en {s} s.',
  'Sent again. It can take a minute; look in spam or promotions too.':
    'Enviado otra vez. Puede tardar un minuto; mira también en spam o en promociones.',
  'I have confirmed it: sign in': 'Ya lo he confirmado: entrar',
  'Not arriving? Look in spam or promotions.': '¿No llega? Mira en spam o en promociones.',
  'Wait a minute before asking for another email.': 'Espera un minuto antes de pedir otro correo.',
  'That code is not right or has expired. Check the latest email or ask for a new one.':
    'Ese código no es correcto o ha caducado. Mira el último correo o pide otro.',
  'TEST ENVIRONMENT · invented data only': 'ENTORNO DE PRUEBAS · solo datos inventados',

  // Doble factor
  'Two-step verification': 'Verificación en dos pasos',
  'Protect your account': 'Protege tu cuenta',
  'Your account can see patient data, so Kuova asks for a second step when you sign in: a 6-digit code from an authenticator app.':
    'Tu cuenta puede ver datos de pacientes, así que Kuova pide un segundo paso al entrar: un código de 6 cifras de una app de autenticación.',
  'You can use Google Authenticator, Microsoft Authenticator, 1Password or any similar app.':
    'Vale Google Authenticator, Microsoft Authenticator, 1Password o cualquier app parecida.',
  '1. Add Kuova to your authenticator app': '1. Añade Kuova a tu app de autenticación',
  'Scan this code with the app.': 'Escanea este código con la app.',
  'QR code for your authenticator app': 'Código QR para tu app de autenticación',
  'Is the app on this phone? Open it directly:': '¿Tienes la app en este móvil? Ábrela directamente:',
  'Open in my authenticator app': 'Abrir en mi app de autenticación',
  'Or type this key in the app:': 'O escribe esta clave en la app:',
  '2. Type the 6-digit code the app shows': '2. Escribe el código de 6 cifras que te enseña la app',
  Activate: 'Activar',
  'Tip: add Kuova to two apps (for example this phone and 1Password). If you lose your phone, the other one still works.':
    'Consejo: añade Kuova a dos apps (por ejemplo, este móvil y 1Password). Si pierdes el móvil, la otra sigue valiendo.',
  'Could not start the setup. Try again in a moment.': 'No se ha podido empezar el alta. Inténtalo de nuevo en un momento.',
  'Try again': 'Reintentar',
  'That code is not right. Use the newest code and check that your phone sets the time automatically.':
    'Ese código no es correcto. Usa el más reciente y comprueba que la hora del móvil se pone sola.',
  'That code has expired. Type the one the app shows now.': 'Ese código ha caducado. Escribe el que enseña ahora la app.',
  'Enter your code': 'Escribe tu código',
  'Open your authenticator app and type the 6-digit code for Kuova Health.':
    'Abre tu app de autenticación y escribe el código de 6 cifras de Kuova Health.',
  Continue: 'Continuar',
  'Lost your phone?': '¿Has perdido el móvil?',
  'Write to support@kuovahealth.com from your account email. Once we have checked it is you, we remove the old app and you add a new one when you sign in.':
    'Escribe a support@kuovahealth.com desde el email de tu cuenta. Cuando comprobemos que eres tú, quitamos la app antigua y añades una nueva al entrar.',
  'Sign out': 'Cerrar sesión',

  // Ajustes → Verificación en dos pasos
  'A code from an authenticator app when you sign in': 'Un código de una app de autenticación al entrar',
  'Two-step verification: your authenticator apps': 'Verificación en dos pasos: tus apps de autenticación',
  On: 'Activada',
  Off: 'Desactivada',
  'Your account can see patient data, so it needs it: when you sign in, Kuova asks for a 6-digit code from your authenticator app.':
    'Tu cuenta puede ver datos de pacientes, así que la necesita: al entrar, Kuova te pide un código de 6 cifras de tu app de autenticación.',
  'Add a second step when you sign in: a 6-digit code from an authenticator app. Then nobody can open your account with only your password.':
    'Añade un segundo paso al entrar: un código de 6 cifras de una app de autenticación. Así nadie puede abrir tu cuenta solo con tu contraseña.',
  'Your authenticator apps': 'Tus apps de autenticación',
  'Authenticator app': 'App de autenticación',
  'Added {date}': 'Añadida el {date}',
  Remove: 'Quitar',
  'Remove this app?': '¿Quitar esta app?',
  'You will no longer be asked for its codes.': 'Ya no te pedirá sus códigos.',
  'Your account needs at least one: to change it, add the new app first and then remove the old one.':
    'Tu cuenta necesita al menos una: para cambiarla, añade primero la nueva y después quita la antigua.',
  'Add another app': 'Añadir otra app',
  'Turn on two-step verification': 'Activar la verificación en dos pasos',
  'Lost your phone? Write to support@kuovahealth.com from your account email. Once we have checked it is you, we remove the old app and you add a new one when you sign in.':
    '¿Has perdido el móvil? Escribe a support@kuovahealth.com desde el email de tu cuenta. Cuando comprobemos que eres tú, quitamos la app antigua y añades una nueva al entrar.',

  // Admin: quitar el doble factor de quien pierde el móvil
  'Remove two-step verification': 'Quitar la verificación en dos pasos',
  'Only after checking it is them (for example a video call with ID and registration number). Write why: it is recorded.':
    'Solo después de comprobar que es quien dice ser (por ejemplo, videollamada con DNI y número de colegiado). Escribe el motivo: queda registrado.',
  'Reason (at least 10 characters)': 'Motivo (al menos 10 caracteres)',
  'Removed: {n}. Next time they sign in, they will add a new app.': 'Quitadas: {n}. La próxima vez que entre, añadirá una app nueva.',
  Cancel: 'Cancelar',
};

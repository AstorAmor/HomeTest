// Español de las pantallas de cuenta (2026-11-11 en master: «¿Has olvidado tu contraseña?»). En la rama
// entorno-pruebas este archivo trae además la confirmación del email y el doble factor. Si una clave
// también está en es.ts, manda la de es.ts (ver index.ts).
export const authEs: Record<string, string> = {
  // Contraseña
  'At least 8 characters': 'Al menos 8 caracteres',
  'One letter (a-z)': 'Una letra (a-z)',
  'One number': 'Un número',
  'The password needs at least 8 characters, with letters (a-z) and numbers.':
    'La contraseña necesita al menos 8 caracteres, con letras (a-z) y números.',

  // Correo con código
  'Check your email': 'Revisa tu correo',
  'Code from the email': 'Código del correo',
  'Send the email again': 'Reenviar el correo',
  'You can ask for another email in {s} s.': 'Podrás pedir otro correo en {s} s.',
  'Sent again. It can take a minute; look in spam or promotions too.':
    'Enviado otra vez. Puede tardar un minuto; mira también en spam o en promociones.',
  'Not arriving? Look in spam or promotions.': '¿No llega? Mira en spam o en promociones.',
  'Wait a minute before asking for another email.': 'Espera un minuto antes de pedir otro correo.',
  'That code is not right or has expired. Check the latest email or ask for a new one.':
    'Ese código no es correcto o ha caducado. Mira el último correo o pide otro.',

  // ¿Has olvidado tu contraseña? (2026-11-11)
  'Forgot your password?': '¿Has olvidado tu contraseña?',
  'Type your account email and we will send you a 6-digit code to choose a new password.':
    'Escribe el email de tu cuenta y te mandamos un código de 6 cifras para elegir una contraseña nueva.',
  'Send me the code': 'Enviarme el código',
  'Back to sign in': 'Volver a iniciar sesión',
  'If there is a Kuova account with {email}, we have sent it a 6-digit code. Type it here to choose a new password.':
    'Si hay una cuenta de Kuova con {email}, le hemos enviado un código de 6 cifras. Escríbelo aquí para elegir una contraseña nueva.',
  'Use another email': 'Usar otro email',
  'New password': 'Contraseña nueva',
  'Choose a new password': 'Elige una contraseña nueva',
  'You are in. Choose a new password for {email}: from now on you will sign in with it.':
    'Ya has entrado. Elige una contraseña nueva para {email}: a partir de ahora entrarás con ella.',
  'Save password': 'Guardar la contraseña',
  'Password changed': 'Contraseña cambiada',
  'From now on, sign in with your new password.': 'A partir de ahora, entra con la contraseña nueva.',
  'That is already your password. You can keep it, or choose a different one.':
    'Esa ya es tu contraseña. Puedes seguir con ella o elegir otra.',
  'Keep my current password': 'Seguir con la que tengo',
  'Your session has ended. Sign out and ask for a new code.': 'La sesión ha caducado. Cierra sesión y pide otro código.',
  'Could not save it. Try again in a moment.': 'No se ha podido guardar. Inténtalo de nuevo en un momento.',
  Continue: 'Continuar',
  'Sign out': 'Cerrar sesión',
};

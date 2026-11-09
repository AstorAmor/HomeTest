// Reglas de la contraseña al crear la cuenta o cambiarla. Son las mismas que exige Supabase
// (config.toml: minimum_password_length = 8, password_requirements = "letters_digits"), que es quien manda:
// esto solo avisa antes de enviar y lo explica en el idioma de la app.
// «Letra» es a-z o A-Z, como en Supabase (una ñ o una vocal con tilde sola no cuenta).

export const PASSWORD_MIN_LENGTH = 8;

export type PasswordRule = 'length' | 'letter' | 'digit';

export const PASSWORD_RULES: PasswordRule[] = ['length', 'letter', 'digit'];

export function passwordRuleMet(rule: PasswordRule, password: string): boolean {
  switch (rule) {
    case 'length':
      return password.length >= PASSWORD_MIN_LENGTH;
    case 'letter':
      return /[A-Za-z]/.test(password);
    case 'digit':
      return /[0-9]/.test(password);
  }
}

export const passwordMissing = (password: string): PasswordRule[] =>
  PASSWORD_RULES.filter((r) => !passwordRuleMet(r, password));

export const isPasswordStrongEnough = (password: string) => passwordMissing(password).length === 0;

// Errores de Supabase sobre la contraseña (llegan en inglés) → qué regla falla
export function passwordRuleFromAuthError(message: string): PasswordRule | null {
  if (/password should be at least|password.*too short/i.test(message)) return 'length';
  if (/password should contain/i.test(message)) return 'letter';
  return null;
}

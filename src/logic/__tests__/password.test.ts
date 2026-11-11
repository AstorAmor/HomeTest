import { describe, expect, it } from 'vitest';
import { isPasswordStrongEnough, passwordMissing, passwordRuleFromAuthError } from '@/logic/password';

describe('contraseña: 8 o más, con letras y números (como Supabase letters_digits)', () => {
  it('acepta letras y números con 8 caracteres', () => {
    expect(isPasswordStrongEnough('kuova2026')).toBe(true);
    expect(isPasswordStrongEnough('A1b2c3d4')).toBe(true);
  });
  it('rechaza las cortas aunque tengan letras y números', () => {
    expect(passwordMissing('abc123')).toEqual(['length']);
    expect(isPasswordStrongEnough('abcd123')).toBe(false);
  });
  it('pide una letra y un número', () => {
    expect(passwordMissing('12345678')).toEqual(['letter']);
    expect(passwordMissing('abcdefgh')).toEqual(['digit']);
    expect(passwordMissing('')).toEqual(['length', 'letter', 'digit']);
  });
  it('una ñ o una vocal con tilde no cuentan como letra (Supabase solo mira a-z)', () => {
    expect(passwordMissing('ñññññ123')).toEqual(['letter']);
    expect(passwordMissing('áéíóú1234')).toEqual(['letter']);
  });
  it('traduce los errores de Supabase a la regla que falla', () => {
    expect(passwordRuleFromAuthError('Password should be at least 8 characters.')).toBe('length');
    expect(
      passwordRuleFromAuthError(
        'Password should contain at least one character of each: abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ, 0123456789'
      )
    ).toBe('letter');
    expect(passwordRuleFromAuthError('Invalid login credentials')).toBeNull();
  });
});

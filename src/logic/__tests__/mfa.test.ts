import { describe, expect, it } from 'vitest';
import { RESUME_MS, cleanTotpCode, groupSecret, isTotpCodeComplete, mfaGate, minutesAgo, pendingTotpToResume } from '@/logic/mfa';

describe('doble factor: qué pantalla toca al entrar', () => {
  it('con aal2 sigue, lo exija o no la cuenta', () => {
    expect(mfaGate({ required: true, currentLevel: 'aal2', nextLevel: 'aal2' })).toBeNull();
    expect(mfaGate({ required: false, currentLevel: 'aal2', nextLevel: 'aal2' })).toBeNull();
  });
  it('admin o profesional sin app de autenticación: darla de alta', () => {
    expect(mfaGate({ required: true, currentLevel: 'aal1', nextLevel: 'aal1' })).toBe('enroll');
  });
  it('con una app ya dada de alta: pedir el código (también al paciente que lo activó)', () => {
    expect(mfaGate({ required: true, currentLevel: 'aal1', nextLevel: 'aal2' })).toBe('verify');
    expect(mfaGate({ required: false, currentLevel: 'aal1', nextLevel: 'aal2' })).toBe('verify');
  });
  it('el paciente sin doble factor entra como siempre', () => {
    expect(mfaGate({ required: false, currentLevel: 'aal1', nextLevel: 'aal1' })).toBeNull();
    expect(mfaGate({ required: false, currentLevel: null, nextLevel: null })).toBeNull();
  });
});

describe('códigos y clave', () => {
  it('limpia espacios y guiones del código', () => {
    expect(cleanTotpCode('123 456')).toBe('123456');
    expect(cleanTotpCode('12-34-567')).toBe('123456');
    expect(isTotpCodeComplete('12345')).toBe(false);
    expect(isTotpCodeComplete(' 123456 ')).toBe(true);
  });
  it('agrupa la clave de 4 en 4', () => {
    expect(groupSecret('JBSWY3DPEHPK3PXP')).toBe('JBSW Y3DP EHPK 3PXP');
  });
  it('retoma el alta a medias más reciente si tiene menos de 15 minutos', () => {
    const now = Date.parse('2026-11-11T10:00:00Z');
    const row = (id: string, min: number, status = 'unverified', factor_type = 'totp') => ({
      id,
      factor_type,
      status,
      created_at: new Date(now - min * 60_000).toISOString(),
    });
    expect(pendingTotpToResume([row('a', 3), row('b', 1)], now)?.id).toBe('b');
    expect(pendingTotpToResume([row('viejo', 20)], now)).toBeNull();
    expect(pendingTotpToResume([row('hecho', 1, 'verified')], now)).toBeNull();
    expect(pendingTotpToResume([row('tel', 1, 'unverified', 'phone')], now)).toBeNull();
    expect(pendingTotpToResume([], now)).toBeNull();
    expect(RESUME_MS).toBe(15 * 60_000);
  });

  it('«hace N min», como mínimo 1', () => {
    const now = Date.parse('2026-11-11T10:00:00Z');
    expect(minutesAgo('2026-11-11T09:59:50Z', now)).toBe(1);
    expect(minutesAgo('2026-11-11T09:52:00Z', now)).toBe(8);
  });
});

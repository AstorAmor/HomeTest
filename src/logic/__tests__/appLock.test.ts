import { describe, expect, it } from 'vitest';
import { DEFAULT_LOCK_AFTER, biometricKind, lockOnFor, parseLockPrefs, shouldLockOnReturn, unlockProblem } from '@/logic/appLock';

describe('bloqueo con Face ID / huella', () => {
  it('lee la preferencia guardada y se defiende de basura', () => {
    expect(parseLockPrefs(JSON.stringify({ userId: 'u1', afterMs: 0 }))).toEqual({ userId: 'u1', afterMs: 0 });
    expect(parseLockPrefs(JSON.stringify({ userId: 'u1', afterMs: 300_000 }))?.afterMs).toBe(300_000);
    expect(parseLockPrefs(JSON.stringify({ userId: 'u1', afterMs: 12345 }))?.afterMs).toBe(DEFAULT_LOCK_AFTER);
    expect(parseLockPrefs(JSON.stringify({ afterMs: 0 }))).toBeNull();
    expect(parseLockPrefs('{roto')).toBeNull();
    expect(parseLockPrefs(null)).toBeNull();
    expect(DEFAULT_LOCK_AFTER).toBe(60_000);
  });

  it('solo vale para la cuenta que lo activó', () => {
    const prefs = { userId: 'u1', afterMs: 60_000 as const };
    expect(lockOnFor(prefs, 'u1')).toBe(true);
    expect(lockOnFor(prefs, 'u2')).toBe(false);
    expect(lockOnFor(prefs, null)).toBe(false);
    expect(lockOnFor(null, 'u1')).toBe(false);
  });

  it('al volver, bloquea si ha pasado el rato elegido', () => {
    const t0 = 1_000_000;
    expect(shouldLockOnReturn(60_000, t0, t0 + 59_000)).toBe(false);
    expect(shouldLockOnReturn(60_000, t0, t0 + 60_000)).toBe(true);
    expect(shouldLockOnReturn(0, t0, t0 + 1)).toBe(true);
    expect(shouldLockOnReturn(300_000, t0, t0 + 120_000)).toBe(false);
    // sin haber pasado a segundo plano (solo el centro de control, un aviso…): no
    expect(shouldLockOnReturn(0, null, t0)).toBe(false);
    // reloj hacia atrás: ante la duda, se pide
    expect(shouldLockOnReturn(300_000, t0, t0 - 5_000)).toBe(true);
  });

  it('qué decir si no se desbloquea', () => {
    expect(unlockProblem('user_cancel')).toBeNull();
    expect(unlockProblem('system_cancel')).toBeNull();
    expect(unlockProblem('lockout')).toBe('lockout');
    expect(unlockProblem('not_enrolled')).toBe('not_set_up');
    expect(unlockProblem('passcode_not_set')).toBe('not_set_up');
    expect(unlockProblem('authentication_failed')).toBe('failed');
    expect(unlockProblem('timeout')).toBe('failed');
  });

  it('cómo se llama en cada móvil', () => {
    expect(biometricKind('ios', [2])).toBe('face_id');
    expect(biometricKind('ios', [1])).toBe('touch_id');
    expect(biometricKind('android', [1])).toBe('fingerprint');
    expect(biometricKind('android', [2])).toBe('face');
    expect(biometricKind('android', [1, 2])).toBe('fingerprint_or_face');
    expect(biometricKind('android', [])).toBe('fingerprint');
  });
});

// Bloqueo de Kuova con Face ID / huella (Astor, 2026-11-11: «abrir Kuova con la cara o el dedo, como la app del
// banco»). Lógica pura, con tests: qué se guarda en el móvil y cuándo toca pedir la cara o el dedo.
//
// - Es una preferencia de ESTE móvil y de ESTA cuenta (guarda el id): si otra persona entra con su cuenta en el
//   mismo móvil, no hereda el bloqueo.
// - No sustituye al doble factor: solo desbloquea la sesión que ya está abierta en el móvil. En un móvil nuevo o
//   tras cerrar sesión se sigue pidiendo contraseña (y el código, si lo tiene).
// - Bloquea al abrir la app en frío con la sesión guardada y al volver de segundo plano tras `afterMs`.

export const LOCK_AFTER_OPTIONS = [0, 60_000, 300_000] as const;
export type LockAfter = (typeof LOCK_AFTER_OPTIONS)[number];
export const DEFAULT_LOCK_AFTER: LockAfter = 60_000;

export interface AppLockPrefs {
  userId: string;
  afterMs: LockAfter;
}

export function parseLockPrefs(raw: string | null | undefined): AppLockPrefs | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    if (!v || typeof v.userId !== 'string' || !v.userId) return null;
    const afterMs = (LOCK_AFTER_OPTIONS as readonly number[]).includes(v.afterMs) ? (v.afterMs as LockAfter) : DEFAULT_LOCK_AFTER;
    return { userId: v.userId, afterMs };
  } catch {
    return null;
  }
}

// ¿Está activado para la cuenta que tiene la sesión abierta?
export const lockOnFor = (prefs: AppLockPrefs | null, userId: string | null | undefined): prefs is AppLockPrefs =>
  !!prefs && !!userId && prefs.userId === userId;

// Al volver de segundo plano: ¿ha pasado el rato elegido? Si el reloj va hacia atrás (cambio de hora a mano),
// se bloquea: ante la duda, pedirlo.
export function shouldLockOnReturn(afterMs: LockAfter, backgroundAt: number | null, now: number): boolean {
  if (backgroundAt === null) return false;
  const away = now - backgroundAt;
  return away < 0 || away >= afterMs;
}

// Qué decir si no se ha podido desbloquear (códigos de expo-local-authentication). null = no decir nada (lo ha
// cancelado la persona o el sistema, por ejemplo al cambiar de app).
export type UnlockProblem = 'lockout' | 'not_set_up' | 'failed' | null;
export function unlockProblem(error: string | undefined): UnlockProblem {
  switch (error) {
    case undefined:
    case 'user_cancel':
    case 'system_cancel':
    case 'app_cancel':
      return null;
    case 'lockout':
      return 'lockout';
    case 'not_enrolled':
    case 'not_available':
    case 'passcode_not_set':
      return 'not_set_up';
    default:
      return 'failed';
  }
}

// Cómo se llama en este móvil: Face ID / Touch ID en iPhone; huella, cara o las dos en Android
export type BiometricKind = 'face_id' | 'touch_id' | 'fingerprint' | 'face' | 'fingerprint_or_face';
export function biometricKind(platform: string, types: number[]): BiometricKind {
  // AuthenticationType de expo-local-authentication: 1 huella, 2 cara, 3 iris (solo Android)
  const finger = types.includes(1);
  const face = types.includes(2) || types.includes(3);
  if (platform === 'ios') return face ? 'face_id' : 'touch_id';
  if (finger && face) return 'fingerprint_or_face';
  return face ? 'face' : 'fingerprint';
}

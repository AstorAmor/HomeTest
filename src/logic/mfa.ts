// Doble factor (app de autenticación, TOTP): qué pantalla toca al entrar. Lógica pura, con tests.
//
// La base de datos es quien obliga (migración 20261109180000_mfa_aal2.sql: sin aal2, un admin, un
// profesional o soporte no ve ninguna fila). Esto solo decide qué enseñar para que no se encuentre la app
// vacía sin saber por qué:
// - 'verify': ya tiene una app de autenticación dada de alta y la sesión aún no ha pasado el código
//   (aal1 → aal2). Vale también para el paciente que lo activó por su cuenta.
// - 'enroll': su cuenta lo exige (admin, profesional o soporte) y todavía no tiene ninguna.
// - null: puede seguir.

export type AalLevel = 'aal1' | 'aal2' | (string & {}) | null | undefined;
export type MfaGate = 'enroll' | 'verify' | null;

export function mfaGate(input: { required: boolean; currentLevel: AalLevel; nextLevel: AalLevel }): MfaGate {
  if (input.currentLevel === 'aal2') return null;
  // nextLevel = aal2 ⇔ hay al menos un factor verificado (Supabase lo calcula con la lista de factores)
  if (input.nextLevel === 'aal2') return 'verify';
  return input.required ? 'enroll' : null;
}

// Códigos de 6 cifras: lo que se pega o se escribe con espacios («123 456») vale igual
export const cleanTotpCode = (raw: string) => raw.replace(/\D/g, '').slice(0, 6);
export const isTotpCodeComplete = (raw: string) => cleanTotpCode(raw).length === 6;

// El código de 6 cifras de un texto copiado: la app de autenticación copia «123456» o «123 456»; un correo,
// «Tu código: 123456». Solo si hay exactamente uno (3+3 cifras, con espacio o guion en medio o sin nada) y
// sin más cifras al lado (ni tras un espacio): un teléfono, una fecha o dos códigos distintos no cuentan (null).
export function codeInText(raw: string): string | null {
  if (!raw || raw.length > 300) return null;
  const found = new Set<string>();
  for (const m of raw.matchAll(/(?<![\d-]|\d[ \u00a0])(\d{3})[ \u00a0-]?(\d{3})(?![\d-]|[ \u00a0]\d)/g)) found.add(m[1] + m[2]);
  return found.size === 1 ? [...found][0] : null;
}

// Lo que queda en la casilla al escribir o pegar: el código si lo pegado lo lleva, si no las cifras (máximo 6)
export const codeFromInput = (raw: string) => codeInText(raw) ?? cleanTotpCode(raw);

// La clave para escribirla a mano, en grupos de 4 («JBSW Y3DP …»)
export const groupSecret = (secret: string) => secret.replace(/\s/g, '').replace(/(.{4})/g, '$1 ').trim();

// Alta a medias que se puede retomar (2026-11-11): si la app se cierra mientras se añade Kuova a la app de
// autenticación (en Android pasa a menudo al cambiar de app), al volver no se crea otra clave nueva, porque
// la que ya se guardó dejaría de valer y su código «no sería correcto». Se retoma la última sin verificar
// si tiene menos de RESUME_MS; las más antiguas se borran al empezar de nuevo.
export const RESUME_MS = 15 * 60_000;

export interface FactorRow {
  id: string;
  factor_type: string;
  status: string;
  created_at: string;
}

export function pendingTotpToResume(factors: FactorRow[], now: number, maxAgeMs = RESUME_MS): { id: string; createdAt: string } | null {
  const fresh = factors
    .filter((f) => f.factor_type === 'totp' && f.status !== 'verified')
    .filter((f) => {
      const age = now - Date.parse(f.created_at);
      return age >= 0 && age < maxAgeMs;
    })
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  return fresh[0] ? { id: fresh[0].id, createdAt: fresh[0].created_at } : null;
}

// «hace N min» del aviso de retomar (mínimo 1)
export const minutesAgo = (createdAt: string, now: number) => Math.max(1, Math.round((now - Date.parse(createdAt)) / 60_000));

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

// La clave para escribirla a mano, en grupos de 4 («JBSW Y3DP …»)
export const groupSecret = (secret: string) => secret.replace(/\s/g, '').replace(/(.{4})/g, '$1 ').trim();

// Supabase da el QR como «data:image/svg+xml;utf-8,<svg…>» (a veces con el SVG codificado para URL)
export function qrSvgFromDataUrl(dataUrl: string): string | null {
  const comma = dataUrl.indexOf(',');
  if (!dataUrl.startsWith('data:image/svg+xml') || comma < 0) return null;
  const body = dataUrl.slice(comma + 1);
  const svg = body.trimStart().startsWith('<') ? body : decodeURIComponent(body);
  return svg.includes('<svg') ? svg : null;
}

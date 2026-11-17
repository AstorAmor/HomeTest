// Primeros pasos de una cuenta nueva (fundador, 2026-11-17: «para un nuevo usuario estaría bien que le llevase por los
// objetivos, firma de metas… y que le diga que cuando tenga análisis serán más ajustadas, pero que de primeras ya le
// ayude»). Al entrar por primera vez: el cuestionario; después «Tus objetivos» con las metas que recomiendan sus
// respuestas y la firma del compromiso; y por fin Hoy, ya con sus metas, donde empieza el tutorial. El paso a paso
// va con `?inicio=1` en /onboarding, /metas-objetivos y /metas-firmar.
//
// Solo cuentas creadas desde que existe este recorrido: las de antes (que nunca pasaron por el cuestionario) no se
// ven obligadas a hacerlo al actualizar la app.
export const FIRST_STEPS_SINCE = '2026-11-17T00:00:00Z';

// user_flags: 'skipped' si saltó el cuestionario (no se le vuelve a llevar). Hecho = el perfil tiene `completedAt`
export const FIRST_STEPS_FLAG = 'first_steps';

export const isNewAccount = (createdAt: string | undefined): boolean => {
  const at = createdAt ? Date.parse(createdAt) : NaN;
  return Number.isFinite(at) && at >= Date.parse(FIRST_STEPS_SINCE);
};

export function needsFirstSteps(createdAt: string | undefined, completedAt: string | undefined, flag: unknown): boolean {
  return isNewAccount(createdAt) && !completedAt && flag !== 'skipped';
}

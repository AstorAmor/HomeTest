import { showSamples } from './dataMode';
import { ageFromDob, profileRepository, type UserProfile } from './profileRepository';
import { withSampleBasics, type BodyBasics } from '@/logic/bodyComposition';

// Lo que las pantallas del peso y de las medidas necesitan saber de la persona: sexo, edad, altura y el peso del
// perfil. Sale del perfil tal cual, salvo en la demo y en las cuentas de prueba (showSamples): ahí, sin altura
// se usa una de ejemplo para que salga el IMC (fundador, 2026-11-16: «en la cuenta demo incluye el IMC con la
// altura») y, sin sexo ni fecha de nacimiento, una persona de ejemplo para las estimaciones de grasa. Lo de
// ejemplo va marcado (sampleHeight, samplePerson) para decirlo en la pantalla y NUNCA se guarda en el perfil.
// Una cuenta real ve exactamente lo que tiene. Las reglas, en withSampleBasics (src/logic/bodyComposition.ts).
export type { BodyBasics };

export async function loadBodyBasics(): Promise<BodyBasics> {
  return bodyBasicsFrom(await profileRepository.get().catch(() => null));
}

// Lo mismo con el perfil leído la última vez, sin esperar a la red (undefined si aún no se ha leído; en la demo,
// undefined también): para pintar al momento el IMC y las estimaciones (fundador, 2026-11-17)
export function peekBodyBasics(): BodyBasics | undefined {
  const profile = profileRepository.peek();
  return profile ? bodyBasicsFrom(profile) : undefined;
}

export function bodyBasicsFrom(profile: UserProfile | null): BodyBasics {
  const age = ageFromDob(profile?.dateOfBirth);
  return withSampleBasics(
    {
      sex: profile?.sex,
      hasDateOfBirth: !!profile?.dateOfBirth,
      age: age != null && Number.isFinite(age) ? age : null,
      heightCm: profile?.heightCm,
      weightKg: profile?.weightKg,
    },
    showSamples(),
  );
}

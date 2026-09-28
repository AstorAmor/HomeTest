import { glucoseRepository } from './glucoseRepository';
import { bloodPressureRepository } from './bloodPressureRepository';
import { cholesterolRepository } from './cholesterolRepository';
import { cortisolRepository } from './cortisolRepository';
import { cycleRepository } from './cycleRepository';
import { aiLogRepository } from './aiLogRepository';
import { checkInRepository } from './checkInRepository';
import { workoutRepository } from './planRepository';
import { profileRepository } from './profileRepository';
import { wearableRepository } from '@/wearables/wearableRepository';

// Copia a la cuenta de Supabase todo lo guardado en el móvil antes de migrar.
// Idempotente: se puede repetir sin duplicar (upsert por id).
// Las comidas no se suben: sus fotos locales pueden haber desaparecido de la caché.
export async function importLocalDataToAccount(): Promise<string> {
  const counts = {
    glucose: await glucoseRepository.importLocalToRemote(),
    bloodPressure: await bloodPressureRepository.importLocalToRemote(),
    cholesterol: await cholesterolRepository.importLocalToRemote(),
    cortisol: await cortisolRepository.importLocalToRemote(),
    cycle: await cycleRepository.importLocalToRemote(),
    aiLogs: await aiLogRepository.importLocalToRemote(),
    checkIns: await checkInRepository.importLocalToRemote(),
    workouts: await workoutRepository.importLocalToRemote(),
    wearables: await wearableRepository.importLocalToRemote(),
  };
  const profile = await profileRepository.importLocalToRemote();
  const parts = Object.entries(counts)
    .filter(([, n]) => n > 0)
    .map(([k, n]) => `${n} ${k}`);
  if (profile) parts.push('profile');
  return parts.length ? `Uploaded: ${parts.join(', ')}` : 'Nothing to upload from this phone';
}

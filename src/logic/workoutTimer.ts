// Cuentas atrás del modo guiado del entrenamiento. Van por la hora del reloj (no restando un segundo
// en cada tic) porque con la pantalla bloqueada la app no recibe tics: al volver tiene que marcar lo
// que de verdad queda. Y como ahí la app no puede sonar, lo que queda por delante se programa como
// aviso del móvil (src/data/workouts/bell.ts).

export const secondsLeft = (endsAt: number, now: number) => Math.ceil((endsAt - now) / 1000);

// side = mitad de un ejercicio por tiempo que se hace por lado (cambia de lado)
export type CountdownEnd = { at: number; kind: 'side' | 'work' | 'rest' };

export function upcomingEnds(input: {
  now: number;
  phase: 'work' | 'rest';
  timerOn: boolean; // el ejercicio por tiempo está en marcha
  endsAt: number; // fin de la cuenta atrás en marcha (ms)
  totalSec: number; // duración del ejercicio por tiempo, los dos lados si va por lado
  perSide: boolean;
  restAfterSec: number; // descanso tras esta serie (0 si no hay o es la última)
}): CountdownEnd[] {
  const { now, phase, timerOn, endsAt, totalSec, perSide, restAfterSec } = input;
  const out: CountdownEnd[] = [];
  if (phase === 'rest') out.push({ at: endsAt, kind: 'rest' });
  else if (timerOn) {
    if (perSide) out.push({ at: endsAt - (totalSec * 1000) / 2, kind: 'side' });
    out.push({ at: endsAt, kind: 'work' });
    // Si acaba con la pantalla bloqueada, el descanso empieza solo y también hay que avisar al final
    if (restAfterSec > 0) out.push({ at: endsAt + restAfterSec * 1000, kind: 'rest' });
  }
  return out.filter((e) => e.at > now);
}

// Cuentas atrás del modo guiado del entrenamiento. Van por la hora del reloj (no restando un segundo
// en cada tic) porque con la pantalla bloqueada la app no recibe tics: al volver tiene que marcar lo
// que de verdad queda. Y como ahí la app no puede sonar, lo que queda por delante se programa como
// aviso del móvil (src/data/workouts/bell.ts).

export const secondsLeft = (endsAt: number, now: number) => Math.ceil((endsAt - now) / 1000);

// Ejercicios por tiempo: el texto de `reps` lleva "s" o "min" ("30 s", "8 min", "1 min 30 s")
export const isTimedReps = (reps: string) => /\d\s*(s|min)\b/.test(reps);

// Segundos de un ejercicio por tiempo: "30 s" → 30, "20–30 s" → 20 (el mínimo), "8 min" → 480,
// "1 min 30 s" → 90
export const timedSeconds = (reps: string) => {
  const min = reps.match(/(\d+)\s*min/);
  if (min) {
    const sec = reps.slice((min.index ?? 0) + min[0].length).match(/(\d+)\s*s\b/);
    return Number(min[1]) * 60 + (sec ? Number(sec[1]) : 0);
  }
  const n = reps.match(/\d+/);
  return n ? Number(n[0]) : 30;
};

// Al revés, para guardar lo que se elige con las ruedas: 45 → "45 s", 120 → "2 min", 90 → "1 min 30 s"
export const timeText = (sec: number) => {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m === 0 ? `${s} s` : s === 0 ? `${m} min` : `${m} min ${s} s`;
};

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

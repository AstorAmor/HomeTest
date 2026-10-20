// Aviso interno de que algo se ha guardado ("hometest:medication_doses", "flag:cycle_goal"…). Lo
// emiten los repositorios y user_flags; lo escuchan los recordatorios del móvil para reprogramarse
// tras cada cambio sin que cada pantalla tenga que acordarse (src/data/phoneReminders.ts).

type Listener = (source: string) => void;

const listeners = new Set<Listener>();

export function onDataChange(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function emitDataChange(source: string): void {
  for (const l of listeners) {
    try {
      l(source);
    } catch {
      // quien escucha no puede romper un guardado
    }
  }
}

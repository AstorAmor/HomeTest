// Histórico mínimo de los ejercicios de Kegel (fundador, 2026-11-05: «que lleve un histórico de cuándo
// los has hecho, minimalista»): los últimos 7 días, con o sin sesión, y cuándo fue la última. Lógica
// pura (las sesiones se guardan en src/data/kegelRepository.ts).

export interface KegelDay {
  key: string; // AAAA-MM-DD, día local
  date: Date;
  done: boolean;
}
export interface KegelWeek {
  days: KegelDay[]; // del más antiguo a hoy
  count: number; // días con al menos una sesión, de esos 7
  last: string | null; // día de la última sesión (de cualquier fecha)
}

export const kegelDayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function kegelWeek(fechas: string[], now = new Date()): KegelWeek {
  const done = new Set(fechas.map((f) => kegelDayKey(new Date(f))));
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6 + i);
    const key = kegelDayKey(date);
    return { key, date, done: done.has(key) };
  });
  const times = fechas.map((f) => new Date(f).getTime()).filter((x) => !Number.isNaN(x));
  return {
    days,
    count: days.filter((d) => d.done).length,
    last: times.length ? kegelDayKey(new Date(Math.max(...times))) : null,
  };
}

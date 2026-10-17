// A qué día pertenece un check-in. El día de una persona no acaba a las 00:00: quien hace el
// check-in de la noche a las 00:10 sigue en "su" día. Regla: antes de las 4:00, lo que no es
// "me acabo de levantar" cuenta para el día anterior. Lo hecho al despertar cuenta siempre para
// el día del reloj. Si aun así cae en otro día, el check-in se puede mover desde "Tus últimos días".
import type { DayMoment } from '@/types/checkIn';

export const DAY_CUTOFF_HOUR = 4;

// Hora que se guarda al apuntar (o mover) un check-in en otro día: una típica de cada momento
export const MOMENT_HOUR: Record<DayMoment, number> = { just_woke_up: 8, mid_day: 14, winding_down: 22 };

export const localDayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const shiftDay = (key: string, days: number) => {
  const d = new Date(`${key}T12:00:00`);
  d.setDate(d.getDate() + days);
  return localDayKey(d);
};

export function checkInDayKey(e: { fecha: string; moment?: DayMoment | string }): string {
  const d = new Date(e.fecha);
  const key = localDayKey(d);
  return e.moment !== 'just_woke_up' && d.getHours() < DAY_CUTOFF_HOUR ? shiftDay(key, -1) : key;
}

// Momento sugerido por la hora: de madrugada, el final del día que aún no ha acabado
export function suggestMoment(date = new Date()): DayMoment {
  const h = date.getHours();
  if (h < DAY_CUTOFF_HOUR) return 'winding_down';
  if (h < 11) return 'just_woke_up';
  if (h < 19) return 'mid_day';
  return 'winding_down';
}

// Fecha a guardar para un check-in de `day` en ese momento. Si `keep` (la hora real del check-in
// o la que ya tenía) ya cae en ese día, se respeta; si no, la hora típica del momento, nunca en
// el futuro.
export function fechaForCheckIn(day: string, moment: DayMoment, keep: string, now = new Date()): string {
  if (checkInDayKey({ fecha: keep, moment }) === day) return keep;
  const at = new Date(`${day}T${String(MOMENT_HOUR[moment]).padStart(2, '0')}:00:00`);
  return (at.getTime() > now.getTime() ? now : at).toISOString();
}

// Días que se ofrecen al apuntar o mover un check-in: el día al que contaría ahora y los dos
// anteriores (y el suyo, si es más antiguo).
export function checkInDayOptions(moment: DayMoment, now = new Date(), current?: string): string[] {
  const base = checkInDayKey({ fecha: now.toISOString(), moment });
  const out = [base, shiftDay(base, -1), shiftDay(base, -2)];
  if (current && !out.includes(current) && current < base) out.push(current);
  return out;
}

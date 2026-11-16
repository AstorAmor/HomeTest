// Etiquetas del check-in («¿Algo más?», 2026-11-16): cosas que se marcan con un toque para que quede
// registro (dolor de cabeza, hinchazón…). No se interpretan ni avisan de nada: solo se guardan con el
// check-in. Sin migración: en metric_readings con kind 'checkin_tag', una fila por etiqueta con id
// 'ctag:<check-in>:<etiqueta>', valor 1 y la fecha del check-in (src/data/checkInTagRepository.ts).

export type CheckInTagId = 'headache' | 'tired' | 'bloated' | 'sore' | 'nervous' | 'focus' | 'cold' | 'period';

export interface CheckInTag {
  id: CheckInTagId;
  label: string; // se traduce con t()
  // Solo a quien no ha dicho que es hombre
  notMale?: boolean;
}

export const CHECKIN_TAGS: CheckInTag[] = [
  { id: 'headache', label: 'Headache' },
  { id: 'tired', label: 'Tired' },
  { id: 'bloated', label: 'Bloated' },
  { id: 'sore', label: 'Sore muscles' },
  { id: 'nervous', label: 'On edge' },
  { id: 'focus', label: 'Hard to focus' },
  { id: 'cold', label: 'Cold or flu' },
  { id: 'period', label: 'Period pain', notMale: true },
];

const KNOWN = new Set<string>(CHECKIN_TAGS.map((x) => x.id));

export const tagsFor = (sex?: string | null) => CHECKIN_TAGS.filter((x) => !(x.notMale && sex === 'male'));

export const tagEntryId = (checkInId: string, tag: string) => `ctag:${checkInId}:${tag}`;

// 'ctag:<check-in>:<etiqueta>' → sus partes (la etiqueta va detrás de los últimos dos puntos)
export function parseTagEntryId(id: string): { checkInId: string; tag: CheckInTagId } | null {
  if (!id.startsWith('ctag:')) return null;
  const rest = id.slice(5);
  const cut = rest.lastIndexOf(':');
  if (cut <= 0) return null;
  const tag = rest.slice(cut + 1);
  if (!KNOWN.has(tag)) return null;
  return { checkInId: rest.slice(0, cut), tag: tag as CheckInTagId };
}

// Qué filas hay que borrar y cuáles añadir para que un check-in tenga justo `wanted`
export function tagChanges(checkInId: string, existingIds: string[], wanted: string[]): { remove: string[]; add: string[] } {
  const mine = existingIds.filter((id) => parseTagEntryId(id)?.checkInId === checkInId);
  const want = new Set(wanted.filter((x) => KNOWN.has(x)).map((x) => tagEntryId(checkInId, x)));
  return {
    remove: mine.filter((id) => !want.has(id)),
    add: [...want].filter((id) => !mine.includes(id)),
  };
}

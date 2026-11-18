import { dateLocale, t } from '@/i18n';

// «Otro» al apuntar un entreno (fundador, 2026-11-17: «Cambia "deporte" por "Otro" y que aparezca un desplegable:
// baile, tenis, fútbol, baloncesto, béisbol… cosas que no sean "claramente" cardio o fuerza… que sean principalmente
// deportes de equipo o algo extraño (buceo…)»). El tipo del entreno sigue siendo 'sport', así los de antes se leen
// igual; el deporte va aparte, en `sport`: la clave de uno de esta lista o, con «Otro», el nombre que se escribió.
// El yoga y el pilates no están: van en Movilidad, que lo dice debajo de su nombre.
//
// Cómo se guarda, sin migración: sin cuenta (en el móvil), tal cual en la entrada. Con cuenta, la tabla `workouts` no
// tiene columna para el deporte, así que viaja dentro de `type`, que es texto libre: 'sport:tennis',
// 'sport:Petanca'. Al leer se vuelve a separar (workoutTypeFromRow), y una fila de antes ('sport') sale sin deporte.
// Lógica pura; la pantalla es src/screens/LogWorkoutScreen.tsx y el repositorio, src/data/planRepository.ts.

export const WORKOUT_SPORTS: { id: string; label: string }[] = [
  { id: 'dance', label: 'Dance' },
  { id: 'tennis', label: 'Tennis' },
  { id: 'padel', label: 'Padel' },
  { id: 'football', label: 'Football' },
  { id: 'basketball', label: 'Basketball' },
  { id: 'baseball', label: 'Baseball' },
  { id: 'volleyball', label: 'Volleyball' },
  { id: 'handball', label: 'Handball' },
  { id: 'rugby', label: 'Rugby' },
  { id: 'hockey', label: 'Hockey' },
  { id: 'golf', label: 'Golf' },
  { id: 'martial_arts', label: 'Martial arts' },
  { id: 'boxing', label: 'Boxing' },
  { id: 'climbing', label: 'Climbing' },
  { id: 'skiing', label: 'Skiing' },
  { id: 'snowboarding', label: 'Snowboarding' },
  { id: 'surfing', label: 'Surfing' },
  { id: 'skating', label: 'Skating' },
  { id: 'diving', label: 'Scuba diving' },
  { id: 'horse_riding', label: 'Horse riding' },
];

// «Otro» de la lista: el nombre lo escribe la persona. Solo vive en la pantalla; no se guarda nunca como deporte
export const OTHER_SPORT = 'other';
export const SPORT_NAME_MAX = 40;

// El nombre escrito: sin espacios de más y con un largo razonable
export const cleanSportName = (text: string) => text.replace(/\s+/g, ' ').trim().slice(0, SPORT_NAME_MAX);

// La lista del desplegable: por orden alfabético en el idioma de la app y «Otro» al final
export function sportOptions(): { id: string; label: string }[] {
  const list = WORKOUT_SPORTS.map((s) => ({ id: s.id, label: t(s.label) })).sort((a, b) => a.label.localeCompare(b.label, dateLocale()));
  return [...list, { id: OTHER_SPORT, label: t('Other') }];
}

// Lo que se guarda en `sport` con lo elegido en el desplegable (y, con «Otro», lo escrito): undefined si no hay nada
export function sportToSave(choice: string | null | undefined, typed = ''): string | undefined {
  if (!choice) return undefined;
  if (choice === OTHER_SPORT) return cleanSportName(typed) || undefined;
  return WORKOUT_SPORTS.some((s) => s.id === choice) ? choice : undefined;
}

// El nombre de un deporte guardado: el de la lista, traducido, o el que se escribió; null si no lo lleva
export function sportName(sport?: string | null): string | null {
  const s = cleanSportName(sport ?? '');
  if (!s || s === OTHER_SPORT) return null;
  const known = WORKOUT_SPORTS.find((x) => x.id === s);
  return known ? t(known.label) : s;
}

// Los cuatro tipos de entreno y su nombre. 'sport' es «Otro» desde el 2026-11-17 (antes, «Deporte»)
export const WORKOUT_TYPE_LABEL: Record<string, string> = { strength: 'Strength', cardio: 'Cardio', mobility: 'Mobility', sport: 'Other' };

// Cómo se llama un entreno apuntado en el historial, en el día y al exportar: su deporte si lo lleva («Tenis»); si
// no, su tipo («Fuerza», «Otro»)
export function workoutLabel(w: { type: string; sport?: string | null }): string {
  const name = w.type === 'sport' ? sportName(w.sport) : null;
  return name ?? t(WORKOUT_TYPE_LABEL[w.type] ?? w.type);
}

// ── La columna `type` de la tabla `workouts` ──

const SPORT_PREFIX = 'sport:';

// Lo que va a la columna: el tipo y, si es 'sport' con deporte, 'sport:<deporte>'
export function workoutTypeToRow(type: string, sport?: string | null): string {
  const s = type === 'sport' ? cleanSportName(sport ?? '') : '';
  return s && s !== OTHER_SPORT ? `${SPORT_PREFIX}${s}` : type;
}

// Lo que se lee de la columna: 'sport:tennis' → { type: 'sport', sport: 'tennis' }; lo demás, tal cual
export function workoutTypeFromRow(raw: unknown): { type: string; sport?: string } {
  const text = typeof raw === 'string' ? raw : '';
  if (!text.startsWith(SPORT_PREFIX)) return { type: text };
  const sport = cleanSportName(text.slice(SPORT_PREFIX.length));
  return sport && sport !== OTHER_SPORT ? { type: 'sport', sport } : { type: 'sport' };
}

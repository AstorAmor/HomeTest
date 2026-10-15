import { t } from '@/i18n';
import { PHONE_SOURCE } from './sources';

// Nombre visible de las fuentes de un dato ("Fitbit + This phone" → "Fitbit y este móvil").
// Los nombres se guardan en inglés (texto fuente) y se traducen al enseñarlos. Suelto, empieza en
// mayúscula ("Este móvil"); dentro de una frase ("De {source}"), capitalize = false. Las marcas
// conservan su mayúscula; "este móvil" va en minúscula salvo al principio.
export function sourceLabel(sources: string[] | string, capitalize = true): string {
  const raw = (Array.isArray(sources) ? sources : sources.split(' + ')).filter(Boolean);
  const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
  const list = raw.map((s, i) => (s === PHONE_SOURCE && (i > 0 || !capitalize) ? lowerFirst(t(s)) : t(s)));
  const out =
    list.length === 0
      ? t('your wearable')
      : list.length === 1
        ? list[0]
        : `${list.slice(0, -1).join(', ')} ${t('and')} ${list[list.length - 1]}`;
  return capitalize ? out.charAt(0).toUpperCase() + out.slice(1) : out;
}

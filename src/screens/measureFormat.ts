// Textos de las medidas del cuerpo que comparten Peso → Medidas y su evolución: el cambio con su signo, sin
// colores también cuando sube («−1,5 cm», «+0,5 cm», «Sin cambios desde el 3 oct.»)
import { dateLocale, num, t } from '@/i18n';
import type { BodyBasics } from '@/logic/bodyComposition';

export const shortDay = (iso: string) => new Date(iso).toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short' });

export const signed = (delta: number, unit?: string, decimals = 1) => {
  const v = num(Number(Math.abs(delta).toFixed(decimals)));
  return `${delta > 0 ? '+' : delta < 0 ? '−' : ''}${v}${unit ? ` ${unit}` : ''}`;
};

// «−1,5 cm desde el 3 oct.» o «Sin cambios desde el 3 oct.»
export const changeSince = (delta: number, fromIso: string, unit?: string, decimals = 1) => {
  const date = shortDay(fromIso);
  return delta === 0 ? t('No change since {date}', { date }) : t('{delta} since {date}', { delta: signed(delta, unit, decimals), date });
};

// En la demo y en las cuentas de prueba, con el perfil a medias, las cuentas salen con una altura o una persona de
// ejemplo (src/data/bodyBasics.ts): se dice en una línea apagada. `uses`: lo que entra en la cuenta que se enseña
// (la persona, en las estimaciones de grasa; la altura, en cintura / altura y en la grasa con la cinta)
export const sampleBasicsNote = (
  basics: Pick<BodyBasics, 'sampleHeight' | 'samplePerson' | 'heightCm' | 'age'> | null | undefined,
  uses: { person?: boolean; height?: boolean },
): string | null => {
  if (!basics) return null;
  const height = !!uses.height && basics.sampleHeight;
  if (uses.person && basics.samplePerson) {
    const who = [t('a {age}-year-old man', { age: basics.age ?? '' }), height ? `${basics.heightCm} cm` : ''].filter(Boolean).join(', ');
    return t('With sample details ({who}). Add yours in your profile.', { who });
  }
  return height ? t('With a sample height ({h} cm). Add yours in your profile.', { h: basics.heightCm ?? '' }) : null;
};

// De qué medidas de cinta sale la grasa estimada, para la frase de debajo (en mujeres, también la cadera)
export const tapeFatNote = (sex: string | undefined) =>
  sex === 'female'
    ? t('Estimate from your neck, waist, hips and height; compare it between measurements taken the same way.')
    : t('Estimate from your neck, waist and height; compare it between measurements taken the same way.');

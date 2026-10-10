import AsyncStorage from '@react-native-async-storage/async-storage';
import { es } from './es';

// Idiomas de la app. El texto fuente es el inglés: t('Today') devuelve la traducción del idioma
// elegido o, si aún no la hay, el inglés. Así se traduce pantalla a pantalla sin romper nada.
// El idioma se carga al arrancar (index.js), antes que las pantallas, igual que el tema: cambiarlo
// recarga la app con un fundido y vuelve a la misma pantalla.
// Español (España) es el idioma prioritario: redacción nativa, nunca traducción literal.

export type Lang = 'en' | 'es' | 'fr' | 'it' | 'de';

export const LANGUAGES: { id: Lang; name: string; ready: boolean }[] = [
  { id: 'en', name: 'English', ready: true },
  { id: 'es', name: 'Español (España)', ready: true },
  { id: 'fr', name: 'Français', ready: false },
  { id: 'it', name: 'Italiano', ready: false },
  { id: 'de', name: 'Deutsch', ready: false },
];

const KEY = 'language.v1';
const DICTS: Partial<Record<Lang, Record<string, string>>> = { es };

let current: Lang = 'en';

export const getLang = () => current;

// Para fechas y números: "9 Oct" / "9 oct"
export const dateLocale = () => (current === 'es' ? 'es-ES' : current === 'fr' ? 'fr-FR' : current === 'it' ? 'it-IT' : current === 'de' ? 'de-DE' : 'en-GB');

export function t(text: string, vars?: Record<string, string | number>): string {
  const out = DICTS[current]?.[text] ?? text;
  return vars ? out.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m)) : out;
}

// Plural sencillo: tn(n, '{n} day', '{n} days')
// Número con la coma decimal del idioma (2.23 → 2,23 en español); deja el resto tal cual.
export const num = (v: number | string | null | undefined): string =>
  v === null || v === undefined ? '' : current === 'en' ? String(v) : String(v).replace(/^(-?\d+)\.(\d+)$/, '$1,$2');

export const tn = (n: number, one: string, many: string) => t(n === 1 ? one : many, { n });

function deviceLang(): Lang {
  try {
    const loc = (Intl.DateTimeFormat().resolvedOptions().locale || 'en').toLowerCase();
    return loc.startsWith('es') ? 'es' : 'en';
  } catch {
    return 'en';
  }
}

export async function loadLanguage(): Promise<Lang> {
  try {
    const v = (await AsyncStorage.getItem(KEY)) as Lang | null;
    current = v && LANGUAGES.some((l) => l.id === v && l.ready) ? v : deviceLang();
  } catch {
    current = deviceLang();
  }
  return current;
}

export async function saveLanguage(lang: Lang) {
  await AsyncStorage.setItem(KEY, lang);
}

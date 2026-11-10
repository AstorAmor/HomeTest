// Idioma del móvil → idioma de la app (2026-11-10). Lógica pura, con tests (locale.test.ts).
//
// Antes solo se miraba Intl, y en algún Android llegaba «en-US» aunque el móvil estuviera en español: la app
// arrancaba en inglés (Astor, al registrarse en «Kuova Pruebas»). Ahora se prueban varias fuentes en orden
// (la del sistema primero) y la primera que se reconoce manda. Catalán, gallego y euskera van a español:
// en España, mejor español que inglés. El resto, inglés. Además, la primera pantalla deja elegirlo.

export type AppLang = 'en' | 'es';

export function langFromLocale(locale: string | null | undefined): AppLang | null {
  const l = (locale ?? '').trim().toLowerCase().replace(/_/g, '-');
  if (!l) return null;
  if (/^(es|ca|gl|eu)(-|$)/.test(l)) return 'es';
  if (/^en(-|$)/.test(l)) return 'en';
  return null;
}

// La primera fuente con un idioma que la app tiene; si ninguna, inglés
export function pickDeviceLang(candidates: (string | null | undefined)[]): AppLang {
  for (const c of candidates) {
    const lang = langFromLocale(c);
    if (lang) return lang;
  }
  return 'en';
}

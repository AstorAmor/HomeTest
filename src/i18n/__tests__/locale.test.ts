import { describe, expect, it } from 'vitest';
import { langFromLocale, pickDeviceLang } from '@/i18n/locale';

describe('idioma del móvil', () => {
  it('reconoce el español con cualquier formato', () => {
    for (const l of ['es', 'es-ES', 'es_ES', 'ES-es', 'es-419', 'es-MX']) expect(langFromLocale(l)).toBe('es');
  });

  it('catalán, gallego y euskera van a español', () => {
    expect(langFromLocale('ca-ES')).toBe('es');
    expect(langFromLocale('gl_ES')).toBe('es');
    expect(langFromLocale('eu')).toBe('es');
  });

  it('inglés, y nada para lo que no reconoce', () => {
    expect(langFromLocale('en-GB')).toBe('en');
    expect(langFromLocale('fr-FR')).toBeNull();
    expect(langFromLocale('')).toBeNull();
    expect(langFromLocale(undefined)).toBeNull();
    expect(langFromLocale('esperanto')).toBeNull();
  });

  it('manda la primera fuente reconocida: el sistema antes que Intl', () => {
    expect(pickDeviceLang(['es_ES', 'en-US'])).toBe('es');
    expect(pickDeviceLang([null, 'es-ES'])).toBe('es');
    expect(pickDeviceLang(['fr_FR', 'en-US'])).toBe('en');
    expect(pickDeviceLang([undefined, null])).toBe('en');
  });
});

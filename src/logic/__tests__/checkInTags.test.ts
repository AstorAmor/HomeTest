import { describe, expect, it } from 'vitest';
import { CHECKIN_TAGS, parseTagEntryId, tagChanges, tagEntryId, tagsFor } from '@/logic/checkInTags';
import { es } from '@/i18n/es';

describe('Etiquetas del check-in', () => {
  it('el id de la fila lleva el check-in y la etiqueta, y se vuelve a leer', () => {
    expect(tagEntryId('checkin-1731', 'headache')).toBe('ctag:checkin-1731:headache');
    expect(parseTagEntryId('ctag:checkin-1731:headache')).toEqual({ checkInId: 'checkin-1731', tag: 'headache' });
    // Un id de check-in con guiones (uuid) también
    expect(parseTagEntryId('ctag:3f2a-9c:cold')).toEqual({ checkInId: '3f2a-9c', tag: 'cold' });
  });

  it('ignora lo que no es una etiqueta conocida', () => {
    expect(parseTagEntryId('meta:steps:2026-11-16')).toBeNull();
    expect(parseTagEntryId('ctag:checkin-1:whatever')).toBeNull();
    expect(parseTagEntryId('ctag::cold')).toBeNull();
  });

  it('calcula qué borrar y qué añadir, sin tocar otros check-ins', () => {
    const existing = ['ctag:a:headache', 'ctag:a:tired', 'ctag:b:headache'];
    expect(tagChanges('a', existing, ['tired', 'cold'])).toEqual({ remove: ['ctag:a:headache'], add: ['ctag:a:cold'] });
    expect(tagChanges('a', existing, [])).toEqual({ remove: ['ctag:a:headache', 'ctag:a:tired'], add: [] });
    expect(tagChanges('c', existing, ['nope', 'sore'])).toEqual({ remove: [], add: ['ctag:c:sore'] });
  });

  it('el dolor de regla no se ofrece a quien ha dicho que es hombre', () => {
    expect(tagsFor('male').some((x) => x.id === 'period')).toBe(false);
    expect(tagsFor('female').some((x) => x.id === 'period')).toBe(true);
    expect(tagsFor(null).some((x) => x.id === 'period')).toBe(true);
  });

  it('todas tienen su traducción', () => {
    const missing = CHECKIN_TAGS.map((x) => x.label).filter((l) => !(l in es));
    expect(missing).toEqual([]);
  });
});

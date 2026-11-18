import { describe, expect, it } from 'vitest';
import { isStale, STALE_DAYS } from '@/logic/labMarkers';

// El aviso de «caducidad» de un valor de análisis (fundador, 2026-11-18: «máximo 1 año»)
describe('isStale', () => {
  const today = new Date('2026-11-18T10:00:00');

  it('un valor de hace menos de un año no está caducado', () => {
    expect(isStale('2026-09-25', today)).toBe(false);
    expect(isStale('2025-11-20', today)).toBe(false);
  });

  it('un valor de hace más de un año sí', () => {
    expect(isStale('2025-11-16', today)).toBe(true);
    expect(isStale('2024-03-01T08:00:00Z', today)).toBe(true);
  });

  it('una fecha que no se entiende no avisa', () => {
    expect(isStale('', today)).toBe(false);
    expect(isStale('sin fecha', today)).toBe(false);
  });

  it('el límite es un año', () => {
    expect(STALE_DAYS).toBe(365);
  });
});

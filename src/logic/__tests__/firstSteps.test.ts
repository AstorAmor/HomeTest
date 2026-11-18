import { describe, expect, it } from 'vitest';
import { isNewAccount, needsFirstSteps } from '@/logic/firstSteps';

describe('primeros pasos de una cuenta nueva', () => {
  it('solo cuentas creadas desde que existe el recorrido', () => {
    expect(isNewAccount('2026-11-17T16:05:12.123456Z')).toBe(true);
    expect(isNewAccount('2026-11-10T09:00:00Z')).toBe(false);
    expect(isNewAccount(undefined)).toBe(false);
    expect(isNewAccount('no es una fecha')).toBe(false);
  });

  it('cuenta nueva sin el cuestionario hecho: le toca', () => {
    expect(needsFirstSteps('2026-11-18T10:00:00Z', undefined, undefined)).toBe(true);
  });

  it('con el cuestionario hecho o saltado, ya no', () => {
    expect(needsFirstSteps('2026-11-18T10:00:00Z', '2026-11-18T10:20:00Z', undefined)).toBe(false);
    expect(needsFirstSteps('2026-11-18T10:00:00Z', undefined, 'skipped')).toBe(false);
  });

  it('una cuenta de antes nunca se ve obligada', () => {
    expect(needsFirstSteps('2026-11-10T09:00:00Z', undefined, undefined)).toBe(false);
  });
});

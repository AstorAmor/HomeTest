import { describe, expect, it } from 'vitest';
import { AFTER_MS, remainingWait } from '@/data/permissionsGate';

describe('«Before we start» va primero', () => {
  it('mientras no se sabe o está abierto, los avisos esperan', () => {
    expect(remainingWait('unknown', 0, 1000)).toBeNull();
    expect(remainingWait('open', 0, 1000)).toBeNull();
  });

  it('recién cerrado, esperan un rato más', () => {
    const closed = 10_000;
    expect(remainingWait('done', closed, closed)).toBe(AFTER_MS);
    expect(remainingWait('done', closed, closed + 500)).toBe(AFTER_MS - 500);
    expect(remainingWait('done', closed, closed + AFTER_MS + 1)).toBe(0);
  });

  it('si no hacía falta (ya visto, web, profesional), salen ya', () => {
    expect(remainingWait('done', 0, 123_456)).toBe(0);
  });
});

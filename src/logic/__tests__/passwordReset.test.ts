import { describe, expect, it, vi } from 'vitest';

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: { getItem: async () => null, setItem: async () => undefined, removeItem: async () => undefined },
}));

const { RESET_PENDING_MS, isResetPending } = await import('@/data/passwordReset');

describe('«Elige una contraseña nueva» sigue pendiente', () => {
  const now = Date.parse('2026-11-11T12:00:00Z');

  it('recién pedido, sí', () => {
    expect(isResetPending('2026-11-11T11:59:00Z', now)).toBe(true);
  });

  it('pasado un día, ya no', () => {
    expect(isResetPending(new Date(now - RESET_PENDING_MS - 1).toISOString(), now)).toBe(false);
  });

  it('sin dato o con un dato roto, no', () => {
    expect(isResetPending(null, now)).toBe(false);
    expect(isResetPending('', now)).toBe(false);
    expect(isResetPending('ayer', now)).toBe(false);
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';

const store = new Map<string, string>();
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async (k: string) => store.get(k) ?? null,
    setItem: async (k: string, v: string) => void store.set(k, v),
  },
}));
vi.mock('react-native', () => ({ Platform: { OS: 'android' } }));
vi.mock('@/lib/supabase', () => ({ getCurrentUserId: () => null, isRemoteActive: () => false, supabase: null }));
vi.mock('@/data/dataMode', () => ({ showSamples: () => false }));

import { onlyOneActive, programRepository } from '@/data/workouts/programRepository';
import type { WorkoutProgram } from '@/data/workouts/types';

const prog = (id: string, active: boolean, createdAt: string) => ({ id, active, createdAt, title: id, sessions: [], completions: [] }) as unknown as WorkoutProgram;

describe('Programas de entrenamiento: se sigue uno', () => {
  beforeEach(() => store.clear());

  it('si llegan dos marcados, el segundo sale para poder seguirlo', () => {
    const out = onlyOneActive([prog('pro', true, '2026-10-21'), prog('mio', true, '2026-10-20'), prog('viejo', false, '2026-10-19')]);
    expect(out.map((p) => p.active)).toEqual([true, false, false]);
  });

  it('«Seguir este programa» en uno anterior lo deja como el tuyo y el otro pasa a la lista', async () => {
    store.set('workouts.programs.v1', JSON.stringify([prog('nuevo', true, '2026-10-22'), prog('anterior', false, '2026-10-20')]));
    await programRepository.setActive('anterior');
    const list = await programRepository.list();
    expect(list.map((p) => [p.id, p.active])).toEqual([
      ['anterior', true],
      ['nuevo', false],
    ]);
  });
});

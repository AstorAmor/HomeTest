import { beforeEach, describe, expect, it, vi } from 'vitest';

// La caché de lecturas de la cuenta (src/data/readCache.ts; fundador, 2026-11-17: «las medidas tardan en cargar»):
// por usuario, compartiendo lo que ya va en camino, corregida tras guardar y guardada en el móvil para pintar al abrir.

const store = vi.hoisted(() => new Map<string, string>());
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async (k: string) => store.get(k) ?? null,
    setItem: async (k: string, v: string) => void store.set(k, v),
    removeItem: async (k: string) => void store.delete(k),
    getAllKeys: async () => [...store.keys()],
    multiGet: async (ks: string[]) => ks.map((k) => [k, store.get(k) ?? null]),
    multiSet: async (pairs: [string, string][]) => pairs.forEach(([k, v]) => store.set(k, v)),
    multiRemove: async (ks: string[]) => ks.forEach((k) => store.delete(k)),
  },
}));
const auth = vi.hoisted(() => ({ uid: 'u1' as string | null }));
vi.mock('@/lib/supabase', () => ({ getCurrentUserId: () => auth.uid, isRemoteActive: () => !!auth.uid }));

const { readCache, CACHE_PREFIX } = await import('../readCache');

// Una lectura de red de mentira que se resuelve cuando se le dice
function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

beforeEach(async () => {
  auth.uid = 'u1';
  await readCache.clear();
  store.clear();
});

describe('caché de lecturas', () => {
  it('sin cuenta (demo) no guarda nada: siempre lee y no hay nada que pintar', async () => {
    auth.uid = null;
    const fetcher = vi.fn(async () => [1]);
    await readCache.load('k', fetcher);
    await readCache.load('k', fetcher);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(readCache.peek('k')).toBeUndefined();
  });

  it('dos lecturas a la vez de lo mismo son una sola petición', async () => {
    const net = deferred<number[]>();
    const fetcher = vi.fn(() => net.promise);
    const a = readCache.load('weight', fetcher);
    const b = readCache.load('weight', fetcher);
    net.resolve([80]);
    expect(await a).toEqual([80]);
    expect(await b).toEqual([80]);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('la lectura normal siempre vuelve a la red; lo último leído queda para pintar', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce([80]).mockResolvedValueOnce([79]);
    await readCache.load('weight', fetcher);
    expect(readCache.peek('weight')).toEqual([80]);
    expect(await readCache.load('weight', fetcher)).toEqual([79]);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(readCache.peek('weight')).toEqual([79]);
  });

  it('va por usuario: lo de una cuenta no se ve con otra', async () => {
    await readCache.load('weight', async () => [80]);
    auth.uid = 'u2';
    expect(readCache.peek('weight')).toBeUndefined();
    await readCache.load('weight', async () => [55]);
    expect(readCache.peek('weight')).toEqual([55]);
    auth.uid = 'u1';
    expect(readCache.peek('weight')).toEqual([80]);
  });

  it('tras guardar: se corrige lo de memoria y la siguiente lectura no se une a una que empezó antes', async () => {
    await readCache.load('weight', async () => [{ id: 'a', v: 80 }]);
    // Una lectura empieza, y antes de que llegue se guarda una pesada nueva
    const old = deferred<{ id: string; v: number }[]>();
    const before = readCache.load('weight', () => old.promise);
    readCache.invalidate<{ id: string; v: number }[]>('weight', (prev) => [{ id: 'b', v: 79 }, ...prev]);
    expect(readCache.peek('weight')).toEqual([{ id: 'b', v: 79 }, { id: 'a', v: 80 }]);
    // La de después va a la red aunque la de antes siga en camino
    const fresh = vi.fn(async () => [{ id: 'b', v: 79 }, { id: 'a', v: 80 }]);
    await readCache.load('weight', fresh);
    expect(fresh).toHaveBeenCalledTimes(1);
    // La de antes llega tarde, sin la pesada nueva: no pisa lo último
    old.resolve([{ id: 'a', v: 80 }]);
    await before;
    expect(readCache.peek('weight')).toEqual([{ id: 'b', v: 79 }, { id: 'a', v: 80 }]);
  });

  it('una lectura que llega después de cambiar de usuario no se guarda en el nuevo', async () => {
    const net = deferred<number[]>();
    const p = readCache.load('weight', () => net.promise);
    auth.uid = 'u2';
    net.resolve([80]);
    await p;
    expect(readCache.peek('weight')).toBeUndefined();
  });

  it('lo marcado `persist` se guarda en el móvil por usuario y vuelve al abrir la app', async () => {
    await readCache.load('weight', async () => [80], { persist: true });
    await readCache.load('steps', async () => [1000]); // sin persist: solo en memoria
    await readCache.flushNow();
    expect(store.get(`${CACHE_PREFIX}u1:weight`)).toBe('[80]');
    expect(store.has(`${CACHE_PREFIX}u1:steps`)).toBe(false);

    // Otra sesión de la app: la memoria empieza vacía y se recupera lo del móvil
    vi.resetModules();
    const fresh = (await import('../readCache')).readCache;
    expect(fresh.peek('weight')).toBeUndefined();
    await fresh.hydrate('u1');
    expect(fresh.peek('weight')).toEqual([80]);
    // Lo de otro usuario no se recupera
    auth.uid = 'u2';
    expect(fresh.peek('weight')).toBeUndefined();
  });

  it('recuperar del móvil no pisa lo que ya llegó de la red', async () => {
    store.set(`${CACHE_PREFIX}u1:weight`, '[70]');
    vi.resetModules();
    const fresh = (await import('../readCache')).readCache;
    await fresh.load('weight', async () => [80], { persist: true });
    await fresh.hydrate('u1');
    expect(fresh.peek('weight')).toEqual([80]);
  });

  it('al cerrar sesión se borra todo, de memoria y del móvil', async () => {
    await readCache.load('weight', async () => [80], { persist: true });
    await readCache.flushNow();
    store.set('hometest:symptom_entries', '[]'); // lo que no es de la caché se queda
    await readCache.clear();
    expect(readCache.peek('weight')).toBeUndefined();
    expect([...store.keys()]).toEqual(['hometest:symptom_entries']);
  });

  it('una corrección tras guardar también llega al móvil', async () => {
    await readCache.load('bp', async () => [1], { persist: true });
    readCache.invalidate<number[]>('bp', (prev) => [2, ...prev]);
    await readCache.flushNow();
    expect(store.get(`${CACHE_PREFIX}u1:bp`)).toBe('[2,1]');
  });
});

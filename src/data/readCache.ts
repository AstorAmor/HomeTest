import AsyncStorage from '@react-native-async-storage/async-storage';
import { getCurrentUserId, isRemoteActive } from '@/lib/supabase';

// Caché de lo que se lee de la cuenta (fundador, 2026-11-17: «las medidas tardan en cargar. ¿Se puede agilizar?»).
//
// 1. Una lectura que ya va en camino se comparte: si Hoy, los avisos y las metas piden la misma tabla a la vez, sale
//    una sola petición. Importa porque Android no manda más de 5 peticiones a la vez al mismo servidor: las demás
//    esperan turno, y Hoy pedía unas 45 al abrirse.
// 2. Lo último leído de cada cosa queda en memoria (peek), para que una pantalla pinte al momento lo que ya se vio
//    (de Mediciones a la ficha del peso) mientras lo refresca de la red. La lectura normal (load) SIEMPRE vuelve a
//    preguntar a Supabase: la caché nunca sirve como dato fresco, solo para pintar antes.
// 3. Lo marcado `persist` se guarda además en el móvil, para que al abrir la app se pinte sin esperar a la red
//    (como otros datos de salud que ya viven en AsyncStorage, p. ej. hometest:symptom_entries).
//
// Todo va por usuario (la clave lleva su id) y se borra al cerrar sesión (AuthContext). Sin cuenta (demo) no se usa:
// ahí los datos ya están en el móvil.

export const CACHE_PREFIX = 'hometest:cache:v1:';
// Android no lee de AsyncStorage filas de más de 2 MB: lo que pase de esto no se guarda en el móvil (sí en memoria)
const MAX_PERSIST_CHARS = 1_500_000;
// Las escrituras en el móvil se agrupan y van detrás, para no frenar el pintado
const FLUSH_MS = 400;

interface Slot {
  has: boolean;
  value: unknown;
  gen: number; // sube con cada cambio: una lectura que empezó antes ya no se guarda como la última
  inflight?: Promise<unknown>;
  persist: boolean;
  saved?: string; // lo último escrito en el móvil (para no reescribir lo mismo)
}

const slots = new Map<string, Slot>();
const dirty = new Set<string>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let version = 0;
let hydration: { uid: string; done: Promise<void> } | null = null;
let epochs = 0; // sube al recuperar otra cuenta o al cerrar sesión: lo que se estaba recuperando ya no vale

const slotId = (uid: string, key: string) => `${uid}|${key}`;
const storageKey = (uid: string, key: string) => `${CACHE_PREFIX}${uid}:${key}`;

// El usuario con cuenta, si la caché se usa; null en la demo
const cacheUser = () => (isRemoteActive() ? getCurrentUserId() : null);

function slotFor(uid: string, key: string, persist: boolean): Slot {
  const id = slotId(uid, key);
  let s = slots.get(id);
  if (!s) {
    s = { has: false, value: undefined, gen: 0, persist };
    slots.set(id, s);
  } else if (persist) s.persist = true;
  return s;
}

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flush();
  }, FLUSH_MS);
}

async function flush() {
  const uid = cacheUser();
  const writes: [string, string][] = [];
  const removes: string[] = [];
  for (const id of dirty) {
    const sep = id.indexOf('|');
    const owner = id.slice(0, sep);
    const key = id.slice(sep + 1);
    const s = slots.get(id);
    // De otro usuario (ya cerró sesión): no se escribe nada suyo
    if (!s || owner !== uid) continue;
    if (!s.has) {
      removes.push(storageKey(owner, key));
      s.saved = undefined;
      continue;
    }
    let text: string;
    try {
      text = JSON.stringify(s.value);
    } catch {
      continue;
    }
    if (text === s.saved) continue;
    if (text.length > MAX_PERSIST_CHARS) {
      removes.push(storageKey(owner, key));
      s.saved = undefined;
      continue;
    }
    s.saved = text;
    writes.push([storageKey(owner, key), text]);
  }
  dirty.clear();
  try {
    if (writes.length) await AsyncStorage.multiSet(writes);
    if (removes.length) await AsyncStorage.multiRemove(removes);
  } catch {
    // sin almacenamiento en el móvil: la memoria y la red siguen sirviendo
  }
}

function put(uid: string, key: string, s: Slot, value: unknown) {
  s.value = value;
  s.has = true;
  version++;
  if (s.persist) {
    dirty.add(slotId(uid, key));
    scheduleFlush();
  }
}

export const readCache = {
  // Lo último leído de `key` para el usuario actual (en memoria o recuperado del móvil), o undefined si no hay
  // nada o no hay cuenta. NO es un dato fresco: solo sirve para pintar mientras llega el de la red.
  peek<T>(key: string): T | undefined {
    const uid = cacheUser();
    if (!uid) return undefined;
    const s = slots.get(slotId(uid, key));
    return s?.has ? (s.value as T) : undefined;
  },

  // Lee de la red con `fetcher` (siempre) y guarda el resultado como lo último leído. Si ya hay una lectura de
  // `key` en camino, devuelve esa misma en vez de lanzar otra. Quien la use no debe modificar lo que recibe
  // (los repositorios devuelven una copia).
  load<T>(key: string, fetcher: () => Promise<T>, opts?: { persist?: boolean }): Promise<T> {
    const uid = cacheUser();
    if (!uid) return fetcher();
    const s = slotFor(uid, key, !!opts?.persist);
    if (s.inflight) return s.inflight as Promise<T>;
    const gen = s.gen;
    const p = fetcher().then((v) => {
      // Si mientras tanto se guardó algo (gen) o cambió el usuario, esta lectura ya no es la última
      if (s.gen === gen && slots.get(slotId(uid, key)) === s && cacheUser() === uid) put(uid, key, s, v);
      return v;
    });
    s.inflight = p;
    const done = () => {
      if (s.inflight === p) s.inflight = undefined;
    };
    p.then(done, done);
    return p;
  },

  // Tras guardar algo de `key`: la siguiente lectura vuelve a la red (no se une a una que empezó antes) y, si se
  // sabe cómo, lo de memoria se corrige ya (`patch`), para que al volver a la pantalla se vea al momento.
  invalidate<T>(key: string, patch?: (prev: T) => T): void {
    const uid = cacheUser();
    if (!uid) return;
    const s = slots.get(slotId(uid, key));
    if (!s) return;
    s.gen++;
    s.inflight = undefined;
    if (patch && s.has) put(uid, key, s, patch(s.value as T));
  },

  // Fija lo último leído (p. ej. el perfil recién guardado), como si acabara de llegar de la red
  set<T>(key: string, value: T, opts?: { persist?: boolean }): void {
    const uid = cacheUser();
    if (!uid) return;
    const s = slotFor(uid, key, !!opts?.persist);
    s.gen++;
    s.inflight = undefined;
    put(uid, key, s, value);
  },

  // Sube con cada cambio de lo guardado: para memorizar lo que se calcula a partir de varias cosas
  version(): number {
    return version;
  },

  // Recupera lo guardado en el móvil para este usuario (al iniciar sesión, antes de pintar la primera pantalla).
  // No pisa lo que ya haya en memoria, que es más reciente.
  hydrate(uid: string): Promise<void> {
    if (hydration?.uid === uid) return hydration.done;
    const prefix = `${CACHE_PREFIX}${uid}:`;
    const epoch = ++epochs;
    const done = (async () => {
      try {
        const keys = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith(prefix));
        if (!keys.length) return;
        const pairs = await AsyncStorage.multiGet(keys);
        // Si mientras tanto se cerró sesión (clear) o entró otra cuenta, no se recupera nada
        if (epoch !== epochs) return;
        for (const [k, text] of pairs) {
          if (text == null) continue;
          const key = k.slice(prefix.length);
          const s = slotFor(uid, key, true);
          if (s.has) continue;
          try {
            s.value = JSON.parse(text);
          } catch {
            continue;
          }
          s.has = true;
          s.saved = text;
          version++;
        }
      } catch {
        // sin almacenamiento: se pinta cuando llegue la red, como antes
      }
    })();
    hydration = { uid, done };
    return done;
  },

  // Al cerrar sesión: fuera todo, de memoria y del móvil (de cualquier usuario)
  async clear(): Promise<void> {
    slots.clear();
    dirty.clear();
    if (flushTimer) clearTimeout(flushTimer);
    flushTimer = null;
    hydration = null;
    epochs++;
    version++;
    try {
      const keys = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith(CACHE_PREFIX));
      if (keys.length) await AsyncStorage.multiRemove(keys);
    } catch {
      // nada que borrar
    }
  },

  // Escribe ya lo pendiente en el móvil (tests y antes de cerrar algo a propósito)
  flushNow(): Promise<void> {
    if (flushTimer) clearTimeout(flushTimer);
    flushTimer = null;
    return flush();
  },
};

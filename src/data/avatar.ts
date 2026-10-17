import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getCurrentUserId, isRemoteActive, supabase } from '@/lib/supabase';
import { compressPhoto } from '@/utils/imageUpload';
import { userFlags } from './userFlags';
import { t } from '@/i18n';

// Foto de perfil del paciente (Mi perfil → tocar la foto). Se reduce a 400 px (JPEG) y se sube al
// bucket privado 'avatars' como <user_id>/avatar-<hora>.jpg: un nombre nuevo cada vez, para que
// ninguna caché enseñe la anterior. La ruta va en user_flags 'avatar_path'. Para pintarla, una URL
// firmada de 7 días que se guarda en el móvil. Sin cuenta (demo), la foto se queda en el móvil.

const FLAG = 'avatar_path';
const WEEK_S = 7 * 24 * 3600;
const cacheKey = () => `avatar.v1:${getCurrentUserId() ?? 'demo'}`;

interface Cached {
  path?: string;
  uri: string;
  until?: number;
}

// La misma foto en todas las pantallas (Today, Más, Mi perfil): al cambiarla se avisa a todas
let current: { user: string | null; uri: string | null } | null = null;
const listeners = new Set<(uri: string | null) => void>();
const publish = (uri: string | null) => {
  current = { user: getCurrentUserId(), uri };
  listeners.forEach((l) => l(uri));
};

async function signedUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase!.storage.from('avatars').createSignedUrl(path, WEEK_S);
  return error ? null : data.signedUrl;
}

async function remember(c: Cached) {
  await AsyncStorage.setItem(cacheKey(), JSON.stringify(c)).catch(() => undefined);
}

export async function loadAvatar(): Promise<string | null> {
  const raw = await AsyncStorage.getItem(cacheKey()).catch(() => null);
  const cached = raw ? (JSON.parse(raw) as Cached) : null;
  if (!isRemoteActive() || !supabase) return cached?.uri ?? null;
  const path = await userFlags.get(FLAG);
  if (typeof path !== 'string' || !path) return null;
  if (cached?.path === path && (cached.until ?? 0) > Date.now()) return cached.uri;
  const uri = await signedUrl(path);
  if (uri) await remember({ path, uri, until: Date.now() + (WEEK_S - 3600) * 1000 });
  return uri ?? cached?.uri ?? null;
}

export async function setAvatar(localUri: string): Promise<void> {
  const compressed = await compressPhoto(localUri, 400);
  if (!isRemoteActive() || !supabase) {
    await remember({ uri: compressed });
    publish(compressed);
    return;
  }
  const old = await userFlags.get(FLAG);
  const path = `${getCurrentUserId()}/avatar-${Date.now()}.jpg`;
  const bytes = await (await fetch(compressed)).arrayBuffer();
  const { error } = await supabase.storage.from('avatars').upload(path, bytes, { contentType: 'image/jpeg' });
  if (error) throw new Error(/bucket not found/i.test(error.message) ? t('Profile photos are not available yet.') : error.message);
  await userFlags.set(FLAG, path);
  if (typeof old === 'string' && old && old !== path) {
    supabase.storage.from('avatars').remove([old]).then(() => undefined, () => undefined);
  }
  const uri = (await signedUrl(path)) ?? compressed;
  await remember({ path, uri, until: Date.now() + (WEEK_S - 3600) * 1000 });
  publish(uri);
}

export async function removeAvatar(): Promise<void> {
  if (isRemoteActive() && supabase) {
    const old = await userFlags.get(FLAG);
    await userFlags.set(FLAG, '');
    if (typeof old === 'string' && old) await supabase.storage.from('avatars').remove([old]).then(() => undefined, () => undefined);
  }
  await AsyncStorage.removeItem(cacheKey()).catch(() => undefined);
  publish(null);
}

export function useAvatar(): string | null {
  const fresh = current && current.user === getCurrentUserId() ? current.uri : null;
  const [uri, setUri] = useState<string | null>(fresh);
  useEffect(() => {
    listeners.add(setUri);
    if (!current || current.user !== getCurrentUserId()) loadAvatar().then(publish, () => publish(null));
    else setUri(current.uri);
    return () => {
      listeners.delete(setUri);
    };
  }, []);
  return uri;
}

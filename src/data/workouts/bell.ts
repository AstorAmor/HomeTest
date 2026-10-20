import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Linking, Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { t } from '@/i18n';
import { loadNotifications, NotificationsModule, toPermission } from '@/data/phoneReminders';

// Timbre del entrenamiento: suena al acabar un descanso, un ejercicio por tiempo y a mitad de los que
// van por lado. Con la app delante suena con expo-audio (por el volumen multimedia y sin parar la
// música). Con la pantalla bloqueada o fuera de la app no corren los temporizadores de JS, así que al
// salir se programan avisos locales del móvil para cada final que quede, y al volver se quitan.
//
// Los tonos salen de scripts/workout-bells.py. En la app van como recursos de la actualización; en el
// aviso de la pantalla bloqueada tienen que estar dentro de la APK (res/raw, `sounds` del plugin de
// expo-notifications), y en Android el sonido es del canal y no se puede cambiar después: un canal
// por tono. Las APK anteriores a la 1.1.0 no los llevan: ahí el aviso usa el tono de avisos del móvil.

export type BellTone = 'campana' | 'cuenco' | 'toques' | 'pitido';

export const BELL_TONES: { id: BellTone; label: string; file: number }[] = [
  { id: 'campana', label: 'Bell', file: require('@/assets/sounds/kuova_campana.wav') },
  { id: 'cuenco', label: 'Singing bowl', file: require('@/assets/sounds/kuova_cuenco.wav') },
  { id: 'toques', label: 'Three chimes', file: require('@/assets/sounds/kuova_toques.wav') },
  { id: 'pitido', label: 'Beep', file: require('@/assets/sounds/kuova_pitido.wav') },
];

// --- Preferencias (de este móvil) ----------------------------------------------------------

export interface BellPrefs {
  on: boolean;
  tone: BellTone;
}

const PREFS_KEY = 'workoutBell.v1';
const DEFAULT_PREFS: BellPrefs = { on: true, tone: 'campana' };

async function readPrefs(): Promise<BellPrefs> {
  try {
    const raw = await AsyncStorage.getItem(PREFS_KEY);
    const p = raw ? (JSON.parse(raw) as Partial<BellPrefs>) : {};
    return { on: p.on ?? DEFAULT_PREFS.on, tone: BELL_TONES.some((x) => x.id === p.tone) ? (p.tone as BellTone) : DEFAULT_PREFS.tone };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function useBellPrefs(): [BellPrefs, (change: Partial<BellPrefs>) => void] {
  const [prefs, setPrefs] = useState(DEFAULT_PREFS);
  useEffect(() => {
    readPrefs().then(setPrefs);
  }, []);
  const update = (change: Partial<BellPrefs>) => {
    const next = { ...prefs, ...change };
    setPrefs(next);
    AsyncStorage.setItem(PREFS_KEY, JSON.stringify(next)).catch(() => undefined);
  };
  return [prefs, update];
}

// --- Sonar con la app delante ----------------------------------------------------------------

const players = new Map<BellTone, AudioPlayer>();

function playerFor(tone: BellTone): AudioPlayer {
  let p = players.get(tone);
  if (!p) {
    p = createAudioPlayer(BELL_TONES.find((x) => x.id === tone)!.file);
    players.set(tone, p);
  }
  return p;
}

// Carga el tono antes de que haga falta (al entrar en el modo guiado), para que suene en su segundo
export const prepareBell = (tone: BellTone) => {
  try {
    playerFor(tone);
  } catch (e) {
    console.warn('Workout bell: load failed', e instanceof Error ? e.message : e);
  }
};

export async function ringBell(tone: BellTone): Promise<void> {
  try {
    // Mezclado con lo que suene (música, podcast) y también con el móvil en silencio: para callarlo
    // está el interruptor de Sonido
    await setAudioModeAsync({ playsInSilentMode: true, interruptionMode: 'mixWithOthers', shouldPlayInBackground: false });
    const p = playerFor(tone);
    await p.seekTo(0);
    p.play();
  } catch (e) {
    console.warn('Workout bell: play failed', e instanceof Error ? e.message : e);
  }
}

export function releaseBells() {
  for (const p of players.values()) p.remove();
  players.clear();
}

// --- Con la pantalla bloqueada ---------------------------------------------------------------

// Desde qué APK van los tonos en res/raw (y SCHEDULE_EXACT_ALARM para que el aviso sea puntual).
// En iOS no hay versión anterior: cualquier build sale ya con ellos.
const TONES_IN_APK_FROM = [1, 1, 0];

export function lockToneAvailable(): boolean {
  if (Platform.OS === 'ios') return true;
  if (Platform.OS !== 'android') return false;
  const v = requireOptionalNativeModule<{ nativeApplicationVersion?: string | null }>('ExpoApplication')?.nativeApplicationVersion;
  const parts = String(v ?? '0').split('.').map((n) => Number(n) || 0);
  for (let i = 0; i < TONES_IN_APK_FROM.length; i++) {
    const a = parts[i] ?? 0;
    if (a !== TONES_IN_APK_FROM[i]) return a > TONES_IN_APK_FROM[i];
  }
  return true;
}

const ID_PREFIX = 'entreno-'; // no 'kuova-': esos son de los recordatorios, que cancelan los suyos
const channels = new Set<string>();

async function channelFor(N: NotificationsModule, tone: BellTone): Promise<string | undefined> {
  if (Platform.OS !== 'android') return undefined;
  const custom = lockToneAvailable();
  const id = custom ? `entreno-${tone}` : 'entreno';
  if (channels.has(id)) return id;
  const label = BELL_TONES.find((x) => x.id === tone)!.label;
  await N.setNotificationChannelAsync(id, {
    name: custom ? `${t('Workout timer')} · ${t(label)}` : t('Workout timer'),
    description: t('When a rest or a timed exercise ends with the screen locked.'),
    importance: N.AndroidImportance.HIGH,
    // Sin `sound`, el tono de avisos del móvil (un nombre que no está en la APK lo dejaría así para siempre)
    ...(custom ? { sound: `kuova_${tone}.wav` } : {}),
    vibrationPattern: [0, 300, 150, 300],
    lockscreenVisibility: N.AndroidNotificationVisibility.PUBLIC,
    showBadge: false,
    lightColor: '#2E7D5B',
  });
  channels.add(id);
  return id;
}

// web = en el navegador; old-app = APK sin expo-notifications (ee97dd7d); ask = falta el permiso
// (se puede pedir); blocked = denegado y solo se cambia en los ajustes del móvil
export type BellLockStatus = 'web' | 'old-app' | 'ask' | 'blocked' | 'on';

export async function bellLockStatus(): Promise<BellLockStatus> {
  if (Platform.OS === 'web') return 'web';
  const N = loadNotifications();
  if (!N) return 'old-app';
  const p = toPermission(N, await N.getPermissionsAsync());
  return p === 'granted' ? 'on' : p === 'blocked' ? 'blocked' : 'ask';
}

export async function allowBellOnLock(tone: BellTone): Promise<BellLockStatus> {
  const N = loadNotifications();
  if (!N) return bellLockStatus();
  try {
    await channelFor(N, tone); // en Android 13+ el diálogo del permiso solo sale si ya hay un canal
    const p = toPermission(N, await N.requestPermissionsAsync({ ios: { allowAlert: true, allowSound: true, allowBadge: false } }));
    return p === 'granted' ? 'on' : p === 'blocked' ? 'blocked' : 'ask';
  } catch (e) {
    console.warn('Workout bell: permission failed', e instanceof Error ? e.message : e);
    return bellLockStatus();
  }
}

// La primera vez que empieza una sesión guiada con sonido se pide el permiso (acaba de poner un
// temporizador en marcha: es el momento con sentido). Una sola vez; luego, desde la hoja de Sonido.
const ASKED_KEY = 'workoutBell.asked.v1';

export async function offerBellOnLock(tone: BellTone): Promise<void> {
  const N = loadNotifications();
  if (!N) return;
  try {
    if ((await N.getPermissionsAsync()).status !== 'undetermined') return;
    if (await AsyncStorage.getItem(ASKED_KEY)) return;
    await AsyncStorage.setItem(ASKED_KEY, new Date().toISOString());
    await allowBellOnLock(tone);
  } catch {
    // sin permiso solo suena con la app delante
  }
}

export const openPhoneSettings = () => Linking.openSettings().catch(() => undefined);

export interface BellAlarm {
  at: number; // ms
  title: string;
  body: string;
}

// Programar y quitar van en fila: bloquear y desbloquear rápido no deja un aviso suelto que sonaría
// encima del timbre de la app
let chain: Promise<void> = Promise.resolve();
const enqueue = (label: string, task: () => Promise<void>) =>
  (chain = chain.then(task).catch((e) => console.warn(`Workout bell: ${label} failed`, e instanceof Error ? e.message : e)));

async function clearOurs(N: NotificationsModule) {
  for (const r of await N.getAllScheduledNotificationsAsync()) {
    if (r.identifier.startsWith(ID_PREFIX)) await N.cancelScheduledNotificationAsync(r.identifier);
  }
  for (const n of await N.getPresentedNotificationsAsync()) {
    if (n.request.identifier.startsWith(ID_PREFIX)) await N.dismissNotificationAsync(n.request.identifier);
  }
}

export function scheduleBellAlarms(alarms: BellAlarm[], tone: BellTone): Promise<void> {
  const N = loadNotifications();
  if (!N || !alarms.length) return Promise.resolve();
  return enqueue('schedule', async () => {
    if (toPermission(N, await N.getPermissionsAsync()) !== 'granted') return;
    const channelId = await channelFor(N, tone);
    await clearOurs(N);
    const custom = lockToneAvailable();
    for (const [i, a] of alarms.entries()) {
      if (a.at <= Date.now() + 500) continue;
      await N.scheduleNotificationAsync({
        identifier: `${ID_PREFIX}${i}`,
        content: { title: a.title, body: a.body, sound: custom ? `kuova_${tone}.wav` : 'default', color: '#2E7D5B' },
        trigger: { type: N.SchedulableTriggerInputTypes.DATE, date: new Date(a.at), channelId },
      });
    }
  });
}

// Al volver a la app (o al acabar la sesión): fuera lo programado y lo que ya sonó en la barra
export function cancelBellAlarms(): Promise<void> {
  const N = loadNotifications();
  if (!N) return Promise.resolve();
  return enqueue('cancel', () => clearOurs(N));
}

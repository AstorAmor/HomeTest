import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, AppState, Linking, Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';
import { t } from '@/i18n';
import { getCurrentUserId } from '@/lib/supabase';
import { appPrefs, isSectionVisible } from './appPrefs';
import { checkInRepository } from './checkInRepository';
import { onDataChange } from './dataEvents';
import { buildNudgeContext, nudgeStore } from './nudgeStore';
import { phoneReminderLog } from './phoneReminderLog';
import { weightRepository } from './weightRepository';
import {
  diffPending,
  mergeFiredLog,
  PHONE_ID_PREFIX,
  PhoneReminder,
  PhoneReminderData,
  planPhoneReminders,
  reminderData,
  resolvedPresented,
} from '@/logic/nudges/phone';

// Recordatorios del móvil con la app cerrada: notificaciones locales programadas con
// expo-notifications (sin servidor ni push). Qué se programa lo decide src/logic/nudges/phone.ts;
// aquí se habla con el sistema: permiso, canales de Android, programar y cancelar, quitar de la
// barra lo que ya está hecho y abrir la pantalla al tocar un aviso.
//
// expo-notifications es un módulo nativo añadido el 2026-10-20: la APK instalada antes (ee97dd7d)
// no lo lleva y recibe igualmente las EAS Update (runtimeVersion = sdkVersion). Por eso se carga
// bajo demanda, como expo-print en src/utils/sharePlan.ts: si falta, todo esto no hace nada y la app
// sigue con los avisos de la bandeja (src/data/nudgeStore.ts), como hasta ahora.

export type NotificationsModule = typeof import('expo-notifications');

// Lo que evalúa `import 'expo-notifications'` al cargarse (si falta uno, el require fallaría)
const NATIVE_MODULES = [
  'ExpoNotificationScheduler',
  'ExpoNotificationPermissionsModule',
  'ExpoNotificationsHandlerModule',
  'ExpoNotificationPresenter',
  'ExpoNotificationsEmitter',
  'ExpoApplication',
];

let native: NotificationsModule | null | undefined;

// También lo usa el timbre del entrenamiento (src/data/workouts/bell.ts)
export function loadNotifications(): NotificationsModule | null {
  if (native !== undefined) return native;
  native = null;
  if (Platform.OS === 'web' || NATIVE_MODULES.some((m) => !requireOptionalNativeModule(m))) return native;
  try {
    native = require('expo-notifications') as NotificationsModule;
    // Con la app abierta también se enseñan (si no, el sistema los descarta)
    native.setNotificationHandler({
      handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
    });
  } catch {
    native = null;
  }
  return native;
}

export const phoneRemindersSupported = () => loadNotifications() !== null;

// --- Permiso y «activado» ------------------------------------------------------------------

// Permiso del sistema. blocked = denegado y ya no deja volver a preguntar: solo desde sus ajustes.
export type Permission = 'undetermined' | 'granted' | 'denied' | 'blocked';

type PermissionResponse = Awaited<ReturnType<NotificationsModule['getPermissionsAsync']>>;

export function toPermission(N: NotificationsModule, r: PermissionResponse): Permission {
  if (r.granted || r.ios?.status === N.IosAuthorizationStatus.PROVISIONAL) return 'granted';
  if (r.status === 'undetermined') return 'undetermined';
  return r.canAskAgain ? 'denied' : 'blocked';
}

// Además del permiso, que el usuario lo haya activado en Kuova: en Android 12 y anteriores el
// permiso viene concedido sin preguntar, y nada debe llegar al móvil sin un «sí». Por usuario y en
// este móvil.
const optInKey = () => `phoneReminders.on.v1:${getCurrentUserId() ?? 'demo'}`;
const isOptedIn = async () => (await AsyncStorage.getItem(optInKey()).catch(() => null)) === '1';
const setOptIn = (on: boolean) => AsyncStorage.setItem(optInKey(), on ? '1' : '0').catch(() => undefined);

// on = activado y con permiso; off = aún no (o lo apagó); blocked = lo quiere, pero el móvil lo tiene
// bloqueado; unsupported = web o APK sin expo-notifications
export type PhoneStatus = 'unsupported' | 'off' | 'on' | 'blocked';

export async function getPhoneStatus(): Promise<PhoneStatus> {
  const N = loadNotifications();
  if (!N) return 'unsupported';
  const p = toPermission(N, await N.getPermissionsAsync());
  if (p === 'blocked') return 'blocked';
  return p === 'granted' && (await isOptedIn()) ? 'on' : 'off';
}

// Dos canales para que en Android se puedan ajustar por separado. En pantalla bloqueada se ve que
// hay un aviso de Kuova, pero no el texto (el nombre de un medicamento es un dato de salud).
const CHANNEL = { doses: 'tomas', reminders: 'recordatorios' } as const;
let channelsReady = false;

async function ensureChannels(N: NotificationsModule) {
  if (Platform.OS !== 'android' || channelsReady) return;
  const common = { lockscreenVisibility: N.AndroidNotificationVisibility.PRIVATE, showBadge: false, lightColor: '#2E7D5B' };
  await N.setNotificationChannelAsync(CHANNEL.doses, {
    ...common,
    name: t('Medication & supplements'),
    description: t('At the time of each dose with reminders on.'),
    importance: N.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
  });
  await N.setNotificationChannelAsync(CHANNEL.reminders, {
    ...common,
    name: t('Reminders'),
    description: t('Weigh-in, morning temperature and check-in.'),
    importance: N.AndroidImportance.DEFAULT,
  });
  channelsReady = true;
}

// Activar: pide el permiso del sistema si hace falta (en Android 13+ es POST_NOTIFICATIONS, y el
// diálogo solo sale si ya hay un canal creado) y, si lo concede, programa lo que toque al momento.
export async function turnOnPhoneReminders(): Promise<PhoneStatus> {
  const N = loadNotifications();
  if (!N) return 'unsupported';
  await ensureChannels(N);
  let p = toPermission(N, await N.getPermissionsAsync());
  if (p !== 'granted' && p !== 'blocked') {
    p = toPermission(N, await N.requestPermissionsAsync({ ios: { allowAlert: true, allowSound: true, allowBadge: false } }));
  }
  if (p !== 'granted') return p === 'blocked' ? 'blocked' : 'off';
  await setOptIn(true);
  await syncPhoneReminders();
  return 'on';
}

// Apagar todos en este móvil (los interruptores de cada aviso se quedan como estén)
export async function turnOffPhoneReminders(): Promise<void> {
  await setOptIn(false);
  await syncPhoneReminders(); // sin «activado», cancela lo programado
}

// Bloqueadas en el móvil: quien va a sus ajustes es que las quiere; al volver ya quedan activadas
export async function openPhoneSettings(): Promise<void> {
  await setOptIn(true);
  await Linking.openSettings().catch(() => undefined);
}

// Cuándo se pregunta: nunca al abrir la app por primera vez, sino justo después de algo que pide un
// recordatorio. Con las tomas y la temperatura el usuario acaba de pedirlo, así que sale el permiso
// del sistema directamente. Con el peso y el check-in, antes se pregunta con un diálogo propio
// (decir «Ahora no» no gasta el permiso del sistema, que en iOS solo se puede pedir una vez). Cada
// motivo se pregunta como mucho una vez al mes; siempre se puede activar en Ajustes → Notificaciones.
export type ReminderOfferReason = 'medication' | 'temperature' | 'weigh_in' | 'checkin';

const OFFER_KEY = 'phoneReminders.offers.v1';
const OFFER_EVERY_DAYS = 30;
const SOFT_ASK: Record<'weigh_in' | 'checkin', string> = {
  weigh_in: 'We can remind you to weigh in once a week, even with the app closed. You can change it in Settings → Notifications.',
  checkin: 'If you go a few days without a check-in, we can send you a reminder, even with the app closed. You can change it in Settings → Notifications.',
};

export async function offerPhoneReminders(reason: ReminderOfferReason): Promise<void> {
  try {
    if ((await getPhoneStatus()) !== 'off') return; // ya activados, bloqueados o sin módulo
    if (reason === 'checkin') {
      // Solo a quien ya lo hace: al menos 3 días con check-in
      const days = new Set((await checkInRepository.getAll().catch(() => [])).map((c) => c.fecha.slice(0, 10)));
      if (days.size < 3) return;
    }
    const offers = JSON.parse((await AsyncStorage.getItem(OFFER_KEY)) ?? '{}') as Partial<Record<ReminderOfferReason, string>>;
    const last = offers[reason];
    if (last && Date.now() - new Date(last).getTime() < OFFER_EVERY_DAYS * 864e5) return;
    await AsyncStorage.setItem(OFFER_KEY, JSON.stringify({ ...offers, [reason]: new Date().toISOString() }));
    if (reason === 'medication' || reason === 'temperature') {
      await turnOnPhoneReminders();
      return;
    }
    Alert.alert(t('Reminders on your phone?'), t(SOFT_ASK[reason]), [
      { text: t('Not now'), style: 'cancel' },
      { text: t('Yes, remind me'), onPress: () => void turnOnPhoneReminders() },
    ]);
  } catch (e) {
    console.warn('Phone reminders: offer failed', e instanceof Error ? e.message : e);
  }
}

// --- Programar -----------------------------------------------------------------------------

let enabled = false; // hay un paciente con sesión (lo enciende <PhoneReminders /> en el layout)
let timer: ReturnType<typeof setTimeout> | null = null;
let lastSync = 0;
const RESUME_EVERY_MS = 15 * 60 * 1000; // al volver a la app, como mucho cada 15 minutos

// Programar y borrar van en fila, uno detrás de otro: así un «borrar al cerrar sesión» nunca se cruza
// con un «programar» de la cuenta que entra después.
let chain: Promise<void> = Promise.resolve();
let syncQueued = false;
const enqueue = (label: string, task: () => Promise<void>) =>
  (chain = chain.then(task).catch((e) => console.warn(`Phone reminders: ${label} failed`, e instanceof Error ? e.message : e)));

const ours = (id: string) => id.startsWith(PHONE_ID_PREFIX);

async function cancelOurs(N: NotificationsModule) {
  const scheduled = await N.getAllScheduledNotificationsAsync();
  for (const r of scheduled) if (ours(r.identifier)) await N.cancelScheduledNotificationAsync(r.identifier);
}

const schedule = (N: NotificationsModule, r: PhoneReminder) =>
  N.scheduleNotificationAsync({
    identifier: r.id,
    content: { title: r.title, body: r.body, data: reminderData(r), sound: 'default', color: '#2E7D5B' },
    trigger: {
      type: N.SchedulableTriggerInputTypes.DATE,
      date: r.at,
      channelId: r.kind === 'dose' ? CHANNEL.doses : CHANNEL.reminders,
    },
  });

async function syncOnce(N: NotificationsModule) {
  if (!enabled) return;
  lastSync = Date.now();
  if (toPermission(N, await N.getPermissionsAsync()) !== 'granted' || !(await isOptedIn())) {
    await cancelOurs(N); // apagados o sin permiso: no dejar nada pendiente
    return;
  }
  await ensureChannels(N);
  const now = new Date();
  const [ctx, prefs, inbox, weighIns, record, sectionPrefs] = await Promise.all([
    buildNudgeContext(now),
    nudgeStore.getPrefs(),
    nudgeStore.getInbox(),
    weightRepository.getAll().catch(() => []),
    phoneReminderLog.get(),
    appPrefs.current(),
  ]);
  const fired = mergeFiredLog(record.fired, record.planned, now);
  const plan = planPhoneReminders({
    ctx,
    prefs,
    log: [...inbox.map((i) => ({ id: i.id, at: i.at })), ...fired],
    weighIns,
    sections: {
      medication: isSectionVisible(sectionPrefs, 'medication'),
      cycle: isSectionVisible(sectionPrefs, 'cycle'),
      checkin: isSectionVisible(sectionPrefs, 'checkin'),
    },
  });
  if (!enabled) return; // ha cerrado sesión mientras se calculaba
  const { cancel, add } = diffPending((await N.getAllScheduledNotificationsAsync()).map((r) => r.identifier), plan);
  for (const id of cancel) await N.cancelScheduledNotificationAsync(id);
  for (const r of add) await schedule(N, r);
  // Lo que ya está hecho sale de la barra de notificaciones (p. ej. la toma marcada desde la app)
  const presented = await N.getPresentedNotificationsAsync();
  const done = resolvedPresented(
    presented.map((n) => ({ id: n.request.identifier, data: n.request.content.data as Partial<PhoneReminderData> | null })),
    { ctx, weighIns }
  );
  for (const id of done) await N.dismissNotificationAsync(id);
  await phoneReminderLog.set({
    planned: plan.filter((r) => r.reminderId).map((r) => ({ reminderId: r.reminderId, at: r.at.toISOString() })),
    fired,
  });
}

// Vuelve a calcular y deja programado lo que toca (si hay módulo y permiso). Si ya hay uno
// esperando en la fila, ese mismo leerá los datos nuevos.
export function syncPhoneReminders(): Promise<void> {
  const N = loadNotifications();
  if (!N) return Promise.resolve();
  if (syncQueued) return chain;
  syncQueued = true;
  return enqueue('sync', async () => {
    syncQueued = false;
    await syncOnce(N);
  });
}

// Lo que hace cambiar los recordatorios: tomas y medicamentos, peso, temperatura basal, check-ins,
// silencios, la bandeja (máximo diario), el objetivo del ciclo y las secciones de la app
const RELEVANT =
  /^(hometest:(medications|medication_doses|weight_entries|basal_temperature|check_ins)|flag:(nudge_prefs|nudge_inbox|cycle_goal|app_prefs))$/;

// Enciende los recordatorios para el paciente con sesión: programa ahora, al volver a la app y
// tras cada cambio. Devuelve la función que los apaga y quita todo (al cerrar sesión).
export function startPhoneReminders(): () => void {
  const N = loadNotifications();
  if (!N) return () => undefined;
  enabled = true;
  syncPhoneReminders();
  const later = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      syncPhoneReminders();
    }, 800);
  };
  const offChange = onDataChange((source) => {
    if (RELEVANT.test(source)) later();
  });
  // Al volver a la app (p. ej. de los ajustes del móvil, o al día siguiente)
  const appState = AppState.addEventListener('change', (s) => {
    if (s === 'active' && Date.now() - lastSync > RESUME_EVERY_MS) syncPhoneReminders();
  });
  return () => {
    offChange();
    appState.remove();
    if (timer) clearTimeout(timer);
    timer = null;
    enabled = false;
  };
}

// Sin sesión: nada programado ni en la barra con los datos de nadie
export function clearPhoneReminders(): Promise<void> {
  const N = loadNotifications();
  if (!N) return Promise.resolve();
  return enqueue('clear', async () => {
    await cancelOurs(N);
    for (const n of await N.getPresentedNotificationsAsync()) {
      if (ours(n.request.identifier)) await N.dismissNotificationAsync(n.request.identifier);
    }
  });
}

// Los próximos avisos programados, para enseñarlos en Notificaciones
export async function upcomingPhoneReminders(limit = 3): Promise<{ id: string; at: Date; title: string }[]> {
  const N = loadNotifications();
  if (!N) return [];
  const scheduled = await N.getAllScheduledNotificationsAsync().catch(() => []);
  return scheduled
    .filter((r) => ours(r.identifier))
    .map((r) => ({ id: r.identifier, at: new Date(String(r.content.data?.at ?? '')), title: r.content.title ?? '' }))
    .filter((r) => !Number.isNaN(r.at.getTime()))
    .sort((a, b) => a.at.getTime() - b.at.getTime())
    .slice(0, limit);
}

// Al tocar un aviso de Kuova se abre su pantalla. También si la app estaba cerrada y se abrió así.
export function listenToReminderTaps(open: (route: string) => void): () => void {
  const N = loadNotifications();
  if (!N) return () => undefined;
  let live = true;
  const handle = (r: Awaited<ReturnType<NotificationsModule['getLastNotificationResponseAsync']>>) => {
    if (!r || r.actionIdentifier !== N.DEFAULT_ACTION_IDENTIFIER) return;
    const { identifier, content } = r.notification.request;
    const route = content.data?.route;
    if (!ours(identifier) || typeof route !== 'string' || !route.startsWith('/')) return;
    N.clearLastNotificationResponseAsync().catch(() => undefined);
    open(route);
  };
  N.getLastNotificationResponseAsync()
    // Al arrancar, deja que la primera pantalla termine de redirigir antes de abrir la del aviso
    .then((r) => r && setTimeout(() => live && handle(r), 600))
    .catch(() => undefined);
  const sub = N.addNotificationResponseReceivedListener(handle);
  return () => {
    live = false;
    sub.remove();
  };
}

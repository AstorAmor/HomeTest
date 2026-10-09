import { useEffect, useSyncExternalStore } from 'react';
import { useAuth } from '@/context/AuthContext';
import { getCurrentUserId } from '@/lib/supabase';
import { userFlags } from '@/data/userFlags';

// Para qué quiere el usuario la app (una o varias cosas) y qué secciones ve. Hay quien solo
// quiere guardar sus analíticas (un historial clínico, sin planes ni "gamificación"), y quien
// quiere todo el acompañamiento. Se pregunta al principio del onboarding y se puede cambiar
// en More → Configure my experience (cada sección se puede encender o apagar).
//
// Se guarda en user_flags (clave "app_prefs"): con cuenta, se respeta en todos sus
// dispositivos; sin cuenta, en el móvil. Sin respuesta, se ve todo (como antes).

export type AppPurpose = 'records' | 'understand' | 'improve';

export type AppSection =
  | 'plan'
  | 'checkin'
  | 'readiness'
  | 'wearables'
  | 'cycle'
  | 'gut'
  | 'bladder'
  | 'medication'
  | 'badges'
  | 'specialists'
  | 'learning';

export interface AppPrefs {
  purposes: AppPurpose[]; // vacío = sin responder (se ve todo)
  hidden: AppSection[];
  // Secciones opcionales que el usuario ha encendido (las de OPT_IN_SECTIONS salen apagadas)
  enabled: AppSection[];
}

// Apagadas de entrada: se encienden según lo que conteste en el onboarding (p. ej. medicación si
// toma alguna) o a mano en Configure my experience
export const OPT_IN_SECTIONS: AppSection[] = ['gut', 'bladder', 'medication'];

export const isSectionVisible = (prefs: AppPrefs, section: AppSection) =>
  OPT_IN_SECTIONS.includes(section) ? prefs.enabled.includes(section) : !prefs.hidden.includes(section);

export const PURPOSE_OPTIONS: { id: AppPurpose; title: string; subtitle: string; icon: string }[] = [
  {
    id: 'records',
    title: 'Keep my health records',
    subtitle: 'My results and history in one place, ready to share with my doctors. Nothing else.',
    icon: 'folder-open-outline',
  },
  {
    id: 'understand',
    title: 'Understand and follow my health',
    subtitle: 'My records, plus trends, wearables and how I feel day to day.',
    icon: 'analytics-outline',
  },
  {
    id: 'improve',
    title: 'Improve my health',
    subtitle: 'All of it, plus a personalised plan built around my goals.',
    icon: 'trending-up-outline',
  },
];

export const SECTION_OPTIONS: { id: AppSection; title: string; subtitle: string; icon: string }[] = [
  { id: 'plan', title: 'Personalised plan', subtitle: 'Actions, targets and where your markers could go', icon: 'list-outline' },
  { id: 'checkin', title: 'Daily check-in', subtitle: 'How you feel: mood, energy and diary', icon: 'happy-outline' },
  { id: 'readiness', title: 'Daily readiness', subtitle: 'A daily score from your sleep and activity', icon: 'speedometer-outline' },
  { id: 'wearables', title: 'Wearable data', subtitle: 'Heart rate, HRV, sleep, steps, temperature', icon: 'watch-outline' },
  { id: 'cycle', title: 'Cycle tracking', subtitle: 'Period dates and predictions', icon: 'rose-outline' },
  { id: 'gut', title: 'Gut', subtitle: 'Bowel movements: how often, colour and consistency', icon: 'nutrition-outline' },
  { id: 'bladder', title: 'Bladder', subtitle: 'Urine: how often, colour and how hydrated you are', icon: 'water-outline' },
  { id: 'medication', title: 'Medication & supplements', subtitle: 'What you take, when, and reminders if you want them', icon: 'medical-outline' },
  { id: 'badges', title: 'Badges', subtitle: 'Achievements and streaks', icon: 'ribbon-outline' },
  { id: 'specialists', title: 'Specialist suggestions', subtitle: '"Talk to a specialist" on Today', icon: 'people-outline' },
  { id: 'learning', title: 'Learning', subtitle: 'Short reads about your health', icon: 'book-outline' },
];

// Qué se oculta de entrada según la respuesta. Con varias respuestas se oculta solo lo que
// ocultan todas (si una de ellas lo necesita, se ve). Luego cada sección se cambia a mano.
export const PURPOSE_HIDDEN: Record<AppPurpose, AppSection[]> = {
  records: ['plan', 'checkin', 'readiness', 'wearables', 'badges', 'specialists', 'learning'],
  understand: ['plan', 'badges'],
  improve: [],
};

export const hiddenForPurposes = (purposes: AppPurpose[]): AppSection[] =>
  purposes.length ? PURPOSE_HIDDEN[purposes[0]].filter((s) => purposes.every((p) => PURPOSE_HIDDEN[p].includes(s))) : [];

// Sin plan solo si no ha pedido mejorar (y ha contestado algo)
export const wantsPlan = (purposes: AppPurpose[]) => !purposes.length || purposes.includes('improve');

const FLAG_KEY = 'app_prefs';
const EMPTY: AppPrefs = { purposes: [], hidden: [], enabled: [] };

// Estado compartido por todas las pantallas: al cambiarlo en ajustes, Today, My Data…
// se actualizan al momento sin recargar.
let state: { prefs: AppPrefs; loadedFor: string | null } = { prefs: EMPTY, loadedFor: null };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

const sanitize = (raw: unknown): AppPrefs => {
  if (!raw || typeof raw !== 'object') return EMPTY;
  const r = raw as Partial<AppPrefs> & { purpose?: unknown };
  // Antes se elegía un solo propósito ("purpose")
  const rawPurposes: unknown[] = Array.isArray(r.purposes) ? r.purposes : r.purpose ? [r.purpose] : [];
  const purposes = PURPOSE_OPTIONS.map((p) => p.id).filter((id) => rawPurposes.includes(id));
  // Antes "Gut and bladder" era una sola sección ("digestive")
  const split = (list: unknown) =>
    Array.isArray(list) ? list.flatMap((s) => (s === 'digestive' ? ['gut', 'bladder'] : [s])) : [];
  const known = (list: unknown) => split(list).filter((s): s is AppSection => SECTION_OPTIONS.some((o) => o.id === s));
  return { purposes, hidden: known(r.hidden), enabled: known(r.enabled) };
};

const currentOwner = () => getCurrentUserId() ?? 'demo';

export const appPrefs = {
  get: () => state.prefs,

  async load(): Promise<AppPrefs> {
    const owner = currentOwner();
    const prefs = sanitize(await userFlags.get(FLAG_KEY).catch(() => undefined));
    state = { prefs, loadedFor: owner };
    emit();
    return prefs;
  },

  async save(prefs: AppPrefs): Promise<void> {
    const clean = sanitize(prefs);
    state = { prefs: clean, loadedFor: currentOwner() };
    emit();
    await userFlags.set(FLAG_KEY, clean as unknown as Record<string, unknown>);
  },

  // Elegir propósitos = aplicar su configuración de secciones. Si son los mismos que ya tenía,
  // se respetan los ajustes a mano que hubiera hecho.
  async setPurposes(purposes: AppPurpose[]): Promise<void> {
    const current = state.prefs;
    const same = current.purposes.length === purposes.length && purposes.every((p) => current.purposes.includes(p));
    if (same) return;
    await this.save({ purposes, hidden: hiddenForPurposes(purposes), enabled: current.enabled });
  },

  async setSectionVisible(section: AppSection, visible: boolean): Promise<void> {
    if (OPT_IN_SECTIONS.includes(section)) {
      const enabled = new Set(state.prefs.enabled);
      if (visible) enabled.add(section);
      else enabled.delete(section);
      await this.save({ ...state.prefs, enabled: [...enabled] });
      return;
    }
    const hidden = new Set(state.prefs.hidden);
    if (visible) hidden.delete(section);
    else hidden.add(section);
    await this.save({ ...state.prefs, hidden: [...hidden] });
  },
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export function useAppPrefs(): AppPrefs {
  const { user } = useAuth();
  const prefs = useSyncExternalStore(subscribe, () => state.prefs, () => state.prefs);
  useEffect(() => {
    // Primera vez, o ha entrado otra cuenta: leer las suyas
    if (state.loadedFor !== currentOwner()) appPrefs.load();
  }, [user?.id]);
  return prefs;
}

// true si la sección se ve (por defecto todas, menos las opcionales)
export function useSections(): (section: AppSection) => boolean {
  const prefs = useAppPrefs();
  return (section) => isSectionVisible(prefs, section);
}

import { userFlags } from './userFlags';
import { checkInRepository } from './checkInRepository';
import { cycleRepository } from './cycleRepository';
import { mealRepository, workoutRepository } from './planRepository';
import { profileRepository } from './profileRepository';
import { cycleGoalStore } from './cycleGoal';
import { basalTemperatureRepository } from './temperatureRepository';
import { bowelRepository, urineRepository } from './bathroomRepository';
import { doseRepository, medicationRepository } from './medicationRepository';
import { wearableRepository } from '@/wearables/wearableRepository';
import { evaluateNudges, muteUntil } from '@/logic/nudges';
import { MuteOption, NudgeContext, NudgeDecision, NudgeId, NudgePrefs } from '@/logic/nudges/types';

// Bandeja de avisos de la app y preferencias de silencio (user_flags "nudge_inbox" y
// "nudge_prefs"). Al abrir Today o la bandeja se evalúan las reglas (src/logic/nudges) con los
// datos del usuario; lo que toca enviar se guarda aquí, y eso mismo sirve de historial para
// respetar el tiempo mínimo entre avisos. Las notificaciones push del móvil vendrán después
// (hace falta un APK nuevo con expo-notifications); la lógica ya es la definitiva.

const PREFS_KEY = 'nudge_prefs';
const INBOX_KEY = 'nudge_inbox';
const KEEP = 60;

export interface InboxItem {
  id: NudgeId;
  at: string;
  title: string;
  body: string;
  route?: string;
  read?: boolean;
}

const ageFrom = (dob?: string) => {
  if (!dob) return null;
  const d = new Date(dob);
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  if (now.getMonth() < d.getMonth() || (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())) age--;
  return age;
};

export async function buildNudgeContext(now = new Date()): Promise<NudgeContext> {
  const [profile, checkIns, workouts, meals, cycle, goal, basal, bowel, urine, wearable, medications, doses] = await Promise.all([
    profileRepository.get(),
    checkInRepository.getAll(),
    workoutRepository.getAll(),
    mealRepository.getAll(),
    cycleRepository.getAll(),
    cycleGoalStore.get(),
    basalTemperatureRepository.getAll(),
    bowelRepository.getAll(),
    urineRepository.getAll(),
    wearableRepository.getRecords(), // solo lo sincronizado de verdad, nunca los datos de ejemplo
    medicationRepository.getAll(),
    doseRepository.getAll(),
  ]);
  return {
    now,
    profile: { sex: profile.sex, age: ageFrom(profile.dateOfBirth), conditions: profile.conditions },
    checkIns,
    workouts,
    meals,
    cycleStarts: cycle,
    cycleGoal: goal,
    temperatures: [
      ...basal.map((t) => ({ fecha: t.fecha, celsius: t.valor, source: 'manual' as const })),
      ...wearable
        .filter((w) => w.metric === 'body_temperature')
        .map((w) => ({ fecha: new Date(`${w.date}T06:00:00`).toISOString(), celsius: w.value, source: 'wearable' as const })),
    ],
    bowel,
    urine,
    sleepNights: wearable.filter((w) => w.metric === 'sleep_duration').map((w) => ({ date: w.date, minutes: w.value })),
    medications,
    doses,
  };
}

const asList = (v: unknown): InboxItem[] => (Array.isArray(v) ? (v as InboxItem[]) : []);

export const nudgeStore = {
  async getPrefs(): Promise<NudgePrefs> {
    const v = await userFlags.get(PREFS_KEY);
    return v && typeof v === 'object' && 'muted' in v ? (v as unknown as NudgePrefs) : { muted: {} };
  },

  async mute(id: NudgeId, option: MuteOption): Promise<void> {
    const prefs = await this.getPrefs();
    const now = new Date();
    prefs.muted[id] = { until: muteUntil(option, now), setAt: now.toISOString() };
    await userFlags.set(PREFS_KEY, prefs as unknown as Record<string, unknown>);
  },

  async unmute(id: NudgeId): Promise<void> {
    const prefs = await this.getPrefs();
    delete prefs.muted[id];
    await userFlags.set(PREFS_KEY, prefs as unknown as Record<string, unknown>);
  },

  async getInbox(): Promise<InboxItem[]> {
    // userFlags guarda objetos: la lista va dentro de { items }
    const v = (await userFlags.get(INBOX_KEY)) as { items?: unknown } | undefined;
    return asList(v?.items);
  },

  async saveInbox(items: InboxItem[]): Promise<void> {
    await userFlags.set(INBOX_KEY, { items: items.slice(0, KEEP) } as unknown as Record<string, unknown>);
  },

  async markAllRead(): Promise<void> {
    const items = await this.getInbox();
    if (items.some((i) => !i.read)) await this.saveInbox(items.map((i) => ({ ...i, read: true })));
  },

  // Evalúa las reglas ahora y guarda en la bandeja lo que toca enviar. Devuelve la bandeja y
  // la decisión de cada regla (con su motivo), que el modo desarrollador enseña para supervisar.
  async refresh(now = new Date()): Promise<{ inbox: InboxItem[]; decisions: NudgeDecision[] }> {
    const [ctx, prefs, inbox] = await Promise.all([buildNudgeContext(now), this.getPrefs(), this.getInbox()]);
    const decisions = evaluateNudges(ctx, prefs, inbox.map((i) => ({ id: i.id, at: i.at })));
    const fresh = decisions
      .filter((d) => d.status === 'send')
      .map((d): InboxItem => ({ id: d.id, at: now.toISOString(), title: d.title ?? d.label, body: d.body ?? '', route: d.route }));
    const next = fresh.length ? [...fresh, ...inbox] : inbox;
    if (fresh.length) await this.saveInbox(next);
    return { inbox: next, decisions };
  },
};

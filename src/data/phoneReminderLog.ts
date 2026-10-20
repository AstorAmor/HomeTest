import AsyncStorage from '@react-native-async-storage/async-storage';
import { getCurrentUserId } from '@/lib/supabase';
import { mergeFiredLog } from '@/logic/nudges/phone';
import { NudgeLogEntry, ReminderId } from '@/logic/nudges/types';

// Lo que quedó programado en este móvil y lo que ya saltó. Va en el propio móvil y por usuario
// (las notificaciones locales son de cada dispositivo). Lo leen la bandeja (para no pasar de dos
// avisos al día entre las dos) y los recordatorios del móvil (src/data/phoneReminders.ts).

export interface PhoneReminderRecord {
  planned: { reminderId?: ReminderId; at: string }[];
  fired: NudgeLogEntry[];
}

const key = () => `phoneReminders.v1:${getCurrentUserId() ?? 'demo'}`;
const EMPTY: PhoneReminderRecord = { planned: [], fired: [] };

export const phoneReminderLog = {
  async get(): Promise<PhoneReminderRecord> {
    try {
      const raw = await AsyncStorage.getItem(key());
      const v = raw ? (JSON.parse(raw) as Partial<PhoneReminderRecord>) : null;
      return { planned: Array.isArray(v?.planned) ? v.planned : [], fired: Array.isArray(v?.fired) ? v.fired : [] };
    } catch {
      return EMPTY;
    }
  },

  async set(record: PhoneReminderRecord): Promise<void> {
    try {
      await AsyncStorage.setItem(key(), JSON.stringify(record));
    } catch {
      // sin almacenamiento: solo se pierde el recuento de lo que ya saltó
    }
  },

  // Recordatorios del móvil que ya saltaron (no las tomas)
  async fired(now = new Date()): Promise<NudgeLogEntry[]> {
    const r = await this.get();
    return mergeFiredLog(r.fired, r.planned, now);
  },
};

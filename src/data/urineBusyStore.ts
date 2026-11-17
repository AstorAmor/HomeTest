import { userFlags } from './userFlags';
import { BUSY_CAUSES, BusyCause } from '@/logic/bathroom';

// Lo que contestó a «¿Pudo influir alguno de estos factores?» en un día de muchas más veces
// (src/logic/bathroom.ts, urineBusyDay): por día, en user_flags (son pocas respuestas, sin tabla nueva) y
// solo los últimos 30 días.
const KEY = 'urine_busy_answers.v1';
const KEEP_DAYS = 30;

export type BusyAnswers = Record<string, BusyCause[]>;

const clean = (v: unknown): BusyAnswers => {
  if (!v || typeof v !== 'object') return {};
  const out: BusyAnswers = {};
  for (const [day, list] of Object.entries(v as Record<string, unknown>)) {
    if (Array.isArray(list)) out[day] = list.filter((x): x is BusyCause => BUSY_CAUSES.includes(x as BusyCause));
  }
  return out;
};

export const urineBusyStore = {
  async get(): Promise<BusyAnswers> {
    return clean(await userFlags.get(KEY).catch(() => undefined));
  },
  async set(day: string, causes: BusyCause[]): Promise<BusyAnswers> {
    const all = { ...(await this.get()), [day]: causes };
    const kept = Object.fromEntries(
      Object.keys(all)
        .sort()
        .slice(-KEEP_DAYS)
        .map((d) => [d, all[d]])
    );
    await userFlags.set(KEY, kept);
    return kept;
  },
};

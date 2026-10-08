import { MAX_NUDGES_PER_DAY, NUDGE_RULES } from './rules';
import { MuteOption, NudgeContext, NudgeDecision, NudgeId, NudgeLogEntry, NudgePrefs } from './types';

const DAY = 24 * 3600 * 1000;
const fmt = (iso: string) => iso.slice(0, 10);

// Hasta cuándo queda silenciado un aviso. null = para siempre.
export function muteUntil(option: MuteOption, from: Date): string | null {
  if (option === 'forever') return null;
  const d = new Date(from);
  if (option === '7d') d.setDate(d.getDate() + 7);
  if (option === '1m') d.setMonth(d.getMonth() + 1);
  if (option === '3m') d.setMonth(d.getMonth() + 3);
  return d.toISOString();
}

export function isMuted(prefs: NudgePrefs, id: NudgeId, now: Date) {
  const m = prefs.muted[id];
  if (!m) return null;
  if (m.until === null) return m;
  return new Date(m.until).getTime() > now.getTime() ? m : null;
}

const sameLocalDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

// Decide, para cada regla, si hoy toca mandar el aviso y por qué (o por qué no). `log` son los
// avisos ya enviados: sirve para respetar el tiempo mínimo entre avisos y el máximo diario.
export function evaluateNudges(ctx: NudgeContext, prefs: NudgePrefs, log: NudgeLogEntry[]): NudgeDecision[] {
  const sentToday = log.filter((l) => sameLocalDay(new Date(l.at), ctx.now)).length;
  let budget = Math.max(0, MAX_NUDGES_PER_DAY - sentToday);

  return NUDGE_RULES.map((rule): NudgeDecision => {
    const base = { id: rule.id, category: rule.category, label: rule.label };
    const check = rule.evaluate(ctx);
    if (!check.due) return { ...base, status: 'not_due', reason: check.reason };
    const content = { title: check.title, body: check.body, route: check.route };

    const muted = isMuted(prefs, rule.id, ctx.now);
    if (muted) {
      return {
        ...base,
        ...content,
        status: 'muted',
        reason: `${check.reason}, but muted ${muted.until ? `until ${fmt(muted.until)}` : 'for good'} (set ${fmt(muted.setAt)})`,
      };
    }
    const last = log
      .filter((l) => l.id === rule.id)
      .reduce<string | null>((a, l) => (!a || l.at > a ? l.at : a), null);
    if (last) {
      const days = Math.floor((ctx.now.getTime() - new Date(last).getTime()) / DAY);
      if (days < rule.cooldownDays) {
        return {
          ...base,
          ...content,
          status: 'cooldown',
          reason: `${check.reason}, but sent ${days} day(s) ago (waits ${rule.cooldownDays})`,
        };
      }
    }
    if (budget <= 0) {
      return { ...base, ...content, status: 'daily_limit', reason: `${check.reason}, but already ${MAX_NUDGES_PER_DAY} today` };
    }
    budget--;
    return { ...base, ...content, status: 'send', reason: check.reason };
  });
}

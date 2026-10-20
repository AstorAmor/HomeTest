import { describe, expect, it } from 'vitest';
import { evaluateNudges, muteUntil, NUDGE_RULES, pruneResolved, simulatePersona } from '@/logic/nudges';
import { PERSONAS } from '../../../simulation/personas';
import { NudgeContext } from '@/logic/nudges/types';

const empty = (now: Date): NudgeContext => ({
  now,
  profile: {},
  checkIns: [],
  workouts: [],
  meals: [],
  cycleStarts: [],
  temperatures: [],
  bowel: [],
  urine: [],
  sleepNights: [],
});

describe('muteUntil', () => {
  const from = new Date('2026-10-08T09:00:00');
  it('silencia 7 días, 1 mes, 3 meses o para siempre', () => {
    expect(new Date(muteUntil('7d', from)!).getDate()).toBe(15);
    expect(new Date(muteUntil('1m', from)!).getMonth()).toBe(10);
    expect(new Date(muteUntil('3m', from)!).getMonth()).toBe(0);
    expect(muteUntil('forever', from)).toBeNull();
  });
});

describe('resumen semanal', () => {
  const weekly = NUDGE_RULES.find((r) => r.id === 'bathroom_weekly')!;
  const daysAgo = (now: Date, n: number) => new Date(now.getTime() - n * 86400000 - 3600000).toISOString();

  it('es general: cuenta check-ins y entrenos aunque no haya notas de baño', () => {
    const now = new Date('2026-10-17T19:00:00');
    const ctx = empty(now);
    ctx.checkIns = [0, 1, 2, 3].map((n) => ({ fecha: daysAgo(now, n), energy: 4 }));
    ctx.workouts = [{ fecha: daysAgo(now, 1) }];
    const r = weekly.evaluate(ctx);
    expect(r.due).toBe(true);
    expect(r.route).toBe('/your-days');
    expect(r.body).toContain('4 check-ins');
    expect(r.body).toContain('1 workout');
    expect(r.body).not.toMatch(/gut|bladder/i);
  });

  it('no sale con menos de 3 días con algo registrado', () => {
    const now = new Date('2026-10-17T19:00:00');
    const ctx = empty(now);
    ctx.checkIns = [0, 1].map((n) => ({ fecha: daysAgo(now, n) }));
    expect(weekly.evaluate(ctx).due).toBe(false);
  });
});

describe('evaluateNudges', () => {
  it('un usuario sin registros no recibe el aviso de inactividad', () => {
    const d = evaluateNudges(empty(new Date()), { muted: {} }, []);
    expect(d.find((x) => x.id === 'inactive_7d')!.status).toBe('not_due');
  });

  it('respeta el máximo de avisos por día, empezando por lo de salud', () => {
    const now = new Date('2026-10-08T20:00:00');
    const ctx = empty(now);
    ctx.profile = { sex: 'female', age: 41 };
    ctx.cycleGoal = { goal: 'conceive', regularCycles: 'yes', tryingFor: 'under_6m', logTemperature: true, answeredAt: now.toISOString() };
    ctx.urine = [0, 1, 2].map((n) => ({
      id: `u${n}`,
      fecha: new Date(now.getTime() - n * 86400000 - 3600000).toISOString(),
      createdAt: now.toISOString(),
      color: 'dark' as const,
    }));
    const decisions = evaluateNudges(ctx, { muted: {} }, []);
    const sent = decisions.filter((x) => x.status === 'send');
    expect(sent.map((x) => x.id)).toEqual(['fertility_doctor', 'urine_dark']);
    expect(decisions.find((x) => x.id === 'temperature_reminder')!.status).toBe('daily_limit');
  });
});

// Cada usuario simulado de simulation/personas (índice generado por npm run simulate) trae sus
// "expect": aquí se comprueban todos, con dos fechas fijas (meses de distinta duración) para que
// el resultado no dependa del día en que se ejecute.
describe('usuarios simulados', () => {
  for (const persona of PERSONAS) {
    for (const start of ['2026-10-08', '2027-02-10']) {
      it(`${persona.id} (día 0 = ${start})`, () => {
        const { expectations } = simulatePersona(persona, new Date(`${start}T00:00:00`));
        expect(expectations.filter((e) => !e.pass)).toEqual([]);
      });
    }
  }
});

describe('bandeja: los avisos-tarea hechos se van', () => {
  const now = new Date('2026-10-20T12:00:00');
  const creatina = {
    id: 'm1',
    fecha: '2026-10-01T08:00:00.000Z',
    createdAt: '2026-10-01T08:00:00.000Z',
    name: 'Creatine',
    kind: 'supplement' as const,
    schedule: { type: 'times' as const, times: ['09:00'] },
    course: { type: 'ongoing' as const },
    reminders: true,
  };
  const at9 = new Date('2026-10-20T09:00:00').toISOString();
  const inbox = [
    { id: 'medication_missed' as const, title: '¿Te has tomado la creatina?' },
    { id: 'bp_very_high' as const, title: 'Tensión muy alta' },
  ];

  it('«¿Te has tomado…?» sale de la bandeja cuando la toma ya está marcada; los avisos de salud se quedan', () => {
    const ctx = { ...empty(now), medications: [creatina], doses: [] } as NudgeContext;
    expect(pruneResolved(inbox, ctx).map((i) => i.id)).toEqual(['medication_missed', 'bp_very_high']);
    const marked = { ...ctx, doses: [{ id: 'd1', fecha: at9, createdAt: at9, medId: 'm1', scheduledFor: at9, status: 'taken' as const }] } as NudgeContext;
    expect(pruneResolved(inbox, marked).map((i) => i.id)).toEqual(['bp_very_high']);
  });
});


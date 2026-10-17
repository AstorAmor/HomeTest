import { describe, expect, it } from 'vitest';
import { PERSONAS } from '../../../simulation/personas';
import {
  AccountScenarioFlags,
  clearScenarioAccount,
  loadScenarioIntoAccount,
  ONCE_REAL_REFUSAL,
  REAL_ACCOUNT_REFUSAL,
  scenarioRecords,
  ScenarioAccountIO,
  ScenarioRecords,
  SIGNED_OUT_REFUSAL,
  UNVERIFIED_REFUSAL,
} from '../scenarioAccount';

// Test scenarios en una cuenta de Supabase (Ajustes → Test scenarios): una cuenta real nunca se
// toca, y lo que se escribe en una cuenta de prueba cabe en las tablas de verdad.
const START = new Date('2026-10-15T00:00:00');
const NOW = new Date('2026-10-15T12:00:00');
const marisa = PERSONAS.find((p) => p.id === 'marisa-tension-alta')!;

function fakeAccount(opts: { signedIn?: boolean; realNow?: boolean; flags?: AccountScenarioFlags | Error } = {}) {
  const calls: string[] = [];
  let written: ScenarioRecords | null = null;
  const io: ScenarioAccountIO = {
    signedIn: () => opts.signedIn ?? true,
    realNow: () => opts.realNow ?? false,
    readFlags: async () => {
      calls.push('readFlags');
      if (opts.flags instanceof Error) throw opts.flags;
      return opts.flags ?? {};
    },
    markScenarioAccount: async () => void calls.push('mark'),
    clear: async () => void calls.push('clear'),
    write: async (r) => {
      calls.push('write');
      written = r;
    },
  };
  return { io, calls, written: () => written };
}

describe('cuenta real: nunca se carga ni se vacía', () => {
  it('con real_account = true en Supabase, cargar un caso se niega y no escribe nada', async () => {
    const acc = fakeAccount({ flags: { realAccount: true } });
    await expect(loadScenarioIntoAccount(acc.io, marisa, START, NOW)).rejects.toThrow(REAL_ACCOUNT_REFUSAL);
    expect(acc.calls).toEqual(['readFlags']);
    expect(acc.written()).toBeNull();
  });

  it('con real_account = true, vaciar la cuenta también se niega', async () => {
    const acc = fakeAccount({ flags: { realAccount: true, scenarioAccount: true } });
    await expect(clearScenarioAccount(acc.io)).rejects.toThrow(REAL_ACCOUNT_REFUSAL);
    expect(acc.calls).not.toContain('clear');
    expect(acc.calls).not.toContain('mark');
  });

  it('si la app ya sabe que es real, ni siquiera consulta: se niega', async () => {
    const acc = fakeAccount({ realNow: true, flags: {} });
    await expect(loadScenarioIntoAccount(acc.io, marisa, START, NOW)).rejects.toThrow(REAL_ACCOUNT_REFUSAL);
    await expect(clearScenarioAccount(acc.io)).rejects.toThrow(REAL_ACCOUNT_REFUSAL);
    expect(acc.calls).toEqual([]);
  });

  it('una cuenta que fue real y se desmarcó en Ajustes sigue protegida', async () => {
    const acc = fakeAccount({ flags: { realAccount: false } });
    await expect(loadScenarioIntoAccount(acc.io, marisa, START, NOW)).rejects.toThrow(ONCE_REAL_REFUSAL);
    await expect(clearScenarioAccount(acc.io)).rejects.toThrow(ONCE_REAL_REFUSAL);
    expect(acc.calls).toEqual(['readFlags', 'readFlags']);
  });

  it('si no se puede leer la marca en Supabase, no se toca nada', async () => {
    const acc = fakeAccount({ flags: new Error('network down') });
    await expect(loadScenarioIntoAccount(acc.io, marisa, START, NOW)).rejects.toThrow(UNVERIFIED_REFUSAL);
    expect(acc.calls).toEqual(['readFlags']);
  });

  it('sin sesión se niega', async () => {
    const acc = fakeAccount({ signedIn: false });
    await expect(clearScenarioAccount(acc.io)).rejects.toThrow(SIGNED_OUT_REFUSAL);
    expect(acc.calls).toEqual([]);
  });
});

describe('cuenta de prueba', () => {
  it('sin marca: se marca como cuenta de escenarios, se vacía y se escribe el caso, en ese orden', async () => {
    const acc = fakeAccount({ flags: {} });
    await loadScenarioIntoAccount(acc.io, marisa, START, NOW);
    expect(acc.calls).toEqual(['readFlags', 'mark', 'clear', 'write']);
    const r = acc.written()!;
    expect(r.simulation.personaId).toBe('marisa-tension-alta');
    expect(r.profile).toMatchObject({ sex: 'female', dateOfBirth: '1968-01-15', firstName: 'Marisa' });
    // Las últimas semanas, tensión alta todos los días; y el aviso ya recibido en la bandeja
    const lastWeek = r.bloodPressure.filter((b) => NOW.getTime() - new Date(b.fecha).getTime() < 7 * 86400000);
    expect(lastWeek.length).toBeGreaterThanOrEqual(6);
    expect(lastWeek.every((b) => b.systolic >= 146 && b.diastolic >= 90)).toBe(true);
    expect(r.inbox.some((i) => i.id === 'bp_high_weeks')).toBe(true);
  });

  it('una cuenta de escenarios que se marcó real y se desmarcó vuelve a aceptar casos', async () => {
    const acc = fakeAccount({ flags: { realAccount: false, scenarioAccount: true } });
    await clearScenarioAccount(acc.io);
    expect(acc.calls).toEqual(['readFlags', 'mark', 'clear']);
  });
});

// Restricciones de supabase/migrations (initial_schema, bowel_urine_logs, medications, urine_void_ml)
const inRange = (v: number | undefined | null, lo: number, hi: number) => v == null || (Number.isInteger(v) && v >= lo && v <= hi);
const oneOf = <T,>(v: T | undefined | null, list: T[]) => v == null || list.includes(v);

describe('los 13 usuarios simulados caben en las tablas de Supabase', () => {
  for (const p of PERSONAS) {
    it(p.id, () => {
      const r = scenarioRecords(p, START, NOW);
      const all = [
        ...r.checkIns, ...r.cycleStarts, ...r.workouts, ...r.meals, ...r.bowel, ...r.urine,
        ...r.doses, ...r.bloodPressure, ...r.glucose, ...r.basalTemperature,
      ];
      // Nada en el futuro y ningún id repetido en una misma tabla
      expect(all.every((e) => new Date(e.fecha) <= NOW)).toBe(true);
      for (const list of [r.checkIns, r.cycleStarts, r.workouts, r.meals, r.bowel, r.urine, r.medications, r.doses, r.bloodPressure, r.glucose, r.basalTemperature]) {
        const ids = (list as { id: string }[]).map((e) => e.id);
        expect(new Set(ids).size).toBe(ids.length);
      }

      for (const c of r.checkIns) {
        expect(oneOf(c.moment, ['just_woke_up', 'mid_day', 'winding_down'])).toBe(true);
        for (const v of [c.sleep, c.energy, c.stress, c.dayRating]) expect(inRange(v, 1, 5)).toBe(true);
      }
      for (const b of r.bowel) {
        expect(inRange(b.count, 0, 20)).toBe(true);
        expect(oneOf(b.color, ['brown', 'light_brown', 'dark_brown', 'yellow', 'green', 'black', 'red', 'pale'])).toBe(true);
        expect(inRange(b.consistency, 1, 7)).toBe(true);
      }
      for (const u of r.urine) {
        expect(inRange(u.count, 0, 40)).toBe(true);
        expect(inRange(u.nightCount, 0, 10)).toBe(true);
        expect(oneOf(u.color, ['clear', 'pale', 'yellow', 'dark', 'amber', 'brown', 'red', 'cloudy'])).toBe(true);
        expect(oneOf(u.voidVolume, ['quarter', 'half', 'three_quarters', 'full'])).toBe(true);
        expect(oneOf(u.volumeUsual, ['yes', 'no', 'unsure'])).toBe(true);
        expect(inRange(u.dailyTotalMl, 0, 10000)).toBe(true);
        expect(inRange(u.voidMl, 0, 2000)).toBe(true);
      }
      for (const m of r.medications) {
        expect(oneOf(m.kind, ['medication', 'supplement'])).toBe(true);
        expect(oneOf(m.withFood, ['with', 'empty', 'any'])).toBe(true);
        expect(m.name && m.schedule && m.course).toBeTruthy();
      }
      for (const d of r.doses) expect(oneOf(d.status, ['taken', 'skipped'])).toBe(true);
      for (const b of r.bloodPressure) {
        expect(Number.isInteger(b.systolic) && Number.isInteger(b.diastolic)).toBe(true);
        expect(b.pulse == null || Number.isInteger(b.pulse)).toBe(true);
        expect(b.source).toBe('manual');
      }
      for (const g of r.glucose) expect(oneOf(g.unidad, ['mg/dL', 'mmol/L'])).toBe(true);
      for (const w of r.workouts) expect(w.type && w.minutes > 0 && w.intensity).toBeTruthy();
      for (const w of r.wearable) {
        expect(w.date <= '2026-10-15').toBe(true);
        expect(w.date && w.metric && w.sourceName && w.provider && w.rawTypeId && w.rawTypeName).toBeTruthy();
        expect(Number.isFinite(w.value)).toBe(true);
      }
      expect(oneOf(r.profile.sex, ['female', 'male'])).toBe(true);
    });
  }
});

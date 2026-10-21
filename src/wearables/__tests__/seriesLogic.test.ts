import { describe, expect, it } from 'vitest';
import { appleSleepSessions, computeReadiness, formatClock, localDayKey, pickPerDay, sleepNights, SLEEP_STAGE, summarizeSleepSessions, toDailySeries } from '../seriesLogic';
import { appleSourceName, joinAppleSources, joinSources, originName, PHONE_SOURCE } from '../sources';
import { DailyWearableRecord } from '../types';

const rec = (date: string, metric: DailyWearableRecord['metric'], value: number, sourceName: string, rawTypeId = 'x'): DailyWearableRecord => ({
  date,
  metric,
  value,
  sourceName,
  provider: 'health_connect',
  rawTypeId,
  rawTypeName: rawTypeId,
});

const day = (offset: number, now = new Date('2026-10-15T09:00:00')) => {
  const d = new Date(now);
  d.setDate(d.getDate() + offset);
  return localDayKey(d);
};

describe('originName', () => {
  it('names the phone step counter instead of showing the system package', () => {
    expect(originName('com.android.healthconnect.phone.j7c531871fddc3f3bb2531c3792c559e5')).toBe(PHONE_SOURCE);
  });
  it('knows Fitbit and shortens unknown packages', () => {
    expect(originName('com.fitbit.FitbitMobile')).toBe('Fitbit');
    expect(originName('com.acme.band.app')).toBe('Acme');
  });
  it('puts the watch before the phone when both contribute', () => {
    expect(joinSources(['com.android.healthconnect.phone.abc', 'com.fitbit.FitbitMobile'])).toBe(`Fitbit + ${PHONE_SOURCE}`);
  });
});

describe('pickPerDay', () => {
  it('prefers the watch over the phone, and the real resting HR over the estimate', () => {
    const picked = pickPerDay([
      rec('2026-10-14', 'sleep_duration', 400, PHONE_SOURCE),
      rec('2026-10-14', 'sleep_duration', 420, 'Fitbit'),
      rec('2026-10-14', 'resting_heart_rate', 50, 'Fitbit', 'HeartRate:lowest-hour'),
      rec('2026-10-14', 'resting_heart_rate', 56, 'Fitbit', 'RestingHeartRate'),
    ]);
    expect(picked.find((r) => r.metric === 'sleep_duration')?.value).toBe(420);
    expect(picked.find((r) => r.metric === 'resting_heart_rate')?.value).toBe(56);
  });
  it('keeps one value per metric and day, sorted for charts', () => {
    const s = toDailySeries([rec('2026-10-14', 'steps', 5000, 'Fitbit'), rec('2026-10-13', 'steps', 7000, 'Fitbit')]);
    expect(s.steps?.map((p) => p.date)).toEqual(['2026-10-13', '2026-10-14']);
  });
});

describe('computeReadiness', () => {
  const now = new Date('2026-10-15T09:00:00');
  it('is null with steps only (no sleep or heart rate today)', () => {
    expect(computeReadiness({ steps: [{ date: day(0), value: 5000 }] }, now)).toBeNull();
  });
  it('works without HRV and says what is missing', () => {
    const r = computeReadiness(
      {
        sleep_duration: [{ date: day(0), value: 480 }],
        resting_heart_rate: [
          { date: day(-2), value: 58 },
          { date: day(-1), value: 58 },
          { date: day(0), value: 58 },
        ],
      },
      now,
    );
    expect(r).not.toBeNull();
    expect(r!.missing).toEqual(['hrv']);
    // sueño cumplido 90 (peso 0,4) y pulso como siempre 65 (peso 0,25), repartidos: (36 + 16,25) / 0,65 ≈ 80
    expect(r!.score).toBe(80);
  });
  it('ignores yesterday when today has no data yet', () => {
    expect(computeReadiness({ sleep_duration: [{ date: day(-1), value: 480 }] }, now)).toBeNull();
  });

  // Cuatro semanas con algo de ruido normal y hoy, el valor que se pase
  const history = (today: number, base: number, noise: number) =>
    Array.from({ length: 29 }, (_, i) => ({ date: day(i - 28), value: i === 28 ? today : base + (i % 2 ? noise : -noise) }));

  it('a normal day scores in the middle, not near the top', () => {
    const r = computeReadiness(
      { sleep_duration: [{ date: day(0), value: 420 }], hrv: history(45, 45, 4), resting_heart_rate: history(58, 58, 1.5) },
      now,
    )!;
    expect(r.score).toBeGreaterThanOrEqual(60);
    expect(r.score).toBeLessThan(80);
  });

  it('a slightly better day does not max out (the old formula gave 100)', () => {
    const r = computeReadiness(
      { sleep_duration: [{ date: day(0), value: 480 }], hrv: history(52, 45, 4), resting_heart_rate: history(56, 58, 1.5) },
      now,
    )!;
    expect(r.hrv!).toBeLessThan(100);
    expect(r.score).toBeLessThan(95);
  });

  it('sleep is scored against your own goal', () => {
    const series = { sleep_duration: [{ date: day(0), value: 420 }], resting_heart_rate: history(58, 58, 1.5) };
    expect(computeReadiness(series, now, { sleepNeedMin: 420 })!.sleep).toBe(90);
    expect(computeReadiness(series, now, { sleepNeedMin: 480 })!.sleep).toBeLessThan(90);
  });

  it('with only a few days of history a good day counts less', () => {
    const short = Array.from({ length: 6 }, (_, i) => ({ date: day(i - 5), value: i === 5 ? 52 : 57 }));
    const r = computeReadiness({ sleep_duration: [{ date: day(0), value: 450 }], resting_heart_rate: short }, now)!;
    expect(r.restingHr!).toBeLessThan(85);
  });

  it('in the luteal phase a slightly higher pulse is not penalised', () => {
    const series = { sleep_duration: [{ date: day(0), value: 450 }], resting_heart_rate: history(60, 58, 1.5) };
    const plain = computeReadiness(series, now)!;
    const luteal = computeReadiness(series, now, { luteal: true })!;
    expect(luteal.restingHr!).toBeGreaterThan(plain.restingHr!);
    expect(luteal.cycleAdjusted).toBe(true);
    expect(plain.cycleAdjusted).toBe(false);
  });
});

describe('sleep detail', () => {
  // Instantes en hora local del teléfono (sin Z), como los convierte Health Connect al leerlos
  const at = (s: string) => new Date(s).toISOString();
  const stage = (from: string, to: string, kind: number) => ({ startTime: at(from), endTime: at(to), stage: kind });
  const { AWAKE, AWAKE_IN_BED, LIGHT, DEEP, REM, OUT_OF_BED, SLEEPING } = SLEEP_STAGE;

  it('adds up each stage and counts the night for the day you wake up', () => {
    const [n] = summarizeSleepSessions([
      {
        startTime: at('2026-10-15T23:10:00'),
        endTime: at('2026-10-16T07:05:00'),
        source: 'Fitbit',
        stages: [
          stage('2026-10-15T23:10:00', '2026-10-15T23:25:00', AWAKE),
          stage('2026-10-15T23:25:00', '2026-10-16T01:00:00', LIGHT),
          stage('2026-10-16T01:00:00', '2026-10-16T02:30:00', DEEP),
          stage('2026-10-16T02:30:00', '2026-10-16T02:40:00', OUT_OF_BED),
          stage('2026-10-16T02:40:00', '2026-10-16T04:00:00', REM),
          stage('2026-10-16T04:00:00', '2026-10-16T04:20:00', AWAKE_IN_BED),
          stage('2026-10-16T04:20:00', '2026-10-16T07:05:00', LIGHT),
        ],
      },
    ]);
    expect(n.date).toBe('2026-10-16');
    expect(n.stages).toEqual({ deep: 90, light: 95 + 165, rem: 80, awake: 15 + 20, outOfBed: 10 });
    // Despierto en la cama (7) tampoco cuenta como dormido
    expect(n.asleep).toBe(90 + 260 + 80);
    expect(n.start).toBe(-50); // 23:10 de la víspera
    expect(n.end).toBe(425); // 07:05
    expect(formatClock(n.start)).toBe('23:10');
    expect(formatClock(n.end)).toBe('07:05');
  });

  it('gives only duration and times when the source sends no stages', () => {
    const [plain, onlyAsleep] = summarizeSleepSessions([
      { startTime: at('2026-10-15T23:30:00'), endTime: at('2026-10-16T06:30:00'), source: 'Fitbit' },
      {
        startTime: at('2026-10-15T23:00:00'),
        endTime: at('2026-10-16T06:00:00'),
        source: 'Zepp',
        stages: [stage('2026-10-15T23:00:00', '2026-10-16T05:30:00', SLEEPING), stage('2026-10-16T05:30:00', '2026-10-16T06:00:00', AWAKE)],
      },
    ]);
    expect(plain).toMatchObject({ asleep: 420, start: -30, end: 390, stages: null });
    expect(onlyAsleep).toMatchObject({ source: 'Zepp', asleep: 390, stages: null });
  });

  it('takes bed and wake times from the main sleep, not from a nap, and joins a night split in two', () => {
    const [n] = summarizeSleepSessions([
      { startTime: at('2026-10-15T23:00:00'), endTime: at('2026-10-16T03:00:00'), source: 'Fitbit' },
      { startTime: at('2026-10-16T03:30:00'), endTime: at('2026-10-16T07:00:00'), source: 'Fitbit' },
      { startTime: at('2026-10-16T15:00:00'), endTime: at('2026-10-16T15:40:00'), source: 'Fitbit' },
    ]);
    expect(n.asleep).toBe(240 + 210 + 40);
    expect(n.start).toBe(-60);
    expect(n.end).toBe(420);
  });

  it('keeps stages and times from the same app as the chosen night', () => {
    const picked = toDailySeries([
      rec('2026-10-16', 'sleep_duration', 400, PHONE_SOURCE, 'SleepSession'),
      rec('2026-10-16', 'sleep_deep', 30, PHONE_SOURCE, 'SleepSession'),
      rec('2026-10-16', 'sleep_start', 10, PHONE_SOURCE, 'SleepSession'),
      rec('2026-10-16', 'sleep_duration', 420, 'Fitbit', 'SleepSession'),
      rec('2026-10-16', 'sleep_start', -40, 'Fitbit', 'SleepSession'),
      // Fases sueltas de un día sin duración: no se enseñan
      rec('2026-10-15', 'sleep_deep', 50, 'Fitbit', 'SleepSession'),
    ]);
    expect(picked.sleep_duration).toEqual([{ date: '2026-10-16', value: 420 }]);
    expect(picked.sleep_start).toEqual([{ date: '2026-10-16', value: -40 }]);
    // El reloj no dio fases esa noche: no se cogen las del teléfono
    expect(picked.sleep_deep).toBeUndefined();
  });

  it('builds each night for the screen, with no stages when there are none', () => {
    const nights = sleepNights({
      sleep_duration: [
        { date: '2026-10-15', value: 400 },
        { date: '2026-10-16', value: 450 },
      ],
      sleep_start: [
        { date: '2026-10-15', value: -30 },
        { date: '2026-10-16', value: -50 },
      ],
      sleep_end: [
        { date: '2026-10-15', value: 400 },
        { date: '2026-10-16', value: 425 },
      ],
      sleep_deep: [{ date: '2026-10-16', value: 90 }],
      sleep_light: [{ date: '2026-10-16', value: 259 }],
      sleep_rem: [{ date: '2026-10-16', value: 80 }],
      sleep_awake: [{ date: '2026-10-16', value: 35 }],
    });
    expect(nights[0]).toEqual({ date: '2026-10-15', asleep: 400, start: -30, end: 400, stages: null });
    // 450 - 429 = 21 min dormido sin fase (p. ej. una siesta); el sueño fuera de la cama no llegó: 0
    expect(nights[1].stages).toEqual({ deep: 90, light: 259, rem: 80, awake: 35, outOfBed: 0, other: 21 });
  });

  it('keeps clock times on the night the clocks change', () => {
    // En España el 25/10/2026 a las 3:00 vuelven a ser las 2:00: esa noche dura una hora más
    const [n] = summarizeSleepSessions([{ startTime: at('2026-10-24T23:00:00'), endTime: at('2026-10-25T07:00:00'), source: 'Fitbit' }]);
    expect([n.start, n.end]).toEqual([-60, 420]);
  });

  it('formats times after midnight and the day before', () => {
    expect(formatClock(-1)).toBe('23:59');
    expect(formatClock(0)).toBe('00:00');
    expect(formatClock(75)).toBe('01:15');
  });
});

describe('Apple Health', () => {
  const at = (local: string) => new Date(local).toISOString();
  const sample = (from: string, to: string, value: number, source = 'Apple Watch') => ({ startTime: at(from), endTime: at(to), value, source });

  it('names Apple devices by model, never by the name their owner gave them', () => {
    const apple = { name: 'Apple Watch de Ana', bundleIdentifier: 'com.apple.health.81B2' };
    expect(appleSourceName(apple, 'Watch7,1')).toBe('Apple Watch');
    expect(appleSourceName({ name: 'iPhone de Ana', bundleIdentifier: 'com.apple.health.81B2' }, 'iPhone16,2')).toBe(PHONE_SOURCE);
    expect(appleSourceName(apple)).toBe('Apple Watch');
    expect(appleSourceName({ name: 'Oura', bundleIdentifier: 'com.ouraring.oura' })).toBe('Oura');
    expect(appleSourceName({ name: 'WHOOP', bundleIdentifier: 'com.whoop.unknown' })).toBe('WHOOP');
    expect(joinAppleSources([{ name: 'iPhone de Ana', bundleIdentifier: 'com.apple.health.1' }, { name: 'Oura', bundleIdentifier: 'com.ouraring.oura' }])).toBe(`Oura + ${PHONE_SOURCE}`);
  });

  it('joins the stages of one night, even when it starts before midnight', () => {
    const sessions = appleSleepSessions([
      sample('2026-10-17T22:50:00', '2026-10-18T07:10:00', 0), // en la cama: no cuenta
      sample('2026-10-17T23:10:00', '2026-10-18T00:40:00', 3), // básico
      sample('2026-10-18T00:40:00', '2026-10-18T01:40:00', 4), // profundo
      sample('2026-10-18T01:40:00', '2026-10-18T02:00:00', 2), // despierto
      sample('2026-10-18T02:00:00', '2026-10-18T06:00:00', 3),
      sample('2026-10-18T06:00:00', '2026-10-18T07:00:00', 5), // REM
    ]);
    expect(sessions).toHaveLength(1);
    const [night] = summarizeSleepSessions(sessions);
    expect(night.date).toBe('2026-10-18');
    expect(night.asleep).toBe(90 + 60 + 240 + 60);
    expect(night.stages).toEqual({ deep: 60, light: 330, rem: 60, awake: 20, outOfBed: 0 });
    expect([night.start, night.end]).toEqual([-50, 420]);
  });

  it('keeps each app apart and drops nights that are only "in bed"', () => {
    const sessions = appleSleepSessions([
      sample('2026-10-17T23:00:00', '2026-10-18T07:00:00', 1, 'Oura'),
      sample('2026-10-17T23:30:00', '2026-10-18T06:30:00', 0, 'This phone'),
      sample('2026-10-18T23:00:00', '2026-10-19T06:00:00', 3),
    ]);
    expect(sessions.map((s) => s.source).sort()).toEqual(['Apple Watch', 'Oura']);
    const nights = summarizeSleepSessions(sessions);
    expect(nights.find((n) => n.source === 'Oura')).toMatchObject({ date: '2026-10-18', asleep: 480, stages: null });
  });
});

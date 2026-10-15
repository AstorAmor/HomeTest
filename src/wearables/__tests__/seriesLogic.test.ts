import { describe, expect, it } from 'vitest';
import { computeReadiness, localDayKey, pickPerDay, toDailySeries } from '../seriesLogic';
import { joinSources, originName, PHONE_SOURCE } from '../sources';
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
    // sueño 100 (peso 0,4) y pulso como siempre 70 (peso 0,25), repartidos: (40 + 17,5) / 0,65 ≈ 88
    expect(r!.score).toBe(88);
  });
  it('ignores yesterday when today has no data yet', () => {
    expect(computeReadiness({ sleep_duration: [{ date: day(-1), value: 480 }] }, now)).toBeNull();
  });
});

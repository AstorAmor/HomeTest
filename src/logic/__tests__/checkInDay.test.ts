import { describe, expect, it } from 'vitest';
import { checkInDayKey, checkInDayOptions, fechaForCheckIn, suggestMoment } from '../checkInDay';

// Fechas en hora local (como las crea la app)
const at = (s: string) => new Date(s).toISOString();

describe('checkInDayKey', () => {
  it('counts a late "winding down" check-in for the day before', () => {
    expect(checkInDayKey({ fecha: at('2026-10-17T00:10:00'), moment: 'winding_down' })).toBe('2026-10-16');
    expect(checkInDayKey({ fecha: at('2026-10-17T03:59:00'), moment: 'mid_day' })).toBe('2026-10-16');
  });

  it('keeps the clock day from 4:00 and for wake-up check-ins', () => {
    expect(checkInDayKey({ fecha: at('2026-10-17T04:00:00'), moment: 'winding_down' })).toBe('2026-10-17');
    expect(checkInDayKey({ fecha: at('2026-10-17T03:30:00'), moment: 'just_woke_up' })).toBe('2026-10-17');
    expect(checkInDayKey({ fecha: at('2026-10-17T23:50:00'), moment: 'winding_down' })).toBe('2026-10-17');
  });

  it('works across a month boundary', () => {
    expect(checkInDayKey({ fecha: at('2026-11-01T01:00:00'), moment: 'winding_down' })).toBe('2026-10-31');
  });
});

describe('suggestMoment', () => {
  it('suggests the end of the day in the small hours', () => {
    expect(suggestMoment(new Date('2026-10-17T00:10:00'))).toBe('winding_down');
    expect(suggestMoment(new Date('2026-10-17T07:00:00'))).toBe('just_woke_up');
    expect(suggestMoment(new Date('2026-10-17T13:00:00'))).toBe('mid_day');
    expect(suggestMoment(new Date('2026-10-17T21:00:00'))).toBe('winding_down');
  });
});

describe('fechaForCheckIn', () => {
  const now = new Date('2026-10-17T10:00:00');

  it('keeps the real time when it already falls on the chosen day', () => {
    const keep = at('2026-10-17T00:10:00');
    expect(fechaForCheckIn('2026-10-16', 'winding_down', keep, now)).toBe(keep);
  });

  it('moves to the typical hour of the moment on another day', () => {
    expect(fechaForCheckIn('2026-10-15', 'winding_down', at('2026-10-17T00:10:00'), now)).toBe(at('2026-10-15T22:00:00'));
  });

  it('never stores a time in the future', () => {
    expect(fechaForCheckIn('2026-10-17', 'winding_down', at('2026-10-16T22:00:00'), now)).toBe(now.toISOString());
  });
});

describe('checkInDayOptions', () => {
  it('offers the day it would count for and the two before', () => {
    expect(checkInDayOptions('winding_down', new Date('2026-10-17T00:10:00'))).toEqual(['2026-10-16', '2026-10-15', '2026-10-14']);
    expect(checkInDayOptions('just_woke_up', new Date('2026-10-17T08:00:00'))).toEqual(['2026-10-17', '2026-10-16', '2026-10-15']);
  });

  it('adds an older current day when editing', () => {
    expect(checkInDayOptions('mid_day', new Date('2026-10-17T12:00:00'), '2026-10-10')).toEqual([
      '2026-10-17',
      '2026-10-16',
      '2026-10-15',
      '2026-10-10',
    ]);
  });
});

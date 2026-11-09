import { describe, expect, it } from 'vitest';
import { deliverySettings, manualSteps, oemFamily, openByDefault } from '@/logic/deliveryHelp';
import { es } from '@/i18n/es';

describe('para que los avisos lleguen', () => {
  it('reconoce Xiaomi, Redmi y POCO por fabricante o marca', () => {
    expect(oemFamily('Xiaomi', 'POCO')).toBe('xiaomi');
    expect(oemFamily('Xiaomi', 'Redmi')).toBe('xiaomi');
    expect(oemFamily(null, 'poco')).toBe('xiaomi');
    expect(oemFamily('samsung', 'samsung')).toBe('samsung');
    expect(oemFamily('Google', 'google')).toBe('other');
    expect(oemFamily(undefined, undefined)).toBe('other');
  });

  it('«Alarmas y recordatorios» solo desde Android 12', () => {
    expect(deliverySettings(30)).toEqual(['battery', 'lock_screen']);
    expect(deliverySettings(31)).toEqual(['exact_alarms', 'battery', 'lock_screen']);
    expect(deliverySettings(35)[0]).toBe('exact_alarms');
  });

  it('pasos a mano según el móvil; abierto de entrada en Xiaomi', () => {
    expect(manualSteps('xiaomi')).toHaveLength(4);
    expect(manualSteps('other')).toEqual([]);
    expect(openByDefault('xiaomi')).toBe(true);
    expect(openByDefault('samsung')).toBe(false);
  });

  it('todos los textos traducidos', () => {
    const dict = es as Record<string, string>;
    const keys = [
      ...manualSteps('xiaomi'),
      ...manualSteps('samsung'),
      'For your reminders to arrive',
      'Some phones close Kuova in the background or delay its notifications to save battery. Check this once:',
      'Alarms & reminders',
      'So the workout rest and your doses ring on time.',
      'Battery',
      'Find Kuova and choose «Unrestricted» or «Don’t optimise».',
      'Lock screen',
      'In Kuova’s notifications, allow them on the lock screen.',
      'Open',
      'On Xiaomi, Redmi and POCO, also in Kuova’s settings:',
      'On Samsung, also in Kuova’s settings:',
      'Open Kuova’s settings',
      'Send a test notification in 1 minute',
      'Done. Lock your phone and wait a minute. If it does not arrive, or arrives late, check the steps above.',
      'Kuova notifications are off in your phone settings.',
      'Kuova test notification',
      'If you can see this with your phone locked, your reminders are getting through.',
    ];
    expect(keys.filter((k) => !dict[k])).toEqual([]);
  });
});

// «Para que los avisos lleguen» (Ajustes → Notificaciones, solo Android), 2026-11-09. Lógica pura, con tests.
//
// Algunos móviles cierran Kuova en segundo plano o retrasan sus avisos para ahorrar batería, sobre todo
// Xiaomi, Redmi y POCO (HyperOS/MIUI). Kuova no puede cambiar esos ajustes: los enseña con un botón a
// cada uno y un aviso de prueba. Qué pasos tocan según el móvil lo decide esto.

export type OemFamily = 'xiaomi' | 'samsung' | 'other';

// Platform.constants.Manufacturer y Brand en Android (p. ej. «Xiaomi» / «POCO», «samsung»)
export function oemFamily(manufacturer?: string | null, brand?: string | null): OemFamily {
  const s = `${manufacturer ?? ''} ${brand ?? ''}`.toLowerCase();
  if (/xiaomi|redmi|poco/.test(s)) return 'xiaomi';
  if (/samsung/.test(s)) return 'samsung';
  return 'other';
}

// Ajustes del sistema con botón directo
export type DeliverySetting = 'exact_alarms' | 'battery' | 'lock_screen';

// «Alarmas y recordatorios» existe desde Android 12 (API 31); en Android 14+ viene denegado de serie
// y sin él el aviso no sale a su hora (expo-notifications usa una alarma inexacta)
export function deliverySettings(androidApi: number): DeliverySetting[] {
  return [...(androidApi >= 31 ? (['exact_alarms'] as const) : []), 'battery', 'lock_screen'];
}

// Pasos que solo se pueden hacer a mano, en la ficha de Kuova de los ajustes del móvil
export function manualSteps(family: OemFamily): string[] {
  switch (family) {
    case 'xiaomi':
      return [
        'Autostart: on.',
        'Battery saver: No restrictions.',
        'Notifications: turn on «Lock screen» and «Floating notifications».',
        'In recent apps, do not swipe Kuova away: lock it with the padlock.',
      ];
    case 'samsung':
      return ['Battery: Unrestricted.'];
    default:
      return [];
  }
}

// Abierto de entrada en los móviles que más fallan; en los demás, plegado
export const openByDefault = (family: OemFamily) => family === 'xiaomi';

import { useEffect } from 'react';
import { Href, router } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { clearPhoneReminders, listenToReminderTaps, startPhoneReminders } from '@/data/phoneReminders';

// Recordatorios del móvil (src/data/phoneReminders.ts) para el paciente con sesión: se programan al
// abrir la app, al volver a ella y tras cada cambio, y al tocar uno se abre su pantalla. Sin sesión
// (o en la interfaz de profesionales) no queda nada programado. Sin el módulo nativo (APK antiguo,
// web) no hace nada.
export function PhoneReminders() {
  const { initializing, isLoggedIn, professional, demoMode, user } = useAuth();
  const patient = isLoggedIn && !professional && demoMode !== 'pro';

  useEffect(() => {
    if (initializing) return;
    if (!patient) {
      clearPhoneReminders();
      return;
    }
    const stop = startPhoneReminders();
    const offTaps = listenToReminderTaps((route) => router.push(route as Href));
    return () => {
      stop();
      offTaps();
    };
  }, [initializing, patient, user?.id]);

  return null;
}

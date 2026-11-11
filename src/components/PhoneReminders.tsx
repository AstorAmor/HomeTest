import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { Href, router } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { usePasswordResetPending } from '@/data/passwordReset';
import { clearPhoneReminders, listenToReminderTaps, startPhoneReminders } from '@/data/phoneReminders';

// Recordatorios del móvil (src/data/phoneReminders.ts) para el paciente con sesión: se programan al
// abrir la app, al volver a ella y tras cada cambio, y al tocar uno se abre su pantalla. Sin sesión
// (o en la interfaz de profesionales) no queda nada programado. Sin el módulo nativo (APK antiguo,
// web) no hace nada.
//
// La pantalla del aviso no se abre en el momento del toque sino cuando se puede (fundador, 2026-11-11:
// la toma llevaba a «Notificaciones», la pantalla en la que estaba, y no a Medicación). En Android el
// toque llega mientras la app vuelve de segundo plano, antes de estar delante, y la navegación hecha
// entonces se puede perder. Así que espera a que la app esté en primer plano y sin el doble factor ni
// «Elige una contraseña nueva» delante (MfaGuard: ahí no están montadas las rutas), y un momento más
// para que la primera pantalla termine de redirigir si la app se acaba de abrir.
const OPEN_DELAY_MS = 600;

export function PhoneReminders() {
  const { initializing, isLoggedIn, professional, demoMode, user, mfaGate } = useAuth();
  const resetPending = usePasswordResetPending();
  const patient = isLoggedIn && !professional && demoMode !== 'pro';
  const [active, setActive] = useState(AppState.currentState === 'active');
  const [pending, setPending] = useState<string | null>(null);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => setActive(s === 'active'));
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (initializing) return;
    if (!patient) {
      setPending(null);
      clearPhoneReminders();
      return;
    }
    const stop = startPhoneReminders();
    const offTaps = listenToReminderTaps(setPending);
    return () => {
      stop();
      offTaps();
    };
  }, [initializing, patient, user?.id]);

  useEffect(() => {
    if (!pending || !patient || !active || mfaGate || resetPending) return;
    const id = setTimeout(() => {
      setPending(null);
      router.push(pending as Href);
    }, OPEN_DELAY_MS);
    return () => clearTimeout(id);
  }, [pending, patient, active, mfaGate, resetPending]);

  return null;
}

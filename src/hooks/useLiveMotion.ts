// ¿Puede moverse ya una animación que no para (la nebulosa del check-in)? Solo cuando se ve: la app
// en primer plano, la pantalla enfocada (no hay otra encima) y, si vive en una pestaña, esa pestaña
// a la vista. Las cinco pestañas se quedan montadas (MainTabsScreen), así que sin esto Hoy seguiría
// pintando fotogramas con el móvil en Mis datos y gastando batería.
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { useIsFocused } from 'expo-router'; // no de @react-navigation: Expo Router 56+ no lo admite

// La pestaña que se ve (la apunta MainTabsScreen al cambiar de página)
let visibleTab = 0;
const subs = new Set<(n: number) => void>();

export function setVisibleTab(n: number) {
  if (n === visibleTab) return;
  visibleTab = n;
  subs.forEach((f) => f(n));
}

export function useVisibleTab(): number {
  const [tab, setTab] = useState(visibleTab);
  useEffect(() => {
    subs.add(setTab);
    setTab(visibleTab);
    return () => {
      subs.delete(setTab);
    };
  }, []);
  return tab;
}

function useAppActive(): boolean {
  const [active, setActive] = useState(AppState.currentState !== 'background' && AppState.currentState !== 'inactive');
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => setActive(s === 'active'));
    return () => sub.remove();
  }, []);
  return active;
}

export function useLiveMotion(tab?: number): boolean {
  const focused = useIsFocused();
  const current = useVisibleTab();
  const app = useAppActive();
  return focused && app && (tab === undefined || current === tab);
}

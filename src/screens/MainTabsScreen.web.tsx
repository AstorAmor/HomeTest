import React, { useEffect, useState } from 'react';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { View, StyleSheet } from 'react-native';
import { TodayScreen } from './TodayScreen';
import { PlanScreen } from './PlanScreen';
import { LabScreen } from './LabScreen';
import { MoreScreen } from './MoreScreen';
import { BottomTabBar, TABS } from '@/components/BottomTabBar';
import { useWebShell } from '@/web/webMode';
import { TourOverlay } from '@/components/tour/TourOverlay';
import { useAuth } from '@/context/AuthContext';
import { setVisibleTab } from '@/hooks/useLiveMotion';
import { onGoToTab } from '@/constants/tabs';

const LAST = TABS.length - 1;

// Variante web de MainTabsScreen: react-native-pager-view no soporta web,
// así que aquí se cambia de pestaña sin gesto de swipe (solo con la tab bar).
// La pestaña va en la URL (?tab=N): al recargar (p. ej. al cambiar el tema) se vuelve a la misma,
// y el modo Señalar sabe en qué pestaña estás. Las cuatro se quedan montadas (como en el móvil): al
// volver a una no se recarga entera de golpe.
export const MainTabsScreen = () => {
  const router = useRouter();
  // Web del paciente en escritorio: el menú lateral elige la pestaña, sin barra abajo
  const shell = useWebShell();
  const { isLoggedIn, initializing } = useAuth();
  const { tab } = useLocalSearchParams<{ tab?: string }>();
  const [currentPage, setCurrentPage] = useState(Math.min(LAST, Math.max(0, Number(tab) || 0)));
  // Las animaciones que no paran solo se mueven a la vista (useLiveMotion)
  React.useEffect(() => setVisibleTab(currentPage), [currentPage]);

  useEffect(() => {
    const n = Math.min(LAST, Math.max(0, Number(tab) || 0));
    if (tab !== undefined && n !== currentPage) setCurrentPage(n);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const select = (i: number) => {
    setCurrentPage(i);
    router.setParams({ tab: String(i) });
  };
  // Saltos desde dentro de una pestaña (goToTab: «Ver» en Hoy lleva a Análisis…)
  useEffect(
    () =>
      onGoToTab((n) => {
        setCurrentPage(n);
        router.setParams({ tab: String(n) });
      }),
    [router],
  );

  const pages = [
    <TodayScreen key="today" />,
    <PlanScreen key="plan" />,
    <LabScreen key="analysis" />,
    <MoreScreen key="you" />,
  ];

  // Sin sesión (se ha cerrado o ha caducado) no se queda dentro: al inicio de sesión
  if (!initializing && !isLoggedIn) return <Redirect href="/" />;
  // En la web del paciente, "Hoy" es el resumen
  if (shell && currentPage === 0) return <Redirect href="/resumen" />;

  return (
    <View style={styles.container}>
      <View style={styles.page}>
        {pages.map((page, i) => (
          <View key={page.key} style={[styles.page, i !== currentPage && styles.hidden]}>
            {page}
          </View>
        ))}
      </View>
      {!shell && <BottomTabBar currentIndex={currentPage} onTabPress={select} />}
      {/* En la web de escritorio no hay barra de pestañas: el tutorial es para el móvil */}
      <TourOverlay goToTab={select} enabled={!shell} />
    </View>
  );
};

const styles = StyleSheet.create({
  // Transparente: el fondo ambiental lo pone el _layout debajo de cada pantalla (ScreenBackdrop)
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  page: {
    flex: 1,
  },
  hidden: { display: 'none' },
});

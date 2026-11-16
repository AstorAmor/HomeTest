import React, { useEffect, useRef, useState } from 'react';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { View, StyleSheet } from 'react-native';
import PagerView from 'react-native-pager-view';
import { TodayScreen } from './TodayScreen';
import { PlanScreen } from './PlanScreen';
import { LabScreen } from './LabScreen';
import { MoreScreen } from './MoreScreen';
import { BottomTabBar, TABS } from '@/components/BottomTabBar';
import { TourOverlay } from '@/components/tour/TourOverlay';
import { useAuth } from '@/context/AuthContext';
import { setVisibleTab } from '@/hooks/useLiveMotion';
import { onGoToTab } from '@/constants/tabs';
import { markAppReady } from '@/components/LaunchIntro';

// Pestañas con deslizamiento lateral (también al tocarlas): Hoy, Plan, Análisis y Tú (2026-11-16; el
// botón K del centro de la barra no es pestaña). Las cuatro se quedan preparadas
// (offscreenPageLimit): sin eso, Android suelta las que no se ven y al volver a Hoy la tenía que pintar
// otra vez entera mientras deslizaba, y se veía a saltos.
export const MainTabsScreen = () => {
  const pagerRef = useRef<PagerView>(null);
  const { tab } = useLocalSearchParams<{ tab?: string }>();
  const initialTab = Math.min(TABS.length - 1, Math.max(0, Number(tab) || 0));
  const [currentPage, setCurrentPage] = useState(initialTab);
  // Las animaciones que no paran solo se mueven a la vista (useLiveMotion)
  React.useEffect(() => setVisibleTab(currentPage), [currentPage]);
  // Ya hay pestañas debajo: la entrada de la marca se puede ir (LaunchIntro)
  useEffect(() => markAppReady(), []);
  // Al entrar se monta solo la pestaña que se ve; las otras tres, pasado el fundido de la entrada (o en cuanto
  // vas a una). Montar las cuatro a la vez justo al entrar trababa la primera pintura (fundador, 2026-11-16: «da
  // saltos, no va fluido»). Después se quedan todas puestas (offscreenPageLimit), como antes.
  const [allMounted, setAllMounted] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setAllMounted(true), 1200);
    return () => clearTimeout(id);
  }, []);
  const mounted = (i: number) => allMounted || i === currentPage || i === initialTab;

  const handleTabPress = (index: number) => {
    pagerRef.current?.setPage(index);
  };
  // «Ver» en Hoy y demás saltos desde dentro de una pestaña (goToTab), y los que llegan por la URL
  // (router.navigate a /(tabs)?tab=N desde una pantalla de encima)
  useEffect(() => onGoToTab((n) => pagerRef.current?.setPage(n)), []);
  useEffect(() => {
    if (tab === undefined) return;
    pagerRef.current?.setPage(Math.min(TABS.length - 1, Math.max(0, Number(tab) || 0)));
  }, [tab]);

  // Sin sesión (se ha cerrado o ha caducado) no se queda dentro: al inicio de sesión
  const { isLoggedIn, initializing } = useAuth();
  if (!initializing && !isLoggedIn) return <Redirect href="/" />;

  return (
    <View style={styles.container}>
      <PagerView
        ref={pagerRef}
        style={styles.pager}
        initialPage={initialTab}
        offscreenPageLimit={TABS.length - 1}
        onPageSelected={(event) => setCurrentPage(event.nativeEvent.position)}
      >
        <View key="today" style={styles.page}>
          {mounted(0) && <TodayScreen />}
        </View>
        <View key="plan" style={styles.page}>
          {mounted(1) && <PlanScreen />}
        </View>
        <View key="analysis" style={styles.page}>
          {mounted(2) && <LabScreen />}
        </View>
        <View key="you" style={styles.page}>
          {mounted(3) && <MoreScreen />}
        </View>
      </PagerView>

      <BottomTabBar currentIndex={currentPage} onTabPress={handleTabPress} />
      <TourOverlay goToTab={handleTabPress} />
    </View>
  );
};

const styles = StyleSheet.create({
  // Transparente: el fondo ambiental lo pone el _layout debajo de cada pantalla (ScreenBackdrop)
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  pager: {
    flex: 1,
  },
  page: {
    flex: 1,
  },
});

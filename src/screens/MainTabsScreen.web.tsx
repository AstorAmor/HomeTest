import React, { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { View, StyleSheet } from 'react-native';
import { TodayScreen } from './TodayScreen';
import { MyDataScreen } from './MyDataScreen';
import { ScheduleScreen } from './ScheduleScreen';
import { LabScreen } from './LabScreen';
import { MoreScreen } from './MoreScreen';
import { BottomTabBar, TABS } from '@/components/BottomTabBar';
import { Colors } from '@/constants/colors';
import { useWebShell } from '@/web/webMode';

const LAST = TABS.length - 1;

// Variante web de MainTabsScreen: react-native-pager-view no soporta web,
// así que aquí se cambia de pestaña sin gesto de swipe (solo con la tab bar).
// La pestaña va en la URL (?tab=N): al recargar (p. ej. al cambiar el tema) se vuelve a la misma,
// y el modo Señalar sabe en qué pestaña estás.
export const MainTabsScreen = () => {
  const router = useRouter();
  // Web del paciente en escritorio: el menú lateral elige la pestaña, sin barra abajo
  const shell = useWebShell();
  const { tab } = useLocalSearchParams<{ tab?: string }>();
  const [currentPage, setCurrentPage] = useState(Math.min(LAST, Math.max(0, Number(tab) || 0)));

  useEffect(() => {
    const n = Math.min(LAST, Math.max(0, Number(tab) || 0));
    if (tab !== undefined && n !== currentPage) setCurrentPage(n);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const select = (i: number) => {
    setCurrentPage(i);
    router.setParams({ tab: String(i) });
  };

  const pages = [
    <TodayScreen key="today" />,
    <MyDataScreen key="my-data" />,
    <ScheduleScreen key="schedule" embedded />,
    <LabScreen key="lab" />,
    <MoreScreen key="more" />,
  ];

  return (
    <View style={styles.container}>
      <View style={styles.page}>{pages[currentPage]}</View>
      {!shell && <BottomTabBar currentIndex={currentPage} onTabPress={select} />}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  page: {
    flex: 1,
  },
});

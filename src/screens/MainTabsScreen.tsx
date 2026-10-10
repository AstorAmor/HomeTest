import React, { useEffect, useRef, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { View, StyleSheet } from 'react-native';
import PagerView from 'react-native-pager-view';
import { TodayScreen } from './TodayScreen';
import { MyDataScreen } from './MyDataScreen';
import { ScheduleScreen } from './ScheduleScreen';
import { LabScreen } from './LabScreen';
import { MoreScreen } from './MoreScreen';
import { BottomTabBar, TABS } from '@/components/BottomTabBar';
import { Colors } from '@/constants/colors';
import { useWebShell } from '@/web/webMode';

export const MainTabsScreen = () => {
  const pagerRef = useRef<PagerView>(null);
  const { tab } = useLocalSearchParams<{ tab?: string }>();
  const initialTab = Math.min(TABS.length - 1, Math.max(0, Number(tab) || 0));
  const [currentPage, setCurrentPage] = useState(initialTab);

  const handleTabPress = (index: number) => {
    pagerRef.current?.setPage(index);
  };

  // Web del paciente en escritorio: el menú lateral elige la pestaña (?tab=N), sin barra abajo
  const shell = useWebShell();
  useEffect(() => {
    if (shell) setCurrentPage(initialTab);
  }, [shell, initialTab]);
  if (shell) {
    const pages = [<TodayScreen key="today" />, <MyDataScreen key="my-data" />, <ScheduleScreen key="schedule" embedded />, <LabScreen key="lab" />, <MoreScreen key="more" />];
    return <View style={styles.container}>{pages[currentPage] ?? pages[0]}</View>;
  }

  return (
    <View style={styles.container}>
      <PagerView
        ref={pagerRef}
        style={styles.pager}
        initialPage={initialTab}
        onPageSelected={(event) => setCurrentPage(event.nativeEvent.position)}
      >
        <View key="today" style={styles.page}>
          <TodayScreen />
        </View>
        <View key="my-data" style={styles.page}>
          <MyDataScreen />
        </View>
        <View key="schedule" style={styles.page}>
          <ScheduleScreen embedded />
        </View>
        <View key="lab" style={styles.page}>
          <LabScreen />
        </View>
        <View key="more" style={styles.page}>
          <MoreScreen />
        </View>
      </PagerView>

      <BottomTabBar currentIndex={currentPage} onTabPress={handleTabPress} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  pager: {
    flex: 1,
  },
  page: {
    flex: 1,
  },
});

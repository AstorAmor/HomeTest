import React, { useRef, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { Animated, Easing, View, StyleSheet } from 'react-native';
import PagerView from 'react-native-pager-view';
import { TodayScreen } from './TodayScreen';
import { MyDataScreen } from './MyDataScreen';
import { ScheduleScreen } from './ScheduleScreen';
import { LabScreen } from './LabScreen';
import { MoreScreen } from './MoreScreen';
import { BottomTabBar, TABS } from '@/components/BottomTabBar';
import { Colors } from '@/constants/colors';

// Al tocar una pestaña: fundido corto en vez de deslizar (deslizar de Agenda a Hoy pasaba por todas
// las de en medio de golpe). Con el dedo se sigue deslizando de una en una.
const FADE_OUT_MS = 90;
const FADE_IN_MS = 200;

export const MainTabsScreen = () => {
  const pagerRef = useRef<PagerView>(null);
  const { tab } = useLocalSearchParams<{ tab?: string }>();
  const initialTab = Math.min(TABS.length - 1, Math.max(0, Number(tab) || 0));
  const [currentPage, setCurrentPage] = useState(initialTab);
  const fade = useRef(new Animated.Value(1)).current;

  const handleTabPress = (index: number) => {
    if (index === currentPage) return;
    setCurrentPage(index);
    Animated.timing(fade, { toValue: 0, duration: FADE_OUT_MS, easing: Easing.out(Easing.quad), useNativeDriver: true }).start(() => {
      pagerRef.current?.setPageWithoutAnimation(index);
      Animated.timing(fade, { toValue: 1, duration: FADE_IN_MS, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
    });
  };

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.pager, { opacity: fade }]}>
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
          <View key="lab" style={styles.page}>
            <LabScreen />
          </View>
          <View key="schedule" style={styles.page}>
            <ScheduleScreen embedded />
          </View>
          <View key="more" style={styles.page}>
            <MoreScreen />
          </View>
        </PagerView>
      </Animated.View>

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

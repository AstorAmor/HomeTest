import React, { useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import PagerView from 'react-native-pager-view';
import { TodayScreen } from './TodayScreen';
import { MyDataScreen } from './MyDataScreen';
import { LabScreen } from './LabScreen';
import { MoreScreen } from './MoreScreen';
import { BottomTabBar } from '@/components/BottomTabBar';
import { Colors } from '@/constants/colors';

export const MainTabsScreen = () => {
  const pagerRef = useRef<PagerView>(null);
  const [currentPage, setCurrentPage] = useState(0);

  const handleTabPress = (index: number) => {
    pagerRef.current?.setPage(index);
  };

  return (
    <View style={styles.container}>
      <PagerView
        ref={pagerRef}
        style={styles.pager}
        initialPage={0}
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

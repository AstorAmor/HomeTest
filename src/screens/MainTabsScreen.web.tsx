import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { TodayScreen } from './TodayScreen';
import { MyDataScreen } from './MyDataScreen';
import { LabScreen } from './LabScreen';
import { MoreScreen } from './MoreScreen';
import { BottomTabBar } from '@/components/BottomTabBar';
import { Colors } from '@/constants/colors';

// Variante web de MainTabsScreen: react-native-pager-view no soporta web,
// así que aquí se cambia de pestaña sin gesto de swipe (solo con la tab bar).
export const MainTabsScreen = () => {
  const [currentPage, setCurrentPage] = useState(0);

  const pages = [<TodayScreen key="today" />, <MyDataScreen key="my-data" />, <LabScreen key="lab" />, <MoreScreen key="more" />];

  return (
    <View style={styles.container}>
      <View style={styles.page}>{pages[currentPage]}</View>
      <BottomTabBar currentIndex={currentPage} onTabPress={setCurrentPage} />
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

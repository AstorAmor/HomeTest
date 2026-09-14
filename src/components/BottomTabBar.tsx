import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';

interface TabConfig {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  activeIcon: keyof typeof Ionicons.glyphMap;
}

const TABS: TabConfig[] = [
  { label: 'Today', icon: 'heart-outline', activeIcon: 'heart' },
  { label: 'My Data', icon: 'analytics-outline', activeIcon: 'analytics-outline' },
  { label: 'Lab', icon: 'flask-outline', activeIcon: 'flask' },
  {
    label: 'More',
    icon: 'ellipsis-horizontal-circle-outline',
    activeIcon: 'ellipsis-horizontal-circle-outline',
  },
];

interface BottomTabBarProps {
  currentIndex: number;
  onTabPress: (index: number) => void;
}

export const BottomTabBar = ({ currentIndex, onTabPress }: BottomTabBarProps) => {
  return (
    <SafeAreaView edges={['bottom']} style={styles.safeArea}>
      <View style={styles.tabBar}>
        {TABS.map((tab, index) => {
          const isActive = index === currentIndex;
          const color = isActive ? Colors.tabBarActive : Colors.tabBarInactive;

          return (
            <TouchableOpacity
              key={tab.label}
              style={styles.tabButton}
              onPress={() => onTabPress(index)}
              activeOpacity={0.7}
            >
              <Ionicons name={isActive ? tab.activeIcon : tab.icon} size={24} color={color} />
              <Text style={[styles.label, { color }]}>{tab.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: Colors.tabBarBackground,
  },
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: Colors.tabBarBorder,
    backgroundColor: Colors.tabBarBackground,
    paddingTop: 8,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    paddingBottom: 6,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
  },
});

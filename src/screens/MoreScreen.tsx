import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Avatar } from '@/components/Avatar';
import { SwipeableScreen } from '@/components/SwipeableScreen';
import { Colors } from '@/constants/colors';
import { mockPatient, mockDoctor } from '@/data/mockData';
import { useAuth } from '@/context/AuthContext';

const avatarSource = require('../../assets/images/avatar.jpg');

interface MenuItem {
  id: string;
  title: string;
  subtitle: string;
  iconFamily: 'ionicons' | 'material';
  icon: string;
  isProfile?: boolean;
}

const menuItems: MenuItem[] = [
  {
    id: 'profile',
    title: 'My Profile',
    subtitle: 'View and edit details',
    iconFamily: 'ionicons',
    icon: 'person-outline',
    isProfile: true,
  },
  {
    id: 'schedule',
    title: 'Manage your schedule',
    subtitle: 'Plan, view test dates, and see upcoming requirements',
    iconFamily: 'ionicons',
    icon: 'calendar-outline',
  },
  {
    id: 'doctor',
    title: 'My Doctor',
    subtitle: `${mockDoctor.nombre}, ${mockDoctor.especialidad}`,
    iconFamily: 'ionicons',
    icon: 'medkit-outline',
  },
  {
    id: 'track',
    title: 'Track your tests',
    subtitle: 'Follow status, delivery, and result history',
    iconFamily: 'material',
    icon: 'van-utility',
  },
  {
    id: 'settings',
    title: 'Settings',
    subtitle: 'Manage your preferences',
    iconFamily: 'ionicons',
    icon: 'settings-outline',
  },
];

export const MoreScreen = () => {
  const { logout } = useAuth();

  return (
    <SwipeableScreen current="more">
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader title="More" />

        <View style={styles.list}>
          {menuItems.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.card}
              onPress={item.id === 'settings' ? logout : undefined}
            >
              {item.isProfile ? (
                <Avatar nombre={mockPatient.nombre} source={avatarSource} size={52} />
              ) : (
                <View style={styles.iconWrap}>
                  {item.iconFamily === 'material' ? (
                    <MaterialCommunityIcons name={item.icon as any} size={26} color={Colors.accent} />
                  ) : (
                    <Ionicons name={item.icon as any} size={26} color={Colors.accent} />
                  )}
                </View>
              )}
              <View style={styles.textWrap}>
                <Text style={styles.itemTitle}>{item.title}</Text>
                <Text style={styles.itemSubtitle}>{item.subtitle}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
    </SwipeableScreen>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    paddingBottom: 32,
  },
  list: {
    paddingHorizontal: 20,
    gap: 12,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 16,
    padding: 16,
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.accentSoft,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textWrap: {
    flex: 1,
  },
  itemTitle: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 3,
  },
  itemSubtitle: {
    color: Colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
});

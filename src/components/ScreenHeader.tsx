import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Avatar } from './Avatar';
import { Colors } from '@/constants/colors';
import { mockPatient } from '@/data/mockData';

const avatarSource = require('../../assets/images/avatar.jpg');

interface ScreenHeaderProps {
  title: string;
  showBack?: boolean;
}

export const ScreenHeader = ({ title, showBack = false }: ScreenHeaderProps) => {
  const router = useRouter();

  return (
    <View style={styles.header}>
      <View style={styles.side}>
        {showBack && (
          <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="chevron-back" size={26} color={Colors.textPrimary} />
          </TouchableOpacity>
        )}
      </View>

      <Text style={styles.title}>{title}</Text>

      <View style={[styles.side, styles.sideRight]}>
        <Avatar nombre={mockPatient.nombre} source={avatarSource} size={38} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
  },
  side: {
    width: 44,
    justifyContent: 'center',
  },
  sideRight: {
    alignItems: 'flex-end',
  },
  title: {
    flex: 1,
    textAlign: 'center',
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
});

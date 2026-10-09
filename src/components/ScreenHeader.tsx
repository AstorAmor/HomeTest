import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/colors';
import { UserAvatar } from './UserAvatar';


interface ScreenHeaderProps {
  title: string;
  showBack?: boolean;
  // La foto solo sale en Today (pidió el fundador); en el resto, el hueco queda vacío
  showAvatar?: boolean;
  // A dónde volver si no hay pantalla anterior (p. ej. tras recargar por cambiar el tema)
  backFallback?: string;
}

export const ScreenHeader = ({ title, showBack = false, showAvatar = false, backFallback = '/' }: ScreenHeaderProps) => {
  const router = useRouter();

  return (
    <View style={styles.header}>
      <View style={styles.side}>
        {showBack && (
          <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace(backFallback as any))} hitSlop={12}>
            <Ionicons name="chevron-back" size={26} color={Colors.textPrimary} />
          </TouchableOpacity>
        )}
      </View>

      <Text style={styles.title}>{title}</Text>

      <View style={[styles.side, styles.sideRight]}>
        {showAvatar && <UserAvatar size={38} />}
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

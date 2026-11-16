import React from 'react';
import { View, Text, Image, StyleSheet, ImageSourcePropType } from 'react-native';
import { Colors } from '@/constants/colors';
import { INTER } from '@/theme/fine';

interface AvatarProps {
  source?: ImageSourcePropType;
  nombre: string;
  size?: number;
}

export const Avatar = ({ source, nombre, size = 40 }: AvatarProps) => {
  const initial = nombre.trim().charAt(0).toUpperCase();

  if (source) {
    return (
      <Image
        source={source}
        resizeMode="cover"
        style={[styles.image, { width: size, height: size, borderRadius: size / 2 }]}
      />
    );
  }

  return (
    <View
      style={[
        styles.placeholder,
        { width: size, height: size, borderRadius: size / 2 },
      ]}
    >
      <Text style={[styles.initial, { fontFamily: INTER.regular, fontSize: size * 0.4 }]}>{initial}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  image: {
    backgroundColor: Colors.card,
  },
  placeholder: {
    backgroundColor: Colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  initial: {
    color: Colors.background,
    fontFamily: INTER.medium,
  },
});

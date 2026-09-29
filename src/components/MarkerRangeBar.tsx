import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Colors, withAlpha } from '@/constants/colors';

interface MarkerRangeBarProps {
  position: number; // 0..1; el rango de referencia es la zona 20-80 %
  color: string;
  width?: number;
}

// Barra de rango con la zona normal marcada y un punto en el valor.
export const MarkerRangeBar = ({ position, color, width = 96 }: MarkerRangeBarProps) => (
  <View style={[styles.track, { width }]}>
    <View style={[styles.normalZone, { left: width * 0.2, width: width * 0.6 }]} />
    <View style={[styles.dot, { left: position * width - 5, backgroundColor: color }]} />
  </View>
);

const styles = StyleSheet.create({
  track: {
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.divider,
    justifyContent: 'center',
  },
  normalZone: {
    position: 'absolute',
    height: 6,
    borderRadius: 3,
    backgroundColor: withAlpha(Colors.accent, 0.3),
  },
  dot: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: Colors.card,
  },
});

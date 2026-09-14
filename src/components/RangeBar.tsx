import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Colors } from '@/constants/colors';

interface RangeBarProps {
  posicion: number; // 0 to 1
  estado: 'normal' | 'high' | 'low';
  width?: number;
}

export const RangeBar = ({ posicion, estado, width = 90 }: RangeBarProps) => {
  const color = estado === 'normal' ? Colors.accent : Colors.danger;
  const filledWidth = Math.max(0, Math.min(1, posicion)) * width;

  return (
    <View style={[styles.track, { width }]}>
      <View style={[styles.fill, { width: filledWidth, backgroundColor: color }]} />
      <View
        style={[
          styles.thumb,
          { left: filledWidth - 4, backgroundColor: color },
        ]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  track: {
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.divider,
    justifyContent: 'center',
  },
  fill: {
    position: 'absolute',
    left: 0,
    height: 4,
    borderRadius: 2,
  },
  thumb: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});

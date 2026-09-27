import React, { ReactNode } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import { Colors } from '@/constants/colors';

interface ProgressRingProps {
  progress: number; // 0..1 (se recorta)
  color: string;
  size?: number;
  strokeWidth?: number;
  trackColor?: string;
  children?: ReactNode; // contenido centrado (número, icono...)
}

// Anillo de progreso de un solo valor (daily readiness, pasos, calorías, sueño).
// A diferencia de DonutChart, que reparte segmentos, aquí hay una sola meta.
export const ProgressRing = ({
  progress,
  color,
  size = 72,
  strokeWidth = 8,
  trackColor = Colors.divider,
  children,
}: ProgressRingProps) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(1, progress));

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <G transform={`rotate(-90, ${size / 2}, ${size / 2})`}>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={trackColor}
            strokeWidth={strokeWidth}
            fill="none"
          />
          {clamped > 0 && (
            <Circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke={color}
              strokeWidth={strokeWidth}
              strokeDasharray={`${clamped * circumference} ${circumference}`}
              strokeLinecap="round"
              fill="none"
            />
          )}
        </G>
      </Svg>
      <View style={[styles.center, { width: size, height: size }]}>{children}</View>
    </View>
  );
};

const styles = StyleSheet.create({
  center: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

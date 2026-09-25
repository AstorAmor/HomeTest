import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import { Colors } from '@/constants/colors';

export interface DonutSegment {
  value: number;
  color: string;
}

interface DonutChartProps {
  segments: DonutSegment[];
  size?: number;
  strokeWidth?: number;
  centerLabel?: string;
  centerSubLabel?: string;
  trackColor?: string;
}

export const DonutChart = ({
  segments,
  size = 140,
  strokeWidth = 16,
  centerLabel,
  centerSubLabel,
  trackColor = Colors.divider,
}: DonutChartProps) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const total = segments.reduce((sum, s) => sum + s.value, 0) || 1;

  let cumulative = 0;

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
          {segments
            .filter((s) => s.value > 0)
            .map((segment, index) => {
              const segmentLength = (segment.value / total) * circumference;
              const dashArray = `${segmentLength} ${circumference - segmentLength}`;
              const dashOffset = -((cumulative / total) * circumference);
              cumulative += segment.value;
              return (
                <Circle
                  key={index}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  stroke={segment.color}
                  strokeWidth={strokeWidth}
                  strokeDasharray={dashArray}
                  strokeDashoffset={dashOffset}
                  strokeLinecap="round"
                  fill="none"
                />
              );
            })}
        </G>
      </Svg>
      {(centerLabel || centerSubLabel) && (
        <View style={[styles.centerWrap, { width: size, height: size }]}>
          {centerLabel && <Text style={styles.centerLabel}>{centerLabel}</Text>}
          {centerSubLabel && <Text style={styles.centerSubLabel}>{centerSubLabel}</Text>}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  centerWrap: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerLabel: {
    color: Colors.textPrimary,
    fontSize: 22,
    fontWeight: '800',
  },
  centerSubLabel: {
    color: Colors.textSecondary,
    fontSize: 11,
    marginTop: 2,
    textAlign: 'center',
  },
});

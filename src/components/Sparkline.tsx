import React from 'react';
import { View } from 'react-native';
import Svg, { Polyline, Circle, Defs, LinearGradient, Stop, Polygon } from 'react-native-svg';
import { Colors } from '@/constants/colors';

interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  filled?: boolean;
}

export const Sparkline = ({
  data,
  width = 140,
  height = 50,
  color = Colors.accent,
  filled = true,
}: SparklineProps) => {
  if (data.length < 2) return <View style={{ width, height }} />;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const padding = 4;

  const points = data.map((value, index) => {
    const x = (index / (data.length - 1)) * (width - padding * 2) + padding;
    const y =
      height - padding - ((value - min) / range) * (height - padding * 2);
    return { x, y };
  });

  const pointsStr = points.map((p) => `${p.x},${p.y}`).join(' ');
  const polygonStr = `${padding},${height} ${pointsStr} ${width - padding},${height}`;

  return (
    <Svg width={width} height={height}>
      <Defs>
        <LinearGradient id="fillGradient" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={color} stopOpacity="0.35" />
          <Stop offset="1" stopColor={color} stopOpacity="0" />
        </LinearGradient>
      </Defs>
      {filled && <Polygon points={polygonStr} fill="url(#fillGradient)" />}
      <Polyline
        points={pointsStr}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle
        cx={points[points.length - 1].x}
        cy={points[points.length - 1].y}
        r={3.5}
        fill={color}
      />
    </Svg>
  );
};

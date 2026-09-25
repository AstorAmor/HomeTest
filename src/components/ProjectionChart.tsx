import React from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import Svg, { Polyline, Polygon, Circle } from 'react-native-svg';
import { Colors } from '@/constants/colors';

interface ProjectionChartProps {
  currentValue: number;
  expectedValueIn6Months: number;
  expectedRangeLow: number;
  expectedRangeHigh: number;
  unit?: string;
  color?: string;
}

const CARD_MARGIN = 40;
const CARD_PADDING = 32;
const Y_AXIS_WIDTH = 40;
const CHART_HEIGHT = 120;
const PADDING_Y = 10;

// Banda de incertidumbre: 0 en el mes 0 (es el valor medido, conocido) y se ensancha
// linealmente hasta [expectedRangeLow, expectedRangeHigh] en el mes 6 — no es una
// promesa de resultado, es la nota que ya trae estimated_next_test.uncertainty_note.
export const ProjectionChart = ({
  currentValue,
  expectedValueIn6Months,
  expectedRangeLow,
  expectedRangeHigh,
  unit = '',
  color = Colors.accent,
}: ProjectionChartProps) => {
  const { width: screenWidth } = useWindowDimensions();
  const chartWidth = Math.max(screenWidth - CARD_MARGIN - CARD_PADDING - Y_AXIS_WIDTH - 10, 120);
  const steps = 7; // meses 0..6
  const upper: { x: number; y: number }[] = [];
  const lower: { x: number; y: number }[] = [];
  const expected: { x: number; y: number }[] = [];

  const allValues = [currentValue, expectedValueIn6Months, expectedRangeLow, expectedRangeHigh];
  const rawMin = Math.min(...allValues);
  const rawMax = Math.max(...allValues);
  const pad = Math.max((rawMax - rawMin) * 0.15, rawMax * 0.02, 0.5);
  const min = rawMin - pad;
  const max = rawMax + pad;

  const scaleY = (value: number) => {
    const range = max - min || 1;
    return CHART_HEIGHT - PADDING_Y - ((value - min) / range) * (CHART_HEIGHT - PADDING_Y * 2);
  };

  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1); // 0..1
    const x = t * chartWidth;
    const bandLow = currentValue + (expectedRangeLow - currentValue) * t;
    const bandHigh = currentValue + (expectedRangeHigh - currentValue) * t;
    const expectedValue = currentValue + (expectedValueIn6Months - currentValue) * t;
    upper.push({ x, y: scaleY(bandHigh) });
    lower.push({ x, y: scaleY(bandLow) });
    expected.push({ x, y: scaleY(expectedValue) });
  }

  const bandPoints = [...upper, ...[...lower].reverse()].map((p) => `${p.x},${p.y}`).join(' ');
  const expectedLine = expected.map((p) => `${p.x},${p.y}`).join(' ');
  const lastPoint = expected[expected.length - 1];

  return (
    <View>
      <View style={styles.chartRow}>
        <View style={styles.yAxis}>
          <Text style={styles.axisLabel}>{Math.round(max)}</Text>
          <Text style={styles.axisLabel}>{Math.round(min)}</Text>
        </View>
        <Svg width={chartWidth} height={CHART_HEIGHT}>
          <Polygon points={bandPoints} fill={color} fillOpacity={0.15} />
          <Polyline points={expectedLine} fill="none" stroke={color} strokeWidth={2} />
          <Circle cx={expected[0].x} cy={expected[0].y} r={3.5} fill={Colors.textSecondary} />
          <Circle cx={lastPoint.x} cy={lastPoint.y} r={4} fill={color} />
        </Svg>
      </View>
      <View style={styles.xAxisRow}>
        <View style={styles.yAxisSpacer} />
        <Text style={styles.axisLabel}>
          Now · {currentValue}
          {unit}
        </Text>
        <Text style={styles.axisLabel}>
          6mo · ~{expectedValueIn6Months}
          {unit}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  chartRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  yAxis: {
    width: Y_AXIS_WIDTH,
    height: CHART_HEIGHT,
    justifyContent: 'space-between',
    paddingVertical: PADDING_Y,
  },
  yAxisSpacer: {
    width: Y_AXIS_WIDTH,
  },
  axisLabel: {
    color: Colors.textMuted,
    fontSize: 10,
  },
  xAxisRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
});

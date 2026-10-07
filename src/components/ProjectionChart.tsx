import React from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import Svg, { Path, Polygon, Circle, Line } from 'react-native-svg';
import { Colors } from '@/constants/colors';
import { axisLabel, axisPadding, getResponseProfile, HORIZON_MONTHS, projectionCurve } from '@/logic/projection';

interface ProjectionChartProps {
  markerId: string;
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
const MID_LABEL_WIDTH = 40;

// Proyección del marcador a 6 meses. La curva no es una recta: cada marcador sigue
// la forma con la que suele responder (src/logic/projection.ts) — rápido al principio
// y luego estable, o en S si el hábito tarda en notarse. La banda de incertidumbre
// sale del valor medido (conocido) y se abre hasta el rango esperado: no es una
// promesa de resultado.
export const ProjectionChart = ({
  markerId,
  currentValue,
  expectedValueIn6Months,
  expectedRangeLow,
  expectedRangeHigh,
  unit = '',
  color = Colors.accent,
}: ProjectionChartProps) => {
  const { width: screenWidth } = useWindowDimensions();
  const chartWidth = Math.max(screenWidth - CARD_MARGIN - CARD_PADDING - Y_AXIS_WIDTH - 10, 120);

  const curve = projectionCurve({
    markerId,
    currentValue,
    expectedValue: expectedValueIn6Months,
    rangeLow: expectedRangeLow,
    rangeHigh: expectedRangeHigh,
  });
  const note = getResponseProfile(markerId).note;

  const allValues = [currentValue, expectedValueIn6Months, expectedRangeLow, expectedRangeHigh];
  const rawMin = Math.min(...allValues);
  const rawMax = Math.max(...allValues);
  const pad = axisPadding(rawMin, rawMax);
  const min = rawMin - pad;
  const max = rawMax + pad;

  const scaleX = (month: number) => (month / HORIZON_MONTHS) * chartWidth;
  const scaleY = (value: number) => {
    const range = max - min || 1;
    return CHART_HEIGHT - PADDING_Y - ((value - min) / range) * (CHART_HEIGHT - PADDING_Y * 2);
  };

  const toXY = (month: number, value: number) => `${scaleX(month).toFixed(1)},${scaleY(value).toFixed(1)}`;
  const bandPoints = [
    ...curve.map((p) => toXY(p.month, p.high)),
    ...[...curve].reverse().map((p) => toXY(p.month, p.low)),
  ].join(' ');
  const expectedPath = curve.map((p, i) => `${i === 0 ? 'M' : 'L'}${toXY(p.month, p.expected)}`).join(' ');
  const first = curve[0];
  const last = curve[curve.length - 1];
  const midX = scaleX(HORIZON_MONTHS / 2);

  return (
    <View>
      <View style={styles.chartRow}>
        <View style={styles.yAxis}>
          <Text style={styles.axisLabel}>{axisLabel(max, max - min)}</Text>
          <Text style={styles.axisLabel}>{axisLabel(min, max - min)}</Text>
        </View>
        <Svg width={chartWidth} height={CHART_HEIGHT}>
          <Line
            x1={midX}
            x2={midX}
            y1={PADDING_Y / 2}
            y2={CHART_HEIGHT - PADDING_Y / 2}
            stroke={Colors.divider}
            strokeWidth={1}
            strokeDasharray="3,4"
          />
          <Polygon points={bandPoints} fill={color} fillOpacity={0.15} />
          <Path d={expectedPath} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          <Circle cx={scaleX(first.month)} cy={scaleY(first.expected)} r={3.5} fill={Colors.textSecondary} />
          <Circle cx={scaleX(last.month)} cy={scaleY(last.expected)} r={4} fill={color} />
        </Svg>
      </View>
      <View style={styles.xAxisRow}>
        <View style={styles.yAxisSpacer} />
        <View style={[styles.xAxisLabels, { width: chartWidth }]}>
          <Text style={styles.axisLabel}>
            Now · {currentValue}
            {unit}
          </Text>
          <Text style={[styles.axisLabel, styles.midLabel, { left: midX - MID_LABEL_WIDTH / 2 }]}>3 mo</Text>
          <Text style={styles.axisLabel}>
            6 mo · ~{expectedValueIn6Months}
            {unit}
          </Text>
        </View>
      </View>
      {note && <Text style={styles.note}>{note}</Text>}
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
    marginTop: 6,
  },
  xAxisLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  midLabel: {
    position: 'absolute',
    width: MID_LABEL_WIDTH,
    textAlign: 'center',
  },
  note: {
    color: Colors.textSecondary,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 8,
  },
});

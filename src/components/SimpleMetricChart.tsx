import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Svg, { Polyline, Circle } from 'react-native-svg';
import { Colors } from '@/constants/colors';

interface Point {
  valor: number;
  fecha: string;
}

interface SimpleMetricChartProps {
  entries: Point[]; // ya filtradas por rango y ordenadas ascendente
  color: string;
}

const SCREEN_WIDTH = Dimensions.get('window').width;
const CARD_MARGIN = 40;
const CARD_PADDING = 32;
const Y_AXIS_WIDTH = 36;
const CHART_WIDTH = SCREEN_WIDTH - CARD_MARGIN - CARD_PADDING - Y_AXIS_WIDTH - 10;
const CHART_HEIGHT = 140;
const PADDING_Y = 10;

const formatAxisDate = (iso: string) => {
  const d = new Date(iso);
  return `${d.getDate()}/${d.getMonth() + 1}`;
};

function scaleY(value: number, min: number, max: number, height: number) {
  const range = max - min || 1;
  return height - PADDING_Y - ((value - min) / range) * (height - PADDING_Y * 2);
}

export const SimpleMetricChart = ({ entries, color }: SimpleMetricChartProps) => {
  if (entries.length < 2) {
    return (
      <View style={styles.emptyWrap}>
        <Text style={styles.emptyText}>
          Add at least 2 entries in this range to see the chart
        </Text>
      </View>
    );
  }

  const values = entries.map((e) => e.valor);
  const min = Math.min(...values) - Math.max(2, Math.round(Math.min(...values) * 0.05));
  const max = Math.max(...values) + Math.max(2, Math.round(Math.max(...values) * 0.05));

  const xStep = entries.length > 1 ? CHART_WIDTH / (entries.length - 1) : 0;
  const points = entries.map((e, i) => ({
    x: i * xStep,
    y: scaleY(e.valor, min, max, CHART_HEIGHT),
  }));
  const line = points.map((p) => `${p.x},${p.y}`).join(' ');

  return (
    <View>
      <View style={styles.chartRow}>
        <View style={styles.yAxis}>
          <Text style={styles.axisLabel}>{Math.round(max)}</Text>
          <Text style={styles.axisLabel}>{Math.round(min)}</Text>
        </View>
        <Svg width={CHART_WIDTH} height={CHART_HEIGHT}>
          <Polyline points={line} fill="none" stroke={color} strokeWidth={2} />
          {points.map((p, i) => (
            <Circle key={i} cx={p.x} cy={p.y} r={3} fill={color} />
          ))}
        </Svg>
      </View>

      <View style={styles.xAxisRow}>
        <View style={styles.yAxisSpacer} />
        <Text style={styles.axisLabel}>{formatAxisDate(entries[0].fecha)}</Text>
        <Text style={styles.axisLabel}>{formatAxisDate(entries[entries.length - 1].fecha)}</Text>
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
    marginTop: 8,
  },
  emptyWrap: {
    paddingVertical: 30,
    alignItems: 'center',
  },
  emptyText: {
    color: Colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
});

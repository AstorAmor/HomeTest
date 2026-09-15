import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Svg, { Polyline, Circle, Polygon } from 'react-native-svg';
import { Colors } from '@/constants/colors';
import { BloodPressureEntry } from '@/types/bloodPressure';

interface BloodPressureChartProps {
  entries: BloodPressureEntry[]; // ya filtradas por rango y ordenadas ascendente
}

const SCREEN_WIDTH = Dimensions.get('window').width;
const CARD_MARGIN = 40; // marginHorizontal: 20 a cada lado de la card contenedora
const CARD_PADDING = 32; // padding: 16 a cada lado dentro de la card
const Y_AXIS_WIDTH = 36;
const CHART_WIDTH = SCREEN_WIDTH - CARD_MARGIN - CARD_PADDING - Y_AXIS_WIDTH - 10;
const BP_CHART_HEIGHT = 110;
const PULSE_CHART_HEIGHT = 80;
const PADDING_Y = 10;

const formatAxisDate = (iso: string) => {
  const d = new Date(iso);
  return `${d.getDate()}/${d.getMonth() + 1}`;
};

function scaleY(value: number, min: number, max: number, height: number) {
  const range = max - min || 1;
  return height - PADDING_Y - ((value - min) / range) * (height - PADDING_Y * 2);
}

export const BloodPressureChart = ({ entries }: BloodPressureChartProps) => {
  if (entries.length < 2) {
    return (
      <View style={styles.emptyWrap}>
        <Text style={styles.emptyText}>
          Add at least 2 entries in this range to see the chart
        </Text>
      </View>
    );
  }

  const systolicValues = entries.map((e) => e.systolic);
  const diastolicValues = entries.map((e) => e.diastolic);
  const pulseValues = entries.filter((e) => e.pulse !== null).map((e) => e.pulse as number);

  const bpMin = Math.min(...diastolicValues, ...systolicValues) - 10;
  const bpMax = Math.max(...diastolicValues, ...systolicValues) + 10;
  const pulseMin = pulseValues.length ? Math.min(...pulseValues) - 10 : 60;
  const pulseMax = pulseValues.length ? Math.max(...pulseValues) + 10 : 100;

  const xStep = entries.length > 1 ? CHART_WIDTH / (entries.length - 1) : 0;

  const sysPoints = entries.map((e, i) => ({
    x: i * xStep,
    y: scaleY(e.systolic, bpMin, bpMax, BP_CHART_HEIGHT),
  }));
  const diaPoints = entries.map((e, i) => ({
    x: i * xStep,
    y: scaleY(e.diastolic, bpMin, bpMax, BP_CHART_HEIGHT),
  }));
  const pulsePoints = entries
    .map((e, i) =>
      e.pulse !== null
        ? { x: i * xStep, y: scaleY(e.pulse, pulseMin, pulseMax, PULSE_CHART_HEIGHT) }
        : null
    )
    .filter((p): p is { x: number; y: number } => p !== null);

  const bandPolygon = [
    ...sysPoints.map((p) => `${p.x},${p.y}`),
    ...diaPoints
      .slice()
      .reverse()
      .map((p) => `${p.x},${p.y}`),
  ].join(' ');

  const sysLine = sysPoints.map((p) => `${p.x},${p.y}`).join(' ');
  const diaLine = diaPoints.map((p) => `${p.x},${p.y}`).join(' ');
  const pulseLine = pulsePoints.map((p) => `${p.x},${p.y}`).join(' ');

  return (
    <View>
      <Text style={styles.chartUnit}>mmHg</Text>
      <View style={styles.chartRow}>
        <View style={[styles.yAxis, { height: BP_CHART_HEIGHT }]}>
          <Text style={styles.axisLabel}>{Math.round(bpMax)}</Text>
          <Text style={styles.axisLabel}>{Math.round(bpMin)}</Text>
        </View>
        <Svg width={CHART_WIDTH} height={BP_CHART_HEIGHT}>
          <Polygon points={bandPolygon} fill={Colors.accent} fillOpacity={0.18} />
          <Polyline points={sysLine} fill="none" stroke={Colors.accent} strokeWidth={2} />
          <Polyline
            points={diaLine}
            fill="none"
            stroke={Colors.accent}
            strokeWidth={2}
            strokeOpacity={0.6}
          />
          {sysPoints.map((p, i) => (
            <Circle key={`s${i}`} cx={p.x} cy={p.y} r={3} fill={Colors.accent} />
          ))}
          {diaPoints.map((p, i) => (
            <Circle key={`d${i}`} cx={p.x} cy={p.y} r={2.5} fill={Colors.accent} fillOpacity={0.7} />
          ))}
        </Svg>
      </View>

      <Text style={[styles.chartUnit, { marginTop: 20 }]}>BPM</Text>
      <View style={styles.chartRow}>
        <View style={[styles.yAxis, { height: PULSE_CHART_HEIGHT }]}>
          <Text style={styles.axisLabel}>{Math.round(pulseMax)}</Text>
          <Text style={styles.axisLabel}>{Math.round(pulseMin)}</Text>
        </View>
        <Svg width={CHART_WIDTH} height={PULSE_CHART_HEIGHT}>
          <Polyline points={pulseLine} fill="none" stroke={Colors.pulseAccent} strokeWidth={2} />
          {pulsePoints.map((p, i) => (
            <Circle key={`p${i}`} cx={p.x} cy={p.y} r={3} fill={Colors.pulseAccent} />
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
  chartUnit: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
    marginLeft: Y_AXIS_WIDTH,
    marginBottom: 4,
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

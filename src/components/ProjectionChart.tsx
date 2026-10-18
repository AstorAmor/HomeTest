import React from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import Svg, { Path, Polygon, Circle, Line, Rect } from 'react-native-svg';
import { Colors } from '@/constants/colors';
import { num, t } from '@/i18n';
import { axisLabel, axisPadding, getResponseProfile, HORIZON_MONTHS, projectionCurve } from '@/logic/projection';
import { rangeText } from '@/utils/rangeStatus';

interface ProjectionChartProps {
  markerId: string;
  currentValue: number;
  expectedValueIn6Months: number;
  expectedRangeLow: number;
  expectedRangeHigh: number;
  unit?: string;
  color?: string;
  // Rango al que hay que llegar (el de la analítica): una franja verde como la de la web, con una raya
  // en el límite que se cruza; puede ser de un solo lado ("< 200", "> 40")
  targetLow?: number | null;
  targetHigh?: number | null;
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
  targetLow = null,
  targetHigh = null,
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

  // El eje incluye el límite que hay que cruzar y un trozo del rango detrás, para que la franja se vea
  const limit = targetHigh !== null && currentValue > targetHigh ? targetHigh : targetLow !== null && currentValue < targetLow ? targetLow : null;
  const inside = limit === null ? [] : [limit, limit + (limit - currentValue) * 0.5];
  const allValues = [currentValue, expectedValueIn6Months, expectedRangeLow, expectedRangeHigh, ...inside];
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

  const range = rangeText(targetLow, targetHigh);
  const hasTarget = range !== null && (targetHigh === null || targetHigh > min) && (targetLow === null || targetLow < max);
  const bandTop = targetHigh !== null && targetHigh < max ? scaleY(targetHigh) : 0;
  const bandBottom = targetLow !== null && targetLow > min ? scaleY(targetLow) : CHART_HEIGHT;
  const edges = [targetHigh, targetLow].filter((v): v is number => v !== null && v > min && v < max);
  // La etiqueta va dentro de la franja, pegada al límite que se cruza
  const labelTop = bandTop > 0 && (limit === null || limit === targetHigh) ? bandTop + 3 : bandBottom - 15;

  return (
    <View>
      <View style={styles.chartRow}>
        <View style={styles.yAxis}>
          <Text style={styles.axisLabel}>{num(axisLabel(max, max - min))}</Text>
          <Text style={styles.axisLabel}>{num(axisLabel(min, max - min))}</Text>
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
          {hasTarget && (
            <>
              <Rect x={0} y={bandTop} width={chartWidth} height={Math.max(bandBottom - bandTop, 0)} rx={6} fill={Colors.ok} fillOpacity={0.14} />
              {edges.map((v) => (
                <Line key={v} x1={0} x2={chartWidth} y1={scaleY(v)} y2={scaleY(v)} stroke={Colors.ok} strokeOpacity={0.7} strokeWidth={1} strokeDasharray="4,3" />
              ))}
            </>
          )}
          <Polygon points={bandPoints} fill={color} fillOpacity={0.15} />
          <Path d={expectedPath} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          <Circle cx={scaleX(first.month)} cy={scaleY(first.expected)} r={3.5} fill={Colors.textSecondary} />
          <Circle cx={scaleX(last.month)} cy={scaleY(last.expected)} r={4} fill={color} />
        </Svg>
        {hasTarget && <Text style={[styles.target, { top: labelTop, left: Y_AXIS_WIDTH, width: chartWidth - 6 }]}>{t('Target {range}', { range }).toUpperCase()}</Text>}
      </View>
      <View style={styles.xAxisRow}>
        <View style={styles.yAxisSpacer} />
        <View style={[styles.xAxisLabels, { width: chartWidth }]}>
          <Text style={styles.axisLabel}>
            {t('Now')} · {num(currentValue)}
            {unit ? ` ${unit}` : ''}
          </Text>
          <Text style={[styles.axisLabel, styles.midLabel, { left: midX - MID_LABEL_WIDTH / 2 }]}>{t('3 mo')}</Text>
          <Text style={styles.axisLabel}>
            {t('6 mo')} · ~{num(expectedValueIn6Months)}
            {unit ? ` ${unit}` : ''}
          </Text>
        </View>
      </View>
      {note && <Text style={styles.note}>{t(note)}</Text>}
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
  target: {
    position: 'absolute',
    textAlign: 'right',
    color: Colors.ok,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  note: {
    color: Colors.textSecondary,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 8,
  },
});

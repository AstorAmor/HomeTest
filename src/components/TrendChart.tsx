import React, { useId, useState } from 'react';
import { View, Text, StyleSheet, LayoutChangeEvent } from 'react-native';
import Svg, { Path, Circle, Defs, LinearGradient, Stop, Line, Rect } from 'react-native-svg';
import { Colors } from '@/constants/colors';

export interface TrendSeries {
  values: number[];
  color: string;
  label?: string;
}

interface TrendChartProps {
  labels: string[]; // una etiqueta por punto (se muestran primera, central y última)
  series: TrendSeries[];
  height?: number;
  band?: { low: number; high: number }; // rango de referencia sombreado
  formatY?: (v: number) => string;
  formatValue?: (v: number) => string; // valor en el globo al tocar un punto
  interactive?: boolean; // tocar la gráfica muestra fecha y valor del punto más cercano
}

const PAD_TOP = 12;
const PAD_BOTTOM = 8;
const Y_LABEL_WIDTH = 34;

// Curva suave (Catmull-Rom -> Bézier) para que las líneas no parezcan dientes de sierra.
function smoothPath(points: { x: number; y: number }[]) {
  if (points.length < 2) return '';
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const t = 0.18;
    const c1x = p1.x + (p2.x - p0.x) * t;
    const c1y = p1.y + (p2.y - p0.y) * t;
    const c2x = p2.x - (p3.x - p1.x) * t;
    const c2y = p2.y - (p3.y - p1.y) * t;
    d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`;
  }
  return d;
}

export const TrendChart = ({
  labels,
  series,
  height = 120,
  band,
  formatY = (v) => String(Math.round(v)),
  formatValue,
  interactive = true,
}: TrendChartProps) => {
  const [width, setWidth] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const gradientId = `trend${useId().replace(/[^a-zA-Z0-9]/g, '')}`;

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  const all = series.flatMap((s) => s.values);
  const pointCount = Math.max(...series.map((s) => s.values.length), 0);
  // El contenedor con onLayout se monta siempre (también sin datos): en web,
  // si aparece después, no llega a medirse y el gráfico se queda con ancho 0.
  if (pointCount < 2) {
    return (
      <View onLayout={onLayout} style={[styles.empty, { height }]}>
        <Text style={styles.emptyText}>Not enough data yet</Text>
      </View>
    );
  }

  let min = Math.min(...all, band?.low ?? Infinity);
  let max = Math.max(...all, band?.high ?? -Infinity);
  const pad = (max - min || Math.abs(max) || 1) * 0.15;
  min -= pad;
  max += pad;

  const plotWidth = Math.max(0, width - Y_LABEL_WIDTH);
  const plotHeight = height - PAD_TOP - PAD_BOTTOM;
  const x = (i: number) => (i / (pointCount - 1)) * (plotWidth - 8) + 4;
  const y = (v: number) => PAD_TOP + plotHeight - ((v - min) / (max - min)) * plotHeight;

  const gridValues = [max - pad, (min + max) / 2, min + pad];
  const fmtValue = formatValue ?? ((v: number) => (Math.abs(v) < 10 ? v.toFixed(1) : String(Math.round(v))));

  // Punto más cercano a la posición tocada
  const pick = (locationX: number) => {
    if (plotWidth <= 0) return;
    const i = Math.round(((locationX - 4) / (plotWidth - 8)) * (pointCount - 1));
    setSelected(Math.max(0, Math.min(pointCount - 1, i)));
  };
  const midIndex = Math.floor((labels.length - 1) / 2);

  return (
    <View onLayout={onLayout}>
      {width > 0 && (
        <Svg width={width} height={height}>
          <Defs>
            <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={series[0].color} stopOpacity="0.32" />
              <Stop offset="1" stopColor={series[0].color} stopOpacity="0" />
            </LinearGradient>
          </Defs>

          {band && (
            <Rect
              x={0}
              y={y(band.high)}
              width={plotWidth}
              height={Math.max(0, y(band.low) - y(band.high))}
              fill={Colors.accent}
              opacity={0.07}
              rx={6}
            />
          )}

          {gridValues.map((g, i) => (
            <Line
              key={i}
              x1={0}
              x2={plotWidth}
              y1={y(g)}
              y2={y(g)}
              stroke={Colors.divider}
              strokeWidth={1}
              strokeDasharray="3 5"
            />
          ))}

          {selected !== null && (
            <Line
              x1={x(selected)}
              x2={x(selected)}
              y1={PAD_TOP - 6}
              y2={PAD_TOP + plotHeight}
              stroke={Colors.textSecondary}
              strokeWidth={1}
              strokeDasharray="2 3"
            />
          )}

          {series.map((s, si) => {
            const pts = s.values.map((v, i) => ({ x: x(i), y: y(v) }));
            const line = smoothPath(pts);
            const last = pts[pts.length - 1];
            return (
              <React.Fragment key={si}>
                {series.length === 1 && (
                  <Path
                    d={`${line} L ${last.x} ${PAD_TOP + plotHeight} L ${pts[0].x} ${PAD_TOP + plotHeight} Z`}
                    fill={`url(#${gradientId})`}
                  />
                )}
                <Path d={line} stroke={s.color} strokeWidth={2.5} fill="none" strokeLinecap="round" />
                <Circle cx={last.x} cy={last.y} r={7} fill={s.color} opacity={0.2} />
                <Circle cx={last.x} cy={last.y} r={3.8} fill={s.color} />
                {selected !== null && s.values[selected] !== undefined && (
                  <Circle cx={pts[selected].x} cy={pts[selected].y} r={5} fill={Colors.background} stroke={s.color} strokeWidth={2.5} />
                )}
              </React.Fragment>
            );
          })}
        </Svg>
      )}

      {width > 0 && interactive && (
        <View
          style={[styles.touchLayer, { width: plotWidth, height }]}
          onStartShouldSetResponder={() => true}
          onResponderTerminationRequest={() => true}
          onResponderGrant={(e) => pick(e.nativeEvent.locationX)}
          onResponderMove={(e) => pick(e.nativeEvent.locationX)}
        />
      )}

      {selected !== null && width > 0 && (
        <View
          pointerEvents="none"
          style={[
            styles.tooltip,
            { left: Math.max(0, Math.min(plotWidth - 130, x(selected) - 65)) },
          ]}
        >
          <Text style={styles.tooltipDate}>{labels[selected]}</Text>
          {series.map((s) =>
            s.values[selected] !== undefined ? (
              <Text key={s.label ?? s.color} style={[styles.tooltipValue, { color: s.color }]}>
                {s.label ? `${s.label}: ` : ''}
                {fmtValue(s.values[selected])}
              </Text>
            ) : null
          )}
        </View>
      )}

      {width > 0 &&
        gridValues.map((g, i) => (
          <Text key={i} style={[styles.yLabel, { top: y(g) - 7, left: plotWidth + 4 }]}>
            {formatY(g)}
          </Text>
        ))}

      <View style={[styles.xLabels, { width: plotWidth }]}>
        <Text style={styles.xLabel}>{labels[0]}</Text>
        {labels.length > 2 && <Text style={styles.xLabel}>{labels[midIndex]}</Text>}
        <Text style={styles.xLabel}>{labels[labels.length - 1]}</Text>
      </View>

      {series.length > 1 && (
        <View style={styles.legend}>
          {series.map((s) => (
            <View key={s.label} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: s.color }]} />
              <Text style={styles.legendText}>{s.label}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  empty: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: Colors.textMuted,
    fontSize: 13,
  },
  yLabel: {
    position: 'absolute',
    color: Colors.textMuted,
    fontSize: 10,
  },
  touchLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  tooltip: {
    position: 'absolute',
    top: -6,
    width: 130,
    backgroundColor: 'rgba(11, 13, 22, 0.92)',
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  tooltipDate: {
    color: Colors.textSecondary,
    fontSize: 10,
    fontWeight: '700',
  },
  tooltipValue: {
    fontSize: 12,
    fontWeight: '800',
  },
  xLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  xLabel: {
    color: Colors.textMuted,
    fontSize: 10,
  },
  legend: {
    flexDirection: 'row',
    gap: 14,
    marginTop: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    color: Colors.textSecondary,
    fontSize: 12,
  },
});

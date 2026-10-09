import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { Colors } from '@/constants/colors';

// Regla con degradado y un punto en el valor actual: la usan la temperatura (con su franja normal)
// y la hidratación según el color de la orina. Mide su propio ancho para dibujar el degradado.

export interface GaugeStop {
  at: number; // posición en las unidades de la regla (entre min y max)
  color: string;
}

export function GaugeBar({
  min,
  max,
  value,
  stops,
  range,
  leftLabel,
  rightLabel,
  rangeLabel,
  height = 6,
}: {
  min: number;
  max: number;
  value: number | null;
  stops: GaugeStop[];
  range?: [number, number]; // franja "normal": se marca con dos rayitas
  rangeLabel?: string; // texto bajo la franja, p. ej. "Normal 36.1–37.2"
  leftLabel?: string;
  rightLabel?: string;
  height?: number;
}) {
  const [width, setWidth] = React.useState(0);
  const pos = (v: number) => Math.max(0, Math.min(1, (v - min) / (max - min)));
  const id = React.useId().replace(/:/g, '');
  const dot = 12;
  const box = Math.max(dot, height + 8) + 4; // alto de la zona: cabe el punto y las rayitas

  return (
    <View>
      <View style={{ height: box }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {width > 0 && (
          <Svg width={width} height={height} style={{ position: 'absolute', top: (box - height) / 2 }}>
            <Defs>
              <LinearGradient id={`g${id}`} x1="0" y1="0" x2="1" y2="0">
                {stops.map((s, i) => (
                  <Stop key={i} offset={pos(s.at)} stopColor={s.color} stopOpacity={1} />
                ))}
              </LinearGradient>
            </Defs>
            <Rect x={0} y={0} width={width} height={height} rx={height / 2} fill={`url(#g${id})`} />
          </Svg>
        )}
        {width > 0 &&
          range?.map((r, i) => (
            <View key={i} style={[styles.tick, { left: pos(r) * width - 1, height: height + 8, top: (box - height - 8) / 2 }]} />
          ))}
        {width > 0 && value != null && (
          <View
            style={[
              styles.dot,
              {
                width: dot,
                height: dot,
                borderRadius: dot / 2,
                top: (box - dot) / 2,
                left: Math.max(0, Math.min(width - dot, pos(value) * width - dot / 2)),
              },
            ]}
          />
        )}
      </View>
      {(leftLabel || rightLabel || rangeLabel) && (
        <View style={styles.labels}>
          <Text style={styles.label}>{leftLabel}</Text>
          {rangeLabel && range && width > 0 && (
            <Text
              style={[styles.label, styles.rangeLabel, { left: ((pos(range[0]) + pos(range[1])) / 2) * width - 70 }]}
              numberOfLines={1}
            >
              {rangeLabel}
            </Text>
          )}
          <Text style={styles.label}>{rightLabel}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  tick: { position: 'absolute', width: 2, borderRadius: 1, backgroundColor: Colors.textMuted, opacity: 0.8 },
  dot: { position: 'absolute', backgroundColor: Colors.textPrimary, borderWidth: 2, borderColor: Colors.card },
  labels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 },
  label: { color: Colors.textMuted, fontSize: 10 },
  rangeLabel: { position: 'absolute', top: 0, width: 140, textAlign: 'center', color: Colors.textSecondary },
});

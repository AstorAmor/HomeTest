// Una regla fina en vez de la barra de colores (rediseño, 2026-11-16: «quiero que todo sea coherente»): una
// raya apenas marcada, la franja de lo habitual en jade suave y un punto de luz en el valor de hoy, como la
// cabeza de las líneas cometa. Sin rojos ni verdes: dónde cae el punto ya lo dice. La usan la temperatura y la
// hidratación de Hoy.
// `edgeLabels`: dos cifras bajo los bordes de la franja (el IMC, 2026-11-18: «18,5» y «25» justo debajo de donde
// empieza y acaba lo habitual), en vez de las de los extremos.
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { FINE, ff } from '@/theme/fine';

export function FineGauge({
  min,
  max,
  value,
  range,
  leftLabel,
  rightLabel,
  rangeLabel,
  edgeLabels,
}: {
  min: number;
  max: number;
  value: number | null;
  range?: [number, number]; // la franja de lo habitual
  leftLabel?: string;
  rightLabel?: string;
  rangeLabel?: string; // bajo la franja, p. ej. «Normal 36.1–37.2»
  edgeLabels?: [string, string];
}) {
  const [w, setW] = useState(0);
  const pos = (v: number) => Math.max(0, Math.min(1, (v - min) / (max - min)));
  const DOT = 9;
  const GLOW = 22;
  const EDGE = 40; // ancho de cada cifra bajo un borde
  return (
    <View>
      <View style={styles.box} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
        <View style={styles.track} />
        {w > 0 && range && <View style={[styles.range, { left: pos(range[0]) * w, width: (pos(range[1]) - pos(range[0])) * w }]} />}
        {w > 0 && value != null && (
          <>
            <View style={[styles.glow, { left: Math.max(-GLOW / 2, Math.min(w - GLOW / 2, pos(value) * w - GLOW / 2)) }]} />
            <View style={[styles.dot, { left: Math.max(0, Math.min(w - DOT, pos(value) * w - DOT / 2)) }]} />
          </>
        )}
      </View>
      {edgeLabels && range && w > 0 && (
        <View style={styles.edges}>
          {edgeLabels.map((label, i) => (
            <Text key={i} style={[styles.label, styles.edge, { left: Math.max(0, Math.min(w - EDGE, pos(range[i]) * w - EDGE / 2)) }]}>
              {label}
            </Text>
          ))}
        </View>
      )}
      {(leftLabel || rightLabel || rangeLabel) && (
        <View style={styles.labels}>
          <Text style={styles.label}>{leftLabel}</Text>
          {rangeLabel ? <Text style={[styles.label, styles.mid]}>{rangeLabel}</Text> : null}
          <Text style={styles.label}>{rightLabel}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { height: 22, justifyContent: 'center' },
  track: { height: 1, backgroundColor: FINE.line },
  range: { position: 'absolute', height: 2, top: 10, borderRadius: 1, backgroundColor: FINE.jadeLine },
  glow: { position: 'absolute', top: 0, width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(131,214,180,0.16)' },
  dot: { position: 'absolute', top: 6.5, width: 9, height: 9, borderRadius: 4.5, backgroundColor: '#F7F3E6' },
  labels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 },
  label: { ...ff('regular'), color: FINE.mute, fontSize: 10.5 },
  mid: { color: FINE.jade },
  edges: { height: 15, marginTop: 1 },
  edge: { position: 'absolute', top: 0, width: 40, textAlign: 'center', fontVariant: ['tabular-nums'] },
});

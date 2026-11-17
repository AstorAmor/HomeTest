// Piezas finas de los análisis (rediseño de las analíticas, 2026-11-16; el fundador: «las analíticas veo que la
// estética no la has actualizado»). Lo mismo que el prototipo (borradores/app-estructura/prototipo): el rosco del
// informe en jade y oro con su leyenda, la línea de rango de cada valor (FineGauge: la franja jade es el rango
// del laboratorio y el punto de luz, tu resultado) y la cifra grande y ligera de un biomarcador con su estado al
// lado. Sin rojos: lo que está en rango va en jade y lo que queda fuera, en oro. Un valor fuera del rango no es
// un diagnóstico.
import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import { FineGauge } from '@/components/fine/FineGauge';
import { rangeBarLayout } from '@/utils/rangeBar';
import type { RangeStatus } from '@/utils/rangeStatus';
import { FINE, ff, fine } from '@/theme/fine';
import { t } from '@/i18n';

// El tono de un estado: en rango, jade; fuera, oro; sin referencia, apagado
export type LabTone = 'in' | 'out' | 'none';
export const labToneColor = (tone: LabTone) => (tone === 'in' ? FINE.jade : tone === 'out' ? FINE.gold : FINE.mute);
export const rangeTone = (s: RangeStatus): LabTone => (s === 'en_rango' ? 'in' : s === 'sin_rango' ? 'none' : 'out');

// La línea de rango de un valor de laboratorio: la franja del rango (también «máximo N» o «mínimo N») y el punto
// en el resultado, con el mismo reparto que tenía la barra de antes (src/utils/rangeBar.ts). Sin límites, nada.
export function LabGauge({ value, low, high, style }: { value: number | null; low: number | null; high: number | null; style?: StyleProp<ViewStyle> }) {
  if (value == null || Number.isNaN(value)) return null;
  const L = rangeBarLayout(value, low, high);
  if (!L) return null;
  return (
    <View style={style} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <FineGauge min={0} max={100} value={L.valuePct} range={[L.minPct ?? 0, L.maxPct ?? 100]} />
    </View>
  );
}

// El rosco del informe: en jade lo que está en rango y en oro lo que hay que revisar, con un hueco entre los dos;
// dentro, la cifra grande y ligera
export function FineDonut({
  inRange,
  review,
  size = 132,
  stroke = 6,
  label,
  sub,
}: {
  inRange: number;
  review: number;
  size?: number;
  stroke?: number;
  label?: string;
  sub?: string;
}) {
  const c = size / 2;
  const r = (size - stroke) / 2;
  const C = 2 * Math.PI * r;
  const total = inRange + review;
  const a = total ? (C * inRange) / total : 0;
  const gap = inRange > 0 && review > 0 ? 3 : 0;
  return (
    <View
      style={{ width: size, height: size }}
      accessible
      accessibilityRole="image"
      accessibilityLabel={`${t('{n} in range', { n: inRange })} · ${t('{n} need a look', { n: review })}`}
    >
      <Svg width={size} height={size}>
        <G transform={`rotate(-90, ${c}, ${c})`}>
          <Circle cx={c} cy={c} r={r} stroke={FINE.line} strokeWidth={stroke} fill="none" />
          {inRange > 0 && (
            <Circle cx={c} cy={c} r={r} stroke={FINE.jade} strokeWidth={stroke} strokeDasharray={`${Math.max(0, a - gap)} ${C - a + gap}`} fill="none" />
          )}
          {review > 0 && (
            <Circle
              cx={c}
              cy={c}
              r={r}
              stroke={FINE.gold}
              strokeWidth={stroke}
              strokeDasharray={`${Math.max(0, C - a - gap)} ${a + gap}`}
              strokeDashoffset={-a}
              fill="none"
            />
          )}
        </G>
      </Svg>
      {label || sub ? (
        <View style={[styles.center, { width: size, height: size }]}>
          {label ? <Text style={[styles.centerNum, { fontSize: Math.round(size * 0.27), lineHeight: Math.round(size * 0.33) }]}>{label}</Text> : null}
          {sub ? <Text style={styles.centerSub}>{sub}</Text> : null}
        </View>
      ) : null}
    </View>
  );
}

// La leyenda del rosco: un punto jade y uno de oro con su recuento
export function DonutLegend({ inRange, review }: { inRange: number; review: number }) {
  return (
    <View style={styles.legend} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={styles.legendRow}>
        <View style={[styles.legendDot, { backgroundColor: FINE.jade }]} />
        <Text style={styles.legendText}>{t('{n} in range', { n: inRange })}</Text>
      </View>
      <View style={styles.legendRow}>
        <View style={[styles.legendDot, { backgroundColor: FINE.gold }]} />
        <Text style={styles.legendText}>{t('{n} need a look', { n: review })}</Text>
      </View>
    </View>
  );
}

// La cifra grande y ligera de un resultado; al lado, la unidad y la fecha apagadas y el estado en jade u oro
export function LabFigure({
  value,
  unit,
  lines,
  status,
  tone = 'none',
  style,
}: {
  value: string;
  unit?: ReactNode; // texto o UnitLabel (con superíndices)
  lines?: (string | null | undefined | false)[];
  status?: string;
  tone?: LabTone;
  style?: StyleProp<ViewStyle>;
}) {
  const side = (lines ?? []).filter((l): l is string => !!l);
  return (
    <View style={[styles.figure, style]}>
      <Text style={styles.figureNum} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
        {value}
      </Text>
      <View style={styles.figureSide}>
        {typeof unit === 'string' ? (unit ? <Text style={styles.figureLine}>{unit}</Text> : null) : unit}
        {side.map((l, i) => (
          <Text key={i} style={styles.figureLine}>
            {l}
          </Text>
        ))}
        {status ? <Text style={[styles.figureStatus, { color: labToneColor(tone) }]}>{status}</Text> : null}
      </View>
    </View>
  );
}

// El estado de una fila («En rango», «Alto», «Para revisar»…), pequeño y en su tono
export function StatusWord({ label, tone }: { label: string; tone: LabTone }) {
  return (
    <Text style={[styles.status, { color: labToneColor(tone) }]} numberOfLines={1}>
      {label}
    </Text>
  );
}

export const labStyles = StyleSheet.create({
  // La unidad apagada al lado de la cifra grande (para UnitLabel)
  unit: { ...ff('regular'), color: FINE.mute, fontSize: 13, lineHeight: 18 },
  // La línea de rango debajo del nombre en una fila
  rowGauge: { marginTop: 4 },
});

const styles = StyleSheet.create({
  center: { position: 'absolute', top: 0, left: 0, alignItems: 'center', justifyContent: 'center' },
  centerNum: { ...fine.num, textAlign: 'center' },
  centerSub: { ...ff('regular'), color: FINE.mute, fontSize: 11, lineHeight: 14, textAlign: 'center', marginTop: 1, maxWidth: 96 },
  legend: { gap: 10 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { ...ff('regular'), color: FINE.ivory, fontSize: 14, lineHeight: 19, fontVariant: ['tabular-nums'] },
  figure: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 4 },
  figureNum: { ...fine.num, fontSize: 44, lineHeight: 52, flexShrink: 1 },
  figureSide: { flex: 1, minWidth: 110 },
  figureLine: { ...ff('regular'), color: FINE.mute, fontSize: 13, lineHeight: 18 },
  figureStatus: { ...ff('medium'), fontSize: 13, lineHeight: 18, marginTop: 1 },
  status: { ...ff('regular'), fontSize: 12, lineHeight: 16 },
});

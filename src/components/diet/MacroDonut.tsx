import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import { Colors } from '@/constants/colors';
import { num, t } from '@/i18n';

// Reparto de las calorías entre proteína, hidratos y grasa, en donut. Colores validados con el
// validador de dataviz (OKLCH, banda de luminosidad y separación para daltonismo) para el tema claro
// y el oscuro; coral y verde quedan en la franja 6-8 de ΔE con daltonismo, así que el donut siempre
// lleva leyenda con gramos y porcentaje y 2 px de separación entre segmentos (nunca solo color).
export const MACRO_COLORS = () =>
  Colors.isLight
    ? { protein: '#c85b32', carbs: '#17895b', fat: '#7250ba' }
    : { protein: '#dd6d45', carbs: '#2ca470', fat: '#8e71d6' };

export type Macros = { kcal: number; protein: number; carbs: number; fat: number };

// Gramos → % de la energía (4 kcal/g proteína e hidratos, 9 kcal/g grasa)
export function macroShares(m: Macros) {
  const p = m.protein * 4;
  const c = m.carbs * 4;
  const f = m.fat * 9;
  const total = p + c + f || 1;
  return { protein: (p / total) * 100, carbs: (c / total) * 100, fat: (f / total) * 100 };
}

const LABEL = { protein: 'Protein', carbs: 'Carbs', fat: 'Fat' } as const;

export const MacroDonut = ({
  m,
  size = 96,
  stroke,
  legend = 'right',
  center = true,
}: {
  m: Macros;
  size?: number;
  stroke?: number;
  legend?: 'right' | 'below' | 'inline' | 'none'; // inline: una línea corta "P 40 g · H 44 g · G 30 g"
  center?: boolean; // kcal en el centro
}) => {
  const colors = MACRO_COLORS();
  const sw = stroke ?? Math.max(5, Math.round(size / 8));
  const r = (size - sw) / 2;
  const circ = 2 * Math.PI * r;
  const shares = macroShares(m);
  const keys = ['protein', 'carbs', 'fat'] as const;
  // Extremos redondos: cada uno sobresale sw/2, así que se recorta sw + 2 para dejar 2 px visibles entre segmentos
  const gap = sw + 2;
  let acc = 0;
  const label = `${Math.round(m.kcal)} kcal: ${keys.map((k) => `${t(LABEL[k])} ${Math.round(m[k])} g (${Math.round(shares[k])} %)`).join(', ')}`;

  const donut = (
    <View style={{ width: size, height: size }} accessible accessibilityRole="image" accessibilityLabel={label}>
      <Svg width={size} height={size}>
        <G transform={`rotate(-90, ${size / 2}, ${size / 2})`}>
          <Circle cx={size / 2} cy={size / 2} r={r} stroke={Colors.divider} strokeWidth={sw} fill="none" />
          {keys.map((k) => {
            const len = (shares[k] / 100) * circ;
            const start = acc;
            acc += len;
            const visible = Math.max(0, len - gap);
            if (visible <= 0) return null;
            return (
              <Circle
                key={k}
                cx={size / 2}
                cy={size / 2}
                r={r}
                stroke={colors[k]}
                strokeWidth={sw}
                strokeLinecap="round"
                fill="none"
                strokeDasharray={`${visible} ${circ - visible}`}
                strokeDashoffset={-(start + gap / 2)}
              />
            );
          })}
        </G>
      </Svg>
      {center ? (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <View style={styles.center}>
            <Text style={[styles.kcal, { fontSize: Math.max(11, size / 5.2) }]}>{num(Math.round(m.kcal))}</Text>
            {size >= 64 ? <Text style={styles.kcalUnit}>kcal</Text> : null}
          </View>
        </View>
      ) : null}
    </View>
  );

  if (legend === 'none') return donut;
  if (legend === 'inline') {
    return (
      <View style={styles.inlineRow}>
        {donut}
        <View style={{ gap: 2 }}>
          {keys.map((k) => (
            <View key={k} style={styles.inlineItem}>
              <View style={[styles.dot, { backgroundColor: colors[k] }]} />
              <Text style={styles.inlineText}>
                {t(LABEL[k])} {Math.round(m[k])} g
              </Text>
            </View>
          ))}
        </View>
      </View>
    );
  }
  return (
    <View style={legend === 'right' ? styles.rowRight : styles.rowBelow}>
      {donut}
      <View style={legend === 'right' ? { flex: 1, gap: 6 } : styles.legendBelow}>
        {keys.map((k) => (
          <View key={k} style={styles.item}>
            <View style={[styles.swatch, { backgroundColor: colors[k] }]} />
            <Text style={styles.itemLabel}>{t(LABEL[k])}</Text>
            <Text style={styles.itemValue}>
              {Math.round(m[k])} g · {Math.round(shares[k])} %
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  kcal: { color: Colors.textPrimary, fontWeight: '900' },
  kcalUnit: { color: Colors.textMuted, fontSize: 10, fontWeight: '700', marginTop: -2 },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  rowBelow: { alignItems: 'center', gap: 10 },
  legendBelow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 12 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  swatch: { width: 10, height: 10, borderRadius: 3 },
  itemLabel: { color: Colors.textSecondary, fontSize: 13, fontWeight: '600', minWidth: 62 },
  itemValue: { color: Colors.textPrimary, fontSize: 13, fontWeight: '700' },
  inlineRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  inlineItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dot: { width: 7, height: 7, borderRadius: 2 },
  inlineText: { color: Colors.textSecondary, fontSize: 11, fontWeight: '600' },
});

import React, { useId } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, Defs, G, RadialGradient, Stop } from 'react-native-svg';
import { Colors } from '@/constants/colors';
import { num, t } from '@/i18n';
import { FINE, ff } from '@/theme/fine';

// Reparto de las calorías entre proteína, hidratos y grasa, en un anillo fino (rediseño del 2026-11-16; el fundador:
// el donut «se ve antiguo, sobre todo por tema de iconos, de fuente»). Como el donut del prototipo: trazo fino sin
// remates redondos, 3 px de hueco entre tramos, la cifra grande y ligera en el centro y la leyenda en Inter.
// Colores de la paleta fina, sin rojos ni azules saturados: proteína en jade, hidratos en oro y grasa en un marfil
// apagado. Se distinguen también por luminosidad, pero el donut siempre lleva leyenda con gramos y porcentaje (o
// el texto «Proteína 40 g…» al lado): nunca solo color.
export const MACRO_COLORS = () =>
  Colors.isLight
    ? { protein: FINE.jade, carbs: FINE.gold, fat: '#8C877D' }
    : { protein: FINE.jade, carbs: FINE.gold, fat: '#B4BDB6' };

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
  const id = `md${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const colors = MACRO_COLORS();
  // Fino como el del prototipo (7 px en un anillo de 132): unos 3 px en los pequeños, 5-6 en los grandes
  const sw = stroke ?? Math.max(3, Math.round(size / 18));
  const r = (size - sw) / 2;
  const c = size / 2;
  const circ = 2 * Math.PI * r;
  const shares = macroShares(m);
  const keys = ['protein', 'carbs', 'fat'] as const;
  // Remates rectos: el hueco entre tramos es el que se recorta, sin más
  const gap = size < 64 ? 2 : 3;
  let acc = 0;
  const label = `${Math.round(m.kcal)} kcal: ${keys.map((k) => `${t(LABEL[k])} ${Math.round(m[k])} g (${Math.round(shares[k])} %)`).join(', ')}`;

  const donut = (
    <View style={{ width: size, height: size }} accessible accessibilityRole="image" accessibilityLabel={label}>
      <Svg width={size} height={size}>
        <Defs>
          {/* Disco interior apenas marcado, como el de GlowRing */}
          <RadialGradient id={`${id}d`} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={FINE.jade} stopOpacity={0} />
            <Stop offset="0.8" stopColor={FINE.jade} stopOpacity={0.03} />
            <Stop offset="1" stopColor={FINE.jade} stopOpacity={0.08} />
          </RadialGradient>
        </Defs>
        <Circle cx={c} cy={c} r={Math.max(0, r - sw / 2)} fill={`url(#${id}d)`} />
        <G transform={`rotate(-90, ${c}, ${c})`}>
          <Circle cx={c} cy={c} r={r} stroke={FINE.line} strokeWidth={sw} fill="none" />
          {keys.map((k) => {
            const len = (shares[k] / 100) * circ;
            const start = acc;
            acc += len;
            const visible = Math.max(0, len - gap);
            if (visible <= 0.5) return null;
            return (
              <Circle
                key={k}
                cx={c}
                cy={c}
                r={r}
                stroke={colors[k]}
                strokeWidth={sw}
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
          <View style={[styles.center, { paddingHorizontal: sw + 4 }]}>
            <Text
              style={[styles.kcal, { fontSize: Math.max(11, Math.round(size / 4)), lineHeight: Math.max(13, Math.round(size / 4 + 3)) }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
            >
              {num(Math.round(m.kcal))}
            </Text>
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
        <View style={{ gap: 3 }}>
          {keys.map((k) => (
            <View key={k} style={styles.inlineItem}>
              <View style={[styles.dot, { backgroundColor: colors[k] }]} />
              <Text style={styles.inlineText}>
                {t(LABEL[k])} <Text style={styles.inlineValue}>{Math.round(m[k])} g</Text>
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
      <View style={legend === 'right' ? { flex: 1, gap: 8 } : styles.legendBelow}>
        {keys.map((k) => (
          <View key={k} style={styles.item}>
            <View style={[styles.swatch, { backgroundColor: colors[k] }]} />
            <Text style={styles.itemLabel}>{t(LABEL[k])}</Text>
            <Text style={styles.itemValue}>
              {Math.round(m[k])} g<Text style={styles.itemShare}> · {Math.round(shares[k])} %</Text>
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  // La cifra, grande y ligera; «kcal» pequeño y apagado debajo (prototipo, `.donut .rin`)
  kcal: { ...ff('light'), color: FINE.ivory, fontVariant: ['tabular-nums'], textAlign: 'center' },
  kcalUnit: { ...ff('regular'), color: FINE.mute, fontSize: 10.5, marginTop: -1 },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  rowBelow: { alignItems: 'center', gap: 12 },
  legendBelow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 14 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  swatch: { width: 8, height: 8, borderRadius: 4 },
  itemLabel: { ...ff('regular'), color: FINE.mute, fontSize: 13, minWidth: 64 },
  itemValue: { ...ff('medium'), color: FINE.ivory, fontSize: 13.5, fontVariant: ['tabular-nums'] },
  itemShare: { ...ff('regular'), color: FINE.mute, fontSize: 12.5 },
  inlineRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  inlineItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  inlineText: { ...ff('regular'), color: FINE.mute, fontSize: 11.5 },
  inlineValue: { ...ff('regular'), color: FINE.ivory, fontVariant: ['tabular-nums'] },
});

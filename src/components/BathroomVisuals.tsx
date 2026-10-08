import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Svg, { Circle, Ellipse, Path, Rect } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { BristolType } from '@/types/bathroom';

// Formas abstractas de la escala de Bristol: siluetas sencillas en un tono neutro, nada
// realista, para que registrar la consistencia no resulte desagradable.
export const BristolShape = ({ type, size = 44, color = Colors.gold }: { type: BristolType; size?: number; color?: string }) => {
  const s = size;
  const shapes: Record<BristolType, React.ReactNode> = {
    1: (
      <>
        <Circle cx={s * 0.28} cy={s * 0.42} r={s * 0.1} fill={color} />
        <Circle cx={s * 0.52} cy={s * 0.36} r={s * 0.09} fill={color} />
        <Circle cx={s * 0.72} cy={s * 0.5} r={s * 0.1} fill={color} />
        <Circle cx={s * 0.42} cy={s * 0.62} r={s * 0.09} fill={color} />
      </>
    ),
    2: (
      <>
        <Circle cx={s * 0.26} cy={s * 0.5} r={s * 0.13} fill={color} />
        <Circle cx={s * 0.44} cy={s * 0.46} r={s * 0.14} fill={color} />
        <Circle cx={s * 0.62} cy={s * 0.5} r={s * 0.13} fill={color} />
        <Circle cx={s * 0.78} cy={s * 0.47} r={s * 0.11} fill={color} />
      </>
    ),
    3: (
      <>
        <Rect x={s * 0.12} y={s * 0.36} width={s * 0.76} height={s * 0.28} rx={s * 0.14} fill={color} />
        <Path d={`M ${s * 0.34} ${s * 0.38} l ${s * 0.04} ${s * 0.1} M ${s * 0.56} ${s * 0.6} l ${s * 0.04} -${s * 0.1} M ${s * 0.7} ${s * 0.38} l -${s * 0.03} ${s * 0.09}`} stroke={Colors.card} strokeWidth={2} strokeLinecap="round" />
      </>
    ),
    4: <Rect x={s * 0.12} y={s * 0.37} width={s * 0.76} height={s * 0.26} rx={s * 0.13} fill={color} />,
    5: (
      <>
        <Ellipse cx={s * 0.3} cy={s * 0.46} rx={s * 0.14} ry={s * 0.1} fill={color} />
        <Ellipse cx={s * 0.6} cy={s * 0.42} rx={s * 0.15} ry={s * 0.11} fill={color} />
        <Ellipse cx={s * 0.48} cy={s * 0.64} rx={s * 0.13} ry={s * 0.09} fill={color} />
      </>
    ),
    6: (
      <Path
        d={`M ${s * 0.16} ${s * 0.56} q ${s * 0.06} -${s * 0.2} ${s * 0.18} -${s * 0.08} q ${s * 0.08} -${s * 0.16} ${s * 0.2} -${s * 0.04} q ${s * 0.12} -${s * 0.12} ${s * 0.2} ${s * 0.04} q ${s * 0.12} ${s * 0.06} ${s * 0.02} ${s * 0.18} q -${s * 0.1} ${s * 0.1} -${s * 0.24} ${s * 0.04} q -${s * 0.14} ${s * 0.08} -${s * 0.24} -${s * 0.02} q -${s * 0.1} -${s * 0.02} -${s * 0.12} -${s * 0.12} Z`}
        fill={color}
      />
    ),
    7: (
      <>
        <Path d={`M ${s * 0.12} ${s * 0.46} q ${s * 0.1} -${s * 0.08} ${s * 0.19} 0 t ${s * 0.19} 0 t ${s * 0.19} 0 t ${s * 0.19} 0`} stroke={color} strokeWidth={3} fill="none" strokeLinecap="round" />
        <Path d={`M ${s * 0.12} ${s * 0.6} q ${s * 0.1} -${s * 0.08} ${s * 0.19} 0 t ${s * 0.19} 0 t ${s * 0.19} 0 t ${s * 0.19} 0`} stroke={color} strokeWidth={3} fill="none" strokeLinecap="round" opacity={0.6} />
      </>
    ),
  };
  return (
    <Svg width={s} height={s}>
      {shapes[type]}
    </Svg>
  );
};

// Fila de muestras de color (círculos) con su nombre
export function ColorSwatches<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { id: T; label: string; swatch: string }[];
  value: T | undefined;
  onChange: (id: T) => void;
}) {
  return (
    <View style={styles.swatches}>
      {options.map((o) => {
        const selected = value === o.id;
        return (
          <TouchableOpacity key={o.id} style={styles.swatchItem} onPress={() => onChange(o.id)} activeOpacity={0.85}>
            <View style={[styles.swatchRing, selected && styles.swatchRingSelected]}>
              <View style={[styles.swatch, { backgroundColor: o.swatch }]}>
                {selected && <Ionicons name="checkmark" size={16} color="#FFFFFF" />}
              </View>
            </View>
            <Text style={[styles.swatchLabel, selected && { color: Colors.textPrimary }]} numberOfLines={2}>
              {o.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  swatchItem: { width: 72, alignItems: 'center' },
  swatchRing: { padding: 3, borderRadius: 26, borderWidth: 2, borderColor: 'transparent' },
  swatchRingSelected: { borderColor: Colors.accent },
  swatch: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatchLabel: { color: Colors.textSecondary, fontSize: 11, textAlign: 'center', marginTop: 4 },
});

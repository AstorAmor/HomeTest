import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Svg, { Circle, Ellipse, Path, Rect } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { BristolType } from '@/types/bathroom';
import { t } from '@/i18n';

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

// Luminosidad de un color (0 negro … 1 blanco). Por encima de 0,85 la gota lleva borde, para que no
// se pierda sobre el fondo crema; por encima de 0,6 el check va oscuro en vez de blanco.
const lum = (hex: string) => {
  const h = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
};

// Gota de la orina, la misma de la infografía de la newsletter (viewBox 0 0 54 70: la gota ocupa
// x 5–49, y 3–67, y su parte redonda es un círculo de radio 22 en 27,45). `size` es el alto en px.
// `ring` pinta alrededor el anillo de selección con ese color ('transparent' guarda el hueco sin
// pintarlo, para que nada salte al elegir). Lo de dentro (`children`) va centrado en la parte redonda;
// si es un número, mejor sin brillo (`shine={false}`), que se le monta encima.
const RING_GAP = 3;
const RING_W = 2;
export const UrineDrop = ({
  color,
  size,
  cloudy,
  ring,
  shine = true,
  children,
}: {
  color: string;
  size: number;
  cloudy?: boolean;
  ring?: string;
  shine?: boolean;
  children?: React.ReactNode;
}) => {
  const s = size / 64; // px por unidad
  const u = (px: number) => px / s;
  // El anillo es la gota agrandada `d` unidades (la punta sube más porque es un pico)
  const d = u(RING_GAP + RING_W / 2);
  const ringPath = `M27 ${3 - 1.6 * d} C27 ${3 - 1.6 * d} ${49 + d} ${30 - 0.35 * d} ${49 + d} 45 A${22 + d} ${22 + d} 0 0 1 ${5 - d} 45 C${5 - d} ${30 - 0.35 * d} 27 ${3 - 1.6 * d} 27 ${3 - 1.6 * d}Z`;
  const side = ring ? u(RING_GAP + RING_W) : u(1);
  const top = ring ? 1.6 * d + u(RING_W / 2) : u(1);
  const vb = { x: 5 - side, y: 3 - top, w: 44 + 2 * side, h: 64 + side + top };
  const pale = lum(color) > 0.85;
  const small = size < 24;
  return (
    <View style={{ width: vb.w * s, height: vb.h * s }}>
      <Svg width={vb.w * s} height={vb.h * s} viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}>
        {ring && ring !== 'transparent' && (
          <Path d={ringPath} fill="none" stroke={ring} strokeWidth={u(RING_W)} strokeLinejoin="round" />
        )}
        <Path
          d="M27 3 C27 3 49 30 49 45 A22 22 0 0 1 5 45 C5 30 27 3 27 3Z"
          fill={color}
          stroke={pale ? '#D9CFBE' : color}
          strokeWidth={u(small ? 1 : 1.5)}
        />
        {/* Turbia: unas motas suaves */}
        {cloudy && !small && (
          <>
            <Circle cx={30} cy={28} r={2.2} fill="#FFFFFF" opacity={0.75} />
            <Circle cx={22} cy={37} r={2.6} fill="#B5AA93" opacity={0.45} />
            <Circle cx={36} cy={41} r={3} fill="#FFFFFF" opacity={0.75} />
            <Circle cx={29} cy={50} r={2.4} fill="#B5AA93" opacity={0.45} />
            <Circle cx={39} cy={54} r={2} fill="#B5AA93" opacity={0.45} />
            <Circle cx={26} cy={60} r={2.2} fill="#FFFFFF" opacity={0.75} />
          </>
        )}
        {shine && !small && (
          <Path d="M15 44 A12 12 0 0 0 21 56" fill="none" stroke="#FFFFFF" strokeOpacity={0.7} strokeWidth={3} strokeLinecap="round" />
        )}
      </Svg>
      {children != null && (
        <View
          pointerEvents="none"
          style={[styles.dropInner, { left: (5 - vb.x) * s, top: (23 - vb.y) * s, width: 44 * s, height: 44 * s }]}
        >
          {children}
        </View>
      )}
    </View>
  );
};

// Fila de muestras de color (círculos, o gotas para la orina) con su nombre
export function ColorSwatches<T extends string>({
  options,
  value,
  onChange,
  center,
  shape = 'circle',
}: {
  options: { id: T; label: string; swatch: string }[];
  value: T | undefined;
  onChange: (id: T) => void;
  center?: boolean;
  shape?: 'circle' | 'drop';
}) {
  return (
    <View style={[styles.swatches, center && { justifyContent: 'center' }]}>
      {options.map((o) => {
        const selected = value === o.id;
        return (
          <TouchableOpacity key={o.id} style={styles.swatchItem} onPress={() => onChange(o.id)} activeOpacity={0.85}>
            {shape === 'drop' ? (
              <UrineDrop color={o.swatch} size={46} cloudy={o.id === 'cloudy'} ring={selected ? Colors.accent : 'transparent'}>
                {selected && <Ionicons name="checkmark" size={16} color={lum(o.swatch) > 0.6 ? '#0E2A2A' : '#FFFFFF'} />}
              </UrineDrop>
            ) : (
              <View style={[styles.swatchRing, selected && styles.swatchRingSelected]}>
                <View style={[styles.swatch, { backgroundColor: o.swatch }]}>
                  {selected && <Ionicons name="checkmark" size={16} color="#FFFFFF" />}
                </View>
              </View>
            )}
            <Text style={[styles.swatchLabel, selected && { color: Colors.textPrimary }]} numberOfLines={2}>
              {t(o.label)}
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
  dropInner: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
});

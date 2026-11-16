// Fondo ambiental de las pestañas (rediseño «Emerald Luxury · Living Nebula», 2026-11-16, como el
// mockup): un degradado verde hondo con brillos esmeralda difusos y un toque de oro muy sutil. Va detrás
// de cada pantalla (`ScreenBackdrop`, en el `screenLayout` del _layout), que tienen el fondo transparente
// (fundador, 2026-11-16: «el fondo de las ventanas sigue sin ser gradient»); al deslizar entre pestañas
// el fondo se queda quieto. Es estático (un SVG que se pinta una vez): nada que animar ni que respetar
// con «reducir movimiento». En claro, crema con un velo salvia y oro.
// Paleta: #061A16 · #0B2921 · #17634B · #83D6B4 · #D8B978 (y #F0EFE6 / #8D9E95 para textos).
import { memo, useId, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, Ellipse, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';
import { Colors } from '@/constants/colors';

type Glow = { cx: number; cy: number; rx: number; ry: number; color: string; opacity: number };

// Posiciones en fracciones de la pantalla (ancho, alto). Arriba, detrás del check-in, la luz más viva.
const DARK = {
  base: ['#061A16', '#0B2921', '#08201A'] as readonly [string, string, string],
  glows: [
    { cx: 0.12, cy: 0.06, rx: 0.95, ry: 0.42, color: '#17634B', opacity: 0.55 },
    { cx: 0.62, cy: 0.24, rx: 0.7, ry: 0.3, color: '#83D6B4', opacity: 0.1 },
    { cx: 1.02, cy: 0.5, rx: 0.6, ry: 0.32, color: '#D8B978', opacity: 0.085 },
    { cx: -0.05, cy: 0.78, rx: 0.8, ry: 0.36, color: '#17634B', opacity: 0.32 },
    { cx: 0.85, cy: 1.02, rx: 0.75, ry: 0.28, color: '#D8B978', opacity: 0.06 },
  ] as Glow[],
};
const LIGHT: typeof DARK = {
  base: ['#FBFAF5', '#F7F4EC', '#F4F0E6'],
  glows: [
    { cx: 0.1, cy: 0.05, rx: 0.95, ry: 0.4, color: '#83D6B4', opacity: 0.22 },
    { cx: 0.65, cy: 0.24, rx: 0.7, ry: 0.3, color: '#17634B', opacity: 0.05 },
    { cx: 1.02, cy: 0.5, rx: 0.6, ry: 0.32, color: '#D8B978', opacity: 0.16 },
    { cx: -0.05, cy: 0.8, rx: 0.8, ry: 0.36, color: '#83D6B4', opacity: 0.16 },
    { cx: 0.85, cy: 1.02, rx: 0.75, ry: 0.28, color: '#D8B978', opacity: 0.12 },
  ],
};

export const AmbientBackground = memo(function AmbientBackground() {
  const u = `amb${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const [size, setSize] = useState({ w: 0, h: 0 });
  const P = Colors.isLight ? LIGHT : DARK;
  const { w, h } = size;
  return (
    <View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { backgroundColor: P.base[0] }]}
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        if (Math.abs(width - w) > 1 || Math.abs(height - h) > 1) setSize({ w: width, h: height });
      }}
    >
      {w > 0 && h > 0 && (
        <Svg width={w} height={h}>
          <Defs>
            <LinearGradient id={`${u}b`} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={P.base[0]} />
              <Stop offset="0.45" stopColor={P.base[1]} />
              <Stop offset="1" stopColor={P.base[2]} />
            </LinearGradient>
            {P.glows.map((g, i) => (
              <RadialGradient key={i} id={`${u}g${i}`} cx="50%" cy="50%" r="50%">
                <Stop offset="0" stopColor={g.color} stopOpacity={g.opacity} />
                <Stop offset="0.45" stopColor={g.color} stopOpacity={g.opacity * 0.45} />
                <Stop offset="1" stopColor={g.color} stopOpacity={0} />
              </RadialGradient>
            ))}
          </Defs>
          <Rect x={0} y={0} width={w} height={h} fill={`url(#${u}b)`} />
          {P.glows.map((g, i) => (
            <Ellipse key={i} cx={g.cx * w} cy={g.cy * h} rx={g.rx * w} ry={g.ry * h} fill={`url(#${u}g${i})`} />
          ))}
        </Svg>
      )}
    </View>
  );
});

// El fondo de cada pantalla de la pila. Opaco a propósito: en Android las pantallas de encima son
// 'transparentModal' y la de debajo sigue montada, así que el color de base tapa lo de debajo desde el
// primer fotograma (el degradado se pinta en cuanto se conoce el tamaño).
export function ScreenBackdrop({ children }: { children: ReactNode }) {
  return (
    <View style={[styles.backdrop, { backgroundColor: Colors.isLight ? LIGHT.base[0] : DARK.base[0] }]}>
      <AmbientBackground />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({ backdrop: { flex: 1 } });

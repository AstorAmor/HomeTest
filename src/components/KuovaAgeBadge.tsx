import React, { useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, RadialGradient, Stop } from 'react-native-svg';
import { Colors } from '@/constants/colors';

// Insignia de la Edad KUOVA (en lugar del reloj de arena): un medallón con aro dorado y destellos,
// con solo el número dentro (el resto va fuera del círculo). El corazón de fondo será una imagen
// que pasará el fundador (una para el tema oscuro y otra para el claro); mientras, sin corazón.
// En tema oscuro, fondo verde noche; en claro, fondo como el de la app.

const PALETTE = {
  dark: {
    bg0: '#163A31',
    bg1: '#0A1915',
    ring: '#C9A36B',
    ring2: '#2E6B57',
    dots: ['#E2C27F', '#7FC29B', '#F3E7C9'],
    num: '#F6F3EC',
    glow: 0.3,
  },
  light: {
    bg0: '#FFFFFF',
    bg1: '#EFE9DD',
    ring: '#B8904F',
    ring2: '#8DB6A2',
    dots: ['#C9A36B', '#4F9A7C', '#9CC9B4'],
    num: '#0E2A24',
    glow: 0.16,
  },
};

// Destellos: siempre los mismos (semilla fija), más densos cerca del corazón
const rng = (seed: number) => {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
};
const DOTS = (() => {
  const r = rng(11);
  return Array.from({ length: 130 }, () => {
    const a = r() * Math.PI * 2;
    const d = Math.pow(r(), 0.5) * 84;
    const big = r() < 0.16;
    return {
      x: 100 + Math.cos(a) * d,
      y: 100 + Math.sin(a) * d * 0.92,
      r: big ? 3 + r() * 6 : 0.6 + Math.pow(r(), 2) * 2.4,
      color: Math.floor(r() * 3),
      opacity: (big ? 0.3 + r() * 0.35 : 0.5 + r() * 0.5) * Math.max(0, 1 - d / 108),
    };
  });
})();

let instances = 0;

export const KuovaAgeBadge = ({ size = 220, value }: { size?: number; value: string }) => {
  // Ids propios por insignia: con dos en pantalla, url(#id) apuntaría a la otra
  const id = `ka${useRef(++instances).current}`;
  const p = Colors.isLight ? PALETTE.light : PALETTE.dark;
  const k = size / 220;
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox="0 0 200 200">
        <Defs>
          <RadialGradient id={`${id}bg`} cx="50%" cy="48%" r="52%">
            <Stop offset="0" stopColor={p.bg0} />
            <Stop offset="1" stopColor={p.bg1} />
          </RadialGradient>
          <LinearGradient id={`${id}ring`} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={p.ring} stopOpacity={1} />
            <Stop offset="0.5" stopColor={p.ring} stopOpacity={0.4} />
            <Stop offset="1" stopColor={p.ring} stopOpacity={0.95} />
          </LinearGradient>
          <RadialGradient id={`${id}glow`} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={p.ring} stopOpacity={p.glow} />
            <Stop offset="1" stopColor={p.ring} stopOpacity={0} />
          </RadialGradient>
          {p.dots.map((c, i) => (
            <RadialGradient key={c} id={`${id}d${i}`} cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={c} stopOpacity={1} />
              <Stop offset="0.5" stopColor={c} stopOpacity={0.55} />
              <Stop offset="1" stopColor={c} stopOpacity={0} />
            </RadialGradient>
          ))}
        </Defs>
        <Circle cx={100} cy={100} r={96} fill={`url(#${id}bg)`} />
        <Circle cx={100} cy={100} r={74} fill={`url(#${id}glow)`} />
        {DOTS.map((dot, i) => (
          <Circle key={i} cx={dot.x} cy={dot.y} r={dot.r} fill={`url(#${id}d${dot.color})`} opacity={dot.opacity} />
        ))}
        <Circle cx={100} cy={100} r={95} fill="none" stroke={`url(#${id}ring)`} strokeWidth={1.8} />
        <Circle cx={100} cy={100} r={90} fill="none" stroke={p.ring2} strokeOpacity={0.4} strokeWidth={0.9} />
      </Svg>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <View style={styles.center}>
          <Text style={[styles.value, { color: p.num, fontSize: 62 * k, lineHeight: 70 * k }]}>{value}</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  value: { fontWeight: '800' },
});

import React, { useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, Defs, G, LinearGradient, Path, RadialGradient, Stop } from 'react-native-svg';
import { Colors } from '@/constants/colors';

// Insignia de la Edad KUOVA (en lugar del reloj de arena): un medallón con aro dorado, un corazón
// anatómico translúcido de fondo y destellos, con el número encima. En tema oscuro, fondo verde
// noche y corazón dorado; en claro, fondo como el de la app y la silueta del corazón en verde.

const HEART_BODY =
  'M98 72 C88 65 73 65 63 73 C51 83 47 101 51 119 C56 141 75 161 103 177 C107 179 111 178 114 174 C133 151 149 129 151 105 C153 85 143 71 127 67 C116 64 106 66 98 72 Z';
// Aorta con sus ramas, vena cava, arteria pulmonar y vena pulmonar (trazos gruesos redondeados)
const VESSELS: [string, number][] = [
  ['M104 74 C103 58 103 48 110 42 C118 35 132 37 136 48 C138 54 137 60 134 64', 11],
  ['M104 46 L101 27', 6],
  ['M113 40 L114 23', 6],
  ['M125 38 L130 25', 6],
  ['M84 72 L84 37', 10],
  ['M116 82 C126 76 138 74 150 70 L161 63 M150 70 L160 78', 8],
  ['M80 80 C72 78 64 80 56 78', 7],
];
// Vasos coronarios: líneas finas sobre el corazón
const CORONARY = [
  'M102 80 C97 102 104 126 113 160',
  'M104 98 C114 104 124 108 138 106',
  'M99 110 C88 118 76 122 62 120',
  'M110 132 C118 136 126 134 134 128',
];

const PALETTE = {
  dark: {
    bg0: '#163A31',
    bg1: '#0A1915',
    ring: '#C9A36B',
    ring2: '#2E6B57',
    heart: '#D8C59A',
    heartOp: 0.3,
    rim: '#F0DDB0',
    rimOp: 0.35,
    lines: 0.32,
    dots: ['#E2C27F', '#7FC29B', '#F3E7C9'],
    num: '#F6F3EC',
    label: '#E8E2D6',
    glow: 0.3,
  },
  light: {
    bg0: '#FFFFFF',
    bg1: '#EFE9DD',
    ring: '#B8904F',
    ring2: '#8DB6A2',
    heart: '#2E6B57',
    heartOp: 0.22,
    rim: '#2E6B57',
    rimOp: 0.28,
    lines: 0.26,
    dots: ['#C9A36B', '#4F9A7C', '#9CC9B4'],
    num: '#0E2A24',
    label: '#3E5A52',
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
      y: 110 + Math.sin(a) * d * 0.92,
      r: big ? 3 + r() * 6 : 0.6 + Math.pow(r(), 2) * 2.4,
      color: Math.floor(r() * 3),
      opacity: (big ? 0.3 + r() * 0.35 : 0.5 + r() * 0.5) * Math.max(0, 1 - d / 108),
    };
  });
})();

let instances = 0;

export const KuovaAgeBadge = ({ size = 220, value, label, sub, subColor }: { size?: number; value: string; label: string; sub?: string; subColor?: string }) => {
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
          <RadialGradient id={`${id}heart`} cx="45%" cy="42%" r="70%">
            <Stop offset="0" stopColor={p.heart} stopOpacity={0.95} />
            <Stop offset="1" stopColor={p.heart} stopOpacity={0.55} />
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
        <Circle cx={100} cy={108} r={74} fill={`url(#${id}glow)`} />
        <G opacity={p.heartOp}>
          {VESSELS.map(([d, w]) => (
            <Path key={d} d={d} stroke={`url(#${id}heart)`} strokeWidth={w} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          ))}
          <Path d={HEART_BODY} fill={`url(#${id}heart)`} />
        </G>
        <Path d={HEART_BODY} fill="none" stroke={p.rim} strokeOpacity={p.rimOp} strokeWidth={0.9} />
        <G opacity={p.lines}>
          {CORONARY.map((d) => (
            <Path key={d} d={d} stroke={p.rim} strokeWidth={0.7} fill="none" strokeLinecap="round" />
          ))}
        </G>
        {DOTS.map((dot, i) => (
          <Circle key={i} cx={dot.x} cy={dot.y} r={dot.r} fill={`url(#${id}d${dot.color})`} opacity={dot.opacity} />
        ))}
        <Circle cx={100} cy={100} r={95} fill="none" stroke={`url(#${id}ring)`} strokeWidth={1.8} />
        <Circle cx={100} cy={100} r={90} fill="none" stroke={p.ring2} strokeOpacity={0.4} strokeWidth={0.9} />
      </Svg>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <View style={styles.center}>
          <Text style={[styles.value, { color: p.num, fontSize: 52 * k, lineHeight: 58 * k }]}>{value}</Text>
          <Text style={[styles.label, { color: p.label, fontSize: 11.5 * k, letterSpacing: 2 * k }]}>{label}</Text>
          {sub ? <Text style={[styles.sub, { color: subColor ?? p.ring, fontSize: 14 * k }]}>{sub}</Text> : null}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 6 },
  value: { fontWeight: '800' },
  label: { fontWeight: '800', textTransform: 'uppercase', marginTop: 2 },
  sub: { fontWeight: '800', marginTop: 6 },
});

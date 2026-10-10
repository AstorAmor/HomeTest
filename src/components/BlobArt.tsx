import React, { useRef } from 'react';
import { View } from 'react-native';
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop, Ellipse } from 'react-native-svg';
import { MaterialCommunityIcons } from '@expo/vector-icons';

// Ilustración provisional para temas y especialistas (sustituye a las fotos): un degradado de
// fondo con manchas suaves de color y un icono grande encima. Determinista por `seed`: la misma
// tarjeta siempre se ve igual.

// Cada ilustración necesita ids propios para sus degradados: si el mismo tema aparece dos veces en
// el DOM (p. ej. en Today, debajo, y en "More"), url(#id) apuntaría a la copia oculta y no se vería.
let instances = 0;

const hash = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
};

export const BlobArt = ({
  seed,
  palette,
  icon,
  size,
  radius = 20,
  iconSize,
}: {
  seed: string;
  palette: [string, string, string];
  icon: string;
  size: number | { width: number; height: number };
  radius?: number;
  iconSize?: number;
}) => {
  const w = typeof size === 'number' ? size : size.width;
  const h = typeof size === 'number' ? size : size.height;
  const r = hash(seed);
  const pick = (n: number, min: number, max: number) => min + (((r >> n) & 255) / 255) * (max - min);
  const instance = useRef(++instances).current;
  const id = `b${r.toString(36)}i${instance}`;
  const [a, b, c] = palette;
  return (
    <View style={{ width: w, height: h, borderRadius: radius, overflow: 'hidden' }}>
      <Svg width={w} height={h}>
        <Defs>
          <LinearGradient id={`${id}bg`} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={a} />
            <Stop offset="1" stopColor={b} />
          </LinearGradient>
          <RadialGradient id={`${id}s1`} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={c} stopOpacity={0.85} />
            <Stop offset="1" stopColor={c} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id={`${id}s2`} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.35} />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id={`${id}s3`} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={a} stopOpacity={0.9} />
            <Stop offset="1" stopColor={a} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x={0} y={0} width={w} height={h} fill={`url(#${id}bg)`} />
        <Ellipse cx={w * pick(0, 0.15, 0.45)} cy={h * pick(8, 0.6, 0.95)} rx={w * pick(16, 0.35, 0.55)} ry={h * pick(24, 0.3, 0.45)} fill={`url(#${id}s1)`} />
        <Ellipse cx={w * pick(4, 0.6, 0.9)} cy={h * pick(12, 0.1, 0.35)} rx={w * pick(20, 0.25, 0.4)} ry={h * pick(2, 0.2, 0.35)} fill={`url(#${id}s2)`} />
        <Ellipse cx={w * pick(6, 0.7, 1)} cy={h * pick(14, 0.7, 1)} rx={w * 0.3} ry={h * 0.28} fill={`url(#${id}s3)`} />
      </Svg>
      <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
        <MaterialCommunityIcons name={icon as any} size={iconSize ?? Math.round(Math.min(w, h) * 0.36)} color="rgba(255,255,255,0.95)" />
      </View>
    </View>
  );
};

// Paletas de la marca para las ilustraciones (verde profundo, oro, salvia, terracota…)
export const ART_PALETTES = {
  forest: ['#0E2A24', '#2E6B57', '#C9A36B'],
  gold: ['#8A6D3F', '#C9A36B', '#F3E2B8'],
  sage: ['#3E6B5C', '#8DB6A2', '#E9D7B8'],
  terracotta: ['#9C4A2F', '#D9663F', '#F0B84D'],
  night: ['#1E2A4A', '#4B5BA6', '#C7B6F2'],
  rose: ['#7A2E4E', '#C2477A', '#F7B6D2'],
  ocean: ['#0F3D4C', '#2F8FA6', '#9FE0E8'],
  sand: ['#B8904F', '#EDE5D9', '#FAF8F3'],
} as const satisfies Record<string, [string, string, string]>;

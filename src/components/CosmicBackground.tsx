import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, RadialGradient, Stop, Rect, Ellipse } from 'react-native-svg';
import { Colors } from '@/constants/colors';

// Fondo "nube cósmica" discreto para el login: base de la paleta (casi negra en el
// tema oscuro, crema en el claro) y varias manchas de color muy difuminadas.
const SHAPES = [
  { id: 'b1', cx: '12%', cy: '18%', rx: '75%', ry: '42%', opacity: 0.45 },
  { id: 'b2', cx: '95%', cy: '38%', rx: '70%', ry: '38%', opacity: 0.35 },
  { id: 'b3', cx: '30%', cy: '88%', rx: '80%', ry: '40%', opacity: 0.3 },
  { id: 'b4', cx: '85%', cy: '95%', rx: '55%', ry: '30%', opacity: 0.3 },
];

export const CosmicBackground = () => {
  const BLOBS = SHAPES.map((s, i) => ({ ...s, color: Colors.cosmicBlobs[i] }));
  return (
  <View pointerEvents="none" style={StyleSheet.absoluteFill}>
    <Svg width="100%" height="100%">
      <Defs>
        {BLOBS.map((b) => (
          <RadialGradient key={b.id} id={b.id} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={b.color} stopOpacity={b.opacity} />
            <Stop offset="0.55" stopColor={b.color} stopOpacity={b.opacity * 0.35} />
            <Stop offset="1" stopColor={b.color} stopOpacity="0" />
          </RadialGradient>
        ))}
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill={Colors.cosmicBase} />
      {BLOBS.map((b) => (
        <Ellipse key={b.id} cx={b.cx} cy={b.cy} rx={b.rx} ry={b.ry} fill={`url(#${b.id})`} />
      ))}
    </Svg>
  </View>
  );
};

// La historia de una meta, como en el prototipo de las 4 pestañas (`spark()`): una línea fina en el color del
// área con un velo debajo, el último punto en marfil y la meta como línea de puntos. Va en la unidad de la meta
// (pasos al día, sesiones a la semana…). Los días o semanas sin dato no se pintan: la línea une los que hay.
import { useState } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Line, Polygon, Polyline } from 'react-native-svg';

export function MetaChart({ values, color, goal, height = 96 }: { values: (number | null)[]; color: string; goal?: number; height?: number }) {
  const [w, setW] = useState(0);
  const pts = values.map((v, i) => [i, v] as const).filter((p): p is readonly [number, number] => p[1] != null);
  const all = pts.map((p) => p[1]).concat(goal == null ? [] : [goal]);
  const mn = Math.min(...all, 0);
  const mx = Math.max(...all);
  const r = mx - mn || 1;
  const h = height;
  const base = h - 10;
  const y = (v: number) => base - ((v - mn) / r) * (h - 26);
  const x = (i: number) => (values.length > 1 ? (i / (values.length - 1)) * (w - 16) + 8 : w / 2);
  const xy = pts.map(([i, v]) => [x(i), y(v)] as const);
  const line = xy.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  const end = xy[xy.length - 1];
  return (
    <View style={{ height: h, marginTop: 12 }} onLayout={(e) => setW(e.nativeEvent.layout.width)} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {w > 0 && xy.length > 1 && (
        <Svg width={w} height={h}>
          <Line x1={8} x2={w - 8} y1={base} y2={base} stroke="rgba(240,239,230,0.09)" />
          {goal != null && <Line x1={8} x2={w - 8} y1={y(goal)} y2={y(goal)} stroke="#F0EFE6" strokeOpacity={0.5} strokeDasharray="3 5" />}
          <Polygon points={`${xy[0][0].toFixed(1)},${base} ${line} ${end[0].toFixed(1)},${base}`} fill={color} opacity={0.09} />
          <Polyline points={line} fill="none" stroke={color} strokeWidth={1.7} strokeLinejoin="round" strokeLinecap="round" />
          <Circle cx={end[0]} cy={end[1]} r={4} fill="#F7F3E6" />
        </Svg>
      )}
    </View>
  );
}

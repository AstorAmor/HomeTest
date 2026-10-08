import React, { ReactNode } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Circle, G, Path } from 'react-native-svg';
import { Colors } from '@/constants/colors';

interface ProgressRingProps {
  progress: number; // 0..1 (se recorta)
  color: string;
  size?: number;
  strokeWidth?: number;
  trackColor?: string;
  // Colores repartidos a lo largo de la vuelta completa (p. ej. coral → ámbar → verde): el
  // arco va cambiando de color según avanza, y un valor bajo solo enseña el principio.
  gradient?: string[];
  children?: ReactNode; // contenido centrado (número, icono...)
}

const SEGMENTS = 90;

const hexToRgb = (hex: string) => {
  const h = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
};

// Color en la posición t (0..1) de una lista de colores repartidos a partes iguales
export const colorAt = (stops: string[], t: number) => {
  if (stops.length === 1) return stops[0];
  const x = Math.max(0, Math.min(1, t)) * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(x));
  const [a, b] = [hexToRgb(stops[i]), hexToRgb(stops[i + 1])];
  const f = x - i;
  const mix = a.map((v, k) => Math.round(v + (b[k] - v) * f));
  return `rgb(${mix[0]}, ${mix[1]}, ${mix[2]})`;
};

// Anillo de progreso de un solo valor (daily readiness, pasos, calorías, sueño).
// A diferencia de DonutChart, que reparte segmentos, aquí hay una sola meta.
export const ProgressRing = ({
  progress,
  color,
  size = 72,
  strokeWidth = 8,
  trackColor = Colors.divider,
  gradient,
  children,
}: ProgressRingProps) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(1, progress));
  const c = size / 2;

  // Punto del anillo a una fracción t de la vuelta, empezando arriba y en sentido horario
  const point = (t: number) => {
    const a = t * 2 * Math.PI - Math.PI / 2;
    return [c + radius * Math.cos(a), c + radius * Math.sin(a)];
  };

  const gradientArc = () => {
    const n = Math.max(1, Math.ceil(clamped * SEGMENTS));
    const step = clamped / n;
    const parts = [];
    for (let i = 0; i < n; i++) {
      const t0 = i * step;
      // Cada tramo pisa un poco el siguiente para que no se vean costuras
      const t1 = Math.min(clamped, (i + 1) * step + 0.004);
      const [x0, y0] = point(t0);
      const [x1, y1] = point(t1);
      parts.push(
        <Path
          key={i}
          d={`M ${x0} ${y0} A ${radius} ${radius} 0 0 1 ${x1} ${y1}`}
          stroke={colorAt(gradient!, (t0 + t1) / 2)}
          strokeWidth={strokeWidth}
          fill="none"
        />
      );
    }
    // Extremos redondeados con el color de cada punta
    const [sx, sy] = point(0);
    const [ex, ey] = point(clamped);
    parts.push(<Circle key="start" cx={sx} cy={sy} r={strokeWidth / 2} fill={colorAt(gradient!, 0)} />);
    parts.push(<Circle key="end" cx={ex} cy={ey} r={strokeWidth / 2} fill={colorAt(gradient!, clamped)} />);
    return parts;
  };

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Circle cx={c} cy={c} r={radius} stroke={trackColor} strokeWidth={strokeWidth} fill="none" />
        {clamped > 0 &&
          (gradient && gradient.length > 0 ? (
            gradientArc()
          ) : (
            <G transform={`rotate(-90, ${c}, ${c})`}>
              <Circle
                cx={c}
                cy={c}
                r={radius}
                stroke={color}
                strokeWidth={strokeWidth}
                strokeDasharray={`${clamped * circumference} ${circumference}`}
                strokeLinecap="round"
                fill="none"
              />
            </G>
          ))}
      </Svg>
      <View style={[styles.center, { width: size, height: size }]}>{children}</View>
    </View>
  );
};

const styles = StyleSheet.create({
  center: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

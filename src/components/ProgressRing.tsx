import React, { ReactNode } from 'react';
import { Colors } from '@/constants/colors';
import { GlowRing, ringTones, type RingColors } from './GlowRing';

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

// Anillo de progreso de un solo valor (ciclo, vistas previas…). Desde el 2026-11-16 es el aro cometa con luz de
// Hoy (GlowRing): el fundador quiere todos los círculos de la app iguales, «que carguen así, modo brillante».
// Con `gradient`, la cola, la mitad y la punta toman su primer color, el del medio y el último.
const isHex = (c: string) => /^#[0-9a-fA-F]{6}$/.test(c);
export const ProgressRing = ({ progress, color, size = 72, strokeWidth = 8, gradient, children }: ProgressRingProps) => {
  const tones: RingColors =
    gradient && gradient.length >= 2 && gradient.every(isHex)
      ? [gradient[0], gradient[Math.floor((gradient.length - 1) / 2)], gradient[gradient.length - 1]]
      : ringTones(isHex(color) ? color : Colors.accent);
  // Más fino que el anillo de antes: como los círculos de Hoy
  const stroke = Math.max(3, Math.min(strokeWidth, Math.round(size / 15)));
  return (
    <GlowRing progress={progress} colors={tones} size={size} stroke={stroke}>
      {children}
    </GlowRing>
  );
};

// Anillo de progreso fino tipo cometa (rediseño «Emerald Luxury», 2026-11-15; fundador: «me gusta el
// gradiente, pero que se vea un poco más estrecho»): la cola sale arriba, estrecha y algo difuminada, y se
// va ensanchando hasta la cabeza, que lleva un punto de luz. Pista muy discreta, un halo suave alrededor
// y un disco interior apenas marcado. Se llena desde 0 al aparecer y se mueve suave al cambiar.
// SVG no tiene degradado cónico: la mitad derecha va de `colors[0]` (arriba) a `colors[1]` (abajo) y la
// izquierda de `colors[1]` a `colors[2]`, así el color sigue la vuelta sin costuras. El arco es una forma
// rellena (no un trazo) para poder estrecharlo hacia la cola.
import { ReactNode, useId } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, G, LinearGradient, Path, RadialGradient, Stop } from 'react-native-svg';
import { Colors, withAlpha } from '@/constants/colors';
import { useTween } from '@/hooks/useTween';

export type RingColors = readonly [string, string, string];

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
export const mixHex = (a: string, b: string, f: number) => {
  const [x, y] = [rgb(a), rgb(b)];
  return `#${x.map((v, i) => Math.round(v + (y[i] - v) * f).toString(16).padStart(2, '0')).join('')}`;
};

// Los tres tonos de un anillo a partir de un color (#RRGGBB): hondo, el color y uno luminoso en la punta
export function ringTones(color: string): RingColors {
  return Colors.isLight
    ? [mixHex(color, '#000000', 0.25), color, mixHex(color, '#FFFFFF', 0.25)]
    : [mixHex(color, Colors.background, 0.35), color, mixHex(color, '#FFFFFF', 0.45)];
}

const TAIL = 0.28; // grosor de la cola respecto a la cabeza
const SAMPLES = 72; // puntos por vuelta del contorno

// Contorno de la banda entre las fracciones `a` y `b` de la vuelta, con grosor w(f)
function band(c: number, r: number, a: number, b: number, w: (f: number) => number) {
  const steps = Math.max(2, Math.ceil((b - a) * SAMPLES));
  const outer: string[] = [];
  const inner: string[] = [];
  for (let i = 0; i <= steps; i++) {
    const f = a + ((b - a) * i) / steps;
    const ang = f * 2 * Math.PI - Math.PI / 2;
    const h = w(f) / 2;
    const cos = Math.cos(ang);
    const sin = Math.sin(ang);
    outer.push(`${(c + (r + h) * cos).toFixed(2)} ${(c + (r + h) * sin).toFixed(2)}`);
    inner.push(`${(c + (r - h) * cos).toFixed(2)} ${(c + (r - h) * sin).toFixed(2)}`);
  }
  return `M ${outer.join(' L ')} L ${inner.reverse().join(' L ')} Z`;
}

export function GlowRing({
  progress,
  colors,
  size = 80,
  stroke = 5,
  children,
}: {
  progress: number; // 0..1 (se recorta)
  colors: RingColors; // inicio, mitad, punta
  size?: number;
  stroke?: number;
  children?: ReactNode;
}) {
  const id = `gr${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const target = Math.max(0, Math.min(1, progress));
  const p = useTween(target, 1100, 0);

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <GlowRingArt id={id} progress={p} colors={colors} size={size} stroke={stroke} />
      </Svg>
      <View style={[StyleSheet.absoluteFill, styles.center]}>{children}</View>
    </View>
  );
}

// El dibujo del anillo, quieto y sin la vista de alrededor, para meterlo dentro de otro SVG: la imagen que se comparte
// de una insignia (BadgeShareCard) lleva así el mismo anillo que se ve en la app. `id`: único en ese SVG.
export function GlowRingArt({ id, progress, colors, size, stroke }: { id: string; progress: number; colors: RingColors; size: number; stroke: number }) {
  const p = Math.max(0, Math.min(1, progress));
  const small = size < 48;
  const c = size / 2;
  const dot = small ? 0 : stroke * 0.62; // el punto de luz de la cabeza
  const r = c - stroke / 2 - (small ? 0.5 : stroke * 0.55); // deja sitio al brillo del punto
  const at = (f: number) => {
    const a = f * 2 * Math.PI - Math.PI / 2;
    return { x: c + r * Math.cos(a), y: c + r * Math.sin(a) };
  };
  // Grosor: estrecho en la cola, entero en la cabeza
  const width = (f: number) => stroke * (TAIL + (1 - TAIL) * Math.pow(p > 0 ? Math.min(1, f / p) : 0, 0.7));
  const tip = at(p);
  const tipColor = p <= 0.5 ? mixHex(colors[0], colors[1], p * 2) : mixHex(colors[1], colors[2], (p - 0.5) * 2);
  const light = Colors.isLight;

  return (
    <G>
      <Defs>
        {/* Mitad derecha: la cola, arriba, algo difuminada */}
        <LinearGradient id={`${id}a`} gradientUnits="userSpaceOnUse" x1={c} y1={c - r} x2={c} y2={c + r}>
          <Stop offset="0" stopColor={colors[0]} stopOpacity={0.4} />
          <Stop offset="0.4" stopColor={mixHex(colors[0], colors[1], 0.4)} stopOpacity={1} />
          <Stop offset="1" stopColor={colors[1]} />
        </LinearGradient>
        <LinearGradient id={`${id}b`} gradientUnits="userSpaceOnUse" x1={c} y1={c + r} x2={c} y2={c - r}>
          <Stop offset="0" stopColor={colors[1]} />
          <Stop offset="1" stopColor={colors[2]} />
        </LinearGradient>
        {/* Disco interior: casi transparente en el centro y un velo del color hacia el borde */}
        <RadialGradient id={`${id}d`} cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={colors[1]} stopOpacity={0} />
          <Stop offset="0.75" stopColor={colors[1]} stopOpacity={light ? 0.04 : 0.05} />
          <Stop offset="1" stopColor={colors[1]} stopOpacity={light ? 0.1 : 0.12} />
        </RadialGradient>
        {/* Halo: una luz muy suave a lo largo del anillo, más fuerte cuanto más lleno */}
        <RadialGradient id={`${id}h`} cx="50%" cy="50%" r="50%">
          <Stop offset={String(Math.max(0, (r - stroke * 2.2) / c))} stopColor={colors[2]} stopOpacity={0} />
          <Stop offset={String(r / c)} stopColor={colors[2]} stopOpacity={(light ? 0.1 : 0.16) * (0.35 + 0.65 * p)} />
          <Stop offset="1" stopColor={colors[2]} stopOpacity={0} />
        </RadialGradient>
        <RadialGradient id={`${id}g`} cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={colors[2]} stopOpacity={light ? 0.55 : 0.7} />
          <Stop offset="1" stopColor={colors[2]} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      {!small && <Circle cx={c} cy={c} r={c} fill={`url(#${id}h)`} />}
      <Circle cx={c} cy={c} r={r - stroke / 2} fill={`url(#${id}d)`} />
      <Circle cx={c} cy={c} r={r} stroke={withAlpha(colors[1], light ? 0.14 : 0.12)} strokeWidth={stroke * 0.7} fill="none" />
      {p > 0.002 && <Path d={band(c, r, 0, Math.min(p, 0.5) + (p > 0.5 ? 0.004 : 0), width)} fill={`url(#${id}a)`} />}
      {p > 0.5 && <Path d={band(c, r, 0.5, p, width)} fill={`url(#${id}b)`} />}
      {p > 0.002 && (
        <>
          {/* Cabeza redondeada del color de la punta */}
          <Circle cx={tip.x} cy={tip.y} r={width(p) / 2} fill={tipColor} />
          {dot > 0 && (
            <>
              <Circle cx={tip.x} cy={tip.y} r={dot * 2.6} fill={`url(#${id}g)`} />
              <Circle cx={tip.x} cy={tip.y} r={dot} fill={light ? '#FFFFFF' : '#F7F3E6'} />
            </>
          )}
        </>
      )}
    </G>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
});

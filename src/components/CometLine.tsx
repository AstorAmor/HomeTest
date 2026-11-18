// Línea de progreso tipo cometa, recta (rediseño «Emerald Luxury», 2026-11-16): lo mismo que el aro del
// check-in pero en horizontal. La cola, a la izquierda, sale estrecha y difuminada y se ensancha hasta la
// cabeza, que lleva un punto de luz. Debajo, una pista apenas marcada hasta el final.
// - `spread="fill"` (por defecto): los colores van de la cola a la cabeza (un tono que se aviva).
// - `spread="track"`: los colores se reparten por todo el ancho y la cabeza toma el del sitio al que
//   llega (p. ej. la disposición: coral, oro, verde).
// Se llena desde 0 al aparecer y se mueve suave al cambiar (useTween; con «reducir movimiento», salta).
import { useId, useState } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Path, RadialGradient, Stop } from 'react-native-svg';
import { Colors, withAlpha } from '@/constants/colors';
import { mixHex } from '@/components/GlowRing';
import { useTween } from '@/hooks/useTween';

const TAIL = 0.22; // grosor de la cola respecto a la cabeza

// Color en la posición f (0..1) de una lista de colores repartidos por igual
export function colorAt(colors: readonly string[], f: number): string {
  if (colors.length === 1) return colors[0];
  const x = Math.max(0, Math.min(1, f)) * (colors.length - 1);
  const i = Math.min(colors.length - 2, Math.floor(x));
  return mixHex(colors[i], colors[i + 1], x - i);
}

export function CometLine({
  progress,
  colors,
  thickness = 4,
  spread = 'fill',
  track = true,
  style,
}: {
  progress: number; // 0..1 (se recorta)
  colors: readonly string[];
  thickness?: number; // grosor de la cabeza
  spread?: 'fill' | 'track';
  track?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const id = `cl${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const [w, setW] = useState(0);
  const p = useTween(Math.max(0, Math.min(1, progress)), 1000, 0);
  const light = Colors.isLight;
  const glow = thickness * 2.4; // radio del brillo de la cabeza
  const H = Math.ceil(glow * 2);
  const c = H / 2;
  const x0 = glow; // deja sitio al brillo en los dos extremos
  const x1 = Math.max(x0, w - glow);
  const head = x0 + (x1 - x0) * p;
  const len = head - x0;
  // f: 0 cola … 1 cabeza; con `track`, la posición real en la pista es f·p
  const tone = (f: number) => colorAt(colors, spread === 'track' ? f * p : f);
  const headColor = tone(1);

  // Contorno relleno: arriba de la cola a la cabeza y vuelta por abajo
  let d = '';
  if (len > 0.5) {
    const N = Math.max(4, Math.ceil(len / 6));
    const top: string[] = [];
    const bot: string[] = [];
    for (let i = 0; i <= N; i++) {
      const f = i / N;
      const half = (thickness * (TAIL + (1 - TAIL) * Math.pow(f, 0.7))) / 2;
      const x = (x0 + f * len).toFixed(2);
      top.push(`${x} ${(c - half).toFixed(2)}`);
      bot.push(`${x} ${(c + half).toFixed(2)}`);
    }
    d = `M ${top.join(' L ')} L ${bot.reverse().join(' L ')} Z`;
  }
  // Degradado de la cola a la cabeza: color (según `spread`) y opacidad (la cola se difumina)
  const stops = [0, 0.2, 0.45, 0.7, 1].map((f) => ({ f, color: tone(f), op: 0.12 + 0.88 * Math.pow(f, 0.8) }));

  return (
    <View style={[{ height: H }, style]} onLayout={(e) => setW(e.nativeEvent.layout.width)} pointerEvents="none">
      {w > 0 && (
        <Svg width={w} height={H}>
          <Defs>
            <LinearGradient id={`${id}f`} gradientUnits="userSpaceOnUse" x1={x0} y1={c} x2={Math.max(head, x0 + 1)} y2={c}>
              {stops.map((s) => (
                <Stop key={s.f} offset={String(s.f)} stopColor={s.color} stopOpacity={s.op} />
              ))}
            </LinearGradient>
            <RadialGradient id={`${id}g`} cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={mixHex(headColor, '#FFFFFF', 0.2)} stopOpacity={light ? 0.5 : 0.7} />
              <Stop offset="1" stopColor={headColor} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          {track && (
            <Line
              x1={x0}
              y1={c}
              x2={x1}
              y2={c}
              stroke={withAlpha(light ? '#0E2A24' : '#F0EFE6', light ? 0.09 : 0.08)}
              strokeWidth={Math.max(1, thickness * 0.3)}
              strokeLinecap="round"
            />
          )}
          {d ? <Path d={d} fill={`url(#${id}f)`} /> : null}
          {len > 0.5 && (
            <>
              <Circle cx={head} cy={c} r={thickness / 2} fill={headColor} />
              <Circle cx={head} cy={c} r={glow} fill={`url(#${id}g)`} />
              <Circle cx={head} cy={c} r={Math.max(1.4, thickness * 0.42)} fill={light ? '#FFFFFF' : '#F7F3E6'} />
            </>
          )}
        </Svg>
      )}
    </View>
  );
}

// La nebulosa del check-in (rediseño «Emerald Luxury · Living Nebula», 2026-11-15): sustituye a la carita.
// fundador, mismo día: nada de «planeta» (ni esfera ni órbitas), mejor por capas, como la Edad KUOVA, y que
// se note mucho más cómo se carga. Así que son láminas de luz apiladas, con el borde de ruido suave y una
// sombra difusa (como las «capas» de la marca), que respiran y se mecen despacio, cada una a su ritmo.
// Con los check-ins del día crece desde dentro y se enciende:
// En el centro, la K de KUOVA (fundador, 2026-11-16: «me falta algo ahí»).
//   0: tres láminas pequeñas, verde hondo y tenue
//   1: una lámina más; el centro pasa a jade
//   2: otra más; jade y esmeralda hasta fuera, núcleo champán
//   3: todas, a su tamaño, luminosas, con el núcleo dorado
// Todo cambia fundiéndose, nunca a saltos. Sin destellos ni estrellitas al completar (fundador, 2026-11-16:
// «quedan un poco cutres»).
//
// Rendimiento: el SVG de cada lámina se dibuja una vez; lo que se anima (escala, giro leve, desplazamiento,
// opacidad) son transformaciones de vistas en el hilo de la interfaz (Reanimated), sin volver a pintar el
// SVG. Un solo reloj (`clock`, una vuelta cada LOOP ms) mueve todo con un número entero de ciclos por
// vuelta, así nunca da saltos. Se para cuando no se ve (`moving`) y con «reducir movimiento».
import { useEffect, useId, type ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  Easing,
  Extrapolation,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, G, LinearGradient, Path, RadialGradient, Stop } from 'react-native-svg';
import { Colors } from '@/constants/colors';
import { mixHex } from '@/components/GlowRing';
import { K_PATH } from '@/components/LaunchIntro';

const V = 200; // viewBox: centro en 100,100
const K_W = 30; // ancho de la K en el viewBox
const K_H = (K_W * 257) / 260;
const LOOP = 120000; // ms de una vuelta del reloj
const TAU = Math.PI * 2;

// Números pseudoaleatorios con semilla (mulberry32, como scripts/kuova-age-art.py): misma forma siempre
function seeded(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Lámina: contorno cerrado y suave con el borde ondulado por unas pocas armónicas (ruido «fractal» suave)
function sheetPath(cx: number, cy: number, R: number, seed: number) {
  const rnd = seeded(seed);
  const harm = [2, 3, 4, 6, 9].map((k, j) => ({ k, a: [0.06, 0.045, 0.03, 0.018, 0.01][j] * (0.6 + 0.8 * rnd()), ph: rnd() * TAU }));
  const N = 48;
  const pts = Array.from({ length: N }, (_, i) => {
    const th = (i / N) * TAU;
    const rr = R * (1 + harm.reduce((s, h) => s + h.a * Math.sin(h.k * th + h.ph), 0));
    return [cx + rr * Math.cos(th), cy + rr * Math.sin(th)];
  });
  // Catmull-Rom cerrado → curvas de Bézier
  const f = (n: number) => n.toFixed(1);
  let d = `M ${f(pts[0][0])} ${f(pts[0][1])}`;
  for (let i = 0; i < N; i++) {
    const p0 = pts[(i - 1 + N) % N];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % N];
    const p3 = pts[(i + 2) % N];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C ${f(c1[0])} ${f(c1[1])} ${f(c2[0])} ${f(c2[1])} ${f(p2[0])} ${f(p2[1])}`;
  }
  return `${d} Z`;
}

// Seis láminas, de fuera adentro; la meseta de dentro algo arriba a la izquierda, como en la Edad KUOVA
const RADII = [72, 63, 54, 45, 36, 26]; // la de fuera no llega al aro ni meciéndose (máx. ~86 de 91)
const SHEETS = RADII.map((R, i) => sheetPath(100 - 1.2 * i, 100 - 1.6 * i, R, 41 + i * 17));
// Cuándo aparece cada lámina (las tres de dentro, siempre) y cuándo se enciende (de dentro afuera)
const APPEAR: [number, number][] = [
  [0.78, 1],
  [0.45, 0.67],
  [0.12, 0.34],
  [-1, 0],
  [-1, 0],
  [-1, 0],
];
const LIGHT_ON: [number, number][] = [
  [0.72, 1],
  [0.55, 0.92],
  [0.38, 0.78],
  [0.2, 0.62],
  [0.06, 0.45],
  [0, 0.34],
];
// Ritmo de cada lámina: ciclos por vuelta del reloj (enteros) y desfase
const SWAY = [
  [9, 7, 0.0],
  [11, 8, 0.21],
  [13, 10, 0.43],
  [10, 12, 0.66],
  [12, 9, 0.12],
  [14, 11, 0.37],
];

const DARK_P = {
  dim: ['#0D2620', '#102E27', '#13372F', '#174137', '#1B4C40', '#205849'],
  // La meseta del centro, algo más honda que la lámina de fuera, para que la K dorada se lea encima
  lit: ['#155E48', '#1D735B', '#2A8A6C', '#3EA07F', '#5DB792', '#2C7D62'],
  edge: '#9FE0C3',
  shadow: '#020A08',
  shadowOp: 0.42,
  halo: '#17634B',
  haloLit: '#83D6B4',
  champagne: '#D8B978',
  core: '#F4F1E4',
  gold: '#FFF1CF',
};
const LIGHT_P: typeof DARK_P = {
  dim: ['#EDE7DA', '#E7E0D1', '#E0D8C7', '#D9D0BD', '#D1C8B3', '#C9BFA8'],
  lit: ['#DCEADF', '#C5DFCE', '#A6D0B8', '#86C2A2', '#6DB591', '#CFE6D9'],
  edge: '#FFFFFF',
  shadow: '#0E2A24',
  shadowOp: 0.16,
  halo: '#B9D9C8',
  haloLit: '#7CCBA8',
  champagne: '#C9A366',
  core: '#FFFFFF',
  gold: '#F2D594',
};

function Layer({ size, style, children }: { size: number; style?: object; children: ReactNode }) {
  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, style]} renderToHardwareTextureAndroid shouldRasterizeIOS>
      <Svg width={size} height={size} viewBox={`0 0 ${V} ${V}`}>
        {children}
      </Svg>
    </Animated.View>
  );
}

// Una lámina: su sombra y su tono apagado, y encima el mismo contorno encendido (que se funde con el
// progreso). Se mece: respira en ancho y alto a destiempo, gira unos grados y se desplaza un poco.
function Sheet({ i, size, u, P, clock, p }: { i: number; size: number; u: string; P: typeof DARK_P; clock: SharedValue<number>; p: SharedValue<number> }) {
  const [a0, a1] = APPEAR[i];
  const [l0, l1] = LIGHT_ON[i];
  const [k1, k2, ph] = SWAY[i];
  const sway = useAnimatedStyle(() => {
    const s1 = Math.sin(TAU * (clock.value * k1 + ph));
    const s2 = Math.cos(TAU * (clock.value * k2 + ph));
    const grow = interpolate(p.value, [a0, a1], [0.86, 1], Extrapolation.CLAMP);
    return {
      opacity: interpolate(p.value, [a0, a1], [0, 1], Extrapolation.CLAMP),
      transform: [
        { translateX: (1.4 * s2 * size) / V },
        { translateY: (1.2 * s1 * size) / V },
        { rotate: `${6 * s1}deg` },
        { scaleX: grow * (1 + 0.028 * s1) },
        { scaleY: grow * (1 + 0.028 * s2) },
      ],
    };
  });
  const lit = useAnimatedStyle(() => ({ opacity: interpolate(p.value, [l0, l1], [i === 5 ? 0.08 : 0, 1], Extrapolation.CLAMP) }));
  const d = SHEETS[i];
  const dim = P.dim[i];
  const on = P.lit[i];
  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, sway]}>
      <Svg width={size} height={size} viewBox={`0 0 ${V} ${V}`}>
        <Defs>
          <RadialGradient id={`${u}d${i}`} cx="50%" cy="50%" r="55%" fx="38%" fy="34%">
            <Stop offset="0" stopColor={mixHex(dim, '#FFFFFF', 0.06)} />
            <Stop offset="1" stopColor={dim} />
          </RadialGradient>
        </Defs>
        {/* Sombra difusa hacia abajo a la derecha: dos copias desplazadas */}
        <G opacity={P.shadowOp}>
          <Path d={d} fill={P.shadow} opacity={0.35} transform="translate(3.4 5)" />
          <Path d={d} fill={P.shadow} opacity={0.65} transform="translate(1.5 2.3)" />
        </G>
        <Path d={d} fill={`url(#${u}d${i})`} />
      </Svg>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, lit]}>
        <Svg width={size} height={size} viewBox={`0 0 ${V} ${V}`}>
          <Defs>
            <RadialGradient id={`${u}l${i}`} cx="50%" cy="50%" r="55%" fx="38%" fy="34%">
              <Stop offset="0" stopColor={mixHex(on, '#FFFFFF', 0.12)} />
              <Stop offset="1" stopColor={on} />
            </RadialGradient>
          </Defs>
          <Path d={d} fill={`url(#${u}l${i})`} stroke={P.edge} strokeOpacity={0.22} strokeWidth={0.6} />
        </Svg>
      </Animated.View>
    </Animated.View>
  );
}

export function CheckInNebula({ size, progress, burst, moving }: { size: number; progress: number; burst: number; moving: boolean }) {
  const P = Colors.isLight ? LIGHT_P : DARK_P;
  const u = `nb${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const reduce = useReducedMotion();
  const clock = useSharedValue(0);
  const p = useSharedValue(0);
  const pop = useSharedValue(1);

  // El reloj: corre mientras se ve; al volver sigue desde donde estaba
  useEffect(() => {
    if (!moving || reduce) {
      cancelAnimation(clock);
      return;
    }
    clock.value = withRepeat(withTiming(clock.value + 1, { duration: LOOP, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(clock);
  }, [moving, reduce, clock]);

  // La luz y el tamaño van hacia el progreso del día, despacio
  useEffect(() => {
    const target = Math.max(0, Math.min(1, progress));
    p.value = reduce ? target : withTiming(target, { duration: 1600, easing: Easing.out(Easing.cubic) });
  }, [progress, reduce, p]);

  // Al completar los tres: crece y vuelve
  useEffect(() => {
    if (!burst || reduce) return;
    pop.value = withSequence(
      withTiming(1.14, { duration: 300, easing: Easing.out(Easing.back(2)) }),
      withSpring(1, { damping: 7, stiffness: 110 }),
    );
  }, [burst, reduce, pop]);

  const whole = useAnimatedStyle(() => ({ transform: [{ scale: interpolate(p.value, [0, 1], [0.8, 1]) * pop.value }] }));
  const haloDim = useAnimatedStyle(() => ({ opacity: 0.8 + 0.2 * Math.sin(TAU * clock.value * 20) }));
  const haloLit = useAnimatedStyle(() => ({ opacity: interpolate(p.value, [0, 1], [0.05, 1]) * (0.75 + 0.25 * Math.sin(TAU * clock.value * 20)) }));
  const core = useAnimatedStyle(() => ({
    opacity: interpolate(p.value, [0, 0.34, 1], [0.12, 0.6, 1]),
    transform: [{ scale: 1 + 0.08 * Math.sin(TAU * clock.value * 26) }],
  }));
  const coreGold = useAnimatedStyle(() => ({
    opacity: interpolate(p.value, [0.5, 1], [0, 0.95], Extrapolation.CLAMP) * (0.82 + 0.18 * Math.sin(TAU * (clock.value * 26 + 0.25))),
    transform: [{ scale: 1 + 0.1 * Math.sin(TAU * (clock.value * 26 + 0.25)) }],
  }));

  return (
    <Animated.View pointerEvents="none" style={[{ width: size, height: size }, whole]}>
      {/* Halo tenue (siempre) y halo luminoso (crece con el progreso) */}
      <Layer size={size} style={haloDim}>
        <Defs>
          <RadialGradient id={`${u}hd`} cx="50%" cy="50%" r="50%">
            <Stop offset="0.3" stopColor={P.halo} stopOpacity={0.45} />
            <Stop offset="0.65" stopColor={P.halo} stopOpacity={0.12} />
            <Stop offset="1" stopColor={P.halo} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={100} cy={100} r={99} fill={`url(#${u}hd)`} />
      </Layer>
      <Layer size={size} style={haloLit}>
        <Defs>
          <RadialGradient id={`${u}hl`} cx="50%" cy="50%" r="50%">
            <Stop offset="0.35" stopColor={P.haloLit} stopOpacity={0.42} />
            <Stop offset="0.7" stopColor={P.champagne} stopOpacity={0.14} />
            <Stop offset="1" stopColor={P.champagne} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={100} cy={100} r={99} fill={`url(#${u}hl)`} />
      </Layer>
      {RADII.map((_, i) => (
        <Sheet key={i} i={i} size={size} u={u} P={P} clock={clock} p={p} />
      ))}
      {/* Luz del centro: blanca y jade; dorada con el día completo */}
      <Layer size={size} style={core}>
        <Defs>
          <RadialGradient id={`${u}k1`} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={P.core} stopOpacity={0.55} />
            <Stop offset="0.4" stopColor={P.haloLit} stopOpacity={0.3} />
            <Stop offset="1" stopColor={P.haloLit} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={94} cy={92} r={26} fill={`url(#${u}k1)`} />
      </Layer>
      <Layer size={size} style={coreGold}>
        <Defs>
          <RadialGradient id={`${u}k2`} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={P.gold} stopOpacity={0.95} />
            <Stop offset="0.35" stopColor={P.champagne} stopOpacity={0.6} />
            <Stop offset="1" stopColor={P.champagne} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={94} cy={92} r={30} fill={`url(#${u}k2)`} />
      </Layer>
      {/* La K de KUOVA en la meseta: dorada en oscuro (como la entrada de la app), verde KUOVA en claro */}
      <Layer size={size}>
        <Defs>
          <LinearGradient id={`${u}kg`} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#F6E6C3" />
            <Stop offset="0.32" stopColor="#DDBD86" />
            <Stop offset="0.58" stopColor="#C9A366" />
            <Stop offset="0.8" stopColor="#A9824B" />
            <Stop offset="1" stopColor="#7E5E33" />
          </LinearGradient>
        </Defs>
        <G transform={`translate(${94 - K_W / 2} ${92 - K_H / 2}) scale(${K_W / 260})`}>
          <Path d={K_PATH} fill={Colors.isLight ? '#FFFFFF' : '#04110D'} opacity={Colors.isLight ? 0.5 : 0.55} transform="translate(6 9)" />
          <Path d={K_PATH} fill={Colors.isLight ? '#0E2A24' : `url(#${u}kg)`} />
        </G>
      </Layer>
    </Animated.View>
  );
}

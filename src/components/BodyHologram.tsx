// La figura de «Medidas» (Peso → Medidas y su evolución): una figura de frente como un holograma, de hombre o de
// mujer según el perfil. El fundador, 2026-11-16: «que aparezca una especie de holograma donde indiques tanto las
// medidas de cinta métrica como las de la pinza de grasa. Que al rellenarlas, te haga un zoom en la zona
// correspondiente»; «con zoom en cada una y señalando también muslo y pantorrilla»; y «tampoco pongas la raya
// vertical en medidas como si fuese un scanner... es demasiado friki»: sin barrido ni líneas de escáner, solo la
// figura, las marcas y el zoom. La cifra del sitio elegido va debajo de la figura, fuera del dibujo (fundador,
// 2026-11-16: «cuando hablamos de silueta, me gusta que esté fuera del cuerpo, que si no se tapa»): antes iba
// escrita junto a la marca y tapaba el cuerpo.
// El dibujo del cuerpo va aparte (BodyFigureArt, las figuras del fundador) y encima, en un SVG con su mismo
// tamaño, las marcas de cada sitio en sus coordenadas (FIGURES en src/logic/bodyFigure.ts): la cinta, una vuelta
// alrededor del cuerpo (la mitad de delante continua y la de detrás discontinua); la pinza, dos trazos cortos en
// la dirección del pliegue (discontinuos si se toma por detrás).
// Al elegir un sitio, la figura se acerca a su zona con un Animated de transform (escala alrededor del centro y
// desplazamiento, ver focusTransform en src/logic/bodyMeasures.ts), igual en la web que en el móvil.
// Los pliegues que se toman por detrás (tríceps y subescapular) van en la figura de espaldas: al elegirlos, la
// figura se da la vuelta (media vuelta sobre su eje, se cambia la imagen y termina de girar) y al elegir otro sitio
// vuelve a ponerse de frente (fundador, 2026-11-16: «para la pinza de tríceps y espalda, dale la vuelta»). Con
// «reducir movimiento», el cambio es directo.
import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, PixelRatio, Platform, Pressable, StyleSheet, Text, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, G, Line, Path } from 'react-native-svg';
import { focusTransform, sitesOf, type FoldMark, type MeasureTool, type TapeMark } from '@/logic/bodyMeasures';
import { FIGURES, isTapeMark, sideOf, zoneOf, zoomCap, type FigureSex, type FigureSide } from '@/logic/bodyFigure';
import { BodyFigureArt } from '@/components/BodyFigureArt';
import { FINE, ff } from '@/theme/fine';

const JADE = FINE.jade;
const BRIGHT = '#C9F5E2'; // lo elegido, casi blanco con un punto de jade
const NATIVE = Platform.OS !== 'web';

type State = 'focus' | 'filled' | 'empty';

// Las formas se pensaron para un lienzo de 200 de ancho; `u` las escala al de la figura (420 → ×2,1)
function TapeMarkShape({ m, state, u }: { m: TapeMark; state: State; u: number }) {
  const rx = m.half + 1.5 * u;
  const ry = Math.max(1.6 * u, m.half * 0.2);
  const front = `M${m.x - rx} ${m.y} A${rx} ${ry} 0 0 0 ${m.x + rx} ${m.y}`;
  const back = `M${m.x - rx} ${m.y} A${rx} ${ry} 0 0 1 ${m.x + rx} ${m.y}`;
  const c = state === 'focus' ? BRIGHT : JADE;
  const op = state === 'empty' ? 0.5 : 1;
  return (
    <G opacity={op}>
      {state === 'focus' && <Path d={front} stroke={JADE} strokeOpacity={0.3} strokeWidth={4 * u} fill="none" strokeLinecap="round" />}
      <Path d={back} stroke={c} strokeOpacity={0.5} strokeWidth={0.7 * u} strokeDasharray={`${1.6 * u} ${1.4 * u}`} fill="none" />
      <Path
        d={front}
        stroke={c}
        strokeWidth={(state === 'focus' ? 1.3 : 0.9) * u}
        fill="none"
        strokeLinecap="round"
        strokeDasharray={state === 'empty' ? `${2.2 * u} ${1.6 * u}` : undefined}
      />
    </G>
  );
}

function FoldMarkShape({ m, state, u }: { m: FoldMark; state: State; u: number }) {
  const a = (m.angle * Math.PI) / 180;
  const [dx, dy] = [Math.cos(a) * 3.6 * u, Math.sin(a) * 3.6 * u]; // medio trazo, en la dirección del pliegue
  const [ox, oy] = [-Math.sin(a) * 1.7 * u, Math.cos(a) * 1.7 * u]; // separación entre las dos «mordazas»
  const c = state === 'focus' ? BRIGHT : JADE;
  const op = state === 'empty' ? 0.55 : 1;
  const jaw = (s: number) => (
    <Line
      x1={m.x - dx + s * ox}
      y1={m.y - dy + s * oy}
      x2={m.x + dx + s * ox}
      y2={m.y + dy + s * oy}
      stroke={c}
      strokeWidth={(state === 'focus' ? 1.1 : 0.9) * u}
      strokeLinecap="round"
    />
  );
  return (
    <G opacity={op}>
      {state === 'focus' && (
        <>
          <Circle cx={m.x} cy={m.y} r={6.5 * u} fill={JADE} fillOpacity={0.12} />
          <Circle cx={m.x} cy={m.y} r={6.5 * u} stroke={JADE} strokeOpacity={0.45} strokeWidth={0.5 * u} fill="none" />
        </>
      )}
      {jaw(1)}
      {jaw(-1)}
      <Circle cx={m.x} cy={m.y} r={(state === 'filled' ? 1 : 0.7) * u} fill={c} />
    </G>
  );
}

export function BodyHologram({
  sex = 'male',
  tool,
  focus,
  filled,
  focusLabel,
  onPick,
  style,
}: {
  sex?: FigureSex; // sin él, la de hombre
  tool: MeasureTool;
  focus: string | null; // kind del sitio elegido
  filled: Record<string, boolean>; // kinds con valor
  focusLabel?: string; // la cifra del elegido («84,5 cm»), debajo de la figura; nunca su cambio (fundador, 2026-11-17)
  onPick?: (kind: string) => void; // tocar una marca
  style?: StyleProp<ViewStyle>;
}) {
  const fig = FIGURES[sex];
  const u = fig.w / 200;
  const [box, setBox] = useState({ w: 0, h: 0 });
  const scale = useRef(new Animated.Value(1)).current;
  const tx = useRef(new Animated.Value(0)).current;
  const ty = useRef(new Animated.Value(0)).current;
  const [still, setStill] = useState(false); // «reducir movimiento»: el zoom sin animar

  const sites = sitesOf(tool);
  const picked = sites.some((s) => s.kind === focus) ? focus : null;
  const zone = picked ? zoneOf(fig, picked) : null;

  // De frente o de espaldas: el lado del sitio elegido. `shown` es el que se ve ahora (cambia a mitad del giro)
  const side: FigureSide = sideOf(picked);
  const [shown, setShown] = useState<FigureSide>(side);
  const turn = useRef(new Animated.Value(0)).current; // −1…1 = −90°…90° de giro
  // Sin `stop()` al limpiar: en Animated, parar una animación ya terminada para la que esté corriendo en ese mismo
  // valor (la segunda mitad del giro) y la figura se quedaba de canto, invisible
  useEffect(() => {
    if (side === shown) {
      // Ya en su lado: termina de girar hasta quedar de cara (también si un giro se quedó a medias)
      if (still) turn.setValue(0);
      else Animated.timing(turn, { toValue: 0, duration: 230, easing: Easing.out(Easing.quad), useNativeDriver: NATIVE }).start();
      return;
    }
    if (still) {
      setShown(side);
      return;
    }
    let alive = true;
    // Primera mitad: hasta quedar de canto; ahí se cambia la imagen y entra por el otro lado
    Animated.timing(turn, { toValue: 1, duration: 190, easing: Easing.in(Easing.quad), useNativeDriver: NATIVE }).start(({ finished }) => {
      if (!finished || !alive) return;
      turn.setValue(-1);
      setShown(side);
    });
    return () => {
      alive = false;
    };
  }, [side, shown, still, turn]);
  const rotateY = turn.interpolate({ inputRange: [-1, 0, 1], outputRange: ['-90deg', '0deg', '90deg'] });
  const onSide = (kind: string) => sideOf(kind) === shown;

  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => alive && setStill(v))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  // La escala de la figura entera en la caja (ajustada y centrada, como la imagen y el viewBox del SVG) y dónde queda
  const s0 = box.w ? Math.min(box.w / fig.w, box.h / fig.h) : 1;
  const offX = (box.w - fig.w * s0) / 2;
  const offY = (box.h - fig.h * s0) / 2;

  // Acercarse a la zona del sitio elegido (o volver a la figura entera), sin pasar del zoom en que la imagen se
  // vería borrosa
  const zx = zone?.x;
  const zy = zone?.y;
  const zz = zone ? Math.min(zone.zoom, zoomCap(s0, PixelRatio.get())) : undefined;
  useEffect(() => {
    if (!box.w) return;
    const to = focusTransform(zx != null && zy != null && zz != null ? { x: zx, y: zy, zoom: zz } : null, box, fig);
    if (still) {
      scale.setValue(to.scale);
      tx.setValue(to.x);
      ty.setValue(to.y);
      return;
    }
    const anim = (v: Animated.Value, value: number) =>
      Animated.timing(v, { toValue: value, duration: 560, easing: Easing.out(Easing.cubic), useNativeDriver: NATIVE });
    const a = Animated.parallel([anim(scale, to.scale), anim(tx, to.x), anim(ty, to.y)]);
    a.start();
    return () => a.stop();
  }, [zx, zy, zz, box, fig, still, scale, tx, ty]);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (Math.abs(width - box.w) > 0.5 || Math.abs(height - box.h) > 0.5) setBox({ w: width, h: height });
  };

  return (
    <View style={style} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={styles.box} onLayout={onLayout}>
        {box.w > 0 && (
          // Desplazar fuera y escalar dentro: así el orden de las transformaciones no depende de la plataforma
          <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ translateX: tx }, { translateY: ty }] }]}>
            <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ scale }] }]}>
              <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ perspective: 900 }, { rotateY }] }]}>
                <BodyFigureArt sex={sex} side={shown} />
                <Svg width={box.w} height={box.h} viewBox={`0 0 ${fig.w} ${fig.h}`} style={StyleSheet.absoluteFill}>
                  {/* Las marcas del modo elegido (cinta o pinza); la elegida, encima y más viva */}
                  {sites
                    .filter((s) => onSide(s.kind))
                    .sort((a, b) => (a.kind === focus ? 1 : 0) - (b.kind === focus ? 1 : 0))
                    .map((s) => {
                      const m = fig.marks[s.kind];
                      if (!m) return null;
                      const state: State = s.kind === focus ? 'focus' : filled[s.kind] ? 'filled' : 'empty';
                      return isTapeMark(m) ? <TapeMarkShape key={s.kind} m={m} state={state} u={u} /> : <FoldMarkShape key={s.kind} m={m} state={state} u={u} />;
                    })}
                </Svg>

                {/* Tocar una marca: zonas transparentes encima, en vez de onPress en el SVG (en la web no llega y llena
                    la consola de avisos). Van dentro de la vista que se escala, así que crecen con el zoom */}
                {onPick &&
                  sites.map((s) => {
                    const m = onSide(s.kind) ? fig.marks[s.kind] : undefined;
                    if (!m) return null;
                    const r = Math.max(10, 9 * u * s0);
                    return (
                      <Pressable
                        key={s.kind}
                        onPress={() => onPick(s.kind)}
                        style={[styles.hit, { left: offX + m.x * s0 - r, top: offY + m.y * s0 - r, width: 2 * r, height: 2 * r, borderRadius: r }]}
                      />
                    );
                  })}
              </Animated.View>
            </Animated.View>
          </Animated.View>
        )}
      </View>
      {/* La cifra del sitio elegido, fuera del dibujo: siempre con su hueco, para que la figura no cambie de tamaño */}
      <Text style={styles.readout} numberOfLines={1}>
        {picked && focusLabel ? focusLabel : ' '}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flex: 1, overflow: 'hidden' },
  readout: { ...ff('regular'), height: 26, lineHeight: 26, textAlign: 'center', color: FINE.ivory, fontSize: 14.5, fontVariant: ['tabular-nums'] },
  hit: { position: 'absolute' },
});

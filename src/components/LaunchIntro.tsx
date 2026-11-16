import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  type SharedValue,
  Easing,
  interpolate,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import Svg, { ClipPath, Defs, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { scheduleOnRN } from 'react-native-worklets';

import { KuovaWordmark } from '@/components/KuovaLogo';

// Entrada de la app (2026-11-09): justo después de la pantalla de carga nativa (fondo verde y la K,
// app.json → expo-splash-screen), la K dorada con brillo de la imagen de marca y «KUOVA HEALTH» debajo.
// Solo en el móvil y al abrir la app en frío (index.js); dura ~1,5 s, se salta con un toque y, con
// «reducir movimiento», no se mueve. Es JavaScript: llega por OTA (la pantalla nativa, no).

export const LAUNCH_BG = '#0E2A24'; // = backgroundColor del splash nativo
export const K_PATH = 'M0 0H38V127L197 0H260L103.67 115.49L250 257H194L72.58 138.45L38 164V202C37 230 20 250 0 257Z';
const K_W = 88; // = imageWidth del splash nativo: la K empieza donde estaba
const K_H = (K_W * 257) / 260;
const GAP_K = 30;
const WORD_H = 21;
const GAP_WORD = 12;
const HEALTH_H = 14;
// La K se queda quieta en el centro, donde estaba la nativa, y el nombre aparece debajo (2026-11-10: Astor
// vio raro que la K subiera para dejarle sitio)

const AnimatedRect = Animated.createAnimatedComponent(Rect);

export function GoldK({ width = K_W, shine }: { width?: number; shine?: SharedValue<number> }) {
  const shineProps = useAnimatedProps(() => ({ x: interpolate(shine?.value ?? 0, [0, 1], [-190, 330]) }));
  return (
    <Svg width={width} height={(width * 257) / 260} viewBox="0 0 260 257">
      <Defs>
        {/* Oro metalizado: champán arriba a la izquierda, bronce abajo a la derecha */}
        <LinearGradient id="launchKGold" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#F6E6C3" />
          <Stop offset="0.32" stopColor="#DDBD86" />
          <Stop offset="0.58" stopColor="#C9A366" />
          <Stop offset="0.8" stopColor="#A9824B" />
          <Stop offset="1" stopColor="#7E5E33" />
        </LinearGradient>
        <LinearGradient id="launchKShine" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0" />
          <Stop offset="0.5" stopColor="#FFF8E8" stopOpacity="0.75" />
          <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
        </LinearGradient>
        <ClipPath id="launchKClip">
          <Path d={K_PATH} />
        </ClipPath>
      </Defs>
      <Path d={K_PATH} fill="url(#launchKGold)" />
      {shine ? (
        <G clipPath="url(#launchKClip)">
          <G transform="rotate(22 130 128)">
            <AnimatedRect animatedProps={shineProps} y={-120} width={90} height={500} fill="url(#launchKShine)" />
          </G>
        </G>
      ) : null}
    </Svg>
  );
}

export function LaunchIntro() {
  const reduceMotion = useReducedMotion();
  const [gone, setGone] = useState(false);
  const reveal = useSharedValue(reduceMotion ? 1 : 0);
  const shine = useSharedValue(0);
  const fade = useSharedValue(1);

  const finish = () => setGone(true);
  const close = (delay: number, duration: number) => {
    fade.value = withDelay(delay, withTiming(0, { duration }, (done) => done && scheduleOnRN(finish)));
  };

  useEffect(() => {
    if (reduceMotion) {
      close(700, 250);
      return;
    }
    reveal.value = withTiming(1, { duration: 560, easing: Easing.out(Easing.cubic) });
    shine.value = withDelay(280, withTiming(1, { duration: 780, easing: Easing.inOut(Easing.quad) }));
    close(1150, 340);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const overlay = useAnimatedStyle(() => ({ opacity: fade.value }));
  const name = useAnimatedStyle(() => ({
    opacity: interpolate(reveal.value, [0.25, 1], [0, 1], 'clamp'),
    transform: [{ translateY: interpolate(reveal.value, [0.25, 1], [8, 0], 'clamp') }],
  }));

  if (gone) return null;
  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.overlay, overlay]}>
      <Pressable
        style={styles.center}
        onPress={() => close(0, 160)}
        accessibilityRole="image"
        accessibilityLabel="Kuova Health">
        <View style={styles.kBox}>
          <GoldK shine={shine} />
          <Animated.View style={[styles.name, name]}>
            <KuovaWordmark height={WORD_H} color="#F4EFE3" />
            <View style={{ height: GAP_WORD }} />
            <Text style={styles.health} allowFontScaling={false}>
              HEALTH
            </Text>
          </Animated.View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: { backgroundColor: LAUNCH_BG, zIndex: 1000, elevation: 1000 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  // Solo la K cuenta para centrar; el nombre cuelga debajo sin moverla
  kBox: { width: K_W, height: K_H },
  name: { position: 'absolute', top: K_H + GAP_K, left: -160, right: -160, alignItems: 'center' },
  health: {
    color: '#C9A366',
    fontSize: 11,
    lineHeight: HEALTH_H,
    fontWeight: '500',
    letterSpacing: 7,
    // el espaciado se añade también tras la última letra: se compensa para que quede centrado
    marginRight: -7,
  },
});

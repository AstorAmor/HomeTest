import React, { useEffect, useMemo } from 'react';
import { Animated, Easing, Platform, StyleSheet, useWindowDimensions, View } from 'react-native';

// Lluvia de confeti para celebrar una insignia. Solo Animated (sin librerías nativas), así que
// llega con una actualización normal de la app. `burst` cambia → vuelve a caer.
const PIECES = 46;
const useNative = Platform.OS !== 'web';

export const Confetti = ({ colors, burst }: { colors: string[]; burst: number }) => {
  const { width, height } = useWindowDimensions();
  const pieces = useMemo(
    () =>
      Array.from({ length: PIECES }, (_, i) => ({
        x: Math.random() * width,
        drift: (Math.random() - 0.5) * 160,
        size: 6 + Math.random() * 8,
        round: Math.random() < 0.3,
        color: colors[i % colors.length],
        delay: Math.random() * 500,
        duration: 2200 + Math.random() * 1600,
        spin: (Math.random() < 0.5 ? -1 : 1) * (360 + Math.random() * 540),
        v: new Animated.Value(0),
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [burst, width, colors.join()],
  );
  useEffect(() => {
    const anims = pieces.map((p) =>
      Animated.timing(p.v, {
        toValue: 1,
        duration: p.duration,
        delay: p.delay,
        easing: Easing.out(Easing.quad),
        useNativeDriver: useNative,
      }),
    );
    Animated.parallel(anims).start();
    return () => anims.forEach((a) => a.stop());
  }, [pieces]);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {pieces.map((p, i) => {
        const v = p.v;
        return (
          <Animated.View
            key={`${burst}-${i}`}
            style={{
              position: 'absolute',
              left: p.x,
              top: -20,
              width: p.size,
              height: p.round ? p.size : p.size * 0.45,
              borderRadius: p.round ? p.size / 2 : 1,
              backgroundColor: p.color,
              opacity: v.interpolate({ inputRange: [0, 0.8, 1], outputRange: [1, 1, 0] }),
              transform: [
                { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, height + 40] }) },
                { translateX: v.interpolate({ inputRange: [0, 1], outputRange: [0, p.drift] }) },
                { rotate: v.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${p.spin}deg`] }) },
              ],
            }}
          />
        );
      })}
    </View>
  );
};

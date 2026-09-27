import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Colors } from '@/constants/colors';

const COLORS = [Colors.accent, Colors.violet, Colors.pinkSoft, Colors.amber, Colors.sky, Colors.coral];
const useNative = Platform.OS !== 'web';

interface ConfettiProps {
  count?: number;
  duration?: number;
}

// Lluvia de confeti de una sola vez (sin dependencias externas). Se monta encima
// de la pantalla con pointerEvents="none" para no bloquear toques.
export const Confetti = ({ count = 70, duration = 2600 }: ConfettiProps) => {
  const { width, height } = useWindowDimensions();
  const progress = useRef(new Animated.Value(0)).current;

  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        left: Math.random() * width,
        drift: (Math.random() - 0.5) * 160,
        delay: Math.random() * 0.35,
        size: 6 + Math.random() * 7,
        round: i % 3 === 0,
        color: COLORS[i % COLORS.length],
        spins: 2 + Math.random() * 4,
      })),
    [count, width]
  );

  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration,
      easing: Easing.out(Easing.quad),
      useNativeDriver: useNative,
    }).start();
  }, [progress, duration]);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {pieces.map((p, i) => {
        const local = progress.interpolate({
          inputRange: [0, p.delay, 1],
          outputRange: [0, 0, 1],
        });
        return (
          <Animated.View
            key={i}
            style={{
              position: 'absolute',
              top: -20,
              left: p.left,
              width: p.size,
              height: p.round ? p.size : p.size * 1.6,
              borderRadius: p.round ? p.size / 2 : 2,
              backgroundColor: p.color,
              opacity: local.interpolate({ inputRange: [0, 0.8, 1], outputRange: [1, 1, 0] }),
              transform: [
                { translateY: local.interpolate({ inputRange: [0, 1], outputRange: [0, height + 40] }) },
                { translateX: local.interpolate({ inputRange: [0, 1], outputRange: [0, p.drift] }) },
                {
                  rotate: local.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0deg', `${p.spins * 360}deg`],
                  }),
                },
              ],
            }}
          />
        );
      })}
    </View>
  );
};

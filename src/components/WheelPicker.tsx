import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  NativeSyntheticEvent,
  NativeScrollEvent,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { Colors } from '@/constants/colors';

interface WheelPickerProps {
  items: string[];
  selectedIndex: number;
  onChange: (index: number) => void;
  width?: number;
  itemHeight?: number;
  // Filas a la vista: 5 (lo de siempre) o 3, más baja (metas, fundador 2026-11-05)
  visible?: 3 | 5;
}

// Selector tipo "rueda de candado": se gira arriba/abajo y encaja en el valor
// central. Funciona en nativo y en web (en web no hay onMomentumScrollEnd, así
// que el encaje se hace con un temporizador cuando el scroll se detiene).
// Solo los números (fundador, 2026-11-16: «sin un bloque oscuro… un bloque dentro de otro bloque; que los
// números se muevan de arriba abajo sin tanto alrededor»): sin rayas de selección ni velos de color encima
// (con el fondo degradado se veían como un rectángulo); el del centro, grande y entero, y los demás se
// apagan y encogen al alejarse.
export const WheelPicker = ({
  items,
  selectedIndex,
  onChange,
  width = 90,
  itemHeight = 40,
  visible = 5,
}: WheelPickerProps) => {
  const scrollRef = useRef<ScrollView>(null);
  const [visualIndex, setVisualIndex] = useState(selectedIndex);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const height = itemHeight * visible;
  const pad = (visible - 1) / 2;
  // Cuánto se apaga cada fila según lo lejos que está del centro
  const fadeAt = (abs: number) => (abs === 0 ? 1 : abs === 1 ? (visible === 3 ? 0.38 : 0.45) : 0.16);

  useEffect(() => {
    // Posición inicial sin animación
    const t = setTimeout(() => {
      scrollRef.current?.scrollTo({ y: selectedIndex * itemHeight, animated: false });
    }, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const settle = (y: number) => {
    const index = Math.max(0, Math.min(items.length - 1, Math.round(y / itemHeight)));
    if (Math.abs(y - index * itemHeight) > 1) {
      scrollRef.current?.scrollTo({ y: index * itemHeight, animated: true });
    }
    if (index !== selectedIndex) onChange(index);
  };

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    setVisualIndex(Math.max(0, Math.min(items.length - 1, Math.round(y / itemHeight))));
    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => settle(y), Platform.OS === 'web' ? 140 : 220);
  };

  const selectByTap = (index: number) => {
    scrollRef.current?.scrollTo({ y: index * itemHeight, animated: true });
  };

  return (
    <View style={{ width, height }}>
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        snapToInterval={Platform.OS === 'web' ? undefined : itemHeight}
        decelerationRate="fast"
        onScroll={handleScroll}
        scrollEventThrottle={16}
        nestedScrollEnabled
        contentContainerStyle={{ paddingVertical: itemHeight * pad }}
      >
        {items.map((label, i) => {
          const distance = i - visualIndex;
          const abs = Math.abs(distance);
          return (
            <TouchableOpacity
              key={`${label}-${i}`}
              activeOpacity={0.7}
              onPress={() => selectByTap(i)}
              style={[
                styles.item,
                {
                  height: itemHeight,
                  opacity: fadeAt(abs),
                  transform: [
                    { perspective: 400 },
                    { rotateX: `${Math.max(-60, Math.min(60, distance * 22))}deg` },
                    { scale: abs === 0 ? 1 : abs === 1 ? 0.92 : 0.84 },
                  ],
                },
              ]}
            >
              <Text style={[styles.itemText, abs === 0 && styles.itemTextSelected]}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  item: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemText: {
    color: Colors.textSecondary,
    fontSize: 17,
    fontWeight: '500',
  },
  itemTextSelected: {
    color: Colors.textPrimary,
    fontSize: 22,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
});

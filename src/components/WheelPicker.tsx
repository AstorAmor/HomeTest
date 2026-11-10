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
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { Colors, withAlpha } from '@/constants/colors';

interface WheelPickerProps {
  items: string[];
  selectedIndex: number;
  onChange: (index: number) => void;
  width?: number;
  itemHeight?: number;
  // Filas a la vista: 5 (lo de siempre) o 3, más baja (metas, fundador 2026-11-05)
  visible?: 3 | 5;
  // Color del fondo sobre el que va (los degradados de arriba y abajo se funden con él)
  fadeColor?: string;
}

// Selector tipo "rueda de candado": se gira arriba/abajo y encaja en el valor
// central. Funciona en nativo y en web (en web no hay onMomentumScrollEnd, así
// que el encaje se hace con un temporizador cuando el scroll se detiene).
export const WheelPicker = ({
  items,
  selectedIndex,
  onChange,
  width = 90,
  itemHeight = 40,
  visible = 5,
  fadeColor = Colors.background,
}: WheelPickerProps) => {
  const scrollRef = useRef<ScrollView>(null);
  const [visualIndex, setVisualIndex] = useState(selectedIndex);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const height = itemHeight * visible;
  const pad = (visible - 1) / 2;
  const fade = itemHeight * (visible === 3 ? 0.8 : 1.5);
  // En la web los id de los degradados son de toda la página: uno por color de fondo
  const fid = fadeColor.replace(/[^a-zA-Z0-9]/g, '');

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
      <View
        pointerEvents="none"
        style={[styles.highlight, { top: itemHeight * pad, height: itemHeight }]}
      />
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
                  opacity: abs === 0 ? 1 : abs === 1 ? 0.55 : 0.25,
                  transform: [
                    { perspective: 400 },
                    { rotateX: `${Math.max(-60, Math.min(60, distance * 22))}deg` },
                  ],
                },
              ]}
            >
              <Text style={[styles.itemText, abs === 0 && styles.itemTextSelected]}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      <Svg pointerEvents="none" width={width} height={height} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id={`wheelFadeTop${fid}`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={fadeColor} stopOpacity="1" />
            <Stop offset="1" stopColor={fadeColor} stopOpacity="0" />
          </LinearGradient>
          <LinearGradient id={`wheelFadeBottom${fid}`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={fadeColor} stopOpacity="0" />
            <Stop offset="1" stopColor={fadeColor} stopOpacity="1" />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width={width} height={fade} fill={`url(#wheelFadeTop${fid})`} />
        <Rect
          x={0}
          y={height - fade}
          width={width}
          height={fade}
          fill={`url(#wheelFadeBottom${fid})`}
        />
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  // La selección se marca con dos rayas horizontales (arriba y abajo), sin recuadro
  highlight: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderTopWidth: 1.5,
    borderBottomWidth: 1.5,
    borderColor: withAlpha(Colors.accent, 0.7),
  },
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
    fontSize: 20,
    fontWeight: '700',
  },
});

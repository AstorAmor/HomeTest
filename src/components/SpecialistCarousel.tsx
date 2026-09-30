import React, { useRef } from 'react';
import { Animated, Platform, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { Image } from 'expo-image';
import { Colors } from '@/constants/colors';
import { SPECIALISTS, SpecialistCard } from '@/data/planImages';

const CARD = 168; // tamaño de la foto central
const GAP = 12;
const useNative = Platform.OS !== 'web';

// Carrusel horizontal: la tarjeta centrada se ve grande y nítida; las de los lados
// se encogen, se atenúan y se difuminan según se alejan del centro.
// `items` permite reutilizarlo (p. ej. "Keep learning" en Today); por defecto, especialistas.
export const SpecialistCarousel = <T extends SpecialistCard>({ onSelect, items }: { onSelect: (s: T) => void; items?: T[] }) => {
  const { width } = useWindowDimensions();
  const scrollX = useRef(new Animated.Value(0)).current;
  const step = CARD + GAP;
  const sidePadding = (width - CARD) / 2;

  return (
    <Animated.ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      snapToInterval={step}
      decelerationRate="fast"
      contentContainerStyle={{ paddingHorizontal: sidePadding, gap: GAP }}
      onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], { useNativeDriver: useNative })}
      scrollEventThrottle={16}
    >
      {(items ?? (SPECIALISTS as T[])).map((s, i) => {
        const inputRange = [(i - 2) * step, (i - 1) * step, i * step, (i + 1) * step, (i + 2) * step];
        const scale = scrollX.interpolate({ inputRange, outputRange: [0.62, 0.78, 1, 0.78, 0.62], extrapolate: 'clamp' });
        const opacity = scrollX.interpolate({ inputRange, outputRange: [0.25, 0.55, 1, 0.55, 0.25], extrapolate: 'clamp' });
        // Capa desenfocada encima que aparece al alejarse del centro
        const blurOpacity = scrollX.interpolate({ inputRange, outputRange: [1, 0.85, 0, 0.85, 1], extrapolate: 'clamp' });
        return (
          <Animated.View key={s.id} style={{ width: CARD, transform: [{ scale }], opacity }}>
            <TouchableOpacity activeOpacity={0.9} onPress={() => onSelect(s)}>
              <View style={styles.photoWrap}>
                <Image source={s.image} style={styles.photo} contentFit="cover" />
                <Animated.View style={[StyleSheet.absoluteFill, { opacity: blurOpacity }]}>
                  <Image source={s.image} style={styles.photo} contentFit="cover" blurRadius={8} />
                </Animated.View>
              </View>
              <Text style={styles.label} numberOfLines={1}>
                {s.label}
              </Text>
              <Text style={styles.subtitle} numberOfLines={1}>
                {s.subtitle}
              </Text>
            </TouchableOpacity>
          </Animated.View>
        );
      })}
    </Animated.ScrollView>
  );
};

const styles = StyleSheet.create({
  photoWrap: { width: CARD, height: CARD, borderRadius: 20, overflow: 'hidden', backgroundColor: Colors.card },
  photo: { width: CARD, height: CARD },
  label: { color: Colors.textPrimary, fontSize: 15, fontWeight: '700', textAlign: 'center', marginTop: 10 },
  subtitle: { color: Colors.textSecondary, fontSize: 12, textAlign: 'center', marginTop: 2 },
});

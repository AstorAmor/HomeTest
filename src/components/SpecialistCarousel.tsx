import React, { useEffect, useRef, useState } from 'react';
import { Animated, LayoutChangeEvent, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { Image } from 'expo-image';
import { Colors } from '@/constants/colors';
import { SPECIALISTS, SpecialistCard } from '@/data/planImages';
import { BlobArt } from './BlobArt';
import { useWebShell } from '@/web/webMode';

const CARD = 168; // tamaño de la foto central
const GAP = 12;
const useNative = Platform.OS !== 'web';

// Carrusel horizontal: la tarjeta centrada se ve grande y nítida; las de los lados
// se encogen, se atenúan y se difuminan según se alejan del centro.
// `items` permite reutilizarlo (p. ej. "Keep learning" en Today); por defecto, especialistas.
// Las tarjetas con `icon` se pintan con la ilustración (BlobArt) en lugar de la foto. `more` añade
// al final una tarjeta "More" (p. ej. todos los temas en cuadrícula).
// `loop`: carrusel infinito (al llegar al final sigue el primero, y a la izquierda nunca queda un
// hueco vacío). Solo si caben menos tarjetas que las que hay: así nunca se ve la misma dos veces a la
// vez. En una pantalla tan ancha que eso no se cumple, tampoco quedan huecos: si caben todas, van en
// una fila centrada; si no, en una fila normal que empieza en el borde izquierdo.
export const SpecialistCarousel = <T extends SpecialistCard>({
  onSelect,
  items,
  more,
  loop,
}: {
  onSelect: (s: T) => void;
  items?: T[];
  more?: { label: string; subtitle: string; onPress: () => void };
  loop?: boolean;
}) => {
  const { width } = useWindowDimensions();
  const scrollX = useRef(new Animated.Value(0)).current;
  const scrollRef = useRef<any>(null);
  const settle = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [boxWidth, setBoxWidth] = useState(0);
  const step = CARD + GAP;

  const base = [
    ...(items ?? (SPECIALISTS as T[])),
    ...(more ? [{ id: '__more', label: more.label, subtitle: more.subtitle, icon: 'view-grid-outline', palette: ['#2A2A2A', '#4A4A44', '#C9A36B'] } as unknown as T] : []),
  ];
  const n = base.length;
  // Hasta medirlo, el ancho se estima (la columna de la web de escritorio o la pantalla entera) para
  // no pintar nunca en blanco ni enseñar un instante el hueco de la izquierda
  const shell = useWebShell();
  const box = boxWidth || (shell ? Math.min(760, width - 280) : width);
  const looping = !!loop && box < (n - 1) * step;
  const flat = !!loop && box >= (n - 1) * step; // pantalla muy ancha: fila sin huecos
  const list = looping ? [...base, ...base, ...base] : base;

  // Margen para que la primera tarjeta quede centrada. En la web, relativo al ancho del propio
  // carrusel (en escritorio la pantalla va en una columna centrada: con el ancho de la ventana
  // quedaba desplazado a la derecha); en el móvil, el carrusel ocupa todo el ancho.
  const sidePadding: any = Platform.OS === 'web' ? `calc(50% - ${CARD / 2}px)` : (width - CARD) / 2;

  // En bucle se empieza en la copia del medio, con la primera tarjeta centrada
  useEffect(() => {
    if (!looping) return;
    const id = setTimeout(() => scrollRef.current?.scrollTo?.({ x: n * step, animated: false }), 0);
    return () => clearTimeout(id);
  }, [looping, n, step]);

  // Al pararse, si se ha salido de la copia del medio, salta sin animación a la misma tarjeta allí
  const recenter = (x: number) => {
    if (!looping) return;
    const i = Math.round(x / step);
    if (i < n) scrollRef.current?.scrollTo?.({ x: x + n * step, animated: false });
    else if (i >= 2 * n) scrollRef.current?.scrollTo?.({ x: x - n * step, animated: false });
  };

  const press = (s: T) => (s.id === '__more' && more ? more.onPress() : onSelect(s));
  const card = (s: T) => (
    <TouchableOpacity activeOpacity={0.9} onPress={() => press(s)}>
      {s.icon && s.palette ? (
        <BlobArt seed={s.id} palette={s.palette} icon={s.icon} size={CARD} />
      ) : (
        <View style={styles.photoWrap}>
          <Image source={s.image} style={styles.photo} contentFit="cover" />
        </View>
      )}
      <Text style={styles.label} numberOfLines={1}>
        {s.label}
      </Text>
      <Text style={styles.subtitle} numberOfLines={1}>
        {s.subtitle}
      </Text>
    </TouchableOpacity>
  );

  if (flat) {
    const fitsAll = box >= n * step - GAP;
    return (
      <View onLayout={(e: LayoutChangeEvent) => setBoxWidth(e.nativeEvent.layout.width)}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[styles.flatRow, fitsAll && styles.flatRowCentered]}
        >
          {base.map((s) => (
            <View key={s.id} style={{ width: CARD }}>
              {card(s)}
            </View>
          ))}
        </ScrollView>
      </View>
    );
  }

  return (
    <View onLayout={(e: LayoutChangeEvent) => setBoxWidth(e.nativeEvent.layout.width)}>
      <Animated.ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={step}
        decelerationRate="fast"
        contentContainerStyle={{ paddingHorizontal: sidePadding, gap: GAP }}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], {
          useNativeDriver: useNative,
          listener: (e: any) => {
            const x = e.nativeEvent.contentOffset.x;
            if (settle.current) clearTimeout(settle.current);
            settle.current = setTimeout(() => recenter(x), 180);
          },
        })}
        scrollEventThrottle={16}
      >
        {list.map((s, i) => {
          const inputRange = [(i - 2) * step, (i - 1) * step, i * step, (i + 1) * step, (i + 2) * step];
          const scale = scrollX.interpolate({ inputRange, outputRange: [0.62, 0.78, 1, 0.78, 0.62], extrapolate: 'clamp' });
          const opacity = scrollX.interpolate({ inputRange, outputRange: [0.25, 0.55, 1, 0.55, 0.25], extrapolate: 'clamp' });
          // Capa desenfocada encima que aparece al alejarse del centro
          const blurOpacity = scrollX.interpolate({ inputRange, outputRange: [1, 0.85, 0, 0.85, 1], extrapolate: 'clamp' });
          return (
            <Animated.View key={`${s.id}-${Math.floor(i / n)}`} style={{ width: CARD, transform: [{ scale }], opacity }}>
              <TouchableOpacity activeOpacity={0.9} onPress={() => (s.id === '__more' && more ? more.onPress() : onSelect(s))}>
                {s.icon && s.palette ? (
                  <BlobArt seed={s.id} palette={s.palette} icon={s.icon} size={CARD} />
                ) : (
                  <View style={styles.photoWrap}>
                    <Image source={s.image} style={styles.photo} contentFit="cover" />
                    <Animated.View style={[StyleSheet.absoluteFill, { opacity: blurOpacity }]}>
                      <Image source={s.image} style={styles.photo} contentFit="cover" blurRadius={8} />
                    </Animated.View>
                  </View>
                )}
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
    </View>
  );
};

const styles = StyleSheet.create({
  photoWrap: { width: CARD, height: CARD, borderRadius: 20, overflow: 'hidden', backgroundColor: Colors.card },
  photo: { width: CARD, height: CARD },
  label: { color: Colors.textPrimary, fontSize: 15, fontWeight: '700', textAlign: 'center', marginTop: 10 },
  subtitle: { color: Colors.textSecondary, fontSize: 12, textAlign: 'center', marginTop: 2 },
  flatRow: { gap: GAP, paddingHorizontal: 20 },
  flatRowCentered: { flexGrow: 1, justifyContent: 'center' },
});

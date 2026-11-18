import React, { useEffect, useRef, useState } from 'react';
import { Animated, LayoutChangeEvent, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { Image } from 'expo-image';
import { SPECIALISTS, SpecialistCard } from '@/data/planImages';
import { GRID_EMBLEM_PATH, PathEmblem, roleEmblemPath } from '@/components/fine/RoleEmblem';
import { linePath } from '@/components/fine/LineEmblem';
import { useWebShell } from '@/web/webMode';
import { FINE, ff } from '@/theme/fine';
import { holdTabsProps } from '@/constants/tabs';

const CARD = 150; // ancho de la tarjeta central
const TILE = 150; // alto de la tarjeta con dibujo (dentro, el nombre en dos líneas como mucho; sin la descripción debajo,
// fundador 2026-11-16: «no pongas descripción debajo»)
const EMBLEM = 72;
const GAP = 12;
const EDGE_ROOM = 4; // aire arriba y abajo para que no se recorte el reborde
const GOLD_EDGE = 'rgba(216,185,120,0.85)'; // el oro de FINE.gold, algo más suave que el dibujo
const useNative = Platform.OS !== 'web';

// Carrusel horizontal: la tarjeta centrada se ve grande y nítida; las de los lados
// se encogen, se atenúan y se difuminan según se alejan del centro.
// `items` permite reutilizarlo con otras tarjetas; por defecto, los especialistas (Análisis → «Habla con un especialista»).
// Las tarjetas sin foto son de la estética fina (fundador, 2026-11-16: los iconos de los especialistas «se ven muy
// gordos y no alineados con la estética»): una tarjeta casi transparente con una línea fina de borde y, dentro, el
// dibujo a línea en un aro fino (el de su rol, components/fine/RoleEmblem.tsx; si no, el de su `icon`) con el nombre
// y la línea de debajo. Ya no usan las manchas de color con un icono relleno (BlobArt). `more` añade al final una
// tarjeta "More" (p. ej. todos los temas en cuadrícula).
// La tarjeta del centro lleva además el reborde en oro, como su dibujo (fundador, 2026-11-17: «prefiero que se
// ponga dorado el reborde de la tarjeta seleccionada también»): una línea de oro encima del borde fino, que aparece
// al llegar al centro y se va al alejarse. En la fila sin centro de las pantallas muy anchas no hay tarjeta elegida.
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
    ...(more ? [{ id: '__more', label: more.label, subtitle: more.subtitle } as unknown as T] : []),
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

  // El dibujo de la tarjeta: el del rol, la cuadrícula de "More" o el del icono; sin ninguno, la foto
  const drawing = (s: T) => (s.id === '__more' ? GRID_EMBLEM_PATH : s.role ? roleEmblemPath(s.role) : s.icon ? linePath(s.icon) : null);

  // `blur`: en el carrusel, la capa desenfocada de la foto que aparece al alejarse del centro.
  // `gold`: lo que se ve del reborde de oro (1 en el centro, 0 a los lados)
  const card = (s: T, blur?: Animated.AnimatedInterpolation<number>, gold?: Animated.AnimatedInterpolation<number>) => {
    const d = drawing(s);
    return (
      <TouchableOpacity activeOpacity={0.85} onPress={() => press(s)} accessibilityRole="button" accessibilityLabel={`${s.label}. ${s.subtitle}`}>
        {d || !s.image ? (
          <View style={styles.tile}>
            <PathEmblem d={d ?? GRID_EMBLEM_PATH} size={EMBLEM} color={FINE.gold} glow />
            {/* El dibujo, siempre a la misma altura; el texto, centrado en lo que queda debajo */}
            <View style={styles.tileText}>
              <Text style={styles.tileLabel} numberOfLines={2}>
                {s.label}
              </Text>
            </View>
            {gold ? <Animated.View pointerEvents="none" style={[styles.tileGold, { opacity: gold }]} /> : null}
          </View>
        ) : (
          <>
            <View style={styles.photoWrap}>
              <Image source={s.image} style={styles.photo} contentFit="cover" />
              {blur ? (
                <Animated.View style={[StyleSheet.absoluteFill, { opacity: blur }]}>
                  <Image source={s.image} style={styles.photo} contentFit="cover" blurRadius={8} />
                </Animated.View>
              ) : null}
              {gold ? <Animated.View pointerEvents="none" style={[styles.photoGold, { opacity: gold }]} /> : null}
            </View>
            <Text style={styles.label} numberOfLines={1}>
              {s.label}
            </Text>
          </>
        )}
      </TouchableOpacity>
    );
  };

  if (flat) {
    const fitsAll = box >= n * step - GAP;
    return (
      <View onLayout={(e: LayoutChangeEvent) => setBoxWidth(e.nativeEvent.layout.width)}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[styles.flatRow, fitsAll && styles.flatRowCentered]}
          {...holdTabsProps}
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
        // Mientras lo deslizas, las pestañas no se mueven (a veces cambiaba de pantalla, fundador 2026-11-16)
        {...holdTabsProps}
        // Un poco de aire arriba y abajo: la ScrollView recorta lo que sale de ella, y el reborde de oro de la
        // tarjeta del centro se veía cortado por arriba (fundador, 2026-11-17)
        contentContainerStyle={{ paddingHorizontal: sidePadding, paddingVertical: EDGE_ROOM, gap: GAP }}
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
          // Capa desenfocada encima que aparece al alejarse del centro (solo en las fotos)
          const blurOpacity = scrollX.interpolate({ inputRange, outputRange: [1, 0.85, 0, 0.85, 1], extrapolate: 'clamp' });
          // El reborde de oro: solo la tarjeta del centro
          const goldOpacity = scrollX.interpolate({ inputRange, outputRange: [0, 0, 1, 0, 0], extrapolate: 'clamp' });
          return (
            <Animated.View key={`${s.id}-${Math.floor(i / n)}`} style={{ width: CARD, transform: [{ scale }], opacity }}>
              {card(s, blurOpacity, goldOpacity)}
            </Animated.View>
          );
        })}
      </Animated.ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  // Tarjeta casi transparente con una línea fina de borde, como las del prototipo (`.chips button`)
  tile: {
    width: CARD,
    height: TILE,
    borderRadius: 18,
    backgroundColor: FINE.tile,
    borderWidth: 1,
    borderColor: FINE.line,
    alignItems: 'center',
    paddingTop: 14,
    paddingBottom: 10,
    paddingHorizontal: 12,
  },
  // El reborde de oro de la tarjeta del centro: justo encima del borde fino (-1: por fuera del hueco interior)
  tileGold: { position: 'absolute', top: -1, left: -1, right: -1, bottom: -1, borderRadius: 18, borderWidth: 1, borderColor: GOLD_EDGE },
  photoGold: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 18, borderWidth: 1, borderColor: GOLD_EDGE },
  tileText: { flex: 1, alignSelf: 'stretch', justifyContent: 'center' },
  tileLabel: { ...ff('medium'), color: FINE.ivory, fontSize: 14.5, lineHeight: 19, textAlign: 'center' },
  photoWrap: { width: CARD, height: CARD, borderRadius: 18, overflow: 'hidden', backgroundColor: FINE.tile },
  photo: { width: CARD, height: CARD },
  label: { ...ff('medium'), color: FINE.ivory, fontSize: 15, textAlign: 'center', marginTop: 10 },
  flatRow: { gap: GAP, paddingHorizontal: 20, paddingVertical: EDGE_ROOM },
  flatRowCentered: { flexGrow: 1, justifyContent: 'center' },
});

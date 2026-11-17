import React, { useEffect, useRef } from 'react';
import { Animated, Platform, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { exerciseMedia, exerciseName, MEDIA_ASPECT } from '@/data/workouts/catalog';
import type { CatalogExercise } from '@/data/workouts/types';
import { t } from '@/i18n';
import { FINE, ff } from '@/theme/fine';

const useNative = Platform.OS !== 'web';

// El movimiento en bucle, como un GIF de unos 2 s: alterna la foto del inicio y la del final con un
// fundido corto. Cuando haya clips propios (exerciseMedia → kind 'video'), aquí se reproducirá el vídeo.
export const ExerciseLoop = ({
  exercise,
  size,
  width,
  playing = true,
  radius = 12,
  showProvisional = false,
  style,
}: {
  exercise: CatalogExercise;
  size?: number; // miniatura cuadrada
  width?: number | `${number}%`; // ancho con la proporción de la foto
  playing?: boolean;
  radius?: number;
  showProvisional?: boolean; // etiqueta "Imagen provisional" en las vistas grandes
  style?: ViewStyle;
}) => {
  const media = exerciseMedia(exercise);
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!playing || media.frames.length < 2) {
      fade.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(650),
        Animated.timing(fade, { toValue: 1, duration: 280, useNativeDriver: useNative }),
        Animated.delay(650),
        Animated.timing(fade, { toValue: 0, duration: 280, useNativeDriver: useNative }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [playing, fade, media.frames.length]);

  const box: ViewStyle = size ? { width: size, height: size } : { width: width ?? '100%', aspectRatio: MEDIA_ASPECT };

  return (
    <View style={[styles.box, box, { borderRadius: radius }, style]} accessibilityRole="image" accessibilityLabel={exerciseName(exercise)}>
      <Image source={{ uri: media.frames[0] }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" transition={150} />
      {media.frames[1] ? (
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: fade }]}>
          <Image source={{ uri: media.frames[1] }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" transition={0} />
        </Animated.View>
      ) : null}
      {showProvisional ? (
        <View style={styles.tag}>
          <Text style={styles.tagText}>{t('Provisional image')}</Text>
        </View>
      ) : null}
    </View>
  );
};

// Lenguaje fino (2026-11-16): mientras carga, un fondo casi transparente; la etiqueta «Imagen provisional», una
// píldora oscura con borde fino y la letra en marfil
const styles = StyleSheet.create({
  box: { overflow: 'hidden', backgroundColor: FINE.tile },
  tag: {
    position: 'absolute',
    left: 8,
    bottom: 8,
    backgroundColor: 'rgba(6,26,22,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(240,239,230,0.14)',
    borderRadius: 20,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  tagText: { ...ff('regular'), color: '#F0EFE6', fontSize: 10.5, letterSpacing: 0.2 },
});

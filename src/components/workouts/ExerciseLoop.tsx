import React, { useEffect, useRef } from 'react';
import { Animated, Platform, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { Colors } from '@/constants/colors';
import { exerciseMedia, exerciseName, MEDIA_ASPECT } from '@/data/workouts/catalog';
import type { CatalogExercise } from '@/data/workouts/types';
import { t } from '@/i18n';

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

const styles = StyleSheet.create({
  box: { overflow: 'hidden', backgroundColor: Colors.cardBorder },
  tag: { position: 'absolute', left: 8, bottom: 8, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  tagText: { color: '#FFFFFF', fontSize: 10, fontWeight: '700' },
});

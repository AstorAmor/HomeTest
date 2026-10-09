import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Transición al cambiar el tema o el idioma. Los estilos de cada pantalla se calculan al cargar
// la app, así que cambiar de tema exige recargarla. Para que no se note:
// 1. Antes de recargar, la pantalla se funde suavemente al color de fondo del tema nuevo.
// 2. Se recuerda ese color; al volver a arrancar, la app aparece debajo de ese mismo color y
//    el velo se desvanece. Se vuelve a la misma pantalla (ver appearance.ts).
// En la web, public/index.html pinta el fondo del tema antes de que cargue el JavaScript.

const KEY = 'appearance.fade.v1';
const FADE_OUT_MS = 240;
const FADE_IN_MS = 420;

let fadeTo: ((color: string) => Promise<void>) | null = null;

// Funde la pantalla al color dado y lo recuerda para el próximo arranque
export async function fadeBeforeReload(color: string) {
  try {
    await AsyncStorage.setItem(KEY, color);
  } catch {
    // sin almacenamiento: la recarga sigue funcionando, solo sin el velo de entrada
  }
  await fadeTo?.(color);
}

// Color pendiente del cambio anterior (se consume una sola vez)
export async function takePendingFade(): Promise<string | null> {
  try {
    const v = await AsyncStorage.getItem(KEY);
    if (v) await AsyncStorage.removeItem(KEY);
    return v;
  } catch {
    return null;
  }
}

// Velo a pantalla completa por encima de la app. `initial` = color con el que arranca opaco
// (venimos de un cambio de tema); `ready` = la app ya está montada y se puede desvelar.
export function ThemeVeil({ initial, ready }: { initial: string | null; ready: boolean }) {
  const [color, setColor] = useState(initial ?? 'transparent');
  const opacity = useRef(new Animated.Value(initial ? 1 : 0)).current;

  useEffect(() => {
    fadeTo = (c: string) =>
      new Promise<void>((resolve) => {
        setColor(c);
        Animated.timing(opacity, { toValue: 1, duration: FADE_OUT_MS, useNativeDriver: false }).start(() => resolve());
      });
    return () => {
      fadeTo = null;
    };
  }, [opacity]);

  useEffect(() => {
    if (!ready || !initial) return;
    // Un respiro para que la primera pantalla se pinte debajo del velo
    const t = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: FADE_IN_MS, useNativeDriver: false }).start();
    }, 260);
    return () => clearTimeout(t);
  }, [ready, initial, opacity]);

  return <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: color, opacity, zIndex: 999999 }]} />;
}

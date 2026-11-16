// Punto de entrada propio (en vez de expo-router/entry): aplica la paleta clara u
// oscura ANTES de cargar las rutas. Los estilos de cada pantalla se calculan al
// cargar su módulo, así que el tema tiene que estar puesto antes de requerirlas.
// `@expo/metro-runtime` debe ser lo primero (Fast Refresh en web).
import '@expo/metro-runtime';

import React, { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { renderRootComponent } from 'expo-router/build/renderRootComponent';
import { loadAppearance } from './src/theme/appearance';
import { takePendingFade, ThemeVeil } from './src/theme/transition';
import { loadTextSize } from './src/theme/textSize';
import { loadLanguage } from './src/i18n';
import { Colors } from './src/constants/colors';
import { LaunchIntro } from './src/components/LaunchIntro';
import * as Font from 'expo-font';

// Inter, la letra del prototipo de las 4 pestañas (src/theme/fine.ts): solo los cuatro pesos que se usan, cada uno
// por su ruta (el índice del paquete arrastraría los 18 archivos a cada OTA). Se espera a que esté antes de
// pintar, como el tema, para que no cambie la letra a la vista; si falla, sale la del sistema.
const loadFonts = () =>
  Font.loadAsync({
    Inter_300Light: require('@expo-google-fonts/inter/300Light/Inter_300Light.ttf'),
    Inter_400Regular: require('@expo-google-fonts/inter/400Regular/Inter_400Regular.ttf'),
    Inter_500Medium: require('@expo-google-fonts/inter/500Medium/Inter_500Medium.ttf'),
    Inter_600SemiBold: require('@expo-google-fonts/inter/600SemiBold/Inter_600SemiBold.ttf'),
  });

SplashScreen.preventAutoHideAsync();

const showIntro =
  Platform.OS !== 'web' || (typeof window !== 'undefined' && /[?&]intro=1/.test(window.location?.search ?? ''));

function Root() {
  const [App, setApp] = useState(null);
  // undefined = cargando; null = arranque normal; color = venimos de cambiar el tema
  const [veil, setVeil] = useState(undefined);

  useEffect(() => {
    Promise.all([
      loadAppearance().catch(() => undefined),
      loadLanguage().catch(() => undefined),
      loadTextSize().catch(() => undefined),
      takePendingFade(),
      loadFonts().catch(() => undefined),
    ]).then(([, , , fade]) => {
      setVeil(fade);
      // require() tardío: las rutas (y sus StyleSheet) se evalúan ya con el tema aplicado.
      const { App: RouterApp } = require('expo-router/build/qualified-entry');
      setApp(() => RouterApp);
    });
  }, []);

  if (veil === undefined) return null;
  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      {App ? <App /> : null}
      {/* Entrada con la marca al abrir en frío (no tras cambiar el tema; en la web solo con ?intro=1) */}
      {App && veil === null && showIntro ? <LaunchIntro /> : null}
      <ThemeVeil initial={veil} ready={!!App} />
    </View>
  );
}

renderRootComponent(Root);

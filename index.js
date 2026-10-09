// Punto de entrada propio (en vez de expo-router/entry): aplica la paleta clara u
// oscura ANTES de cargar las rutas. Los estilos de cada pantalla se calculan al
// cargar su módulo, así que el tema tiene que estar puesto antes de requerirlas.
// `@expo/metro-runtime` debe ser lo primero (Fast Refresh en web).
import '@expo/metro-runtime';

import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { renderRootComponent } from 'expo-router/build/renderRootComponent';
import { loadAppearance } from './src/theme/appearance';
import { takePendingFade, ThemeVeil } from './src/theme/transition';
import { loadTextSize } from './src/theme/textSize';
import { loadLanguage } from './src/i18n';
import { Colors } from './src/constants/colors';

SplashScreen.preventAutoHideAsync();

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
      <ThemeVeil initial={veil} ready={!!App} />
    </View>
  );
}

renderRootComponent(Root);

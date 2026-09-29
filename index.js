// Punto de entrada propio (en vez de expo-router/entry): aplica la paleta clara u
// oscura ANTES de cargar las rutas. Los estilos de cada pantalla se calculan al
// cargar su módulo, así que el tema tiene que estar puesto antes de requerirlas.
// `@expo/metro-runtime` debe ser lo primero (Fast Refresh en web).
import '@expo/metro-runtime';

import React, { useEffect, useState } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import { renderRootComponent } from 'expo-router/build/renderRootComponent';
import { loadAppearance } from './src/theme/appearance';

SplashScreen.preventAutoHideAsync();

function Root() {
  const [App, setApp] = useState(null);

  useEffect(() => {
    loadAppearance()
      .catch(() => undefined)
      .finally(() => {
        // require() tardío: las rutas (y sus StyleSheet) se evalúan ya con el tema aplicado.
        const { App: RouterApp } = require('expo-router/build/qualified-entry');
        setApp(() => RouterApp);
      });
  }, []);

  return App ? <App /> : null;
}

renderRootComponent(Root);

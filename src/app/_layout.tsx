import { DarkTheme, ThemeProvider, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AuthProvider } from '@/context/AuthContext';
import { Colors } from '@/constants/colors';

SplashScreen.preventAutoHideAsync();

// Transiciones: todas las pantallas de detalle entran y salen con la misma
// animación lateral (ios_from_right), así "atrás" es el reflejo exacto de "adelante"
// en Android e iOS. Los modales de registro suben y bajan (slide_from_bottom).
// contentStyle con el fondo de la app evita el destello blanco durante la animación.
const MODAL = { presentation: 'modal', animation: 'slide_from_bottom' } as const;

export default function Layout() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={DarkTheme}>
        <AuthProvider>
          <StatusBar style="light" />
          <Stack
            screenOptions={{
              headerShown: false,
              animation: 'ios_from_right',
              gestureEnabled: true,
              fullScreenGestureEnabled: true,
              contentStyle: { backgroundColor: Colors.background },
            }}
          >
            <Stack.Screen name="index" options={{ animation: 'none' }} />
            <Stack.Screen name="login" options={{ animation: 'none' }} />
            <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
            <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
            <Stack.Screen name="results-ready" options={{ animation: 'fade' }} />
            <Stack.Screen name="upload-test" options={MODAL} />
            <Stack.Screen name="log-glucose" options={MODAL} />
            <Stack.Screen name="log-blood-pressure" options={MODAL} />
            <Stack.Screen name="log-cholesterol" options={MODAL} />
            <Stack.Screen name="log-cortisol" options={MODAL} />
            <Stack.Screen name="log-cycle" options={MODAL} />
            <Stack.Screen name="check-in" options={MODAL} />
            <Stack.Screen name="log-workout" options={MODAL} />
            <Stack.Screen name="log-meal" options={MODAL} />
            <Stack.Screen name="blood-pressure-detail" />
            <Stack.Screen name="glucose-detail" />
            <Stack.Screen name="cholesterol-detail" />
            <Stack.Screen name="cortisol-detail" />
            <Stack.Screen name="cycle-detail" />
            <Stack.Screen name="catalogo" />
            <Stack.Screen name="report-intro" />
            <Stack.Screen name="report-summary" />
            <Stack.Screen name="report-marker-detail" />
            <Stack.Screen name="report-plan" />
            <Stack.Screen name="talk-to-specialist" />
            <Stack.Screen name="wearables" />
            <Stack.Screen name="upcoming-analysis" />
            <Stack.Screen name="lab-report" />
            <Stack.Screen name="professionals" />
            <Stack.Screen name="professional-detail" />
            <Stack.Screen name="track-tests" />
            <Stack.Screen name="profile" />
          </Stack>
        </AuthProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

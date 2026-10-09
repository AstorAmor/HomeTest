import { DarkTheme, DefaultTheme, ThemeProvider, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AuthProvider } from '@/context/AuthContext';
import { DevInspector } from '@/components/dev/DevInspector';
import { Colors } from '@/constants/colors';

// La pantalla de carga se mantiene desde index.js (donde se aplica el tema).

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
      <ThemeProvider value={Colors.isLight ? DefaultTheme : DarkTheme}>
        <AuthProvider>
          <StatusBar style={Colors.isLight ? 'dark' : 'light'} />
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
            <Stack.Screen name="log-bowel" options={MODAL} />
            <Stack.Screen name="log-urine" options={MODAL} />
            <Stack.Screen name="log-temperature" options={MODAL} />
            <Stack.Screen name="cycle-goal" options={MODAL} />
            <Stack.Screen name="medication-setup" options={MODAL} />
            <Stack.Screen name="blood-pressure-detail" />
            <Stack.Screen name="glucose-detail" />
            <Stack.Screen name="cholesterol-detail" />
            <Stack.Screen name="cortisol-detail" />
            <Stack.Screen name="cycle-detail" />
            <Stack.Screen name="digestive" />
            <Stack.Screen name="notifications" />
            <Stack.Screen name="simulation" />
            <Stack.Screen name="case-builder" />
            <Stack.Screen name="medications" />
            <Stack.Screen name="evidence" />
            <Stack.Screen name="feature-guide" />
            <Stack.Screen name="catalogo" />
            <Stack.Screen name="report-intro" />
            <Stack.Screen name="report-summary" />
            <Stack.Screen name="report-marker-detail" />
            <Stack.Screen name="report-plan" />
            <Stack.Screen name="habits" />
            <Stack.Screen name="app-sections" />
            <Stack.Screen name="talk-to-specialist" />
            <Stack.Screen name="wearables" />
            <Stack.Screen name="upcoming-analysis" />
            <Stack.Screen name="lab-report" />
            <Stack.Screen name="professionals" />
            <Stack.Screen name="professional-detail" />
            <Stack.Screen name="track-tests" />
            <Stack.Screen name="profile" />
            <Stack.Screen name="sharing" />
            <Stack.Screen name="share-new" />
            <Stack.Screen name="admin" />
            <Stack.Screen name="pro" options={{ animation: 'fade' }} />
            <Stack.Screen name="pro-patient" />
            <Stack.Screen name="pro-profile" />
            <Stack.Screen name="plan-intro" options={{ animation: 'fade' }} />
            <Stack.Screen name="exercise" options={{ presentation: 'modal', animation: 'fade' }} />
            <Stack.Screen name="metric" />
            <Stack.Screen name="store" />
            <Stack.Screen name="schedule" />
            <Stack.Screen name="checkout" />
            <Stack.Screen name="book-lab" />
            <Stack.Screen name="plans" />
            <Stack.Screen name="action-plan" />
            <Stack.Screen name="progress" />
            <Stack.Screen name="plan-update" />
            <Stack.Screen name="pro-patients" options={{ animation: 'fade' }} />
            <Stack.Screen name="pro-inbox" options={{ animation: 'fade' }} />
            <Stack.Screen name="pro-settings" options={{ animation: 'fade' }} />
            <Stack.Screen name="pro-room" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
            <Stack.Screen name="pro-plan" />
            <Stack.Screen name="chat" />
            <Stack.Screen name="consult-book" />
            <Stack.Screen name="consult-request" />
            <Stack.Screen name="learn" />
            <Stack.Screen name="video" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
          </Stack>
          {/* Modo "Señalar" para anotar cambios de diseño (solo web, ver DevInspector.web.tsx) */}
          <DevInspector />
        </AuthProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

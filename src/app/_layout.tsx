import { DarkTheme, DefaultTheme, ThemeProvider, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, type ReactElement } from 'react';
import { Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AuthProvider } from '@/context/AuthContext';
import { DevInspector } from '@/components/dev/DevInspector';
import { Colors } from '@/constants/colors';
import { WebShell } from '@/components/web/WebShell';
import { PhoneReminders } from '@/components/PhoneReminders';
import { PermissionsIntro } from '@/components/PermissionsIntro';
import { MfaGuard } from '@/components/MfaGuard';
import { AppLock } from '@/components/AppLock';
import { markAppReady } from '@/components/LaunchIntro';
import { ScreenBackdrop } from '@/components/AmbientBackground';

// La pantalla de carga se mantiene desde index.js (donde se aplica el tema).

// Transiciones: todas las pantallas de detalle entran y salen con la misma
// animación lateral (ios_from_right), así "atrás" es el reflejo exacto de "adelante"
// en Android e iOS. Los modales de registro suben y bajan (slide_from_bottom).
// contentStyle con el fondo de la app evita el destello blanco durante la animación.
//
// Android (fundador, 2026-11-09: volver atrás desde Historia clínica iba a saltos): react-native-screens suelta
// del todo la pantalla de debajo en cuanto otra opaca la tapa, y al volver la tiene que pintar entera otra vez
// (las cinco pestañas y cada gráfica SVG, que tira su dibujo al soltarse) dentro de una animación de 200 ms.
// Con las pantallas de encima en 'transparentModal' (por fuera iguales: llevan el mismo fondo opaco) la de
// debajo se queda puesta y ya pintada, y «atrás» solo desliza la de arriba. Las de base (arranque, login,
// pestañas, onboarding y portal del especialista) siguen en 'card' para no dejar nada viejo debajo.
// En iOS y en la web no cambia nada.
const OVER = Platform.OS === 'android' ? 'transparentModal' : undefined;

// Fondo ambiental (degradado) debajo de cada pantalla, que tienen el suyo transparente (2026-11-16)
const withBackdrop = ({ children }: { children: ReactElement }) => <ScreenBackdrop>{children}</ScreenBackdrop>;
const BASE = { presentation: 'card' } as const;
const MODAL = { presentation: OVER ?? 'modal', animation: 'slide_from_bottom' } as const;

export default function Layout() {
  useEffect(() => {
    // Con la entrada (LaunchIntro) la nativa ya se ha ido; esto cubre la web y el arranque tras cambiar el tema
    SplashScreen.hideAsync();
    // La entrada se va cuando ya está puesta la primera pantalla de verdad (el log-in, las pestañas o el selector
    // de la demo llaman a markAppReady al montarse). Esto, por si se abre en otra (un enlace): como mucho 2,5 s
    const id = setTimeout(markAppReady, 2500);
    return () => clearTimeout(id);
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={Colors.isLight ? DefaultTheme : DarkTheme}>
        <AuthProvider>
          <StatusBar style={Colors.isLight ? 'dark' : 'light'} />
          {/* Web del paciente en escritorio (?web=1): menú lateral + columna; en la app no cambia nada */}
          {/* Doble factor pendiente (admins, profesionales y quien lo active): antes que cualquier pantalla */}
          <MfaGuard>
          <WebShell>
          <Stack
            screenLayout={withBackdrop}
            screenOptions={{
              headerShown: false,
              presentation: OVER,
              animation: 'ios_from_right',
              gestureEnabled: true,
              fullScreenGestureEnabled: true,
              contentStyle: { backgroundColor: Colors.background },
            }}
          >
            <Stack.Screen name="index" options={{ ...BASE, animation: 'none' }} />
            <Stack.Screen name="login" options={{ ...BASE, animation: 'none' }} />
            <Stack.Screen name="(tabs)" options={{ ...BASE, animation: 'fade' }} />
            <Stack.Screen name="onboarding" options={{ ...BASE, animation: 'fade' }} />
            <Stack.Screen name="results-ready" options={{ animation: 'fade' }} />
            <Stack.Screen name="upload-test" options={MODAL} />
            <Stack.Screen name="log-glucose" options={MODAL} />
            <Stack.Screen name="log-blood-pressure" options={MODAL} />
            <Stack.Screen name="log-cholesterol" options={MODAL} />
            <Stack.Screen name="log-cortisol" options={MODAL} />
            <Stack.Screen name="log-vo2max" options={MODAL} />
            <Stack.Screen name="log-grip-strength" options={MODAL} />
            <Stack.Screen name="log-weight" options={MODAL} />
            <Stack.Screen name="log-measurements" options={MODAL} />
            <Stack.Screen name="daily-goals" options={MODAL} />
            <Stack.Screen name="log-cycle" options={MODAL} />
            <Stack.Screen name="check-in" options={MODAL} />
            <Stack.Screen name="log-workout" options={MODAL} />
            <Stack.Screen name="log-meal" options={MODAL} />
            <Stack.Screen name="log-bowel" options={MODAL} />
            <Stack.Screen name="log-digestion" options={MODAL} />
            <Stack.Screen name="gut-safety" options={MODAL} />
            <Stack.Screen name="log-urine" options={MODAL} />
            <Stack.Screen name="log-water" options={MODAL} />
            <Stack.Screen name="log-steps" options={MODAL} />
            <Stack.Screen name="log-sleep" options={MODAL} />
            <Stack.Screen name="log-symptom" options={MODAL} />
            <Stack.Screen name="volume-check" options={MODAL} />
            <Stack.Screen name="log-temperature" options={MODAL} />
            <Stack.Screen name="cycle-goal" options={MODAL} />
            <Stack.Screen name="know-your-roots" options={MODAL} />
            <Stack.Screen name="medication-setup" options={MODAL} />
            <Stack.Screen name="blood-pressure-detail" />
            <Stack.Screen name="glucose-detail" />
            <Stack.Screen name="cholesterol-detail" />
            <Stack.Screen name="cortisol-detail" />
            <Stack.Screen name="vo2max-detail" />
            <Stack.Screen name="grip-strength-detail" />
            <Stack.Screen name="weight-detail" />
            <Stack.Screen name="cycle-detail" />
            <Stack.Screen name="digestive" />
            <Stack.Screen name="gut-insights" />
            <Stack.Screen name="notifications" />
            <Stack.Screen name="simulation" />
            <Stack.Screen name="case-builder" />
            <Stack.Screen name="medications" />
            <Stack.Screen name="medication-history" />
            <Stack.Screen name="evidence" />
            <Stack.Screen name="feature-guide" />
            <Stack.Screen name="catalogo" />
            <Stack.Screen name="report-intro" />
            <Stack.Screen name="report-summary" />
            <Stack.Screen name="biological-age" />
            <Stack.Screen name="report-marker-detail" />
            <Stack.Screen name="report-plan" />
            <Stack.Screen name="habits" />
            <Stack.Screen name="your-days" />
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
            <Stack.Screen name="support" />
            <Stack.Screen name="pro" options={{ ...BASE, animation: 'fade' }} />
            <Stack.Screen name="pro-patient" />
            <Stack.Screen name="pro-profile" />
            <Stack.Screen name="plan-intro" options={{ animation: 'fade' }} />
            <Stack.Screen name="exercise" options={{ ...MODAL, animation: 'fade' }} />
            <Stack.Screen name="metric" />
            <Stack.Screen name="store" />
            <Stack.Screen name="test-finder" />
            <Stack.Screen name="schedule" />
            <Stack.Screen name="checkout" />
            <Stack.Screen name="book-lab" />
            <Stack.Screen name="lab-appointment" />
            <Stack.Screen name="plans" />
            <Stack.Screen name="action-plan" />
            <Stack.Screen name="progress" />
            <Stack.Screen name="plan-update" />
            <Stack.Screen name="pro-patients" options={{ animation: 'fade' }} />
            <Stack.Screen name="pro-inbox" options={{ animation: 'fade' }} />
            <Stack.Screen name="pro-settings" options={{ animation: 'fade' }} />
            <Stack.Screen name="pro-templates" options={{ animation: 'fade' }} />
            <Stack.Screen name="pro-room" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
            <Stack.Screen name="pro-plan" />
            <Stack.Screen name="chat" />
            <Stack.Screen name="consult-book" />
            <Stack.Screen name="consult-request" />
            <Stack.Screen name="learn" />
            <Stack.Screen name="video" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
            <Stack.Screen name="resumen" options={{ ...BASE, animation: 'none' }} />
            <Stack.Screen name="security" />
          </Stack>
          </WebShell>
          </MfaGuard>
          {/* Modo "Señalar" para anotar cambios de diseño (solo web, ver DevInspector.web.tsx) */}
          <DevInspector />
          {/* Recordatorios del móvil con la app cerrada (solo con un APK que lleve expo-notifications) */}
          <PhoneReminders />
          <PermissionsIntro />
          {/* Bloqueo con Face ID / huella (Ajustes): por encima de todo, también del doble factor */}
          <AppLock />
        </AuthProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

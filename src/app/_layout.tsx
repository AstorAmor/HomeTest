import { DarkTheme, ThemeProvider, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AuthProvider } from '@/context/AuthContext';

SplashScreen.preventAutoHideAsync();

export default function Layout() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={DarkTheme}>
        <AuthProvider>
          <StatusBar style="light" />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" options={{ animationEnabled: false }} />
            <Stack.Screen name="login" options={{ animationEnabled: false }} />
            <Stack.Screen name="(tabs)" options={{ animationEnabled: false }} />
            <Stack.Screen name="upload-test" options={{ presentation: 'modal' }} />
            <Stack.Screen name="log-glucose" options={{ presentation: 'modal' }} />
            <Stack.Screen name="log-blood-pressure" options={{ presentation: 'modal' }} />
            <Stack.Screen name="log-cholesterol" options={{ presentation: 'modal' }} />
            <Stack.Screen name="log-cortisol" options={{ presentation: 'modal' }} />
            <Stack.Screen name="log-cycle" options={{ presentation: 'modal' }} />
            <Stack.Screen name="blood-pressure-detail" />
            <Stack.Screen name="glucose-detail" />
            <Stack.Screen name="cholesterol-detail" />
            <Stack.Screen name="cortisol-detail" />
            <Stack.Screen name="cycle-detail" />
            <Stack.Screen name="catalogo" />
          </Stack>
        </AuthProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

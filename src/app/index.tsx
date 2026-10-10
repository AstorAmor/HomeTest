import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { takeAppearanceReturnTo } from '@/theme/appearance';
import { useAuth } from '@/context/AuthContext';
import { LoginScreen } from '@/screens/LoginScreen';
import { DevModeSelectScreen } from '@/screens/DevModeSelectScreen';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { Colors } from '@/constants/colors';
import { useWebShell } from '@/web/webMode';

export default function RootIndex() {
  const { isLoggedIn, demoMode, initializing, professional } = useAuth();
  const params = useLocalSearchParams<{ tab?: string }>();
  const webShell = useWebShell();
  // Tras cambiar el tema la app se recarga: volver a donde estabas (undefined = leyendo)
  const [returnTo, setReturnTo] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    takeAppearanceReturnTo().then(setReturnTo);
  }, []);

  // Mientras se recupera la sesión guardada, pantalla vacía (evita un parpadeo del login)
  if (initializing || returnTo === undefined) {
    return <View style={{ flex: 1, backgroundColor: Colors.background }} />;
  }

  if (!isLoggedIn) {
    return <LoginScreen />;
  }

  // Los profesionales tienen su propia interfaz (pacientes que les comparten datos)
  if (professional || demoMode === 'pro') {
    return <Redirect href="/pro" />;
  }

  // Selector "developer" tras el login: nuevo usuario / resultados / habitual
  if (!demoMode) {
    return <DevModeSelectScreen />;
  }

  // Volver a una pestaña concreta ("/(tabs)?tab=3") o a otra pantalla guardada
  const tabFromReturn = returnTo?.startsWith('/(tabs)') ? (returnTo.match(/[?&]tab=(\d)/)?.[1] ?? null) : null;
  if (returnTo && !returnTo.startsWith('/(tabs)')) return <Redirect href={returnTo as any} />;
  const tab = tabFromReturn ?? params.tab;
  // Web del paciente en escritorio: se entra por el resumen (estilo Salud de Apple)
  if (webShell && !tab) return <Redirect href="/resumen" />;
  return <Redirect href={tab ? { pathname: '/(tabs)', params: { tab } } : '/(tabs)'} />;
}

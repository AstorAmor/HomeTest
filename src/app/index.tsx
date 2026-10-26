import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { takeAppearanceReturnTo } from '@/theme/appearance';
import { useAuth } from '@/context/AuthContext';
import { LoginScreen } from '@/screens/LoginScreen';
import { DevModeSelectScreen } from '@/screens/DevModeSelectScreen';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { Colors } from '@/constants/colors';
import { useWebShell } from '@/web/webMode';
import { type ActiveWorkout, isFreshWorkout, loadActiveWorkout } from '@/data/workouts/activeWorkout';

// Solo la primera vez que se pasa por aquí tras abrir la app: luego «/» es la portada de siempre
let resumeChecked = false;

export default function RootIndex() {
  const { isLoggedIn, demoMode, initializing, professional, realAccount } = useAuth();
  const params = useLocalSearchParams<{ tab?: string }>();
  const webShell = useWebShell();
  // Tras cambiar el tema la app se recarga: volver a donde estabas (undefined = leyendo)
  const [returnTo, setReturnTo] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    takeAppearanceReturnTo().then(setReturnTo);
  }, []);
  // Un entreno a medias (Android cerró la app con la pantalla bloqueada): se vuelve a él. Se mira con
  // la sesión ya recuperada, porque es de un usuario (undefined = leyendo)
  const [workout, setWorkout] = useState<ActiveWorkout | null | undefined>(resumeChecked ? null : undefined);
  useEffect(() => {
    if (initializing || resumeChecked) return;
    resumeChecked = true;
    loadActiveWorkout().then((w) => setWorkout(w && isFreshWorkout(w) ? w : null));
  }, [initializing]);

  // Mientras se recupera la sesión guardada, pantalla vacía (evita un parpadeo del login)
  if (initializing || returnTo === undefined || workout === undefined) {
    return <View style={{ flex: 1, backgroundColor: Colors.background }} />;
  }

  if (!isLoggedIn) {
    return <LoginScreen />;
  }

  // Los profesionales tienen su propia interfaz (pacientes que les comparten datos)
  if (professional || demoMode === 'pro') {
    return <Redirect href="/pro" />;
  }

  // Selector "developer" tras el login: nuevo usuario / resultados / habitual. Una cuenta real no
  // tiene "momentos" de demo: entra como un día normal.
  if (!demoMode && !realAccount) {
    return <DevModeSelectScreen />;
  }

  // Volver a una pestaña concreta ("/(tabs)?tab=2", ver src/constants/tabs.ts) o a otra pantalla guardada
  const tabFromReturn = returnTo?.startsWith('/(tabs)') ? (returnTo.match(/[?&]tab=(\d)/)?.[1] ?? null) : null;
  if (returnTo && !returnTo.startsWith('/(tabs)')) return <Redirect href={returnTo as any} />;
  if (workout && !returnTo) return <Redirect href={{ pathname: '/workout-session', params: { program: workout.programId, session: workout.session.id } }} />;
  const tab = tabFromReturn ?? params.tab;
  // Web del paciente en escritorio: se entra por el resumen (estilo Salud de Apple)
  if (webShell && !tab) return <Redirect href="/resumen" />;
  return <Redirect href={tab ? { pathname: '/(tabs)', params: { tab } } : '/(tabs)'} />;
}

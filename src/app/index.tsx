import { View } from 'react-native';
import { useAuth } from '@/context/AuthContext';
import { LoginScreen } from '@/screens/LoginScreen';
import { DevModeSelectScreen } from '@/screens/DevModeSelectScreen';
import { Redirect } from 'expo-router';
import { Colors } from '@/constants/colors';

export default function RootIndex() {
  const { isLoggedIn, demoMode, initializing } = useAuth();

  // Mientras se recupera la sesión guardada, pantalla vacía (evita un parpadeo del login)
  if (initializing) {
    return <View style={{ flex: 1, backgroundColor: Colors.background }} />;
  }

  if (!isLoggedIn) {
    return <LoginScreen />;
  }

  // Selector "developer" tras el login: nuevo usuario / resultados / habitual
  if (!demoMode) {
    return <DevModeSelectScreen />;
  }

  return <Redirect href="/(tabs)" />;
}

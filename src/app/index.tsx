import { useAuth } from '@/context/AuthContext';
import { LoginScreen } from '@/screens/LoginScreen';
import { DevModeSelectScreen } from '@/screens/DevModeSelectScreen';
import { Redirect } from 'expo-router';

export default function RootIndex() {
  const { isLoggedIn, demoMode } = useAuth();

  if (!isLoggedIn) {
    return <LoginScreen />;
  }

  // Selector "developer" tras el login: nuevo usuario / resultados / habitual
  if (!demoMode) {
    return <DevModeSelectScreen />;
  }

  return <Redirect href="/(tabs)" />;
}
